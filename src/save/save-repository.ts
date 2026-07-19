import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'
import {
  MAX_SAVE_BACKUP_GENERATIONS,
  SAVE_SLOT_IDS,
  createCommittedSaveGeneration,
  createEmptySaveSlotSummary,
  createSaveGenerationRecord,
  createSaveSlotSummary,
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
}

export interface SavePlayerDataAtomicResult {
  readonly playerData: PlayerData
  readonly record: SaveGenerationRecord
  readonly pointer: SaveSlotPointer
}

export interface LoadSaveSlotResult {
  readonly playerData: PlayerData
  readonly record: SaveGenerationRecord
  readonly pointer: SaveSlotPointer
  readonly recoveredFromBackup: boolean
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
    return Object.freeze({ playerData: record.playerData, record, pointer })
  } finally {
    if (!committed) {
      await repository.deleteGeneration(temporary.generationId).catch(() => undefined)
    }
  }
}

export async function loadSaveSlot(
  repository: SaveRepository,
  slotId: SaveSlotId,
  catalog: PlayerDataContentCatalog,
): Promise<LoadSaveSlotResult | null> {
  const pointer = await repository.readSlotPointer(slotId)
  if (pointer === null) return null
  const generationIds = [pointer.currentGenerationId, ...pointer.backupGenerationIds]
  const failures: string[] = []
  for (let index = 0; index < generationIds.length; index += 1) {
    const generationId = generationIds[index]
    const record = await repository.readGeneration(generationId)
    if (record === null) {
      failures.push(`${generationId}: missing`)
      continue
    }
    try {
      const validated = validateSaveGenerationRecord(record, catalog)
      if (validated.state !== 'COMMITTED') {
        throw new Error('not committed')
      }
      if (validated.slotId !== slotId) {
        throw new Error(`belongs to ${validated.slotId}`)
      }
      return Object.freeze({
        playerData: validated.playerData,
        record: validated,
        pointer,
        recoveredFromBackup: index > 0,
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
): Promise<readonly SaveSlotSummary[]> {
  const summaries = await Promise.all(
    SAVE_SLOT_IDS.map(async (slotId) => {
      const loaded = await loadSaveSlot(repository, slotId, catalog)
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
