import { describe, expect, it } from 'vitest'
import { createInteractiveBattleRunner } from '../battle/interactive-battle-runner'
import {
  T039_INITIAL_PLAYER_DATA,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import {
  createCommittedSaveGeneration,
  createSaveSlotPointer,
  type SaveGenerationRecord,
  type SaveSlotId,
  type SaveSlotPointer,
} from './save-model'
import { SAVED_BATTLE_SESSION_VERSION } from './save-state'
import {
  listSaveSlotSummaries,
  loadSaveSlot,
  savePlayerDataAtomic,
  type SaveRepository,
} from './save-repository'

class BattleSaveRepository implements SaveRepository {
  readonly generations = new Map<string, SaveGenerationRecord>()
  readonly pointers = new Map<SaveSlotId, SaveSlotPointer>()

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
    const generation = this.generations.get(input.generationId)
    if (generation === undefined || generation.state !== 'TEMPORARY') {
      throw new Error('temporary generation missing')
    }
    const previous = this.pointers.get(input.slotId)
    const previousIds =
      previous === undefined
        ? []
        : [previous.currentGenerationId, ...previous.backupGenerationIds]
    const candidates = [input.preferredBackupGenerationId, ...previousIds].filter(
      (generationId): generationId is string => generationId !== undefined,
    )
    const backups = candidates
      .filter(
        (generationId, index, values) =>
          generationId !== input.generationId && values.indexOf(generationId) === index,
      )
      .slice(0, input.maximumBackupGenerations)
    const pointer = createSaveSlotPointer({
      slotId: input.slotId,
      currentGenerationId: input.generationId,
      backupGenerationIds: backups,
      updatedAtEpochMs: generation.savedAtEpochMs,
    })
    this.generations.set(input.generationId, createCommittedSaveGeneration(generation))
    this.pointers.set(input.slotId, pointer)
    return pointer
  }

  async deleteGeneration(generationId: string): Promise<void> {
    this.generations.delete(generationId)
  }

  async deleteSlot(slotId: SaveSlotId): Promise<void> {
    this.pointers.delete(slotId)
  }
}

function createSavedBattle() {
  const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
  runner.step()
  runner.step()
  return {
    saveVersion: SAVED_BATTLE_SESSION_VERSION,
    stageId: 'stage.demo-forest-01',
    serial: 3,
    attempt: 1,
    fastModeAvailable: false,
    definition: STANDARD_HEADLESS_BATTLE,
    stableSnapshot: runner.getStableSnapshot(),
  } as const
}

describe('resumable battle generation persistence', () => {
  it('atomically saves and reloads an active battle with its slot summary', async () => {
    const repository = new BattleSaveRepository()
    const activeBattle = createSavedBattle()

    await savePlayerDataAtomic(
      repository,
      T039_INITIAL_PLAYER_DATA,
      T039_PLAYER_CATALOG,
      {
        slotId: 'slot-1',
        generationId: 'battle-generation-1',
        savedAtEpochMs: 100,
        activeBattle,
      },
    )

    const loaded = await loadSaveSlot(repository, 'slot-1', T039_PLAYER_CATALOG)
    expect(loaded?.activeBattle).toEqual(activeBattle)
    expect(loaded?.activeBattle?.stableSnapshot.totalActions).toBe(2)

    const summaries = await listSaveSlotSummaries(repository, T039_PLAYER_CATALOG)
    expect(summaries[0].resumableBattleStageId).toBe('stage.demo-forest-01')
  })

  it('rejects a modified battle payload while retaining the previous current generation', async () => {
    const repository = new BattleSaveRepository()
    await savePlayerDataAtomic(
      repository,
      T039_INITIAL_PLAYER_DATA,
      T039_PLAYER_CATALOG,
      {
        slotId: 'slot-1',
        generationId: 'battle-generation-1',
        savedAtEpochMs: 100,
        activeBattle: createSavedBattle(),
      },
    )
    const record = repository.generations.get('battle-generation-1')
    if (record === undefined || record.activeBattle === null || record.activeBattle === undefined) {
      throw new Error('saved battle generation missing')
    }
    repository.generations.set(
      record.generationId,
      Object.freeze({
        ...record,
        activeBattle: Object.freeze({ ...record.activeBattle, attempt: 99 }),
      }),
    )

    await expect(loadSaveSlot(repository, 'slot-1', T039_PLAYER_CATALOG)).rejects.toThrow(
      'battle checksum mismatch',
    )
    expect((await repository.readSlotPointer('slot-1'))?.currentGenerationId).toBe(
      'battle-generation-1',
    )
  })
})
