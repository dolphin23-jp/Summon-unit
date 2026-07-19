import { describe, expect, it } from 'vitest'
import { registerActiveEffect, type ActiveEffectState } from './effect-framework'
import {
  applyHealingReceivedModifier,
  getBattleStatMultiplierPermille,
  getHealingReceivedMultiplierPermille,
  getModifiedBattleStatValue,
} from './stat-modifiers'

function addEffect(
  effects: readonly ActiveEffectState[],
  effectId: string,
  strength: number,
  applicationSequence: number,
  stacks: number = 1,
): readonly ActiveEffectState[] {
  return registerActiveEffect(effects, {
    effectId,
    sourceBattleUnitId: 'ally.source',
    targetBattleUnitId: 'ally.target',
    strength,
    stacks,
    stackLimit: 5,
    duration: { unit: 'BATTLE', remaining: null },
    appliedAt: 0,
    applicationSequence,
  }).effects
}

describe('battle stat modifiers', () => {
  it('adds buffs and debuffs deterministically from active effects', () => {
    let effects: readonly ActiveEffectState[] = []
    effects = addEffect(effects, 'effect.buff.attack', 200, 1)
    effects = addEffect(effects, 'effect.debuff.attack', 100, 2)

    expect(getBattleStatMultiplierPermille(effects, 'ATTACK')).toBe(1100)
    expect(getModifiedBattleStatValue(30, effects, 'ATTACK')).toBe(33)
  })

  it('uses stacks and clamps every stat to the documented range', () => {
    let effects: readonly ActiveEffectState[] = []
    effects = addEffect(effects, 'effect.buff.attack', 800, 1, 5)
    effects = addEffect(effects, 'effect.debuff.defense', 1000, 2, 5)
    effects = addEffect(effects, 'effect.buff.speed', 500, 3, 5)
    effects = addEffect(effects, 'effect.buff.action-cost', 500, 4, 5)
    effects = addEffect(effects, 'effect.buff.healing-received', 1000, 5, 5)

    expect(getBattleStatMultiplierPermille(effects, 'ATTACK')).toBe(2000)
    expect(getBattleStatMultiplierPermille(effects, 'DEFENSE')).toBe(250)
    expect(getBattleStatMultiplierPermille(effects, 'SPEED')).toBe(1500)
    expect(getBattleStatMultiplierPermille(effects, 'ACTION_COST')).toBe(500)
    expect(getHealingReceivedMultiplierPermille(effects)).toBe(2500)
  })

  it('treats an action-cost buff as a reduction and a debuff as an increase', () => {
    const buffed = addEffect([], 'effect.buff.action-cost', 200, 1)
    const debuffed = addEffect([], 'effect.debuff.action-cost', 200, 1)

    expect(getModifiedBattleStatValue(100, buffed, 'ACTION_COST')).toBe(80)
    expect(getModifiedBattleStatValue(100, debuffed, 'ACTION_COST')).toBe(120)
  })

  it('rounds integer stats half up and keeps speed and cost at least one', () => {
    const speedBuff = addEffect([], 'effect.buff.speed', 500, 1)
    const maximumCostBuff = addEffect([], 'effect.buff.action-cost', 1000, 1)

    expect(getModifiedBattleStatValue(3, speedBuff, 'SPEED')).toBe(5)
    expect(getModifiedBattleStatValue(1, maximumCostBuff, 'ACTION_COST')).toBe(1)
  })

  it('supports complete healing prevention at the lower bound', () => {
    const effects = addEffect([], 'effect.debuff.healing-received', 1000, 1)

    expect(getHealingReceivedMultiplierPermille(effects)).toBe(0)
    expect(applyHealingReceivedModifier(80, effects)).toBe(0)
  })

  it('ignores unrelated effects', () => {
    const effects = addEffect([], 'effect.poison', 999, 1)

    expect(getBattleStatMultiplierPermille(effects, 'ATTACK')).toBe(1000)
    expect(getModifiedBattleStatValue(30, effects, 'ATTACK')).toBe(30)
  })
})
