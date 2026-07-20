import { describe, expect, it } from 'vitest'
import { runHeadlessBattle } from '../battle/headless-battle-runner'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import {
  isBattleMotionLevel,
  resolveInitialBattleMotionLevel,
} from './battle-accessibility'
import { createBattleResultView } from './battle-result-view'

describe('battle result view', () => {
  it('projects deterministic rewards, analysis changes, and per-unit records', () => {
    const result = runHeadlessBattle(STANDARD_HEADLESS_BATTLE)
    const view = createBattleResultView(STANDARD_HEADLESS_BATTLE, result)

    expect(view.rewards.stub).toBe(true)
    expect(view.unitStats).toHaveLength(result.summary.units.length)
    expect(view.analysisChanges.map((change) => change.speciesId)).toEqual(
      [...new Set(result.summary.units.map((unit) => unit.speciesId))].sort(),
    )

    for (const unit of result.summary.units) {
      const record = view.unitStats.find((candidate) => candidate.battleUnitId === unit.battleUnitId)
      expect(record).toMatchObject({
        speciesId: unit.speciesId,
        side: unit.side,
        hp: unit.hp,
        defeated: unit.defeated,
        actionCount: unit.actionCount,
      })
    }
  })

  it('matches aggregate event-log damage and remains byte-identical', () => {
    const result = runHeadlessBattle(STANDARD_HEADLESS_BATTLE)
    const first = createBattleResultView(STANDARD_HEADLESS_BATTLE, result)
    const second = createBattleResultView(STANDARD_HEADLESS_BATTLE, result)
    const loggedDamage = result.log.events.reduce(
      (total, event) => total + (event.kind === 'damage_applied' ? event.payload.appliedDamage : 0),
      0,
    )

    expect(first.unitStats.reduce((total, unit) => total + unit.damageTaken, 0)).toBe(loggedDamage)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
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
