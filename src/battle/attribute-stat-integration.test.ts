import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { createInitialUnitActionSchedule } from './action-scheduling'
import { registerActiveEffect, type ActiveEffectState } from './effect-framework'
import {
  calculateSingleTargetDamage,
  previewSingleTargetSkillDamage,
  useSingleTargetInnateSkill,
} from './single-target-damage'
import { createBattleUnitState } from './unit-state'

const skill: SkillDefinition = Object.freeze({
  id: 'skill.flame-strike',
  slotType: 'INNATE',
  attributeId: 'attribute.fire',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})

const actorSpecies: MonsterSpecies = Object.freeze({
  id: 'species.flame-runner',
  rarity: 2,
  attributeId: 'attribute.fire',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze(['tag.beast']),
  stats: Object.freeze({ hp: 120, attack: 30, defense: 20, speed: 3 }),
  innateSkillId: skill.id,
})

const targetSpecies: MonsterSpecies = Object.freeze({
  id: 'species.wind-shell',
  rarity: 2,
  attributeId: 'attribute.wind',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze(['tag.armored']),
  stats: Object.freeze({ hp: 120, attack: 20, defense: 20, speed: 2 }),
  innateSkillId: 'skill.wind-shell',
})

function addEffect(
  effects: readonly ActiveEffectState[],
  targetBattleUnitId: string,
  effectId: string,
  strength: number,
  applicationSequence: number,
): readonly ActiveEffectState[] {
  return registerActiveEffect(effects, {
    effectId,
    sourceBattleUnitId: 'ally.support',
    targetBattleUnitId,
    strength,
    duration: { unit: 'TARGET_ACTIONS', remaining: 3 },
    appliedAt: 0,
    applicationSequence,
  }).effects
}

describe('attribute and stat modifier integration', () => {
  it('applies the attribute multiplier before the single final damage rounding', () => {
    expect(calculateSingleTargetDamage(30, 20, 1000, 1250)).toBe(31)
    expect(calculateSingleTargetDamage(30, 20, 1000, 800)).toBe(20)
  })

  it('uses attack, defense, speed, and action-cost effects in skill resolution', () => {
    const actorId = 'ally.flame-runner'
    const targetId = 'enemy.wind-shell'
    let actorEffects: readonly ActiveEffectState[] = []
    actorEffects = addEffect(actorEffects, actorId, 'effect.buff.attack', 200, 1)
    actorEffects = addEffect(actorEffects, actorId, 'effect.buff.speed', 500, 2)
    actorEffects = addEffect(actorEffects, actorId, 'effect.buff.action-cost', 200, 3)
    const targetEffects = addEffect([], targetId, 'effect.debuff.defense', 250, 4)

    const actor = createBattleUnitState(actorSpecies, {
      battleUnitId: actorId,
      position: { side: 'ALLY', row: 0, column: 1 },
      initialEffects: actorEffects,
    })
    const target = createBattleUnitState(targetSpecies, {
      battleUnitId: targetId,
      position: { side: 'ENEMY', row: 0, column: 1 },
      initialEffects: targetEffects,
    })
    const actorSchedule = createInitialUnitActionSchedule(actor, actorSpecies, 100, 0)
    const input = {
      actor,
      actorSpecies,
      actorSchedule,
      target,
      targetSpecies,
      skill,
      currentTime: actorSchedule.nextActionTime,
    }

    const preview = previewSingleTargetSkillDamage(input)
    const result = useSingleTargetInnateSkill(input)

    expect(preview).toEqual({
      calculatedDamage: 39,
      effectiveAttack: 36,
      effectiveDefense: 15,
      attributeMultiplierPermille: 1250,
    })
    expect(result.calculatedDamage).toBe(preview.calculatedDamage)
    expect(result.target.hp).toBe(81)
    expect(result.effectiveActionCost).toBe(80)
    expect(result.effectiveSpeed).toBe(5)
    expect(result.actorSchedule.nextActionTime).toBe(input.currentTime + 16_000)
  })

  it('lets an explicit skill attribute override the actor species attribute', () => {
    const actor = createBattleUnitState(actorSpecies, {
      battleUnitId: 'ally.actor',
      position: { side: 'ALLY', row: 0, column: 1 },
    })
    const target = createBattleUnitState(
      { ...targetSpecies, attributeId: 'attribute.fire' },
      {
        battleUnitId: 'enemy.target',
        position: { side: 'ENEMY', row: 0, column: 1 },
      },
    )
    const waterSkill: SkillDefinition = { ...skill, attributeId: 'attribute.water' }

    expect(
      previewSingleTargetSkillDamage({
        actor,
        actorSpecies,
        target,
        targetSpecies: { ...targetSpecies, attributeId: 'attribute.fire' },
        skill: waterSkill,
      }).attributeMultiplierPermille,
    ).toBe(1250)
  })
})
