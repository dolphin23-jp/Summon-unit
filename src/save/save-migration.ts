import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'
import { createStagePlayerData } from '../progression/stage-reward'

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

export function createPlayerDataMigrationPlan(
  input: PlayerDataMigrationPlan,
): PlayerDataMigrationPlan {
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
    steps: Object.freeze(
      [...byFromVersion.values()].sort(
        (left, right) => left.fromVersion - right.fromVersion,
      ),
    ),
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
  const playerData = createStagePlayerData(
    migration.playerData as unknown as PlayerData,
    catalog,
  )
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
