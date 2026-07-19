import {
  createInteractiveBattleRunner,
  type HeadlessBattleDefinition,
  type InteractiveBattleStableSnapshot,
} from '../battle/interactive-battle-runner'

export const SAVED_BATTLE_SESSION_VERSION = 1

export interface SavedBattleSession {
  readonly saveVersion: typeof SAVED_BATTLE_SESSION_VERSION
  readonly stageId: string
  readonly serial: number
  readonly attempt: number
  readonly fastModeAvailable: boolean
  readonly definition: HeadlessBattleDefinition
  readonly stableSnapshot: InteractiveBattleStableSnapshot
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeIntegerAtLeast(
  value: unknown,
  minimum: number,
  field: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function cloneJson<T>(value: T, field: string): T {
  const json = JSON.stringify(value)
  if (json === undefined) throw new Error(`${field} must be JSON serializable`)
  return JSON.parse(json) as T
}

export function normalizeSavedBattleSession(input: SavedBattleSession): SavedBattleSession {
  const cloned = cloneJson(input, 'saved battle session')
  if (cloned.saveVersion !== SAVED_BATTLE_SESSION_VERSION) {
    throw new Error(`unsupported saved battle session version: ${String(cloned.saveVersion)}`)
  }
  assertNonEmptyString(cloned.stageId, 'saved battle stageId')
  assertSafeIntegerAtLeast(cloned.serial, 1, 'saved battle serial')
  assertSafeIntegerAtLeast(cloned.attempt, 0, 'saved battle attempt')
  if (typeof cloned.fastModeAvailable !== 'boolean') {
    throw new Error('saved battle fastModeAvailable must be boolean')
  }

  const runner = createInteractiveBattleRunner(cloned.definition, cloned.stableSnapshot)
  const stableSnapshot = runner.getStableSnapshot()
  return Object.freeze({
    saveVersion: SAVED_BATTLE_SESSION_VERSION,
    stageId: cloned.stageId,
    serial: cloned.serial,
    attempt: cloned.attempt,
    fastModeAvailable: cloned.fastModeAvailable,
    definition: Object.freeze(cloned.definition),
    stableSnapshot,
  })
}
