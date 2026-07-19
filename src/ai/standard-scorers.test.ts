import { describe, expect, it } from 'vitest'
import { createTimelineQueue } from '../battle/timeline-queue'
import { createBattleState } from '../battle/defeat-and-victory'
import { createBattleUnitState } from '../battle/unit-state'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  enumerateAiActionCandidates,
  type AiActionEvaluation,
  type AiEvaluationInput,
} from './action-evaluation'
import {
  DEFAULT_AI_STANDARD_SCORE_WEIGHTS,
  createStandardAiScorers,
  evaluateStandardAiActions,
  selectBestStandardAiAction,
  type AiStandardScoringContext,
} from './standard-scorers'

const LIGHT_SKILL: SkillDefinition = Object.freeze({
  id: 'skill.score.light',
  slotType: 'INNATE',
  actionCost: 60,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'DIRECT',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 700,
})

const HEAVY_SKILL: SkillDefinition = Object.freeze({
  id: 'skill.score.heavy',
  slotType: 'GENERIC',
  actionCost: 120,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'DIRECT',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 1500,
})

const SWEEP_SKILL: SkillDefinition = Object.freeze({
  id: 'skill.score.sweep',
  slotType: 'GENERIC',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'ARC',
  areaMask: 'CROSS',
  damageMultiplierPermille: 700,
})

const HEAL_SKILL: SkillDefinition = Object.freeze({
  id: 'skill.score.heal',
  slotType: 'GENERIC',
  actionCost: 70,
  targetType: 'SINGLE_ALLY',
  reachMethod: 'SNIPE',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 1,
})

const GUARD_SKILL: SkillDefinition = Object.freeze({
  id: 'skill.score.guard',
  slotType: 'GENERIC',
  actionCost: 50,
  targetType: 'SELF',
  reachMethod: 'SELF',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 1,
})

const SPECIES: readonly MonsterSpecies[] = Object.freeze([
  Object.freeze({
    id: 'species.score.actor',
    rarity: 2,
    attributeId: 'attribute.fire',
    primarySpeciesId: 'group.score.actor',
    tagIds: Object.freeze(['tag.score']),
    innateSkillId: LIGHT_SKILL.id,
    stats: Object.freeze({ hp: 100, attack: 40, defense: 10, speed: 10 }),
  }),
  Object.freeze({
    id: 'species.score.patient',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'group.score.patient',
    tagIds: Object.freeze(['tag.score']),
    innateSkillId: LIGHT_SKILL.id,
    stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 5 }),
  }),
  Object.freeze({
    id: 'species.score.enemy-front',
    rarity: 2,
    attributeId: 'attribute.wind',
    primarySpeciesId: 'group.score.enemy-front',
    tagIds: Object.freeze(['tag.score']),
    innateSkillId: LIGHT_SKILL.id,
    stats: Object.freeze({ hp: 60, attack: 25, defense: 10, speed: 5 }),
  }),
  Object.freeze({
    id: 'species.score.enemy-side',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'group.score.enemy-side',
    tagIds: Object.freeze(['tag.score']),
    innateSkillId: LIGHT_SKILL.id,
    stats: Object.freeze({ hp: 50, attack: 20, defense: 5, speed: 4 }),
  }),
])

const SPECIES_BY_ID: Readonly<Record<string, MonsterSpecies>> = Object.freeze(
  Object.fromEntries(SPECIES.map((species) => [species.id, species])),
)

function getSpecies(speciesId: string): MonsterSpecies {
  const species = SPECIES_BY_ID[speciesId]
  if (species === undefined) {
    throw new Error(`missing species: ${speciesId}`)
  }
  return species
}

function createInput(
  availableSkills: readonly SkillDefinition[] = Object.freeze([
    LIGHT_SKILL,
    HEAVY_SKILL,
    SWEEP_SKILL,
    HEAL_SKILL,
    GUARD_SKILL,
  ]),
): AiEvaluationInput {
  const timeline = createTimelineQueue([
    Object.freeze({
      id: 'unit-turn:ally.patient',
      time: 100,
      priority: 0,
      sequence: 0,
      kind: 'UNIT_TURN',
      payload: Object.freeze({ battleUnitId: 'ally.patient' }),
    }),
  ])
  const battle = createBattleState({
    timeline,
    units: [
      createBattleUnitState(getSpecies('species.score.actor'), {
        battleUnitId: 'ally.actor',
        position: { side: 'ALLY', row: 1, column: 1 },
      }),
      createBattleUnitState(getSpecies('species.score.patient'), {
        battleUnitId: 'ally.patient',
        position: { side: 'ALLY', row: 2, column: 2 },
        initialHp: 20,
      }),
      createBattleUnitState(getSpecies('species.score.enemy-front'), {
        battleUnitId: 'enemy.front',
        position: { side: 'ENEMY', row: 0, column: 1 },
        initialHp: 15,
      }),
      createBattleUnitState(getSpecies('species.score.enemy-side'), {
        battleUnitId: 'enemy.left',
        position: { side: 'ENEMY', row: 1, column: 0 },
      }),
      createBattleUnitState(getSpecies('species.score.enemy-side'), {
        battleUnitId: 'enemy.right',
        position: { side: 'ENEMY', row: 1, column: 2 },
      }),
    ],
  })
  return Object.freeze({
    battle,
    actorBattleUnitId: 'ally.actor',
    speciesById: SPECIES_BY_ID,
    availableSkills,
  })
}

function findCandidateId(
  input: AiEvaluationInput,
  skillId: string,
  targetBattleUnitId: string | null,
): string {
  const candidate = enumerateAiActionCandidates(input).find(
    (value) =>
      value.kind === 'USE_SKILL' &&
      value.skillId === skillId &&
      value.selectedTargetBattleUnitId === targetBattleUnitId,
  )
  if (candidate === undefined) {
    throw new Error(`missing candidate for ${skillId}`)
  }
  return candidate.candidateId
}

function findEvaluation(
  evaluations: readonly AiActionEvaluation[],
  candidateId: string,
): AiActionEvaluation {
  const evaluation = evaluations.find(
    (candidate) => candidate.preview.candidate.candidateId === candidateId,
  )
  if (evaluation === undefined) {
    throw new Error(`missing evaluation: ${candidateId}`)
  }
  return evaluation
}

function getComponent(evaluation: AiActionEvaluation, componentId: string): number {
  const component = evaluation.score.components.find((value) => value.id === componentId)
  if (component === undefined) {
    throw new Error(`missing component: ${componentId}`)
  }
  return component.value
}

describe('standard AI scorers', () => {
  it('prefers a cheaper lethal attack and penalizes overkill and heavy-skill waste', () => {
    const input = createInput(Object.freeze([LIGHT_SKILL, HEAVY_SKILL]))
    const context: AiStandardScoringContext = Object.freeze({ input, currentTime: 0 })
    const evaluations = evaluateStandardAiActions(context)
    const lightId = findCandidateId(input, LIGHT_SKILL.id, 'enemy.front')
    const heavyId = findCandidateId(input, HEAVY_SKILL.id, 'enemy.front')
    const light = findEvaluation(evaluations, lightId)
    const heavy = findEvaluation(evaluations, heavyId)

    expect(getComponent(light, 'attack.immediate-damage')).toBe(1_500)
    expect(getComponent(light, 'attack.defeat-value')).toBe(5_600)
    expect(getComponent(heavy, 'attack.overkill-penalty')).toBeLessThan(
      getComponent(light, 'attack.overkill-penalty'),
    )
    expect(getComponent(heavy, 'attack.heavy-skill-waste-penalty')).toBe(
      -(HEAVY_SKILL.actionCost - LIGHT_SKILL.actionCost) *
        DEFAULT_AI_STANDARD_SCORE_WEIGHTS.heavySkillWaste,
    )
    expect(light.score.total).toBeGreaterThan(heavy.score.total)
    expect(selectBestStandardAiAction(context)?.preview.candidate.candidateId).toBe(lightId)
  })

  it('scores actual healing, overheal, and rescue before the target next action', () => {
    const input = createInput(Object.freeze([LIGHT_SKILL, HEAL_SKILL]))
    const healId = findCandidateId(input, HEAL_SKILL.id, 'ally.patient')
    const context: AiStandardScoringContext = Object.freeze({
      input,
      currentTime: 0,
      supportProjections: Object.freeze([
        Object.freeze({
          candidateId: healId,
          targets: Object.freeze([
            Object.freeze({
              battleUnitId: 'ally.patient',
              rawHealing: 50,
              appliedHealing: 40,
              preventedDamage: 0,
              usefulActionCount: 0,
            }),
          ]),
        }),
      ]),
      pendingThreats: Object.freeze([
        Object.freeze({
          threatId: 'threat.patient',
          resolvesAt: 50,
          expectedDamage: 40,
          targetBattleUnitId: 'ally.patient',
        }),
      ]),
    })
    const evaluation = findEvaluation(evaluateStandardAiActions(context), healId)

    expect(getComponent(evaluation, 'support.actual-healing')).toBe(4_000)
    expect(getComponent(evaluation, 'support.overheal-penalty')).toBe(-800)
    expect(getComponent(evaluation, 'support.rescue-before-enemy-action')).toBe(6_000)
    expect(selectBestStandardAiAction(context)?.preview.candidate.candidateId).toBe(healId)
  })

  it('scores cover, line of sight, danger cells, and movement oscillation', () => {
    const input = createInput(Object.freeze([LIGHT_SKILL]))
    const moveId = 'move:ALLY:1:0'
    const context: AiStandardScoringContext = Object.freeze({
      input,
      currentTime: 0,
      dangerZones: Object.freeze([
        Object.freeze({
          dangerId: 'danger.fire-floor',
          positionIds: Object.freeze(['ALLY:1:0']),
          expectedDamage: 20,
        }),
      ]),
      recentActorPositionIds: Object.freeze(['ALLY:1:0', 'ALLY:1:1']),
    })
    const evaluation = findEvaluation(evaluateStandardAiActions(context), moveId)

    expect(getComponent(evaluation, 'position.line-of-sight')).toBeGreaterThan(0)
    expect(getComponent(evaluation, 'position.next-action-value')).toBeGreaterThan(0)
    expect(getComponent(evaluation, 'position.static-danger-penalty')).toBe(-2_000)
    expect(getComponent(evaluation, 'position.backtrack-penalty')).toBe(-2_500)
  })

  it('rewards telegraph evasion and mitigation when the actor cannot act again in time', () => {
    const input = createInput(Object.freeze([LIGHT_SKILL, GUARD_SKILL]))
    const guardId = findCandidateId(input, GUARD_SKILL.id, 'ally.actor')
    const lightId = findCandidateId(input, LIGHT_SKILL.id, 'enemy.front')
    const context: AiStandardScoringContext = Object.freeze({
      input,
      currentTime: 0,
      supportProjections: Object.freeze([
        Object.freeze({
          candidateId: guardId,
          targets: Object.freeze([
            Object.freeze({
              battleUnitId: 'ally.actor',
              rawHealing: 0,
              appliedHealing: 0,
              preventedDamage: 20,
              usefulActionCount: 0,
            }),
          ]),
        }),
      ]),
      pendingThreats: Object.freeze([
        Object.freeze({
          threatId: 'telegraph.center',
          resolvesAt: 5_000,
          expectedDamage: 30,
          targetPositionIds: Object.freeze(['ALLY:1:1']),
        }),
      ]),
    })
    const evaluations = evaluateStandardAiActions(context)
    const guard = findEvaluation(evaluations, guardId)
    const light = findEvaluation(evaluations, lightId)
    const safeMove = evaluations.find(
      (evaluation) =>
        evaluation.preview.kind === 'MOVE' &&
        evaluation.preview.toPositionId !== 'ALLY:1:1',
    )

    expect(getComponent(guard, 'telegraph.response')).toBe(800)
    expect(getComponent(light, 'telegraph.response')).toBe(-3_600)
    expect(safeMove).toBeDefined()
    expect(getComponent(safeMove as AiActionEvaluation, 'telegraph.response')).toBe(3_600)
  })

  it('creates a stable complete scorer set and returns byte-identical results for 100 runs', () => {
    const input = createInput()
    const context: AiStandardScoringContext = Object.freeze({
      input,
      currentTime: 0,
      dangerZones: Object.freeze([
        Object.freeze({
          dangerId: 'danger.fixed',
          positionIds: Object.freeze(['ALLY:0:0']),
          expectedDamage: 10,
        }),
      ]),
    })
    expect(createStandardAiScorers(context).map((scorer) => scorer.id)).toEqual([
      'attack.immediate-damage',
      'attack.defeat-value',
      'attack.overkill-penalty',
      'attack.heavy-skill-waste-penalty',
      'support.actual-healing',
      'support.overheal-penalty',
      'support.rescue-before-enemy-action',
      'support.prevented-damage',
      'support.useful-actions',
      'position.cover',
      'position.line-of-sight',
      'position.next-action-value',
      'position.static-danger-penalty',
      'position.backtrack-penalty',
      'telegraph.response',
      'tempo.action-cost-penalty',
    ])

    const run = () => JSON.stringify(evaluateStandardAiActions(context))
    const expected = run()
    for (let index = 0; index < 100; index += 1) {
      expect(run()).toBe(expected)
    }
  })

  it('rejects invalid projections, duplicate dangers, and unsafe weights', () => {
    const input = createInput(Object.freeze([HEAL_SKILL]))
    const healId = findCandidateId(input, HEAL_SKILL.id, 'ally.patient')
    expect(() =>
      evaluateStandardAiActions({
        input,
        currentTime: 0,
        supportProjections: [
          {
            candidateId: healId,
            targets: [
              {
                battleUnitId: 'ally.patient',
                rawHealing: 10,
                appliedHealing: 11,
                preventedDamage: 0,
                usefulActionCount: 0,
              },
            ],
          },
        ],
      }),
    ).toThrow('appliedHealing must not exceed rawHealing')

    expect(() =>
      evaluateStandardAiActions({
        input,
        currentTime: 0,
        dangerZones: [
          { dangerId: 'same', positionIds: ['ALLY:0:0'], expectedDamage: 1 },
          { dangerId: 'same', positionIds: ['ALLY:0:1'], expectedDamage: 1 },
        ],
      }),
    ).toThrow('danger zone id must be unique')

    expect(() =>
      evaluateStandardAiActions({
        input,
        currentTime: 0,
        weights: { immediateDamage: Number.POSITIVE_INFINITY },
      }),
    ).toThrow('must be a safe integer')
  })
})
