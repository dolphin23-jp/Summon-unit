import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import {
  assertValidSkillDefinition,
  type SkillDefinition,
} from '../content/skill-definition'
import {
  createInitialUnitActionSchedule,
  type UnitActionSchedule,
} from './action-scheduling'
import {
  calculateSingleTargetDamage,
  canUseSingleTargetInnateSkill,
  useSingleTargetInnateSkill,
  type SingleTargetSkillUseInput,
} from './single-target-damage'
import { createBattleUnitState, withBattleUnitHp } from './unit-state'

const skill: SkillDefinition = Object.freeze({
  id: 'skill.razor-claw',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})

const actorSpecies: MonsterSpecies = Object.freeze({
  id: 'species.grass-fang-rat',
  rarity: 1,
  attributeId: 'attribute.wind',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze(['tag.beast']),
  stats: Object.freeze({ hp: 120, attack: 30, defense: 20, speed: 3 }),
  innateSkillId: skill.id,
})

const targetSpecies: MonsterSpecies = Object.freeze({
  id: 'species.stone-shell',
  rarity: 1,
  attributeId: 'attribute.earth',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze(['tag.armored']),
  stats: Object.freeze({ hp: 120, attack: 20, defense: 20, speed: 2 }),
  innateSkillId: 'skill.shell-bash',
})

function createUseInput(): SingleTargetSkillUseInput {
  const actor = createBattleUnitState(actorSpecies, {
    battleUnitId: 'battle-unit.ally.001',
    position: { side: 'ALLY', row: 0, column: 1 },
  })
  const target = createBattleUnitState(targetSpecies, {
    battleUnitId: 'battle-unit.enemy.001',
    position: { side: 'ENEMY', row: 0, column: 1 },
  })
  const actorSchedule = createInitialUnitActionSchedule(actor, actorSpecies, 100, 0)

  return {
    actor,
    actorSpecies,
    actorSchedule,
    target,
    targetSpecies,
    skill,
    currentTime: actorSchedule.nextActionTime,
  }
}

function withScheduleUnitId(
  schedule: UnitActionSchedule,
  battleUnitId: string,
): UnitActionSchedule {
  return {
    ...schedule,
    battleUnitId,
    tie: { ...schedule.tie, battleUnitId },
  }
}

describe('minimal skill definition', () => {
  it('accepts all three slot types for the fixed single-enemy damage shape', () => {
    expect(() => assertValidSkillDefinition(skill)).not.toThrow()
    expect(() =>
      assertValidSkillDefinition({ ...skill, id: 'skill.generic', slotType: 'GENERIC' }),
    ).not.toThrow()
    expect(() =>
      assertValidSkillDefinition({ ...skill, id: 'skill.bloom', slotType: 'BLOOM' }),
    ).not.toThrow()
  })

  it.each([
    [{ ...skill, id: '' }, 'skill.id must be a non-empty string'],
    [
      { ...skill, actionCost: 0 },
      'skill.actionCost must be a safe integer greater than or equal to 1',
    ],
    [
      { ...skill, damageMultiplierPermille: 0 },
      'skill.damageMultiplierPermille must be a safe integer greater than or equal to 1',
    ],
    [
      { ...skill, slotType: 'ULTIMATE' } as unknown as SkillDefinition,
      'skill.slotType must be INNATE, GENERIC, or BLOOM',
    ],
    [
      { ...skill, targetType: 'GLOBAL' } as unknown as SkillDefinition,
      'skill.targetType is invalid',
    ],
  ] as const)('rejects invalid skill master data', (invalidSkill, message) => {
    expect(() => assertValidSkillDefinition(invalidSkill)).toThrow(message)
  })
})

describe('single-target damage calculation', () => {
  it('matches the standard reference case', () => {
    expect(calculateSingleTargetDamage(30, 20, 1000)).toBe(25)
  })

  it('decreases monotonically as defense increases', () => {
    const damages = [0, 20, 100, 200].map((defense) =>
      calculateSingleTargetDamage(30, defense, 1000),
    )

    expect(damages).toEqual([30, 25, 15, 10])
    expect(damages.every((damage, index) => index === 0 || damage <= damages[index - 1])).toBe(
      true,
    )
  })

  it('rounds only at the end and guarantees at least one damage', () => {
    expect(calculateSingleTargetDamage(5, 100, 1000)).toBe(3)
    expect(calculateSingleTargetDamage(0, 9999, 1)).toBe(1)
  })

  it.each([
    [-1, 0, 1000, 'attack must be a safe integer greater than or equal to 0'],
    [1, -1, 1000, 'defense must be a safe integer greater than or equal to 0'],
    [1, 0, 0, 'damageMultiplierPermille must be a safe integer greater than or equal to 1'],
  ] as const)('rejects invalid damage inputs', (attack, defense, multiplier, message) => {
    expect(() => calculateSingleTargetDamage(attack, defense, multiplier)).toThrow(message)
  })
})

describe('single-target innate skill use', () => {
  it('applies reference damage immutably and reschedules with the skill action cost', () => {
    const input = createUseInput()
    const actorMasterBefore = JSON.stringify(input.actorSpecies)
    const targetMasterBefore = JSON.stringify(input.targetSpecies)
    const result = useSingleTargetInnateSkill(input)

    expect(result.calculatedDamage).toBe(25)
    expect(result.appliedDamage).toBe(25)
    expect(result.target.hp).toBe(95)
    expect(result.target.defeated).toBe(false)
    expect(input.target.hp).toBe(120)
    expect(result.target).not.toBe(input.target)

    expect(result.actorSchedule.tie.actionCount).toBe(1)
    expect(result.actorSchedule.tie.lastActionTime).toBe(input.currentTime)
    expect(result.actorSchedule.nextActionTime).toBe(input.currentTime + 33_334)
    expect(input.actorSchedule.tie.actionCount).toBe(0)

    expect(JSON.stringify(input.actorSpecies)).toBe(actorMasterBefore)
    expect(JSON.stringify(input.targetSpecies)).toBe(targetMasterBefore)
    expect(skill.damageMultiplierPermille).toBe(1000)
  })

  it('clamps overkill to zero HP while reporting calculated and applied damage separately', () => {
    const input = createUseInput()
    const weakenedTarget = withBattleUnitHp(input.target, targetSpecies, 10)
    const result = useSingleTargetInnateSkill({ ...input, target: weakenedTarget })

    expect(result.calculatedDamage).toBe(25)
    expect(result.appliedDamage).toBe(10)
    expect(result.target.hp).toBe(0)
    expect(result.target.defeated).toBe(true)
  })

  it('returns identical results for identical inputs', () => {
    const input = createUseInput()

    expect(useSingleTargetInnateSkill(input)).toEqual(useSingleTargetInnateSkill(input))
  })

  it('reports whether the actor can use the skill on the selected target', () => {
    const input = createUseInput()
    expect(canUseSingleTargetInnateSkill(input)).toBe(true)

    expect(
      canUseSingleTargetInnateSkill({
        ...input,
        actor: withBattleUnitHp(input.actor, actorSpecies, 0),
      }),
    ).toBe(false)
    expect(
      canUseSingleTargetInnateSkill({
        ...input,
        target: withBattleUnitHp(input.target, targetSpecies, 0),
      }),
    ).toBe(false)
    expect(
      canUseSingleTargetInnateSkill({
        ...input,
        target: createBattleUnitState(targetSpecies, {
          battleUnitId: 'battle-unit.ally.002',
          position: { side: 'ALLY', row: 0, column: 2 },
        }),
      }),
    ).toBe(false)
    expect(
      canUseSingleTargetInnateSkill({
        ...input,
        skill: { ...skill, id: 'skill.other' },
      }),
    ).toBe(false)
    expect(
      canUseSingleTargetInnateSkill({
        ...input,
        skill: { ...skill, slotType: 'BLOOM' },
      }),
    ).toBe(false)
    expect(
      canUseSingleTargetInnateSkill({
        ...input,
        actorSchedule: withScheduleUnitId(input.actorSchedule, 'battle-unit.ally.999'),
      }),
    ).toBe(false)
    expect(
      canUseSingleTargetInnateSkill({ ...input, currentTime: input.currentTime + 1 }),
    ).toBe(false)
  })

  it('rejects an allied target without mutating either unit', () => {
    const input = createUseInput()
    const alliedTarget = createBattleUnitState(targetSpecies, {
      battleUnitId: 'battle-unit.ally.002',
      position: { side: 'ALLY', row: 0, column: 2 },
    })

    expect(() => useSingleTargetInnateSkill({ ...input, target: alliedTarget })).toThrow(
      'single-target damage skill requires an enemy target',
    )
    expect(input.actor.hp).toBe(120)
    expect(alliedTarget.hp).toBe(120)
  })

  it('rejects non-innate or unowned skills', () => {
    const input = createUseInput()

    expect(() =>
      useSingleTargetInnateSkill({ ...input, skill: { ...skill, slotType: 'BLOOM' } }),
    ).toThrow('single-target innate skill requires INNATE slotType')
    expect(() =>
      useSingleTargetInnateSkill({ ...input, skill: { ...skill, id: 'skill.other' } }),
    ).toThrow('skill.id must match actorSpecies.innateSkillId')
  })
})
