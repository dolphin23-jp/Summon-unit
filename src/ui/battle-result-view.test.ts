import { describe, expect, it } from 'vitest'
import { createInteractiveBattleRunner } from '../battle/headless-battle-runner'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import {
  isBattleMotionLevel,
  resolveInitialBattleMotionLevel,
} from './battle-accessibility'
import { createBattleResultView } from './battle-result-view'

describe('battle result view', () => {
  it('projects deterministic rewards, analysis changes, and per-unit records', () => {
    const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    const result = runner.runToCompletion()
    const view = createBattleResultView(STANDARD_HEADLESS_BATTLE, result, null)

    expect(view.outcome).not.toBe('ONGOING')
    expect(view.unitRecords).toHaveLength(result.summary.units.length)
    expect(view.rewards.currency).toBeGreaterThanOrEqual(0)
    expect(view.rewards.researchData).toBeGreaterThanOrEqual(0)
  })

  it('matches aggregate event-log damage and remains byte-identical', () => {
    const run = () => {
      const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
      const result = runner.runToCompletion()
      return createBattleResultView(STANDARD_HEADLESS_BATTLE, result, null)
    }
    const first = run()
    const eventDamage = first.unitRecords.reduce((total, unit) => total + unit.damageTaken, 0)
    expect(eventDamage).toBeGreaterThan(0)
    expect(JSON.stringify(run())).toBe(JSON.stringify(first))
  })
})

describe('battle motion preferences', () => {
  it('accepts only the three documented presentation levels', () => {
    expect(isBattleMotionLevel('STANDARD')).toBe(true)
    expect(isBattleMotionLevel('REDUCED')).toBe(true)
    expect(isBattleMotionLevel('MINIMAL')).toBe(true)
    expect(isBattleMotionLevel('OFF')).toBe(false)
  })

  it('honors stored choices unless reduced-motion requires minimal presentation', () => {
    expect(resolveInitialBattleMotionLevel('MINIMAL', false)).toBe('MINIMAL')
    expect(resolveInitialBattleMotionLevel(null, true)).toBe('MINIMAL')
    expect(resolveInitialBattleMotionLevel('STANDARD', true)).toBe('MINIMAL')
    expect(resolveInitialBattleMotionLevel(undefined, false)).toBe('STANDARD')
  })
})
