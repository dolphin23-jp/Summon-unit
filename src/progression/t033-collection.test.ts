import { describe, expect, it } from 'vitest'
import {
  T033_INITIAL_LEARNING_STATE,
  T033_INITIAL_PLAYER_DATA,
  T033_PLAYER_CATALOG,
} from '../demo/player-collection-demo'
import { STANDARD_INTERACTIVE_BATTLE } from '../demo/standard-headless-battle'
import {
  createFormationBattleDefinition,
  moveFormationMemberPriority,
  placeFormationMember,
  saveFormationPreset,
  updateFormationMemberLoadout,
} from './formation-editor'
import {
  getGenericSkillLearningBalance,
  learnGenericSkill,
} from './generic-skill-learning'

describe('T033 generic skill learning', () => {
  it('consumes only the selected instance currency and permanently learns the skill', () => {
    const result = learnGenericSkill(
      T033_INITIAL_PLAYER_DATA,
      T033_INITIAL_LEARNING_STATE,
      'unit.delta-01',
      'skill.demo-generic-focus',
      100,
      T033_PLAYER_CATALOG,
    )

    const delta = result.playerData.collection.unitInstances.find(
      (instance) => instance.instanceId === 'unit.delta-01',
    )
    expect(delta?.learnedGenericSkillIds).toEqual(['skill.demo-generic-focus'])
    expect(getGenericSkillLearningBalance(result.learningState, 'unit.delta-01')).toBe(120)
    expect(getGenericSkillLearningBalance(result.learningState, 'unit.alpha-01')).toBe(180)
    expect(
      T033_INITIAL_PLAYER_DATA.collection.unitInstances.find(
        (instance) => instance.instanceId === 'unit.delta-01',
      )?.learnedGenericSkillIds,
    ).toEqual([])
    expect(Object.isFrozen(result.playerData)).toBe(true)
    expect(Object.isFrozen(result.learningState)).toBe(true)
  })

  it('rejects insufficient currency and duplicate or non-generic learning', () => {
    expect(() =>
      learnGenericSkill(
        T033_INITIAL_PLAYER_DATA,
        T033_INITIAL_LEARNING_STATE,
        'unit.delta-01',
        'skill.demo-generic-focus',
        500,
        T033_PLAYER_CATALOG,
      ),
    ).toThrow('insufficient generic skill currency')

    expect(() =>
      learnGenericSkill(
        T033_INITIAL_PLAYER_DATA,
        T033_INITIAL_LEARNING_STATE,
        'unit.alpha-01',
        'skill.demo-generic',
        60,
        T033_PLAYER_CATALOG,
      ),
    ).toThrow('already learned')

    expect(() =>
      learnGenericSkill(
        T033_INITIAL_PLAYER_DATA,
        T033_INITIAL_LEARNING_STATE,
        'unit.delta-01',
        'skill.demo-bloom',
        60,
        T033_PLAYER_CATALOG,
      ),
    ).toThrow('GENERIC slot')
  })
})

describe('T033 formation editing', () => {
  it('places an owned instance, swaps tie priority, and saves an independent preset', () => {
    const placed = placeFormationMember(
      T033_INITIAL_PLAYER_DATA,
      'formation.main',
      'unit.delta-01',
      { row: 0, column: 1 },
      T033_PLAYER_CATALOG,
    )
    const main = placed.formations.formations.find(
      (formation) => formation.formationId === 'formation.main',
    )
    expect(main?.members.map((member) => member.instanceId)).toContain('unit.delta-01')
    expect(main?.members.find((member) => member.instanceId === 'unit.delta-01')?.position).toEqual({
      row: 0,
      column: 1,
    })

    const reordered = moveFormationMemberPriority(
      placed,
      'formation.main',
      'unit.delta-01',
      -1,
      T033_PLAYER_CATALOG,
    )
    const reorderedMain = reordered.formations.formations.find(
      (formation) => formation.formationId === 'formation.main',
    )
    expect(
      reorderedMain?.members.find((member) => member.instanceId === 'unit.delta-01')?.tiePriority,
    ).toBeLessThan(
      main?.members.find((member) => member.instanceId === 'unit.delta-01')?.tiePriority ?? 99,
    )

    const preset = saveFormationPreset(
      reordered,
      'formation.main',
      'formation.preset-test',
      'テストプリセット',
      T033_PLAYER_CATALOG,
    )
    expect(preset.formations.activeFormationId).toBe('formation.preset-test')
    expect(
      preset.formations.formations.find(
        (formation) => formation.formationId === 'formation.preset-test',
      )?.members,
    ).toEqual(reorderedMain?.members)
    expect(
      T033_INITIAL_PLAYER_DATA.formations.formations.some(
        (formation) => formation.formationId === 'formation.preset-test',
      ),
    ).toBe(false)
  })

  it('removes policies for a skill when that skill is unequipped', () => {
    const updated = updateFormationMemberLoadout(
      T033_INITIAL_PLAYER_DATA,
      'formation.main',
      'unit.alpha-01',
      { genericSkillId: null, bloomSkillId: 'skill.demo-bloom' },
      T033_PLAYER_CATALOG,
    )
    const member = updated.formations.formations
      .find((formation) => formation.formationId === 'formation.main')
      ?.members.find((candidate) => candidate.instanceId === 'unit.alpha-01')

    expect(member?.loadout.genericSkillId).toBeNull()
    expect(member?.ai.skillPolicies?.map((setting) => setting.skillId)).toEqual([
      'skill.demo-bloom',
    ])
  })

  it('creates a battle definition from the selected formation loadout and AI settings', () => {
    const definition = createFormationBattleDefinition(
      T033_INITIAL_PLAYER_DATA,
      'formation.main',
      T033_PLAYER_CATALOG,
      STANDARD_INTERACTIVE_BATTLE,
    )

    const allies = definition.units.filter((unit) => unit.position.side === 'ALLY')
    const enemies = definition.units.filter((unit) => unit.position.side === 'ENEMY')
    expect(allies.map((unit) => unit.battleUnitId)).toEqual([
      'ally:unit.alpha-01',
      'ally:unit.beta-01',
      'ally:unit.gamma-01',
    ])
    expect(allies[0]?.equippedSkillIds).toEqual([
      'skill.demo-generic',
      'skill.demo-bloom',
    ])
    expect(enemies).toHaveLength(3)
    expect(definition.aiConfigurations?.['ally:unit.gamma-01']?.individualStrategy).toBe(
      'ASSAULT',
    )
    expect(definition.species).toBe(T033_PLAYER_CATALOG.species)
    expect(definition.skills).toBe(T033_PLAYER_CATALOG.skills)
  })
})
