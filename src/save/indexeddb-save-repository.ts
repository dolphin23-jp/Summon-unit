import {
  createCommittedSaveGeneration,
  createSaveSlotPointer,
  type SaveGenerationRecord,
  type SaveSlotId,
  type SaveSlotPointer,
} from './save-model'
import type { SaveRepository } from './save-repository'

export const SAVE_DATABASE_NAME = 'summon-unit-saves'
export const SAVE_DATABASE_VERSION = 1

const GENERATION_STORE = 'generations'
const POINTER_STORE = 'slot-pointers'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted'))
  })
}

function assertBackupLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('maximumBackupGenerations must be a non-negative safe integer')
  }
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

export class IndexedDbSaveRepository implements SaveRepository {
  private readonly databasePromise: Promise<IDBDatabase>

  constructor(
    factory: IDBFactory = indexedDB,
    databaseName = SAVE_DATABASE_NAME,
  ) {
    this.databasePromise = new Promise((resolve, reject) => {
      const request = factory.open(databaseName, SAVE_DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(GENERATION_STORE)) {
          database.createObjectStore(GENERATION_STORE, { keyPath: 'generationId' })
        }
        if (!database.objectStoreNames.contains(POINTER_STORE)) {
          database.createObjectStore(POINTER_STORE, { keyPath: 'slotId' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('failed to open save database'))
      request.onblocked = () => reject(new Error('save database upgrade is blocked'))
    })
  }

  async putTemporaryGeneration(record: SaveGenerationRecord): Promise<void> {
    if (record.state !== 'TEMPORARY') {
      throw new Error('putTemporaryGeneration requires a temporary record')
    }
    const database = await this.databasePromise
    const transaction = database.transaction(GENERATION_STORE, 'readwrite')
    transaction.objectStore(GENERATION_STORE).put(record)
    await transactionCompletion(transaction)
  }

  async readGeneration(generationId: string): Promise<SaveGenerationRecord | null> {
    const database = await this.databasePromise
    const transaction = database.transaction(GENERATION_STORE, 'readonly')
    const result = await requestResult(
      transaction.objectStore(GENERATION_STORE).get(generationId) as IDBRequest<
        SaveGenerationRecord | undefined
      >,
    )
    await transactionCompletion(transaction)
    return result ?? null
  }

  async readSlotPointer(slotId: SaveSlotId): Promise<SaveSlotPointer | null> {
    const database = await this.databasePromise
    const transaction = database.transaction(POINTER_STORE, 'readonly')
    const result = await requestResult(
      transaction.objectStore(POINTER_STORE).get(slotId) as IDBRequest<
        SaveSlotPointer | undefined
      >,
    )
    await transactionCompletion(transaction)
    return result === undefined ? null : createSaveSlotPointer(result)
  }

  async listSlotPointers(): Promise<readonly SaveSlotPointer[]> {
    const database = await this.databasePromise
    const transaction = database.transaction(POINTER_STORE, 'readonly')
    const result = await requestResult(
      transaction.objectStore(POINTER_STORE).getAll() as IDBRequest<SaveSlotPointer[]>,
    )
    await transactionCompletion(transaction)
    return Object.freeze(
      result
        .map(createSaveSlotPointer)
        .sort((left, right) => left.slotId.localeCompare(right.slotId, 'en')),
    )
  }

  async commitTemporaryGeneration(input: {
    readonly slotId: SaveSlotId
    readonly generationId: string
    readonly maximumBackupGenerations: number
  }): Promise<SaveSlotPointer> {
    assertBackupLimit(input.maximumBackupGenerations)
    const database = await this.databasePromise
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [GENERATION_STORE, POINTER_STORE],
        'readwrite',
      )
      const generationStore = transaction.objectStore(GENERATION_STORE)
      const pointerStore = transaction.objectStore(POINTER_STORE)
      let committedPointer: SaveSlotPointer | null = null
      const fail = (error: unknown) => {
        try {
          transaction.abort()
        } catch {
          // The transaction may already be inactive after a request failure.
        }
        reject(error)
      }

      const generationRequest = generationStore.get(input.generationId) as IDBRequest<
        SaveGenerationRecord | undefined
      >
      generationRequest.onerror = () =>
        fail(generationRequest.error ?? new Error('failed to read temporary generation'))
      generationRequest.onsuccess = () => {
        const generation = generationRequest.result
        if (generation === undefined) {
          fail(new Error(`temporary generation does not exist: ${input.generationId}`))
          return
        }
        if (generation.state !== 'TEMPORARY' || generation.slotId !== input.slotId) {
          fail(new Error(`temporary generation identity mismatch: ${input.generationId}`))
          return
        }

        const pointerRequest = pointerStore.get(input.slotId) as IDBRequest<
          SaveSlotPointer | undefined
        >
        pointerRequest.onerror = () =>
          fail(pointerRequest.error ?? new Error('failed to read save slot pointer'))
        pointerRequest.onsuccess = () => {
          const previous = pointerRequest.result
          const previousGenerationIds =
            previous === undefined
              ? []
              : [previous.currentGenerationId, ...previous.backupGenerationIds]
          const uniquePrevious = previousGenerationIds.filter(
            (generationId, index, values) =>
              generationId !== input.generationId && values.indexOf(generationId) === index,
          )
          const backupGenerationIds = uniquePrevious.slice(
            0,
            input.maximumBackupGenerations,
          )
          const discardedGenerationIds = uniquePrevious.slice(
            input.maximumBackupGenerations,
          )
          const committed = createCommittedSaveGeneration(generation)
          committedPointer = createSaveSlotPointer({
            slotId: input.slotId,
            currentGenerationId: input.generationId,
            backupGenerationIds,
            updatedAtEpochMs: committed.savedAtEpochMs,
          })
          generationStore.put(committed)
          pointerStore.put(committedPointer)
          for (const generationId of discardedGenerationIds) {
            generationStore.delete(generationId)
          }
        }
      }

      transaction.oncomplete = () => {
        if (committedPointer === null) {
          reject(new Error('save commit completed without a slot pointer'))
          return
        }
        resolve(committedPointer)
      }
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('save commit transaction failed'))
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('save commit transaction was aborted'))
    })
  }

  async deleteGeneration(generationId: string): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(GENERATION_STORE, 'readwrite')
    transaction.objectStore(GENERATION_STORE).delete(generationId)
    await transactionCompletion(transaction)
  }

  async deleteSlot(slotId: SaveSlotId): Promise<void> {
    const database = await this.databasePromise
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        [GENERATION_STORE, POINTER_STORE],
        'readwrite',
      )
      const generationStore = transaction.objectStore(GENERATION_STORE)
      const pointerStore = transaction.objectStore(POINTER_STORE)
      const pointerRequest = pointerStore.get(slotId) as IDBRequest<
        SaveSlotPointer | undefined
      >
      pointerRequest.onerror = () => {
        try {
          transaction.abort()
        } catch {
          // Ignore inactive transaction errors.
        }
        reject(pointerRequest.error ?? new Error('failed to read save slot pointer'))
      }
      pointerRequest.onsuccess = () => {
        const pointer = pointerRequest.result
        if (pointer !== undefined) {
          for (const generationId of [
            pointer.currentGenerationId,
            ...pointer.backupGenerationIds,
          ]) {
            generationStore.delete(generationId)
          }
        }
        pointerStore.delete(slotId)
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('delete slot transaction failed'))
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('delete slot transaction was aborted'))
    })
  }

  async close(): Promise<void> {
    const database = await this.databasePromise
    database.close()
  }
}
