import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'
import { createStagePlayerData } from '../progression/stage-reward'

export const SAVE_SLOT_IDS = Object.freeze(['slot-1', 'slot-2', 'slot-3'] as const)
export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number]

export const MAX_SAVE_BACKUP_GENERATIONS = 3

export type SaveGenerationState = 'TEMPORARY' | 'COMMITTED'

export interface SaveGenerationRecord {
  readonly generationId: string
  readonly slotId: SaveSlotId
  readonly savedAtEpochMs: number
  readonly state: SaveGenerationState
  readonly checksum: string
  readonly playerData: PlayerData
}

export interface SaveSlotPointer {
  readonly slotId: SaveSlotId
  readonly currentGenerationId: string
  readonly backupGenerationIds: readonly string[]
  readonly updatedAtEpochMs: number
}

export interface SaveSlotSummary {
  readonly slotId: SaveSlotId
  readonly empty: boolean
  readonly currentGenerationId: string | null
  readonly backupCount: number
  readonly savedAtEpochMs: number | null
  readonly schemaVersion: number | null
  readonly gameVersion: string | null
  readonly contentVersion: string | null
  readonly currency: number | null
  readonly researchData: number | null
  readonly ownedUnitCount: number | null
  readonly completedStageCount: number | null
  readonly recoveredFromBackup: boolean
}

export interface CreateSaveGenerationInput {
  readonly generationId: string
  readonly slotId: SaveSlotId
  readonly savedAtEpochMs: number
  readonly playerData: PlayerData
  readonly state?: SaveGenerationState
}

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

export function isSaveSlotId(value: string): value is SaveSlotId {
  return SAVE_SLOT_IDS.includes(value as SaveSlotId)
}

export function assertSaveSlotId(value: string, field = 'slotId'): asserts value is SaveSlotId {
  if (!isSaveSlotId(value)) {
    throw new Error(`${field} must be one of ${SAVE_SLOT_IDS.join(', ')}`)
  }
}

function calculateChecksumFromJson(json: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function calculatePlayerDataChecksum(
  playerData: PlayerData,
  catalog: PlayerDataContentCatalog,
): string {
  const normalized = createStagePlayerData(playerData, catalog)
  return calculateChecksumFromJson(JSON.stringify(normalized))
}

export function createSaveGenerationRecord(
  input: CreateSaveGenerationInput,
  catalog: PlayerDataContentCatalog,
): SaveGenerationRecord {
  assertNonEmptyString(input.generationId, 'save generationId')
  assertSaveSlotId(input.slotId)
  assertSafeIntegerAtLeast(input.savedAtEpochMs, 0, 'save savedAtEpochMs')
  const state = input.state ?? 'TEMPORARY'
  if (state !== 'TEMPORARY' && state !== 'COMMITTED') {
    throw new Error(`save state is invalid: ${String(state)}`)
  }
  const playerData = createStagePlayerData(input.playerData, catalog)
  return Object.freeze({
    generationId: input.generationId,
    slotId: input.slotId,
    savedAtEpochMs: input.savedAtEpochMs,
    state,
    checksum: calculateChecksumFromJson(JSON.stringify(playerData)),
    playerData,
  })
}

export function validateSaveGenerationRecord(
  record: SaveGenerationRecord,
  catalog: PlayerDataContentCatalog,
): SaveGenerationRecord {
  const normalized = createSaveGenerationRecord(
    {
      generationId: record.generationId,
      slotId: record.slotId,
      savedAtEpochMs: record.savedAtEpochMs,
      state: record.state,
      playerData: record.playerData,
    },
    catalog,
  )
  if (record.checksum !== normalized.checksum) {
    throw new Error(`save generation checksum mismatch: ${record.generationId}`)
  }
  return normalized
}

export function createCommittedSaveGeneration(
  record: SaveGenerationRecord,
): SaveGenerationRecord {
  if (record.state !== 'TEMPORARY') {
    throw new Error(`save generation is not temporary: ${record.generationId}`)
  }
  return Object.freeze({ ...record, state: 'COMMITTED' })
}

export function createSaveSlotPointer(input: SaveSlotPointer): SaveSlotPointer {
  assertSaveSlotId(input.slotId)
  assertNonEmptyString(input.currentGenerationId, 'save pointer currentGenerationId')
  assertSafeIntegerAtLeast(input.updatedAtEpochMs, 0, 'save pointer updatedAtEpochMs')
  if (input.backupGenerationIds.length > MAX_SAVE_BACKUP_GENERATIONS) {
    throw new Error(
      `save pointer may contain at most ${MAX_SAVE_BACKUP_GENERATIONS} backup generations`,
    )
  }
  const seen = new Set<string>([input.currentGenerationId])
  const backupGenerationIds = input.backupGenerationIds.map((generationId) => {
    assertNonEmptyString(generationId, 'save pointer backupGenerationIds[]')
    if (seen.has(generationId)) {
      throw new Error(`save pointer generation IDs must be unique: ${generationId}`)
    }
    seen.add(generationId)
    return generationId
  })
  return Object.freeze({
    slotId: input.slotId,
    currentGenerationId: input.currentGenerationId,
    backupGenerationIds: Object.freeze(backupGenerationIds),
    updatedAtEpochMs: input.updatedAtEpochMs,
  })
}

export function createEmptySaveSlotSummary(slotId: SaveSlotId): SaveSlotSummary {
  return Object.freeze({
    slotId,
    empty: true,
    currentGenerationId: null,
    backupCount: 0,
    savedAtEpochMs: null,
    schemaVersion: null,
    gameVersion: null,
    contentVersion: null,
    currency: null,
    researchData: null,
    ownedUnitCount: null,
    completedStageCount: null,
    recoveredFromBackup: false,
  })
}

export function createSaveSlotSummary(input: {
  readonly pointer: SaveSlotPointer
  readonly record: SaveGenerationRecord
  readonly recoveredFromBackup: boolean
}): SaveSlotSummary {
  const { pointer, record, recoveredFromBackup } = input
  if (pointer.slotId !== record.slotId) {
    throw new Error('save pointer and generation belong to different slots')
  }
  return Object.freeze({
    slotId: pointer.slotId,
    empty: false,
    currentGenerationId: record.generationId,
    backupCount: pointer.backupGenerationIds.length,
    savedAtEpochMs: record.savedAtEpochMs,
    schemaVersion: record.playerData.schemaVersion,
    gameVersion: record.playerData.gameVersion,
    contentVersion: record.playerData.contentVersion,
    currency: record.playerData.economy.currency,
    researchData: record.playerData.economy.researchData,
    ownedUnitCount: record.playerData.collection.unitInstances.length,
    completedStageCount: record.playerData.stageProgress?.completedStageIds.length ?? 0,
    recoveredFromBackup,
  })
}
