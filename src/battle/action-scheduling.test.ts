import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { createBattleUnitState } from './unit-state'
import {
  BATTLE_TIME_SCALE,
  calculateActionDelay,
  calculateFirstActionTime,
  calculateNextActionTime,
  compareUnitActionTieInfo,
  createInitialUnitActionSchedule,
  createOrderedUnitTurnEvents,
  createUnitTurnEvent,
  getUnitTurnEventId,
  registerUnitTurnEvent,
  rescheduleUnitActionAfterAction,
  type UnitActionSchedule,
  type UnitActionTieInfo,
} from './action-scheduling'
import { createTimelineQueue, peekTimelineEvent } from './timeline-queue'

const species: MonsterSpecies = {
  id: 'species.clock-hare',
  rarity: 2,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.beast',
  tagIds: ['tag.beast'],
  stats: { hp: 90, attack: 20, defense: 15, speed: 3 },
  innateSkillId: 'skill.clock-kick',
}

function createUnit(battleUnitId: string) {
  return createBattleUnitState(species, {
    battleUnitId,
    position: { side: 'ALLY', row: 0, column: 0 },
  })
}

function createSchedule(
  battleUnitId: string,
  nextActionTime: number,
  tie: Omit<UnitActionTieInfo, 'battleUnitId'>,
): UnitActionSchedule {
  return {
    battleUnitId,
    nextActionTime,
    tie: { ...tie, battleUnitId },
  }
}

describe('integer action time calculations', () => {
  it('uses a 1000 tick scale and rounds fractional delays up', () => {
    expect(BATTLE_TIME_SCALE).toBe(1000)
    expect(calculateActionDelay(100, 4)).toBe(25_000)
    expect(calculateActionDelay(100, 3)).toBe(33_334)
    expect(calculateFirstActionTime(75, 3)).toBe(25_000)
  })

  it('keeps the minimum positive delay at one tick', () => {
    expect(calculateActionDelay(1, 10_000)).toBe(1)
  })

  it('adds the integer delay to the current time without floating point drift', () => {
    let currentTime = 0
    for (let index = 0; index < 100; index += 1) {
      currentTime = calculateNextActionTime(currentTime, 100, 3)
    }

    expect(currentTime).toBe(3_333_400)
    expect(Number.isInteger(currentTime)).toBe(true)
  })

  it.each([
    [0, 1, 'actionCost must be greater than or equal to 1'],
    [-1, 1, 'actionCost must be greater than or equal to 1'],
    [1.5, 1, 'actionCost must be a safe integer'],
    [1, 0, 'speed must be greater than or equal to 1'],
    [1, -1, 'speed must be greater than or equal to 1'],
    [1, 1.5, 'speed must be a safe integer'],
  ] as const)('rejects invalid action cost or speed', (actionCost, speed, message) => {
    expect(() => calculateActionDelay(actionCost, speed)).toThrow(message)
  })

  it('rejects unsafe time addition', () => {
    expect(() => calculateNextActionTime(Number.MAX_SAFE_INTEGER, 1, 1)).toThrow(
      'nextActionTime must be a safe integer',
    )
  })
})

describe('unit action schedules', () => {
  it('creates the first schedule from species speed without mutating the unit', () => {
    const unit = createUnit('ally.clock-hare.1')
    const unitSnapshot = structuredClone(unit)

    const schedule = createInitialUnitActionSchedule(unit, species, 100, 4)

    expect(schedule).toEqual({
      battleUnitId: 'ally.clock-hare.1',
      nextActionTime: 33_334,
      tie: {
        actionCount: 0,
        lastActionTime: 0,
        tiePriority: 4,
        battleUnitId: 'ally.clock-hare.1',
      },
    })
    expect(unit).toEqual(unitSnapshot)
  })

  it('updates action count and last action time when rescheduling', () => {
    const initial = createInitialUnitActionSchedule(createUnit('ally.clock-hare.1'), species, 100, 4)

    const rescheduled = rescheduleUnitActionAfterAction(
      initial,
      initial.nextActionTime,
      75,
      species.stats.speed,
    )

    expect(rescheduled).toEqual({
      battleUnitId: 'ally.clock-hare.1',
      nextActionTime: 58_334,
      tie: {
        actionCount: 1,
        lastActionTime: 33_334,
        tiePriority: 4,
        battleUnitId: 'ally.clock-hare.1',
      },
    })
    expect(initial.tie.actionCount).toBe(0)
    expect(initial.tie.lastActionTime).toBe(0)
  })

  it('returns the same schedule for the same inputs', () => {
    const unit = createUnit('ally.clock-hare.1')

    const first = createInitialUnitActionSchedule(unit, species, 130, 2)
    const second = createInitialUnitActionSchedule(unit, species, 130, 2)

    expect(second).toEqual(first)
  })

  it('rejects a species that does not match the unit', () => {
    expect(() =>
      createInitialUnitActionSchedule(
        createUnit('ally.clock-hare.1'),
        { ...species, id: 'species.other' },
        100,
        0,
      ),
    ).toThrow('unit.speciesId must match species.id')
  })
})

describe('same-time tie ordering', () => {
  const baseTie: UnitActionTieInfo = {
    actionCount: 2,
    lastActionTime: 10_000,
    tiePriority: 3,
    battleUnitId: 'unit.b',
  }

  it('compares action count, last action time, tie priority, and fixed id in order', () => {
    expect(compareUnitActionTieInfo({ ...baseTie, actionCount: 1 }, baseTie)).toBeLessThan(0)
    expect(compareUnitActionTieInfo({ ...baseTie, lastActionTime: 9_999 }, baseTie)).toBeLessThan(0)
    expect(compareUnitActionTieInfo({ ...baseTie, tiePriority: 2 }, baseTie)).toBeLessThan(0)
    expect(
      compareUnitActionTieInfo({ ...baseTie, battleUnitId: 'unit.a' }, baseTie),
    ).toBeLessThan(0)
  })

  it('assigns stable event sequences from the complete tie order', () => {
    const schedules = [
      createSchedule('unit.d', 20_000, {
        actionCount: 1,
        lastActionTime: 10_000,
        tiePriority: 1,
      }),
      createSchedule('unit.c', 20_000, {
        actionCount: 0,
        lastActionTime: 11_000,
        tiePriority: 1,
      }),
      createSchedule('unit.b', 20_000, {
        actionCount: 0,
        lastActionTime: 10_000,
        tiePriority: 2,
      }),
      createSchedule('unit.a', 20_000, {
        actionCount: 0,
        lastActionTime: 10_000,
        tiePriority: 2,
      }),
    ]

    const events = createOrderedUnitTurnEvents(schedules, 40)

    expect(events.map((event) => [event.payload.battleUnitId, event.sequence])).toEqual([
      ['unit.a', 40],
      ['unit.b', 41],
      ['unit.c', 42],
      ['unit.d', 43],
    ])
  })

  it('orders different action times before applying tie information', () => {
    const events = createOrderedUnitTurnEvents([
      createSchedule('unit.later', 20_001, {
        actionCount: 0,
        lastActionTime: 0,
        tiePriority: 0,
      }),
      createSchedule('unit.earlier', 20_000, {
        actionCount: 99,
        lastActionTime: 19_000,
        tiePriority: 99,
      }),
    ])

    expect(events.map((event) => event.payload.battleUnitId)).toEqual([
      'unit.earlier',
      'unit.later',
    ])
  })
})

describe('unit turn event registration', () => {
  it('creates a fixed event id and immutable tie snapshot', () => {
    const schedule = createInitialUnitActionSchedule(createUnit('ally.clock-hare.1'), species, 100, 4)
    const event = createUnitTurnEvent(schedule, 7)

    expect(event.id).toBe(getUnitTurnEventId('ally.clock-hare.1'))
    expect(event).toMatchObject({
      time: 33_334,
      priority: 0,
      sequence: 7,
      kind: 'UNIT_TURN',
    })
    expect(event.payload.tie).toEqual(schedule.tie)
    expect(Object.isFrozen(event.payload.tie)).toBe(true)
  })

  it('replaces an existing turn event for the same unit when re-registering', () => {
    const initial = createInitialUnitActionSchedule(createUnit('ally.clock-hare.1'), species, 100, 4)
    const firstEvent = createUnitTurnEvent(initial, 1)
    const firstQueue = registerUnitTurnEvent(createTimelineQueue(), firstEvent)

    const next = rescheduleUnitActionAfterAction(
      initial,
      initial.nextActionTime,
      75,
      species.stats.speed,
    )
    const secondEvent = createUnitTurnEvent(next, 2)
    const secondQueue = registerUnitTurnEvent(firstQueue, secondEvent)

    expect(secondQueue.events).toHaveLength(1)
    expect(peekTimelineEvent(secondQueue)).toEqual(secondEvent)
    expect(firstQueue.events).toEqual([firstEvent])
  })
})
