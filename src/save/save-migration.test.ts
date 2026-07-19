import { describe, expect, it } from 'vitest'
import {
  T039_INITIAL_PLAYER_DATA,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import type { PlayerData } from '../progression/player-data'
import {
  calculateStoredPlayerDataChecksum,
  createCommittedSaveGeneration,
  createSaveSlotPointer,
  type SaveGenerationRecord,
  type SaveSlotId,
  type SaveSlotPointer,
} from './save-model'
import {
  CURRENT_PLAYER_DATA_SCHEMA_VERSION,
  applyPlayerDataMigrations,
  createPlayerDataMigrationPlan,
  migratePlayerDataToCurrent,
} from './save-migration'
import { loadSaveSlot, type SaveRepository } from './save-repository'

class MigrationTestRepository implements SaveRepository {
  readonly generations = new Map<string, SaveGenerationRecord>()
  readonly pointers = new Map<SaveSlotId, SaveSlotPointer>()
  failNextCommit = false

  async putTemporaryGeneration(record: SaveGenerationRecord): Promise<void> {
    this.generations.set(record.generationId, record)
  }

  async readGeneration(generationId: string): Promise<SaveGenerationRecord | null> {
    return this.generations.get(generationId) ?? null
  }

  async readSlotPointer(slotId: SaveSlotId): Promise<SaveSlotPointer | null> {
    return this.pointers.get(slotId) ?? null
  }

  async listSlotPointers(): Promise<readonly SaveSlotPointer[]> {
    return Object.freeze([...this.pointers.values()])
  }

  async commitTemporaryGeneration(input: {
    readonly slotId: SaveSlotId
    readonly generationId: string
    readonly maximumBackupGenerations: number
    readonly preferredBackupGenerationId?: string
  }): Promise<SaveSlotPointer> {
    if (this.failNextCommit) {
      this.failNextCommit = false
      throw new Error('simulated migration commit failure')
    }
    const generation = this.generations.get(input.generationId)
    if (
      generation === undefined ||
      generation.state !== 'TEMPORARY' ||
      generation.slotId !== input.slotId
    ) {
      throw new Error('temporary generation identity mismatch')
    }
    const previous = this.pointers.get(input.slotId)
    const candidates = [
      input.preferredBackupGenerationId,
      ...(previous === undefined
        ? []
        : [previous.currentGenerationId, ...previous.backupGenerationIds]),
    ].filter((generationId): generationId is string => generationId !== undefined)
    const uniquePrevious = candidates.filter(
      (generationId, index, values) =>
        generationId !== input.generationId && values.indexOf(generationId) === index,
    )
    const backups = uniquePrevious.slice(0, input.maximumBackupGenerations)
    const discarded = uniquePrevious.slice(input.maximumBackupGenerations)
    const pointer = createSaveSlotPointer({
      slotId: input.slotId,
      currentGenerationId: input.generationId,
      backupGenerationIds: backups,
      updatedAtEpochMs: generation.savedAtEpochMs,
    })
    this.generations.set(input.generationId, createCommittedSaveGeneration(generation))
    this.pointers.set(input.slotId, pointer)
    for (const generationId of discarded) this.generations.delete(generationId)
    return pointer
  }

  async deleteGeneration(generationId: string): Promise<void> {
    this.generations.delete(generationId)
  }

  async deleteSlot(slotId: SaveSlotId): Promise<void> {
    const pointer = this.pointers.get(slotId)
    if (pointer !== undefined) {
      for (const generationId of [
        pointer.currentGenerationId,
        ...pointer.backupGenerationIds,
      ]) {
        this.generations.delete(generationId)
      }
    }
    this.pointers.delete(slotId)
  }
}

function createLegacyPlayerData(schemaVersion: number): PlayerData {
  const current = T039_INITIAL_PLAYER_DATA
  const legacy: Record<string, unknown> = {
    schemaVersion,
    gameVersion: `0.0.0-schema-${schemaVersion}`,
    contentVersion: current.contentVersion,
    collection: current.collection,
    formations: current.formations,
  }
  if (schemaVersion >= 2) legacy.economy = current.economy
  if (schemaVersion >= 3) legacy.research = current.research
  if (schemaVersion >= 4) legacy.facilities = current.facilities
  if (schemaVersion >= 5) legacy.stageProgress = current.stageProgress
  return legacy as unknown as PlayerData
}

function createLegacyRecord(
  generationId: string,
  playerData: PlayerData,
  slotId: SaveSlotId = 'slot-1',
): SaveGenerationRecord {
  return Object.freeze({
    generationId,
    slotId,
    savedAtEpochMs: 100,
    state: 'COMMITTED' as const,
    checksum: calculateStoredPlayerDataChecksum(playerData),
    playerData,
  })
}

function installPointer(
  repository: MigrationTestRepository,
  currentGenerationId: string,
  backupGenerationIds: readonly string[] = [],
): void {
  repository.pointers.set(
    'slot-1',
    createSaveSlotPointer({
      slotId: 'slot-1',
      currentGenerationId,
      backupGenerationIds,
      updatedAtEpochMs: 100,
    }),
  )
}

const loadOptions = Object.freeze({
  now: () => 500,
  createMigrationGenerationId: () => 'migration-generation',
})

describe('PlayerData migration framework', () => {
  it('applies every schema transition one version at a time', () => {
    const legacy = createLegacyPlayerData(1)
    const result = migratePlayerDataToCurrent(legacy, T039_PLAYER_CATALOG)

    expect(result.originalSchemaVersion).toBe(1)
    expect(result.appliedMigrations).toEqual([
      { fromVersion: 1, toVersion: 2 },
      { fromVersion: 2, toVersion: 3 },
      { fromVersion: 3, toVersion: 4 },
      { fromVersion: 4, toVersion: 5 },
      { fromVersion: 5, toVersion: 6 },
    ])
    expect(result.playerData.schemaVersion).toBe(CURRENT_PLAYER_DATA_SCHEMA_VERSION)
    expect(result.playerData.economy).toEqual({
      currency: 0,
      researchData: 0,
      catalysts: [],
    })
    expect(result.playerData.research?.nodes).toHaveLength(
      T039_PLAYER_CATALOG.researchNodes?.length ?? 0,
    )
    expect(result.playerData.facilities?.researchFacilityStage).toBe(1)
    expect(result.playerData.stageProgress).toEqual({
      completedStageIds: [],
      settledBattleIds: [],
      regionalPoints: [],
    })
    expect(legacy.schemaVersion).toBe(1)
  })

  it('rejects a migration plan that skips a schema version', () => {
    expect(() =>
      createPlayerDataMigrationPlan({
        targetSchemaVersion: 3,
        steps: [
          {
            fromVersion: 1,
            toVersion: 3,
            migrate: (playerData) => ({ ...playerData, schemaVersion: 3 }),
          },
        ],
      }),
    ).toThrow('advance exactly one schema version')
  })

  it('rejects a chain with a missing intermediate step', () => {
    const plan = createPlayerDataMigrationPlan({
      targetSchemaVersion: 3,
      steps: [
        {
          fromVersion: 1,
          toVersion: 2,
          migrate: (playerData) => ({ ...playerData, schemaVersion: 2 }),
        },
      ],
    })
    expect(() => applyPlayerDataMigrations(createLegacyPlayerData(1), plan)).toThrow(
      'missing migration step from schema version 2',
    )
  })
})

describe('persistent save migration', () => {
  it('commits the migrated generation and keeps the source as the newest backup', async () => {
    const repository = new MigrationTestRepository()
    const legacy = createLegacyRecord('legacy-current', createLegacyPlayerData(1))
    repository.generations.set(legacy.generationId, legacy)
    installPointer(repository, legacy.generationId)

    const loaded = await loadSaveSlot(
      repository,
      'slot-1',
      T039_PLAYER_CATALOG,
      loadOptions,
    )

    expect(loaded?.record.generationId).toBe('migration-generation')
    expect(loaded?.playerData.schemaVersion).toBe(CURRENT_PLAYER_DATA_SCHEMA_VERSION)
    expect(loaded?.migration?.fromSchemaVersion).toBe(1)
    expect(loaded?.migration?.backupGenerationId).toBe('legacy-current')
    expect(loaded?.pointer.backupGenerationIds[0]).toBe('legacy-current')
    expect(repository.generations.get('legacy-current')).toBe(legacy)
  })

  it('leaves the old pointer intact when the migration commit fails', async () => {
    const repository = new MigrationTestRepository()
    const legacy = createLegacyRecord('legacy-current', createLegacyPlayerData(4))
    repository.generations.set(legacy.generationId, legacy)
    installPointer(repository, legacy.generationId)
    repository.failNextCommit = true

    await expect(
      loadSaveSlot(repository, 'slot-1', T039_PLAYER_CATALOG, loadOptions),
    ).rejects.toThrow('no valid generation')
    expect(repository.pointers.get('slot-1')?.currentGenerationId).toBe('legacy-current')
    expect(repository.generations.has('migration-generation')).toBe(false)
    expect(repository.generations.get('legacy-current')).toBe(legacy)
  })

  it('preserves an old third backup when newer generations are invalid', async () => {
    const repository = new MigrationTestRepository()
    const invalidIds = ['broken-current', 'broken-backup-1', 'broken-backup-2']
    for (const generationId of invalidIds) {
      repository.generations.set(
        generationId,
        Object.freeze({
          ...createLegacyRecord(generationId, createLegacyPlayerData(6)),
          checksum: 'broken',
        }),
      )
    }
    const legacyBackup = createLegacyRecord('legacy-backup-3', createLegacyPlayerData(2))
    repository.generations.set(legacyBackup.generationId, legacyBackup)
    installPointer(repository, 'broken-current', [
      'broken-backup-1',
      'broken-backup-2',
      legacyBackup.generationId,
    ])

    const loaded = await loadSaveSlot(
      repository,
      'slot-1',
      T039_PLAYER_CATALOG,
      loadOptions,
    )

    expect(loaded?.recoveredFromBackup).toBe(true)
    expect(loaded?.migration?.sourceGenerationId).toBe('legacy-backup-3')
    expect(loaded?.pointer.backupGenerationIds).toEqual([
      'legacy-backup-3',
      'broken-current',
      'broken-backup-1',
    ])
    expect(repository.generations.has('legacy-backup-3')).toBe(true)
  })
})
