import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'
import type { SavedBattleSession } from './save-state'
import {
  DEFAULT_PLAYER_DATA_MIGRATION_PLAN,
  getPlayerDataSchemaVersion,
  migratePlayerDataToCurrent,
  type AppliedPlayerDataMigration,
  type PlayerDataMigrationPlan,
} from './save-migration'
import {
  MAX_SAVE_BACKUP_GENERATIONS,
  SAVE_SLOT_IDS,
  createCommittedSaveGeneration,
  createEmptySaveSlotSummary,
  createSaveGenerationRecord,
  createSaveSlotSummary,
  validateSaveGenerationEnvelope,
  validateSaveGenerationRecord,
  type SaveGenerationRecord,
  type SaveSlotId,
  type SaveSlotPointer,
  type SaveSlotSummary,
} from './save-model'

export interface SaveRepository {
  putTemporaryGeneration(record: SaveGenerationRecord): Promise<void>
  readGeneration(generationId: string): Promise<SaveGenerationRecord | null>
  readSlotPointer(slotId: SaveSlotId): Promise<SaveSlotPointer | null>
  listSlotPointers(): Promise<readonly SaveSlotPointer[]>
  commitTemporaryGeneration(input: {
    readonly slotId: SaveSlotId
    readonly generationId: string
    readonly maximumBackupGenerations: number
    readonly preferredBackupGenerationId?: string
  }): Promise<SaveSlotPointer>
  deleteGeneration(generationId: string): Promise<void>
  deleteSlot(slotId: SaveSlotId): Promise<void>
}

export interface SavePlayerDataAtomicInput {
  readonly slotId: SaveSlotId
  readonly generationId: string
  readonly savedAtEpochMs: number
  readonly preferredBackupGenerationId?: string
  readonly activeBattle?: SavedBattleSession | null
}

export interface SavePlayerDataAtomicResult {
  readonly playerData: PlayerData
  readonly record: SaveGenerationRecord
  readonly pointer: SaveSlotPointer
  readonly activeBattle: SavedBattleSession | null
}

export interface SaveSlotMigrationReceipt {
  readonly sourceGenerationId: string
  readonly backupGenerationId: string
  readonly fromSchemaVersion: number
  readonly toSchemaVersion: number
  readonly appliedMigrations: readonly AppliedPlayerDataMigration[]
}

export interface LoadSaveSlotResult {
  readonly playerData: PlayerData
  readonly record: SaveGenerationRecord
  readonly pointer: SaveSlotPointer
  readonly recoveredFromBackup: boolean
  readonly migration: SaveSlotMigrationReceipt | null
  readonly activeBattle: SavedBattleSession | null
}

export interface LoadSaveSlotOptions {
  readonly migrationPlan?: PlayerDataMigrationPlan
  readonly now?: () => number
  readonly createMigrationGenerationId?: (input: {
    readonly slotId: SaveSlotId
    readonly savedAtEpochMs: number
    readonly sourceGenerationId: string
    readonly fromSchemaVersion: number
    readonly toSchemaVersion: number
  }) => string
}

let migrationGenerationSequence = 0

function createDefaultMigrationGenerationId(input: {
  readonly slotId: SaveSlotId
  readonly savedAtEpochMs: number
  readonly sourceGenerationId: string
  readonly fromSchemaVersion: number
  readonly toSchemaVersion: number
}): string {
  migrationGenerationSequence += 1
  return `${input.slotId}:migration:${input.savedAtEpochMs}:${input.fromSchemaVersion}-${input.toSchemaVersion}:${migrationGenerationSequence}`
}

export async function savePlayerDataAtomic(
  repository: SaveRepository,
  playerData: PlayerData,
  catalog: PlayerDataContentCatalog,
  input: SavePlayerDataAtomicInput,
): Promise<SavePlayerDataAtomicResult> {
  const temporary = createSaveGenerationRecord(
    {
      generationId: input.generationId,
      slotId: input.slotId,
      savedAtEpochMs: input.savedAtEpochMs,
      playerData,
      activeBattle: input.activeBattle ?? null,
      state: 'TEMPORARY',
    },
    catalog,
  )
  let committed = false
  await repository.putTemporaryGeneration(temporary)
  try {
    const written = await repository.readGeneration(temporary.generationId)
    if (written === null) {
      throw new Error(`temporary save generation disappeared: ${temporary.generationId}`)
    }
    const verified = validateSaveGenerationRecord(written, catalog)
    if (verified.state !== 'TEMPORARY' || verified.slotId !== input.slotId) {
      throw new Error(`temporary save generation identity mismatch: ${temporary.generationId}`)
    }
    const pointer = await repository.commitTemporaryGeneration({
      slotId: input.slotId,
      generationId: temporary.generationId,
      maximumBackupGenerations: MAX_SAVE_BACKUP_GENERATIONS,
      preferredBackupGenerationId: input.preferredBackupGenerationId,
    })
    committed = true
    if (pointer.currentGenerationId !== verified.generationId) {
      throw new Error('save repository committed a different generation')
    }
    const record = createCommittedSaveGeneration(verified)
    return Object.freeze({
      playerData: record.playerData,
      record,
      pointer,
      activeBattle: record.activeBattle ?? null,
    })
  } finally {
    if (!committed) {
      await repository.deleteGeneration(temporary.generationId).catch(() => undefined)
    }
  }
}

function validateCommittedEnvelope(
  record: SaveGenerationRecord,
  slotId: SaveSlotId,
): SaveGenerationRecord {
  const envelope = validateSaveGenerationEnvelope(record)
  if (envelope.state !== 'COMMITTED') throw new Error('not committed')
  if (envelope.slotId !== slotId) throw new Error(`belongs to ${envelope.slotId}`)
  return envelope
}

export async function loadSaveSlot(
  repository: SaveRepository,
  slotId: SaveSlotId,
  catalog: PlayerDataContentCatalog,
  options: LoadSaveSlotOptions = {},
): Promise<LoadSaveSlotResult | null> {
  const pointer = await repository.readSlotPointer(slotId)
  if (pointer === null) return null
  const migrationPlan = options.migrationPlan ?? DEFAULT_PLAYER_DATA_MIGRATION_PLAN
  const now = options.now ?? Date.now
  const createMigrationGenerationId =
    options.createMigrationGenerationId ?? createDefaultMigrationGenerationId
  const generationIds = [pointer.currentGenerationId, ...pointer.backupGenerationIds]
  const failures: string[] = []

  for (let index = 0; index < generationIds.length; index += 1) {
    const generationId = generationIds[index]
    const stored = await repository.readGeneration(generationId)
    if (stored === null) {
      failures.push(`${generationId}: missing`)
      continue
    }
    try {
      const envelope = validateCommittedEnvelope(stored, slotId)
      const sourceSchemaVersion = getPlayerDataSchemaVersion(envelope.playerData)
      if (sourceSchemaVersion === migrationPlan.targetSchemaVersion) {
        const validated = validateSaveGenerationRecord(envelope, catalog)
        return Object.freeze({
          playerData: validated.playerData,
          record: validated,
          pointer,
          recoveredFromBackup: index > 0,
          migration: null,
          activeBattle: validated.activeBattle ?? null,
        })
      }

      const migrated = migratePlayerDataToCurrent(
        envelope.playerData,
        catalog,
        migrationPlan,
      )
      const savedAtEpochMs = now()
      const saved = await savePlayerDataAtomic(
        repository,
        migrated.playerData,
        catalog,
        {
          slotId,
          generationId: createMigrationGenerationId({
            slotId,
            savedAtEpochMs,
            sourceGenerationId: envelope.generationId,
            fromSchemaVersion: migrated.originalSchemaVersion,
            toSchemaVersion: migrationPlan.targetSchemaVersion,
          }),
          savedAtEpochMs,
          preferredBackupGenerationId: envelope.generationId,
          activeBattle: envelope.activeBattle ?? null,
        },
      )
      return Object.freeze({
        playerData: saved.playerData,
        record: saved.record,
        pointer: saved.pointer,
        recoveredFromBackup: index > 0,
        migration: Object.freeze({
          sourceGenerationId: envelope.generationId,
          backupGenerationId: envelope.generationId,
          fromSchemaVersion: migrated.originalSchemaVersion,
          toSchemaVersion: migrationPlan.targetSchemaVersion,
          appliedMigrations: migrated.appliedMigrations,
        }),
        activeBattle: saved.activeBattle,
      })
    } catch (error) {
      failures.push(`${generationId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`save slot ${slotId} has no valid generation (${failures.join('; ')})`)
}

export async function listSaveSlotSummaries(
  repository: SaveRepository,
  catalog: PlayerDataContentCatalog,
  options: LoadSaveSlotOptions = {},
): Promise<readonly SaveSlotSummary[]> {
  const summaries = await Promise.all(
    SAVE_SLOT_IDS.map(async (slotId) => {
      const loaded = await loadSaveSlot(repository, slotId, catalog, options)
      return loaded === null
        ? createEmptySaveSlotSummary(slotId)
        : createSaveSlotSummary({
            pointer: loaded.pointer,
            record: loaded.record,
            recoveredFromBackup: loaded.recoveredFromBackup,
          })
    }),
  )
  return Object.freeze(summaries)
}

export async function deleteSaveSlot(
  repository: SaveRepository,
  slotId: SaveSlotId,
): Promise<void> {
  await repository.deleteSlot(slotId)
}
