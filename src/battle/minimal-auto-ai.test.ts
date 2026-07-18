import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { createBattleState } from './defeat-and-victory'
import {
  enumerateMinimalAiAttackCandidates,
  enumerateMinimalAiMovementCandidates,
  selectMinimalAutoAiAction,
  type MinimalAutoAiInput,
} from './minimal-auto-ai'
import { createBattleUnitState, type BattleUnitState } from './unit-state'

const actorSpecies: MonsterSpecies = Object.freeze({
  id: 'species.ai-striker',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.ai-striker',
  tagIds: Object.freeze(['tag.ai-test']),
  innateSkillId: 'skill.ai-light',
  stats: Object.freeze({ hp: 100, attack: 30, defense: 10, speed: 4 }),
})

const enemySpecies: MonsterSpecies = Object.freeze({
  id: 'species.ai-target',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.ai-target',
  tagIds: Object.freeze(['tag.ai-test']),
  innateSkillId: 'skill.ai-target-hit',
  stats: Object.freeze({ hp: 120, attack: 20, defense: 20, speed: 3 }),
})

const allySpecies: MonsterSpecies = Object.freeze({
  id: 'species.ai-ally',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.ai-ally',
  tagIds: Object.freeze(['tag.ai-test']),
  innateSkillId: 'skill.ai-ally-hit',
  stats: Object.freeze({ hp: 80, attack: 15, defense: 15, speed: 2 }),
})

const lightSkill: SkillDefinition = Object.freeze({
  id: 'skill.ai-light',
  slotType: 'INNATE',
  actionCost: 70,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})

const heavySkill: SkillDefinition = Object.freeze({
  id: 'skill.ai-heavy',
  slotType: 'INNATE',
  actionCost: 150,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 2000,
})

const speciesById = Object.freeze({
  [actorSpecies.id]: actorSpecies,
  [enemySpecies.id]: enemySpecies,
  [allySpecies.id]: allySpecies,
})

function createUnit(
  species: MonsterSpecies,
  battleUnitId: string,
  side: 'ALLY' | 'ENEMY',
  row: 0 | 1 | 2,
  column: 0 | 1 | 2,
  initialHp?: number,
): BattleUnitState {
  return createBattleUnitState(species, {
    battleUnitId,
    position: { side, row, column },
    initialHp,
  })
}

function createInput(
  units: readonly BattleUnitState[],
  availableDirectSkills: readonly SkillDefinition[] = [lightSkill, heavySkill],
): MinimalAutoAiInput {
  return {
    battle: createBattleState({ units }),
    actorBattleUnitId: 'unit.actor',
    speciesById,
    availableDirectSkills,
  }
}

function createSameColumnBattle(targetHp = enemySpecies.stats.hp): MinimalAutoAiInput {
  return createInput([
    createUnit(actorSpecies, 'unit.actor', 'ALLY', 0, 1),
    createUnit(enemySpecies, 'unit.enemy.front', 'ENEMY', 0, 1, targetHp),
    createUnit(enemySpecies, 'unit.enemy.rear', 'ENEMY', 2, 1),
  ])
}

function reverseBattleUnitOrder(input: MinimalAutoAiInput): MinimalAutoAiInput {
  return {
    ...input,
    battle: createBattleState({ units: [...input.battle.units].reverse() }),
    availableDirectSkills: [...input.availableDirectSkills].reverse(),
  }
}

describe('minimal auto AI attack selection', () => {
  it('selects the highest-scoring DIRECT single-target attack', () => {
    const input = createSameColumnBattle()
    const candidates = enumerateMinimalAiAttackCandidates(input)
    const decision = selectMinimalAutoAiAction(input)

    expect(candidates.map((candidate) => candidate.skillId)).toEqual([
      heavySkill.id,
      lightSkill.id,
    ])
    expect(decision).toMatchObject({
      kind: 'USE_SKILL',
      actorBattleUnitId: 'unit.actor',
      skillId: heavySkill.id,
      targetBattleUnitId: 'unit.enemy.front',
      reason: {
        code: 'HIGHEST_ATTACK_SCORE',
        predictedDamage: 50,
        appliedDamage: 50,
        defeatsTarget: false,
        actionCost: 150,
      },
    })
  })

  it('uses the lighter skill when both skills defeat a weakened target', () => {
    const input = createSameColumnBattle(20)
    const candidates = enumerateMinimalAiAttackCandidates(input)
    const decision = selectMinimalAutoAiAction(input)

    expect(candidates.map((candidate) => candidate.skillId)).toEqual([
      lightSkill.id,
      heavySkill.id,
    ])
    expect(decision).toMatchObject({
      kind: 'USE_SKILL',
      skillId: lightSkill.id,
      targetBattleUnitId: 'unit.enemy.front',
      reason: {
        code: 'LOWEST_COST_DEFEAT',
        appliedDamage: 20,
        defeatsTarget: true,
        actionCost: 70,
        score: {
          immediateDamageScore: 20_000,
          defeatBonus: 1_000_000,
          actionCostPenalty: 70,
          total: 1_019_930,
        },
      },
    })
  })

  it('attacks the exposed front enemy rather than a covered rear enemy', () => {
    const decision = selectMinimalAutoAiAction(createSameColumnBattle())

    expect(decision.kind).toBe('USE_SKILL')
    if (decision.kind !== 'USE_SKILL') {
      throw new Error('expected an attack decision')
    }
    expect(decision.targetBattleUnitId).toBe('unit.enemy.front')
  })

  it('returns frozen candidate and reason data without mutating the battle or masters', () => {
    const input = createSameColumnBattle()
    const battleBefore = structuredClone(input.battle)
    const speciesBefore = JSON.stringify(input.speciesById)
    const skillsBefore = JSON.stringify(input.availableDirectSkills)
    const candidates = enumerateMinimalAiAttackCandidates(input)

    expect(Object.isFrozen(candidates)).toBe(true)
    expect(Object.isFrozen(candidates[0])).toBe(true)
    expect(Object.isFrozen(candidates[0].reason)).toBe(true)
    expect(Object.isFrozen(candidates[0].reason.score)).toBe(true)
    expect(input.battle).toEqual(battleBefore)
    expect(JSON.stringify(input.speciesById)).toBe(speciesBefore)
    expect(JSON.stringify(input.availableDirectSkills)).toBe(skillsBefore)
  })
})

describe('minimal auto AI movement and wait selection', () => {
  it('moves one column toward the nearest enemy when no DIRECT target is available', () => {
    const input = createInput([
      createUnit(actorSpecies, 'unit.actor', 'ALLY', 1, 0),
      createUnit(enemySpecies, 'unit.enemy.far', 'ENEMY', 0, 2),
    ])
    const candidates = enumerateMinimalAiMovementCandidates(input)
    const decision = selectMinimalAutoAiAction(input)

    expect(candidates.map((candidate) => candidate.reason.destinationPositionId)).toEqual([
      'ALLY:0:1',
      'ALLY:1:1',
      'ALLY:2:1',
    ])
    expect(decision).toEqual({
      kind: 'MOVE',
      actorBattleUnitId: 'unit.actor',
      destination: { side: 'ALLY', row: 0, column: 1 },
      score: -101,
      reason: {
        code: 'APPROACH_DIRECT_COLUMN',
        targetBattleUnitId: 'unit.enemy.far',
        currentColumnDistance: 2,
        columnDistanceAfterMove: 1,
        rowDistanceAfterMove: 1,
        destinationPositionId: 'ALLY:0:1',
      },
    })
  })

  it('chooses the next fixed empty improving position when the best destination is occupied', () => {
    const input = createInput([
      createUnit(actorSpecies, 'unit.actor', 'ALLY', 1, 0),
      createUnit(allySpecies, 'unit.ally.blocker', 'ALLY', 0, 1),
      createUnit(enemySpecies, 'unit.enemy.far', 'ENEMY', 0, 2),
    ])

    expect(selectMinimalAutoAiAction(input)).toMatchObject({
      kind: 'MOVE',
      destination: { side: 'ALLY', row: 1, column: 1 },
      reason: { destinationPositionId: 'ALLY:1:1' },
    })
  })

  it('waits when no attack is available and no adjacent move improves DIRECT access', () => {
    const input = createInput(
      [
        createUnit(actorSpecies, 'unit.actor', 'ALLY', 1, 0),
        createUnit(allySpecies, 'unit.ally.front-blocker', 'ALLY', 0, 1),
        createUnit(allySpecies, 'unit.ally.middle-blocker', 'ALLY', 1, 1),
        createUnit(allySpecies, 'unit.ally.rear-blocker', 'ALLY', 2, 1),
        createUnit(enemySpecies, 'unit.enemy.far', 'ENEMY', 0, 2),
      ],
      [lightSkill],
    )

    expect(selectMinimalAutoAiAction(input)).toEqual({
      kind: 'WAIT',
      actorBattleUnitId: 'unit.actor',
      score: 0,
      reason: { code: 'NO_ATTACK_OR_PURPOSEFUL_MOVE' },
    })
  })

  it('waits instead of moving aimlessly when an enemy is already in the actor column but no skill is available', () => {
    const input = createSameColumnBattle()
    const withoutSkills = { ...input, availableDirectSkills: [] }

    expect(enumerateMinimalAiMovementCandidates(withoutSkills)).toEqual([])
    expect(selectMinimalAutoAiAction(withoutSkills).kind).toBe('WAIT')
  })
})

describe('minimal auto AI determinism and validation', () => {
  it('returns exactly the same decision across reversed inputs and 100 fresh runs', () => {
    const canonical = createSameColumnBattle(20)
    const expected = selectMinimalAutoAiAction(canonical)

    for (let runIndex = 0; runIndex < 100; runIndex += 1) {
      const input =
        runIndex % 2 === 0
          ? createSameColumnBattle(20)
          : reverseBattleUnitOrder(createSameColumnBattle(20))
      expect(selectMinimalAutoAiAction(input)).toEqual(expected)
    }
  })

  it('always returns an action, including the fallback case', () => {
    const attackInput = createSameColumnBattle()
    const moveInput = createInput([
      createUnit(actorSpecies, 'unit.actor', 'ALLY', 1, 0),
      createUnit(enemySpecies, 'unit.enemy.far', 'ENEMY', 0, 2),
    ])
    const waitInput = { ...attackInput, availableDirectSkills: [] }

    expect(selectMinimalAutoAiAction(attackInput).kind).toBe('USE_SKILL')
    expect(selectMinimalAutoAiAction(moveInput).kind).toBe('MOVE')
    expect(selectMinimalAutoAiAction(waitInput).kind).toBe('WAIT')
  })

  it('rejects duplicate available skill ids', () => {
    const input = createSameColumnBattle()

    expect(() =>
      selectMinimalAutoAiAction({
        ...input,
        availableDirectSkills: [lightSkill, { ...lightSkill }],
      }),
    ).toThrow('availableDirectSkills must not contain duplicate ids: skill.ai-light')
  })

  it('rejects missing species masters', () => {
    const input = createSameColumnBattle()
    const incompleteSpecies = Object.freeze({ [actorSpecies.id]: actorSpecies })

    expect(() =>
      selectMinimalAutoAiAction({
        ...input,
        speciesById: incompleteSpecies,
      }),
    ).toThrow(`species master is missing: ${enemySpecies.id}`)
  })

  it('rejects actors that do not belong to the battle', () => {
    const input = createSameColumnBattle()

    expect(() =>
      selectMinimalAutoAiAction({
        ...input,
        actorBattleUnitId: 'unit.missing',
      }),
    ).toThrow('actor must belong to the battle: unit.missing')
  })
})
