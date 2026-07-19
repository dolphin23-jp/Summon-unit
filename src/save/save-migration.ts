import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'
import { createStagePlayerData } from '../progression/stage-reward'
import {
  SAVE_SLOT_IDS,
  createEmptySaveSlotSummary,
  createSaveSlotSummary,
  validateSaveGenerationEnvelope,
  validateSaveGenerationRecord,
  type SaveGenerationRecord,
  type SaveSlotId,
  type SaveSlotSummary,
} from './save-model'
import {
  savePlayerDataAtomic,
  type LoadSaveSlotResult,
  type SaveRepository,
} from './save-repository'

export const CURRENT_PLAYER_DATA_SCHEMA_VERSION = 6

export type JsonObject = Readonly<Record<string, unknown>>

export interface PlayerDataMigrationStep {
  readonly fromVersion: number
  readonly toVersion: number
  readonly migrate: (playerData: JsonObject) => JsonObject
}

export interface PlayerDataMigrationPlan {
  readonly targetSchemaVersion: number
  readonly steps: readonly PlayerDataMigrationStep[]
}

export interface AppliedPlayerDataMigration {
  readonly fromVersion: number
  readonly toVersion: number
}

export interface ApplyPlayerDataMigrationsResult {
  readonly playerData: JsonObject
  readonly originalSchemaVersion: number
  readonly targetSchemaVersion: number
  readonly appliedMigrations: readonly AppliedPlayerDataMigration[]
}

export interface MigratePlayerDataToCurrentResult {
  readonly playerData: PlayerData
  readonly originalSchemaVersion: number
  readonly appliedMigrations: readonly AppliedPlayerDataMigration[]
}

export interface SaveMigrationRuntime {
  readonly plan?: PlayerDataMigrationPlan
  readonly now?: () => number
  readonly createGenerationId: (input: {
    readonly slotId: SaveSlotId
    readonly savedAtEpochMs: number
    readonly sourceGenerationId: string
    readonly fromSchemaVersion: number
    readonly toSchemaVersion: number
  }) => string
}

export interface SaveSlotMigrationReceipt {
  readonly sourceGenerationId: string
  readonly backupGenerationId: string
  readonly fromSchemaVersion: number
  readonly toSchemaVersion: number
  readonly appliedMigrations: readonly AppliedPlayerDataMigration[]
}

export interface LoadSaveSlotWithMigrationResult extends LoadSaveSlotResult {
  readonly migration: SaveSlotMigrationReceipt | null
}

function assertSafeSchemaVersion(value: unknown, field: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${field} must be a positive safe integer`)
  }
}

function assertJsonObject(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`)
  }
}

function cloneJsonObject(value: unknown): Record<string, unknown> {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new Error('playerData must be JSON serializable')
  }
  const cloned: unknown = JSON.parse(serialized)
  assertJsonObject(cloned, 'playerData')
  return cloned
}

export function getPlayerDataSchemaVersion(playerData: unknown): number {
  assertJsonObject(playerData, 'playerData')
  assertSafeSchemaVersion(playerData.schemaVersion, 'playerData.schemaVersion')
  return playerData.schemaVersion
}

export function createPlayerDataMigrationPlan(input: PlayerDataMigrationPlan): PlayerDataMigrationPlan {
  assertSafeSchemaVersion(input.targetSchemaVersion, 'migration targetSchemaVersion')
  const byFromVersion = new Map<number, PlayerDataMigrationStep>()
  for (const step of input.steps) {
    assertSafeSchemaVersion(step.fromVersion, 'migration fromVersion')
    assertSafeSchemaVersion(step.toVersion, 'migration toVersion')
    if (step.toVersion !== step.fromVersion + 1) {
      throw new Error(
        `migration must advance exactly one schema version: ${step.fromVersion} -> ${step.toVersion}`,
      )
    }
    if (step.toVersion > input.targetSchemaVersion) {
      throw new Error(`migration exceeds target schema version: ${step.toVersion}`)
    }
    if (byFromVersion.has(step.fromVersion)) {
      throw new Error(`migration from schema version ${step.fromVersion} is duplicated`)
    }
    byFromVersion.set(step.fromVersion, step)
  }
  return Object.freeze({
    targetSchemaVersion: input.targetSchemaVersion,
    steps: Object.freeze([...byFromVersion.values()].sort((left, right) => left.fromVersion - right.fromVersion)),
  })
}

function addDefaultField(
  playerData: JsonObject,
  nextSchemaVersion: number,
  field: string,
  defaultValue: unknown,
): JsonObject {
  return Object.freeze({
    ...playerData,
    schemaVersion: nextSchemaVersion,
    [field]: playerData[field] ?? defaultValue,
  })
}

export const DEFAULT_PLAYER_DATA_MIGRATION_PLAN = createPlayerDataMigrationPlan({
  targetSchemaVersion: CURRENT_PLAYER_DATA_SCHEMA_VERSION,
  steps: Object.freeze([
    Object.freeze({
      fromVersion: 1,
      toVersion: 2,
      migrate: (playerData: JsonObject) =>
        addDefaultField(playerData, 2, 'economy', {
          currency: 0,
          researchData: 0,
          catalysts: [],
        }),
    }),
    Object.freeze({
      fromVersion: 2,
      toVersion: 3,
      migrate: (playerData: JsonObject) =>
        addDefaultField(playerData, 3, 'research', { nodes: [] }),
    }),
    Object.freeze({
      fromVersion: 3,
      toVersion: 4,
      migrate: (playerData: JsonObject) =>
        addDefaultField(playerData, 4, 'facilities', { researchFacilityStage: 1 }),
    }),
    Object.freeze({
      fromVersion: 4,
      toVersion: 5,
      migrate: (playerData: JsonObject) =>
        addDefaultField(playerData, 5, 'stageProgress', {
          completedStageIds: [],
          settledBattleIds: [],
          regionalPoints: [],
        }),
    }),
    Object.freeze({
      fromVersion: 5,
      toVersion: 6,
      migrate: (playerData: JsonObject) =>
        Object.freeze({ ...playerData, schemaVersion: 6 }),
    }),
  ]),
})

export function applyPlayerDataMigrations(
  input: unknown,
  migrationPlan: PlayerDataMigrationPlan,
): ApplyPlayerDataMigrationsResult {
  const plan = createPlayerDataMigrationPlan(migrationPlan)
  let playerData: JsonObject = Object.freeze(cloneJsonObject(input))
  const originalSchemaVersion = getPlayerDataSchemaVersion(playerData)
  if (originalSchemaVersion > plan.targetSchemaVersion) {
    throw new Error(
      `save schema ${originalSchemaVersion} is newer than supported schema ${plan.targetSchemaVersion}`,
    )
  }

  const stepsByFromVersion = new Map(plan.steps.map((step) => [step.fromVersion, step]))
  const appliedMigrations: AppliedPlayerDataMigration[] = []
  let currentVersion = originalSchemaVersion
  while (currentVersion < plan.targetSchemaVersion) {
    const step = stepsByFromVersion.get(currentVersion)
    if (step === undefined) {
      throw new Error(`missing migration step from schema version ${currentVersion}`)
    }
    const migrated = step.migrate(playerData)
    assertJsonObject(migrated, `migration ${step.fromVersion} -> ${step.toVersion} result`)
    const migratedVersion = getPlayerDataSchemaVersion(migrated)
    if (migratedVersion !== step.toVersion) {
      throw new Error(
        `migration ${step.fromVersion} -> ${step.toVersion} returned schema ${migratedVersion}`,
      )
    }
    playerData = Object.freeze(cloneJsonObject(migrated))
    appliedMigrations.push(
      Object.freeze({ fromVersion: step.fromVersion, toVersion: step.toVersion }),
    )
    currentVersion = migratedVersion
  }

  return Object.freeze({
    playerData,
    originalSchemaVersion,
    targetSchemaVersion: plan.targetSchemaVersion,
    appliedMigrations: Object.freeze(appliedMigrations),
  })
}

export function migratePlayerDataToCurrent(
  input: unknown,
  catalog: PlayerDataContentCatalog,
  migrationPlan: PlayerDataMigrationPlan = DEFAULT_PLAYER_DATA_MIGRATION_PLAN,
): MigratePlayerDataToCurrentResult {
  if (migrationPlan.targetSchemaVersion !== CURRENT_PLAYER_DATA_SCHEMA_VERSION) {
    throw new Error(
      `current migration target must be schema ${CURRENT_PLAYER_DATA_SCHEMA_VERSION}`,
    )
  }
  const migration = applyPlayerDataMigrations(input, migrationPlan)
  const playerData = createStagePlayerData(migration.playerData as unknown as PlayerData, catalog)
  if (playerData.schemaVersion !== CURRENT_PLAYER_DATA_SCHEMA_VERSION) {
    throw new Error(
      `migrated PlayerData must use schema ${CURRENT_PLAYER_DATA_SCHEMA_VERSION}`,
    )
  }
  return Object.freeze({
    playerData,
    originalSchemaVersion: migration.originalSchemaVersion,
    appliedMigrations: migration.appliedMigrations,
  })
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

export async function loadSaveSlotWithMigration(
  repository: SaveRepository,
  slotId: SaveSlotId,
  catalog: PlayerDataContentCatalog,
  runtime: SaveMigrationRuntime,
): Promise<LoadSaveSlotWithMigrationResult | null> {
  const pointer = await repository.readSlotPointer(slotId)
  if (pointer === null) return null
  const migrationPlan = runtime.plan ?? DEFAULT_PLAYER_DATA_MIGRATION_PLAN
  const now = runtime.now ?? Date.now
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
        })
      }

      const migrated = migratePlayerDataToCurrent(envelope.playerData, catalog, migrationPlan)
      const savedAtEpochMs = now()
      const saved = await savePlayerDataAtomic(
        repository,
        migrated.playerData,
        catalog,
        {
          slotId,
          generationId: runtime.createGenerationId({
            slotId,
            savedAtEpochMs,
            sourceGenerationId: envelope.generationId,
            fromSchemaVersion: migrated.originalSchemaVersion,
            toSchemaVersion: migrationPlan.targetSchemaVersion,
          }),
          savedAtEpochMs,
          preferredBackupGenerationId: envelope.generationId,
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
      })
    } catch (error) {
      failures.push(`${generationId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(`save slot ${slotId} has no valid generation (${failures.join('; ')})`)
}

export async function listSaveSlotSummariesWithMigration(
  repository: SaveRepository,
  catalog: PlayerDataContentCatalog,
  runtime: SaveMigrationRuntime,
): Promise<readonly SaveSlotSummary[]> {
  const summaries = await Promise.all(
    SAVE_SLOT_IDS.map(async (slotId) => {
      const loaded = await loadSaveSlotWithMigration(repository, slotId, catalog, runtime)
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
