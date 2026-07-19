import { describe, expect, it } from 'vitest'
import type { UnitActionSchedule } from './action-scheduling'
import {
  MAX_SINGLE_DELAY,
  MINIMUM_ACTION_INTERVAL,
  modifyNextActionTime,
} from './time-manipulation'

function createSchedule(nextActionTime = 200_000): UnitActionSchedule {
  return Object.freeze({
    battleUnitId: 'unit.time',
    nextActionTime,
    tie: Object.freeze({
      actionCount: 1,
      lastActionTime: 100_000,
      tiePriority: 0,
      battleUnitId: 'unit.time',
    }),
  })
}

describe('next action time manipulation', () => {
  it('clamps advancement to the minimum action interval', () => {
    const result = modifyNextActionTime({
      schedule: createSchedule(),
      currentTime: 100_000,
      requestedShift: -500_000,
      baseActionDelay: 100_000,
    })
    expect(result.schedule.nextActionTime).toBe(100_000 + MINIMUM_ACTION_INTERVAL)
    expect(result.appliedShift).toBe(-90_000)
  })

  it('clamps one delay application to 50 timeline units', () => {
    const result = modifyNextActionTime({
      schedule: createSchedule(),
      currentTime: 100_000,
      requestedShift: 999_999,
      baseActionDelay: 100_000,
    })
    expect(result.appliedShift).toBe(MAX_SINGLE_DELAY)
    expect(result.schedule.nextActionTime).toBe(250_000)
  })

  it('caps cumulative delay at 200 percent of the base interval', () => {
    const first = modifyNextActionTime({
      schedule: createSchedule(),
      currentTime: 100_000,
      requestedShift: MAX_SINGLE_DELAY,
      baseActionDelay: 100_000,
    })
    const second = modifyNextActionTime({
      schedule: first.schedule,
      currentTime: 100_000,
      requestedShift: MAX_SINGLE_DELAY,
      baseActionDelay: 100_000,
    })
    const third = modifyNextActionTime({
      schedule: second.schedule,
      currentTime: 100_000,
      requestedShift: MAX_SINGLE_DELAY,
      baseActionDelay: 100_000,
    })
    expect(second.schedule.nextActionTime).toBe(300_000)
    expect(third.schedule.nextActionTime).toBe(300_000)
    expect(third.appliedShift).toBe(0)
  })

  it('does not mutate the original schedule', () => {
    const schedule = createSchedule()
    const result = modifyNextActionTime({
      schedule,
      currentTime: 100_000,
      requestedShift: -1,
      baseActionDelay: 100_000,
    })
    expect(schedule.nextActionTime).toBe(200_000)
    expect(result.schedule).not.toBe(schedule)
    expect(Object.isFrozen(result.schedule)).toBe(true)
  })
})
