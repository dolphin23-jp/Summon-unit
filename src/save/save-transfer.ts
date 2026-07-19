import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'
import { migratePlayerDataToCurrent, type AppliedPlayerDataMigration } from './save-migration'
import { calculateCanonicalJsonChecksum } from './save-model'
import { normalizeSavedBattleSession, type SavedBattleSession } from './save-state'

export const SAVE_TRANSFER_FORMAT = 'summon-unit-save'
export const SAVE_TRANSFER_FORMAT_VERSION = 1

export interface SaveTransferPayload {
  readonly playerData: PlayerData
  readonly activeBattle: SavedBattleSession | null
}

export interface SaveTransferDocument {
  readonly format: typeof SAVE_TRANSFER_FORMAT
  readonly formatVersion: typeof SAVE_TRANSFER_FORMAT_VERSION
  readonly exportedAtEpochMs: number
  readonly checksum: string
  readonly payload: SaveTransferPayload
}

export interface ImportSaveTransferResult extends SaveTransferPayload {
  readonly originalSchemaVersion: number
  readonly appliedMigrations: readonly AppliedPlayerDataMigration[]
  readonly exportedAtEpochMs: number
}

function assertObject(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`)
  }
}

function assertSafeIntegerAtLeast(value: unknown, minimum: number, field: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function normalizePayload(
  input: unknown,
  catalog: PlayerDataContentCatalog,
): {
  readonly payload: SaveTransferPayload
  readonly originalSchemaVersion: number
  readonly appliedMigrations: readonly AppliedPlayerDataMigration[]
} {
  assertObject(input, 'save transfer payload')
  const migrated = migratePlayerDataToCurrent(input.playerData, catalog)
  const activeBattle =
    input.activeBattle === null || input.activeBattle === undefined
      ? null
      : normalizeSavedBattleSession(input.activeBattle as SavedBattleSession)
  return Object.freeze({
    payload: Object.freeze({ playerData: migrated.playerData, activeBattle }),
    originalSchemaVersion: migrated.originalSchemaVersion,
    appliedMigrations: migrated.appliedMigrations,
  })
}

export function exportSaveTransferJson(
  input: SaveTransferPayload,
  catalog: PlayerDataContentCatalog,
  exportedAtEpochMs = Date.now(),
): string {
  assertSafeIntegerAtLeast(exportedAtEpochMs, 0, 'exportedAtEpochMs')
  const normalized = normalizePayload(input, catalog).payload
  const document: SaveTransferDocument = Object.freeze({
    format: SAVE_TRANSFER_FORMAT,
    formatVersion: SAVE_TRANSFER_FORMAT_VERSION,
    exportedAtEpochMs,
    checksum: calculateCanonicalJsonChecksum(normalized),
    payload: normalized,
  })
  return JSON.stringify(document, null, 2)
}

export function importSaveTransferJson(
  json: string,
  catalog: PlayerDataContentCatalog,
): ImportSaveTransferResult {
  if (json.trim().length === 0) throw new Error('save import JSON must not be empty')
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('save import JSON is invalid')
  }
  assertObject(parsed, 'save transfer document')
  if (parsed.format !== SAVE_TRANSFER_FORMAT) {
    throw new Error(`unsupported save transfer format: ${String(parsed.format)}`)
  }
  if (parsed.formatVersion !== SAVE_TRANSFER_FORMAT_VERSION) {
    throw new Error(`unsupported save transfer format version: ${String(parsed.formatVersion)}`)
  }
  assertSafeIntegerAtLeast(parsed.exportedAtEpochMs, 0, 'save transfer exportedAtEpochMs')
  if (typeof parsed.checksum !== 'string' || parsed.checksum.length === 0) {
    throw new Error('save transfer checksum must be a non-empty string')
  }
  const actualChecksum = calculateCanonicalJsonChecksum(parsed.payload)
  if (actualChecksum !== parsed.checksum) {
    throw new Error('save transfer checksum mismatch')
  }
  const normalized = normalizePayload(parsed.payload, catalog)
  return Object.freeze({
    ...normalized.payload,
    originalSchemaVersion: normalized.originalSchemaVersion,
    appliedMigrations: normalized.appliedMigrations,
    exportedAtEpochMs: parsed.exportedAtEpochMs,
  })
}
