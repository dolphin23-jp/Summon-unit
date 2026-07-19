import { describe, expect, it } from 'vitest'
import {
  T039_INITIAL_PLAYER_DATA,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import {
  createCommittedSaveGeneration,
  createSaveSlotPointer,
  type SaveGenerationRecord,
  type SaveSlotId,
  type SaveSlotPointer,
} from './save-model'
import {
  listSaveSlotSummaries,
  loadSaveSlot,
  savePlayerDataAtomic,
  type SaveRepository,
} from './save-repository'

class TestSaveRepository implements SaveRepository {
  readonly generations = new Map<string, SaveGenerationRecord>()
  readonly pointers = new Map<SaveSlotId, SaveSlotPointer>()
  corruptNextTemporaryRead = false

  async putTemporaryGeneration(record: SaveGenerationRecord): Promise<void> {
    this.generations.set(record.generationId, record)
  }

  async readGeneration(generationId: string): Promise<SaveGenerationRecord | null> {
    const record = this.generations.get(generationId) ?? null
    if (
      record !== null &&
      record.state === 'TEMPORARY' &&
      this.corruptNextTemporaryRead
    ) {
      this.corruptNextTemporaryRead = false
      return Object.freeze({ ...record, checksum: 'corrupted' })
    }
    return record
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
  }): Promise<SaveSlotPointer> {
    const generation = this.generations.get(input.generationId)
    if (
      generation === undefined ||
      generation.state !== 'TEMPORARY' ||
      generation.slotId !== input.slotId
    ) {
      throw new Error('temporary generation identity mismatch')
    }
    const previous = this.pointers.get(input.slotId)
    const previousIds =
      previous === undefined
        ? []
        : [previous.currentGenerationId, ...previous.backupGenerationIds]
    const uniquePreviousIds = previousIds.filter(
      (generationId, index, values) =>
        generationId !== input.generationId && values.indexOf(generationId) === index,
    )
    const backups = uniquePreviousIds.slice(0, input.maximumBackupGenerations)
    const discarded = uniquePreviousIds.slice(input.maximumBackupGenerations)
    const committed = createCommittedSaveGeneration(generation)
    const pointer = createSaveSlotPointer({
      slotId: input.slotId,
      currentGenerationId: input.generationId,
      backupGenerationIds: backups,
      updatedAtEpochMs: generation.savedAtEpochMs,
    })
    this.generations.set(input.generationId, committed)
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

function withCurrency(currency: number) {
  return {
    ...T039_INITIAL_PLAYER_DATA,
    economy: { ...T039_INITIAL_PLAYER_DATA.economy, currency },
  }
}

async function save(
  repository: TestSaveRepository,
  generationId: string,
  currency: number,
  slotId: SaveSlotId = 'slot-1',
) {
  return savePlayerDataAtomic(
    repository,
    withCurrency(currency),
    T039_PLAYER_CATALOG,
    {
      slotId,
      generationId,
      savedAtEpochMs: Number(generationId.replace(/\D/g, '')) || 1,
    },
  )
}

describe('atomic save repository service', () => {
  it('writes a temporary generation, verifies it, and switches the pointer', async () => {
    const repository = new TestSaveRepository()
    await save(repository, 'generation-1', 100)
    const result = await save(repository, 'generation-2', 200)

    expect(result.pointer.currentGenerationId).toBe('generation-2')
    expect(result.pointer.backupGenerationIds).toEqual(['generation-1'])
    expect(result.record.state).toBe('COMMITTED')
    expect((await loadSaveSlot(repository, 'slot-1', T039_PLAYER_CATALOG))?.playerData.economy.currency).toBe(200)
  })

  it('retains the three newest backup generations and deletes older generations', async () => {
    const repository = new TestSaveRepository()
    for (let index = 1; index <= 5; index += 1) {
      await save(repository, `generation-${index}`, index * 100)
    }

    const pointer = await repository.readSlotPointer('slot-1')
    expect(pointer?.currentGenerationId).toBe('generation-5')
    expect(pointer?.backupGenerationIds).toEqual([
      'generation-4',
      'generation-3',
      'generation-2',
    ])
    expect(repository.generations.has('generation-1')).toBe(false)
  })

  it('does not move the current pointer when temporary verification fails', async () => {
    const repository = new TestSaveRepository()
    await save(repository, 'generation-1', 100)
    repository.corruptNextTemporaryRead = true

    await expect(save(repository, 'generation-2', 200)).rejects.toThrow(
      'checksum mismatch',
    )
    expect((await repository.readSlotPointer('slot-1'))?.currentGenerationId).toBe(
      'generation-1',
    )
    expect(repository.generations.has('generation-2')).toBe(false)
  })

  it('loads the newest valid backup when the current generation is corrupted', async () => {
    const repository = new TestSaveRepository()
    await save(repository, 'generation-1', 100)
    await save(repository, 'generation-2', 200)
    const current = repository.generations.get('generation-2')
    if (current === undefined) throw new Error('test generation missing')
    repository.generations.set(
      'generation-2',
      Object.freeze({ ...current, checksum: 'corrupted' }),
    )

    const loaded = await loadSaveSlot(repository, 'slot-1', T039_PLAYER_CATALOG)
    expect(loaded?.record.generationId).toBe('generation-1')
    expect(loaded?.playerData.economy.currency).toBe(100)
    expect(loaded?.recoveredFromBackup).toBe(true)
  })

  it('keeps three slots independent and reports empty slots', async () => {
    const repository = new TestSaveRepository()
    await save(repository, 'slot1-generation', 111, 'slot-1')
    await save(repository, 'slot3-generation', 333, 'slot-3')

    const summaries = await listSaveSlotSummaries(repository, T039_PLAYER_CATALOG)
    expect(summaries.map((summary) => [summary.slotId, summary.currency])).toEqual([
      ['slot-1', 111],
      ['slot-2', null],
      ['slot-3', 333],
    ])
  })
})
