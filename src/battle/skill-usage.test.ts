import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  canUseSkillWithUsageState,
  completeActorActionSkillUsage,
  createSkillUsageBook,
  getSkillUsageState,
} from './skill-usage'
import { createBattleUnitState, withBattleUnitHp } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.skill-usage',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 3 }),
  innateSkillId: 'skill.limited',
})

const limitedSkill: SkillDefinition = Object.freeze({
  id: 'skill.limited',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
  cooldownActions: 2,
  usageLimit: 2,
  usageConditions: Object.freeze([
    Object.freeze({ type: 'ACTOR_HP_AT_OR_BELOW', thresholdPermille: 500 }),
  ]),
})

const freeSkill: SkillDefinition = Object.freeze({
  id: 'skill.free',
  slotType: 'GENERIC',
  actionCost: 80,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 800,
})

function createUnits() {
  const actor = createBattleUnitState(species, {
    battleUnitId: 'ally.actor',
    position: { side: 'ALLY', row: 0, column: 0 },
  })
  const target = createBattleUnitState(species, {
    battleUnitId: 'enemy.target',
    position: { side: 'ENEMY', row: 0, column: 0 },
  })
  return { actor, target }
}

describe('skill usage state', () => {
  it('enforces actor and target HP conditions deterministically', () => {
    const { actor, target } = createUnits()
    const book = createSkillUsageBook([limitedSkill])
    expect(
      canUseSkillWithUsageState({
        usageBook: book,
        skill: limitedSkill,
        actor,
        actorSpecies: species,
        target,
        targetSpecies: species,
      }),
    ).toBe(false)

    const weakened = withBattleUnitHp(actor, species, 50)
    expect(
      canUseSkillWithUsageState({
        usageBook: book,
        skill: limitedSkill,
        actor: weakened,
        actorSpecies: species,
        target,
        targetSpecies: species,
      }),
    ).toBe(true)

    const targetConditionSkill: SkillDefinition = {
      ...freeSkill,
      id: 'skill.finisher',
      usageConditions: [
        { type: 'TARGET_HP_AT_OR_BELOW', thresholdPermille: 250 },
      ],
    }
    const targetBook = createSkillUsageBook([targetConditionSkill])
    expect(
      canUseSkillWithUsageState({
        usageBook: targetBook,
        skill: targetConditionSkill,
        actor,
        actorSpecies: species,
        target: withBattleUnitHp(target, species, 25),
        targetSpecies: species,
      }),
    ).toBe(true)
  })

  it('sets cooldown on use and advances it on movement or wait actions', () => {
    const skills = [limitedSkill, freeSkill]
    const initial = createSkillUsageBook(skills)
    const afterUse = completeActorActionSkillUsage(initial, skills, limitedSkill.id)
    expect(getSkillUsageState(afterUse, limitedSkill.id)).toEqual({
      skillId: limitedSkill.id,
      cooldownRemaining: 2,
      usesRemaining: 1,
    })

    const afterMove = completeActorActionSkillUsage(afterUse, skills, null)
    const afterWait = completeActorActionSkillUsage(afterMove, skills, null)
    expect(getSkillUsageState(afterMove, limitedSkill.id).cooldownRemaining).toBe(1)
    expect(getSkillUsageState(afterWait, limitedSkill.id).cooldownRemaining).toBe(0)
  })

  it('exhausts usage limits without mutating prior books', () => {
    const skills = [limitedSkill]
    const initial = createSkillUsageBook(skills)
    const first = completeActorActionSkillUsage(initial, skills, limitedSkill.id)
    const cooledOne = completeActorActionSkillUsage(first, skills, null)
    const cooledTwo = completeActorActionSkillUsage(cooledOne, skills, null)
    const second = completeActorActionSkillUsage(cooledTwo, skills, limitedSkill.id)

    expect(getSkillUsageState(initial, limitedSkill.id).usesRemaining).toBe(2)
    expect(getSkillUsageState(second, limitedSkill.id).usesRemaining).toBe(0)
    expect(() =>
      completeActorActionSkillUsage(second, skills, limitedSkill.id),
    ).toThrow('skill usage limit is exhausted')
  })
})
