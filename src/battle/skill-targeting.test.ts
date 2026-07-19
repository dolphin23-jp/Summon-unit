import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition, SkillTargetType } from '../content/skill-definition'
import { createBattleState } from './defeat-and-victory'
import { resolveSkillTargetGroup, getSkillPrimaryTargetCandidates } from './skill-targeting'
import { createTimelineQueue } from './timeline-queue'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.targeting',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 3 }),
  innateSkillId: 'skill.targeting',
})

function createSkill(targetType: SkillTargetType): SkillDefinition {
  return Object.freeze({
    id: `skill.${targetType.toLowerCase()}`,
    slotType: 'INNATE',
    actionCost: 100,
    targetType,
    damageMultiplierPermille: 1000,
  })
}

function createBattle() {
  const actor = createBattleUnitState(species, {
    battleUnitId: 'ally.actor',
    position: { side: 'ALLY', row: 0, column: 0 },
  })
  const allyAdjacentA = createBattleUnitState(species, {
    battleUnitId: 'ally.a',
    position: { side: 'ALLY', row: 0, column: 1 },
  })
  const allyAdjacentB = createBattleUnitState(species, {
    battleUnitId: 'ally.b',
    position: { side: 'ALLY', row: 1, column: 0 },
  })
  const allyFar = createBattleUnitState(species, {
    battleUnitId: 'ally.far',
    position: { side: 'ALLY', row: 2, column: 2 },
  })
  const enemyA = createBattleUnitState(species, {
    battleUnitId: 'enemy.a',
    position: { side: 'ENEMY', row: 0, column: 0 },
  })
  const enemyB = createBattleUnitState(species, {
    battleUnitId: 'enemy.b',
    position: { side: 'ENEMY', row: 2, column: 2 },
  })
  return createBattleState({
    units: [actor, allyAdjacentA, allyAdjacentB, allyFar, enemyB, enemyA],
    timeline: createTimelineQueue(),
  })
}

describe('generalized skill targeting', () => {
  it('returns deterministic enemy and ally primary candidates', () => {
    const battle = createBattle()
    expect(
      getSkillPrimaryTargetCandidates(battle, 'ally.actor', createSkill('SINGLE_ENEMY')).map(
        (unit) => unit.battleUnitId,
      ),
    ).toEqual(['enemy.a', 'enemy.b'])
    expect(
      getSkillPrimaryTargetCandidates(battle, 'ally.actor', createSkill('SINGLE_ALLY')).map(
        (unit) => unit.battleUnitId,
      ),
    ).toEqual(['ally.a', 'ally.actor', 'ally.b', 'ally.far'])
  })

  it('resolves ally plus adjacent units with the selected target first', () => {
    const targets = resolveSkillTargetGroup({
      battle: createBattle(),
      actorBattleUnitId: 'ally.actor',
      skill: createSkill('SINGLE_ALLY_AND_ADJACENT'),
      selectedTargetBattleUnitId: 'ally.actor',
    })
    expect(targets.map((unit) => unit.battleUnitId)).toEqual([
      'ally.actor',
      'ally.a',
      'ally.b',
    ])
  })

  it('resolves self and self-centered area without a selected target', () => {
    const battle = createBattle()
    expect(
      resolveSkillTargetGroup({
        battle,
        actorBattleUnitId: 'ally.actor',
        skill: createSkill('SELF'),
      }).map((unit) => unit.battleUnitId),
    ).toEqual(['ally.actor'])
    expect(
      resolveSkillTargetGroup({
        battle,
        actorBattleUnitId: 'ally.actor',
        skill: createSkill('SELF_AREA'),
      }).map((unit) => unit.battleUnitId),
    ).toEqual(['ally.actor', 'ally.a', 'ally.b'])
  })

  it('rejects a target from the wrong side', () => {
    expect(() =>
      resolveSkillTargetGroup({
        battle: createBattle(),
        actorBattleUnitId: 'ally.actor',
        skill: createSkill('SINGLE_ENEMY'),
        selectedTargetBattleUnitId: 'ally.a',
      }),
    ).toThrow('selected skill target must be an enemy')
  })
})
