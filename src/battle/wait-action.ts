import type { MonsterSpecies } from '../content/monster-species'
import {
  assertValidUnitActionSchedule,
  rescheduleUnitActionAfterAction,
  type BattleTime,
  type UnitActionSchedule,
} from './action-scheduling'
import { getModifiedBattleStatValue } from './stat-modifiers'
import { assertValidBattleUnitState, type BattleUnitState } from './unit-state'

export const WAIT_ACTION_COSTS = Object.freeze([50, 65, 80] as const)

export interface WaitActionState {
  readonly consecutiveWaitCount: number
}

export interface PerformWaitActionInput {
  readonly actor: BattleUnitState
  readonly actorSpecies: MonsterSpecies
  readonly actorSchedule: UnitActionSchedule
  readonly currentTime: BattleTime
  readonly waitState: WaitActionState
}

export interface PerformWaitActionResult {
  readonly actorSchedule: UnitActionSchedule
  readonly waitState: WaitActionState
  readonly baseActionCost: number
  readonly effectiveActionCost: number
  readonly effectiveSpeed: number
}

export const EMPTY_WAIT_ACTION_STATE: WaitActionState = Object.freeze({
  consecutiveWaitCount: 0,
})

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

export function assertValidWaitActionState(state: WaitActionState): void {
  assertSafeIntegerAtLeast(state.consecutiveWaitCount, 0, 'consecutiveWaitCount')
}

export function getWaitActionCost(state: WaitActionState): number {
  assertValidWaitActionState(state)
  if (state.consecutiveWaitCount === 0) {
    return WAIT_ACTION_COSTS[0]
  }
  if (state.consecutiveWaitCount === 1) {
    return WAIT_ACTION_COSTS[1]
  }
  return WAIT_ACTION_COSTS[2]
}

export function resetWaitActionState(): WaitActionState {
  return EMPTY_WAIT_ACTION_STATE
}

export function performWaitAction(input: PerformWaitActionInput): PerformWaitActionResult {
  assertValidBattleUnitState(input.actor, input.actorSpecies)
  assertValidUnitActionSchedule(input.actorSchedule)
  assertValidWaitActionState(input.waitState)
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')

  if (input.actor.defeated) {
    throw new Error('defeated actor cannot wait')
  }
  if (input.actorSchedule.battleUnitId !== input.actor.battleUnitId) {
    throw new Error('actorSchedule.battleUnitId must match actor.battleUnitId')
  }
  if (input.currentTime !== input.actorSchedule.nextActionTime) {
    throw new Error('currentTime must match actorSchedule.nextActionTime')
  }

  const baseActionCost = getWaitActionCost(input.waitState)
  const effectiveActionCost = getModifiedBattleStatValue(
    baseActionCost,
    input.actor.effects,
    'ACTION_COST',
  )
  const effectiveSpeed = getModifiedBattleStatValue(
    input.actorSpecies.stats.speed,
    input.actor.effects,
    'SPEED',
  )
  const actorSchedule = rescheduleUnitActionAfterAction(
    input.actorSchedule,
    input.currentTime,
    effectiveActionCost,
    effectiveSpeed,
  )
  const waitState = Object.freeze({
    consecutiveWaitCount: input.waitState.consecutiveWaitCount + 1,
  })
  assertValidWaitActionState(waitState)

  return Object.freeze({
    actorSchedule,
    waitState,
    baseActionCost,
    effectiveActionCost,
    effectiveSpeed,
  })
}
