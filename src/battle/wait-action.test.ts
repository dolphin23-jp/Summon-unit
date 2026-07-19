import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { createInitialUnitActionSchedule } from './action-scheduling'
import {
  EMPTY_WAIT_ACTION_STATE,
  getWaitActionCost,
  performWaitAction,
  resetWaitActionState,
} from './wait-action'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.waiter',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 5 }),
  innateSkillId: 'skill.waiter',
})

function createInput() {
  const actor = createBattleUnitState(species, {
    battleUnitId: 'unit.waiter',
    position: { side: 'ALLY', row: 0, column: 0 },
  })
  const schedule = createInitialUnitActionSchedule(actor, species, 100, 0)
  return { actor, schedule }
}

describe('formal wait action', () => {
  it('uses escalating 50, 65, 80, 80 costs for consecutive waits', () => {
    const { actor, schedule } = createInput()
    const first = performWaitAction({
      actor,
      actorSpecies: species,
      actorSchedule: schedule,
      currentTime: schedule.nextActionTime,
      waitState: EMPTY_WAIT_ACTION_STATE,
    })
    const second = performWaitAction({
      actor,
      actorSpecies: species,
      actorSchedule: first.actorSchedule,
      currentTime: first.actorSchedule.nextActionTime,
      waitState: first.waitState,
    })
    const third = performWaitAction({
      actor,
      actorSpecies: species,
      actorSchedule: second.actorSchedule,
      currentTime: second.actorSchedule.nextActionTime,
      waitState: second.waitState,
    })
    const fourth = performWaitAction({
      actor,
      actorSpecies: species,
      actorSchedule: third.actorSchedule,
      currentTime: third.actorSchedule.nextActionTime,
      waitState: third.waitState,
    })

    expect([
      first.baseActionCost,
      second.baseActionCost,
      third.baseActionCost,
      fourth.baseActionCost,
    ]).toEqual([50, 65, 80, 80])
    expect(fourth.waitState.consecutiveWaitCount).toBe(4)
  })

  it('resets the streak after a skill or movement action', () => {
    expect(getWaitActionCost({ consecutiveWaitCount: 2 })).toBe(80)
    expect(resetWaitActionState()).toEqual({ consecutiveWaitCount: 0 })
    expect(getWaitActionCost(resetWaitActionState())).toBe(50)
  })

  it('does not mutate the prior schedule or wait state', () => {
    const { actor, schedule } = createInput()
    const waitState = EMPTY_WAIT_ACTION_STATE
    const result = performWaitAction({
      actor,
      actorSpecies: species,
      actorSchedule: schedule,
      currentTime: schedule.nextActionTime,
      waitState,
    })
    expect(schedule.tie.actionCount).toBe(0)
    expect(waitState.consecutiveWaitCount).toBe(0)
    expect(result.actorSchedule.tie.actionCount).toBe(1)
    expect(Object.isFrozen(result.waitState)).toBe(true)
  })
})
