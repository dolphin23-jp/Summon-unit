import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'
import { createStagePlayerData } from '../progression/stage-reward'
import { normalizeSavedBattleSession, type SavedBattleSession } from './save-state'

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
  readonly activeBattle?: SavedBattleSession | null
  readonly activeBattleChecksum?: string | null
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
  readonly resumableBattleStageId: string | null
}

export interface CreateSaveGenerationInput {
  readonly generationId: string
  readonly slotId: SaveSlotId
  readonly savedAtEpochMs: number
  readonly playerData: PlayerData
  readonly activeBattle?: SavedBattleSession | null
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

export function calculateStoredPlayerDataChecksum(playerData: unknown): string {
  const json = JSON.stringify(playerData)
  if (json === undefined) {
    throw new Error('save playerData must be JSON serializable')
  }
  return calculateChecksumFromJson(json)
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson)
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key]
      if (child !== undefined) result[key] = canonicalizeJson(child)
    }
    return result
  }
  return value
}

export function calculateCanonicalJsonChecksum(value: unknown): string {
  const json = JSON.stringify(canonicalizeJson(value))
  if (json === undefined) throw new Error('value must be JSON serializable')
  return calculateChecksumFromJson(json)
}

export function calculatePlayerDataChecksum(
  playerData: PlayerData,
  catalog: PlayerDataContentCatalog,
): string {
  const normalized = createStagePlayerData(playerData, catalog)
  return calculateStoredPlayerDataChecksum(normalized)
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
  const activeBattle =
    input.activeBattle === null || input.activeBattle === undefined
      ? null
      : normalizeSavedBattleSession(input.activeBattle)
  return Object.freeze({
    generationId: input.generationId,
    slotId: input.slotId,
    savedAtEpochMs: input.savedAtEpochMs,
    state,
    checksum: calculateStoredPlayerDataChecksum(playerData),
    playerData,
    activeBattle,
    activeBattleChecksum:
      activeBattle === null ? null : calculateCanonicalJsonChecksum(activeBattle),
  })
}

export function validateSaveGenerationEnvelope(
  record: SaveGenerationRecord,
): SaveGenerationRecord {
  assertNonEmptyString(record.generationId, 'save generationId')
  assertSaveSlotId(record.slotId)
  assertSafeIntegerAtLeast(record.savedAtEpochMs, 0, 'save savedAtEpochMs')
  if (record.state !== 'TEMPORARY' && record.state !== 'COMMITTED') {
    throw new Error(`save state is invalid: ${String(record.state)}`)
  }
  assertNonEmptyString(record.checksum, 'save checksum')
  const checksum = calculateStoredPlayerDataChecksum(record.playerData)
  if (record.checksum !== checksum) {
    throw new Error(`save generation checksum mismatch: ${record.generationId}`)
  }
  const activeBattle = record.activeBattle ?? null
  const activeBattleChecksum = record.activeBattleChecksum ?? null
  if (activeBattle === null && activeBattleChecksum !== null) {
    throw new Error(`save generation battle checksum has no battle: ${record.generationId}`)
  }
  if (activeBattle !== null && activeBattleChecksum === null) {
    throw new Error(`save generation battle checksum is missing: ${record.generationId}`)
  }
  const normalizedActiveBattle =
    activeBattle === null ? null : normalizeSavedBattleSession(activeBattle)
  if (
    normalizedActiveBattle !== null &&
    calculateCanonicalJsonChecksum(activeBattle) !== activeBattleChecksum
  ) {
    throw new Error(`save generation battle checksum mismatch: ${record.generationId}`)
  }
  return Object.freeze({
    ...record,
    activeBattle: normalizedActiveBattle,
    activeBattleChecksum,
  })
}

export function validateSaveGenerationRecord(
  record: SaveGenerationRecord,
  catalog: PlayerDataContentCatalog,
): SaveGenerationRecord {
  const envelope = validateSaveGenerationEnvelope(record)
  const normalized = createSaveGenerationRecord(
    {
      generationId: envelope.generationId,
      slotId: envelope.slotId,
      savedAtEpochMs: envelope.savedAtEpochMs,
      state: envelope.state,
      playerData: envelope.playerData,
      activeBattle: envelope.activeBattle ?? null,
    },
    catalog,
  )
  if (envelope.checksum !== normalized.checksum) {
    throw new Error(`save generation checksum mismatch after normalization: ${record.generationId}`)
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
    resumableBattleStageId: null,
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
    resumableBattleStageId: record.activeBattle?.stageId ?? null,
  })
}
