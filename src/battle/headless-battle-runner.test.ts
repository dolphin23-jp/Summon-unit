import { describe, expect, it } from 'vitest'
import {
  runHeadlessBattle,
  type HeadlessBattleDefinition,
} from './headless-battle-runner'
import {
  STANDARD_HEADLESS_BATTLE,
  STANDARD_HEADLESS_SPECIES,
  formatHeadlessBattleResult,
  runStandardHeadlessBattle,
} from '../demo/standard-headless-battle'

describe('headless battle runner', () => {
  it('completes the standard four-species 3v3 demo with summary and full log', () => {
    const result = runStandardHeadlessBattle()

    expect(STANDARD_HEADLESS_SPECIES).toHaveLength(4)
    expect(STANDARD_HEADLESS_BATTLE.units).toHaveLength(6)
    expect(result.summary.termination).toBe('BATTLE_ENDED')
    expect(result.summary.outcome).not.toBe('ONGOING')
    expect(result.summary.totalActions).toBeGreaterThan(0)
    expect(result.summary.totalActions).toBeLessThanOrEqual(300)
    expect(result.summary.finalVirtualTime).toBeGreaterThan(0)
    expect(result.summary.units).toHaveLength(6)
    expect(result.summary.units.reduce((sum, unit) => sum + unit.actionCount, 0)).toBe(
      result.summary.totalActions,
    )

    expect(result.log.events[0]).toMatchObject({ kind: 'battle_started', virtualTime: 0 })
    expect(result.log.events.at(-1)).toMatchObject({
      kind: 'battle_ended',
      payload: { outcome: result.summary.outcome },
    })
    expect(result.log.events.some((event) => event.kind === 'unit_moved')).toBe(true)
    expect(result.log.events.some((event) => event.kind === 'skill_used')).toBe(true)
    expect(result.log.events.some((event) => event.kind === 'unit_defeated')).toBe(true)
    expect(result.summary.eventCount).toBe(result.log.events.length)
  })

  it('returns byte-identical JSON for repeated fresh executions', () => {
    const expected = formatHeadlessBattleResult(runStandardHeadlessBattle())

    for (let index = 0; index < 50; index += 1) {
      expect(formatHeadlessBattleResult(runStandardHeadlessBattle())).toBe(expected)
    }
  }, 10_000)

  it('stops at the configured action limit without inventing an outcome', () => {
    const limited: HeadlessBattleDefinition = {
      ...STANDARD_HEADLESS_BATTLE,
      maxActions: 1,
    }
    const result = runHeadlessBattle(limited)

    expect(result.summary).toMatchObject({
      termination: 'ACTION_LIMIT_REACHED',
      outcome: 'ONGOING',
      totalActions: 1,
    })
    expect(result.log.events.filter((event) => event.kind === 'turn_started')).toHaveLength(1)
    expect(result.log.events.some((event) => event.kind === 'battle_ended')).toBe(false)
  })

  it('does not mutate the reusable TypeScript battle definition', () => {
    const before = structuredClone(STANDARD_HEADLESS_BATTLE)

    runStandardHeadlessBattle()

    expect(STANDARD_HEADLESS_BATTLE).toEqual(before)
    expect(Object.isFrozen(STANDARD_HEADLESS_BATTLE)).toBe(true)
    expect(Object.isFrozen(STANDARD_HEADLESS_BATTLE.units)).toBe(true)
  })
})
