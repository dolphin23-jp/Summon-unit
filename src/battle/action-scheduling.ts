import type { MonsterSpecies } from '../content/monster-species'
import type { BattleUnitId, BattleUnitState } from './unit-state'
import {
  cancelTimelineEvent,
  pushTimelineEvent,
  type ScheduledEvent,
  type TimelineQueue,
} from './timeline-queue'

export const BATTLE_TIME_SCALE = 1000
export const UNIT_TURN_EVENT_PRIORITY = 0

export type BattleTime = number

export interface UnitActionTieInfo {
  readonly actionCount: number
  readonly lastActionTime: BattleTime
  readonly tiePriority: number
  readonly battleUnitId: BattleUnitId
}

export interface UnitActionSchedule {
  readonly battleUnitId: BattleUnitId
  readonly nextActionTime: BattleTime
  readonly tie: UnitActionTieInfo
}

export interface UnitTurnEventPayload {
  readonly battleUnitId: BattleUnitId
  readonly tie: UnitActionTieInfo
}

function assertNonEmptyId(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeInteger(value: number, field: string, minimum?: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer`)
  }

  if (minimum !== undefined && value < minimum) {
    throw new Error(`${field} must be greater than or equal to ${minimum}`)
  }
}

function assertUnitMatchesSpecies(unit: BattleUnitState, species: MonsterSpecies): void {
  if (unit.speciesId !== species.id) {
    throw new Error('unit.speciesId must match species.id')
  }
}

function freezeTieInfo(tie: UnitActionTieInfo): UnitActionTieInfo {
  return Object.freeze({ ...tie })
}

function freezeSchedule(schedule: UnitActionSchedule): UnitActionSchedule {
  return Object.freeze({
    ...schedule,
    tie: freezeTieInfo(schedule.tie),
  })
}

export function calculateActionDelay(actionCost: number, speed: number): BattleTime {
  assertSafeInteger(actionCost, 'actionCost', 1)
  assertSafeInteger(speed, 'speed', 1)

  const numerator = BigInt(actionCost) * BigInt(BATTLE_TIME_SCALE)
  const divisor = BigInt(speed)
  const delay = (numerator + divisor - 1n) / divisor

  if (delay > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('scaled action delay must be a safe integer')
  }

  return Number(delay)
}

export function calculateFirstActionTime(actionCost: number, speed: number): BattleTime {
  return calculateActionDelay(actionCost, speed)
}

export function calculateNextActionTime(
  currentTime: BattleTime,
  actionCost: number,
  speed: number,
): BattleTime {
  assertSafeInteger(currentTime, 'currentTime', 0)

  const nextActionTime = BigInt(currentTime) + BigInt(calculateActionDelay(actionCost, speed))
  if (nextActionTime > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('nextActionTime must be a safe integer')
  }

  return Number(nextActionTime)
}

export function createInitialUnitActionSchedule(
  unit: BattleUnitState,
  species: MonsterSpecies,
  initialActionCost: number,
  tiePriority: number,
): UnitActionSchedule {
  assertUnitMatchesSpecies(unit, species)
  assertSafeInteger(tiePriority, 'tiePriority')
  assertNonEmptyId(unit.battleUnitId, 'unit.battleUnitId')

  return freezeSchedule({
    battleUnitId: unit.battleUnitId,
    nextActionTime: calculateFirstActionTime(initialActionCost, species.stats.speed),
    tie: {
      actionCount: 0,
      lastActionTime: 0,
      tiePriority,
      battleUnitId: unit.battleUnitId,
    },
  })
}

export function rescheduleUnitActionAfterAction(
  schedule: UnitActionSchedule,
  currentTime: BattleTime,
  actionCost: number,
  speed: number,
): UnitActionSchedule {
  assertValidUnitActionSchedule(schedule)
  assertSafeInteger(currentTime, 'currentTime', 0)

  if (currentTime < schedule.tie.lastActionTime) {
    throw new Error('currentTime must not be earlier than the last action time')
  }

  const actionCount = schedule.tie.actionCount + 1
  assertSafeInteger(actionCount, 'actionCount', 0)

  return freezeSchedule({
    battleUnitId: schedule.battleUnitId,
    nextActionTime: calculateNextActionTime(currentTime, actionCost, speed),
    tie: {
      ...schedule.tie,
      actionCount,
      lastActionTime: currentTime,
    },
  })
}

export function assertValidUnitActionSchedule(schedule: UnitActionSchedule): void {
  assertNonEmptyId(schedule.battleUnitId, 'schedule.battleUnitId')
  assertSafeInteger(schedule.nextActionTime, 'schedule.nextActionTime', 0)
  assertSafeInteger(schedule.tie.actionCount, 'schedule.tie.actionCount', 0)
  assertSafeInteger(schedule.tie.lastActionTime, 'schedule.tie.lastActionTime', 0)
  assertSafeInteger(schedule.tie.tiePriority, 'schedule.tie.tiePriority')
  assertNonEmptyId(schedule.tie.battleUnitId, 'schedule.tie.battleUnitId')

  if (schedule.battleUnitId !== schedule.tie.battleUnitId) {
    throw new Error('schedule.battleUnitId must match schedule.tie.battleUnitId')
  }

  if (schedule.nextActionTime < schedule.tie.lastActionTime) {
    throw new Error('schedule.nextActionTime must not be earlier than the last action time')
  }
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  return left < right ? -1 : 1
}

export function compareUnitActionTieInfo(
  left: UnitActionTieInfo,
  right: UnitActionTieInfo,
): number {
  if (left.actionCount !== right.actionCount) {
    return left.actionCount - right.actionCount
  }

  if (left.lastActionTime !== right.lastActionTime) {
    return left.lastActionTime - right.lastActionTime
  }

  if (left.tiePriority !== right.tiePriority) {
    return left.tiePriority - right.tiePriority
  }

  return compareIds(left.battleUnitId, right.battleUnitId)
}

export function getUnitTurnEventId(battleUnitId: BattleUnitId): string {
  assertNonEmptyId(battleUnitId, 'battleUnitId')
  return `unit-turn:${battleUnitId}`
}

export function createUnitTurnEvent(
  schedule: UnitActionSchedule,
  sequence: number,
): ScheduledEvent<UnitTurnEventPayload> {
  assertValidUnitActionSchedule(schedule)
  assertSafeInteger(sequence, 'sequence', 0)

  return Object.freeze({
    id: getUnitTurnEventId(schedule.battleUnitId),
    time: schedule.nextActionTime,
    priority: UNIT_TURN_EVENT_PRIORITY,
    sequence,
    kind: 'UNIT_TURN',
    payload: Object.freeze({
      battleUnitId: schedule.battleUnitId,
      tie: freezeTieInfo(schedule.tie),
    }),
  })
}

export function createOrderedUnitTurnEvents(
  schedules: readonly UnitActionSchedule[],
  startingSequence = 0,
): readonly ScheduledEvent<UnitTurnEventPayload>[] {
  assertSafeInteger(startingSequence, 'startingSequence', 0)

  const seenIds = new Set<string>()
  const orderedSchedules = schedules.map((schedule) => {
    assertValidUnitActionSchedule(schedule)
    if (seenIds.has(schedule.battleUnitId)) {
      throw new Error(`battleUnitId must be unique: ${schedule.battleUnitId}`)
    }
    seenIds.add(schedule.battleUnitId)
    return schedule
  })

  orderedSchedules.sort((left, right) => {
    if (left.nextActionTime !== right.nextActionTime) {
      return left.nextActionTime - right.nextActionTime
    }
    return compareUnitActionTieInfo(left.tie, right.tie)
  })

  return Object.freeze(
    orderedSchedules.map((schedule, index) => {
      const sequence = startingSequence + index
      assertSafeInteger(sequence, 'sequence', 0)
      return createUnitTurnEvent(schedule, sequence)
    }),
  )
}

export function registerUnitTurnEvent(
  queue: TimelineQueue,
  event: ScheduledEvent<UnitTurnEventPayload>,
): TimelineQueue {
  const withoutPrevious = cancelTimelineEvent(queue, event.id).queue
  return pushTimelineEvent(withoutPrevious, event)
}
