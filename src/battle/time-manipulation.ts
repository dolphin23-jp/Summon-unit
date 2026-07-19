import {
  BATTLE_TIME_SCALE,
  assertValidUnitActionSchedule,
  type BattleTime,
  type UnitActionSchedule,
} from './action-scheduling'

export const MINIMUM_ACTION_INTERVAL = 10 * BATTLE_TIME_SCALE
export const MAX_SINGLE_DELAY = 50 * BATTLE_TIME_SCALE
export const MAX_CUMULATIVE_INTERVAL_MULTIPLIER_PERMILLE = 2000

export interface ModifyNextActionTimeInput {
  readonly schedule: UnitActionSchedule
  readonly currentTime: BattleTime
  readonly requestedShift: BattleTime
  readonly baseActionDelay: BattleTime
}

export interface ModifyNextActionTimeResult {
  readonly schedule: UnitActionSchedule
  readonly requestedShift: BattleTime
  readonly appliedShift: BattleTime
  readonly minimumNextActionTime: BattleTime
  readonly maximumNextActionTime: BattleTime
}

function assertSafeInteger(value: number, field: string, minimum?: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer`)
  }
  if (minimum !== undefined && value < minimum) {
    throw new Error(`${field} must be greater than or equal to ${minimum}`)
  }
}

function clamp(value: bigint, minimum: bigint, maximum: bigint): bigint {
  if (value < minimum) {
    return minimum
  }
  if (value > maximum) {
    return maximum
  }
  return value
}

export function modifyNextActionTime(
  input: ModifyNextActionTimeInput,
): ModifyNextActionTimeResult {
  assertValidUnitActionSchedule(input.schedule)
  assertSafeInteger(input.currentTime, 'currentTime', 0)
  assertSafeInteger(input.requestedShift, 'requestedShift')
  assertSafeInteger(input.baseActionDelay, 'baseActionDelay', 1)

  if (input.schedule.nextActionTime < input.currentTime) {
    throw new Error('schedule.nextActionTime must not be earlier than currentTime')
  }

  const currentTime = BigInt(input.currentTime)
  const minimumNextActionTime = currentTime + BigInt(MINIMUM_ACTION_INTERVAL)
  const maximumInterval =
    (BigInt(input.baseActionDelay) *
      BigInt(MAX_CUMULATIVE_INTERVAL_MULTIPLIER_PERMILLE)) /
    1000n
  const maximumNextActionTime = currentTime + maximumInterval

  let boundedRequest = BigInt(input.requestedShift)
  if (boundedRequest > BigInt(MAX_SINGLE_DELAY)) {
    boundedRequest = BigInt(MAX_SINGLE_DELAY)
  }

  const requestedNextActionTime = BigInt(input.schedule.nextActionTime) + boundedRequest
  const nextActionTime = clamp(
    requestedNextActionTime,
    minimumNextActionTime,
    maximumNextActionTime,
  )
  if (nextActionTime > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('modified nextActionTime must be a safe integer')
  }

  const appliedShift = nextActionTime - BigInt(input.schedule.nextActionTime)
  if (
    appliedShift > BigInt(Number.MAX_SAFE_INTEGER) ||
    appliedShift < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error('applied time shift must be a safe integer')
  }

  const schedule = Object.freeze({
    ...input.schedule,
    nextActionTime: Number(nextActionTime),
    tie: Object.freeze({ ...input.schedule.tie }),
  })
  assertValidUnitActionSchedule(schedule)

  return Object.freeze({
    schedule,
    requestedShift: input.requestedShift,
    appliedShift: Number(appliedShift),
    minimumNextActionTime: Number(minimumNextActionTime),
    maximumNextActionTime: Number(maximumNextActionTime),
  })
}
