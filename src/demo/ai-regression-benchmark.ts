import { createBattleState } from '../battle/defeat-and-victory'
import { createTimelineQueue } from '../battle/timeline-queue'
import { createBattleUnitState } from '../battle/unit-state'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import type { AiEvaluationInput } from '../ai/action-evaluation'
import { evaluateConfiguredAiDecision } from '../ai/configured-decision'
import {
  collectAiRegressionMetrics,
  type AiRegressionMetrics,
  type AiRegressionObservation,
} from '../ai/regression-metrics'

const LIGHT: SkillDefinition = Object.freeze({
  id: 'skill.benchmark.light',
  slotType: 'INNATE',
  actionCost: 60,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'DIRECT',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 700,
})
const BLOOM: SkillDefinition = Object.freeze({
  id: 'skill.benchmark.bloom',
  slotType: 'BLOOM',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'DIRECT',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 1300,
})
const HEAL: SkillDefinition = Object.freeze({
  id: 'skill.benchmark.heal',
  slotType: 'GENERIC',
  actionCost: 70,
  targetType: 'SINGLE_ALLY',
  reachMethod: 'SNIPE',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 1,
})

const SPECIES: readonly MonsterSpecies[] = Object.freeze([
  Object.freeze({
    id: 'species.benchmark.actor',
    rarity: 2,
    attributeId: 'attribute.fire',
    primarySpeciesId: 'group.benchmark.actor',
    tagIds: Object.freeze(['tag.benchmark']),
    innateSkillId: LIGHT.id,
    stats: Object.freeze({ hp: 100, attack: 40, defense: 10, speed: 10 }),
  }),
  Object.freeze({
    id: 'species.benchmark.ally',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'group.benchmark.ally',
    tagIds: Object.freeze(['tag.benchmark']),
    innateSkillId: LIGHT.id,
    stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 5 }),
  }),
  Object.freeze({
    id: 'species.benchmark.enemy',
    rarity: 2,
    attributeId: 'attribute.wind',
    primarySpeciesId: 'group.benchmark.enemy',
    tagIds: Object.freeze(['tag.benchmark']),
    innateSkillId: LIGHT.id,
    stats: Object.freeze({ hp: 60, attack: 20, defense: 10, speed: 5 }),
  }),
])
const SPECIES_BY_ID = Object.freeze(
  Object.fromEntries(SPECIES.map((species) => [species.id, species])) as Readonly<
    Record<string, MonsterSpecies>
  >,
)

function species(id: string): MonsterSpecies {
  const value = SPECIES_BY_ID[id]
  if (value === undefined) {
    throw new Error(`benchmark species is missing: ${id}`)
  }
  return value
}

function baseInput(skills: readonly SkillDefinition[]): AiEvaluationInput {
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
  return Object.freeze({
    actorBattleUnitId: 'ally.actor',
    speciesById: SPECIES_BY_ID,
    availableSkills: Object.freeze(skills),
    battle: createBattleState({
      timeline,
      units: [
        createBattleUnitState(species('species.benchmark.actor'), {
          battleUnitId: 'ally.actor',
          position: { side: 'ALLY', row: 1, column: 1 },
        }),
        createBattleUnitState(species('species.benchmark.ally'), {
          battleUnitId: 'ally.patient',
          position: { side: 'ALLY', row: 2, column: 2 },
          initialHp: 20,
        }),
        createBattleUnitState(species('species.benchmark.enemy'), {
          battleUnitId: 'enemy.front',
          position: { side: 'ENEMY', row: 0, column: 1 },
          initialHp: 15,
        }),
      ],
    }),
  })
}

function cornerInput(skills: readonly SkillDefinition[]): AiEvaluationInput {
  return Object.freeze({
    actorBattleUnitId: 'ally.actor',
    speciesById: SPECIES_BY_ID,
    availableSkills: Object.freeze(skills),
    battle: createBattleState({
      units: [
        createBattleUnitState(species('species.benchmark.actor'), {
          battleUnitId: 'ally.actor',
          position: { side: 'ALLY', row: 0, column: 0 },
        }),
        createBattleUnitState(species('species.benchmark.ally'), {
          battleUnitId: 'ally.blocker-a',
          position: { side: 'ALLY', row: 0, column: 1 },
        }),
        createBattleUnitState(species('species.benchmark.ally'), {
          battleUnitId: 'ally.blocker-b',
          position: { side: 'ALLY', row: 1, column: 1 },
        }),
        createBattleUnitState(species('species.benchmark.enemy'), {
          battleUnitId: 'enemy.front',
          position: { side: 'ENEMY', row: 0, column: 0 },
          initialHp: 60,
        }),
      ],
    }),
  })
}

function skillCandidateId(
  input: AiEvaluationInput,
  skillId: string,
  targetId: string,
): string {
  return `skill:${skillId}:target:${targetId}:position:${
    input.battle.units.find((unit) => unit.battleUnitId === targetId)?.position.side
  }:${
    input.battle.units.find((unit) => unit.battleUnitId === targetId)?.position.row
  }:${
    input.battle.units.find((unit) => unit.battleUnitId === targetId)?.position.column
  }`
}

export function runReferenceAiRegressionBenchmark(): AiRegressionMetrics {
  const attackInput = baseInput([LIGHT])
  const healInput = baseInput([LIGHT, HEAL])
  const bloomInput = baseInput([LIGHT, BLOOM])
  const moveInput = cornerInput([LIGHT])
  const healCandidateId = skillCandidateId(healInput, HEAL.id, 'ally.patient')

  const observations: readonly AiRegressionObservation[] = Object.freeze([
    Object.freeze({
      observationId: 'attack-standard',
      result: evaluateConfiguredAiDecision({
        input: attackInput,
        currentTime: 0,
        configuration: {
          individualStrategy: 'STANDARD',
          teamStrategy: 'INDIVIDUAL_PRIORITY',
        },
      }),
    }),
    Object.freeze({
      observationId: 'support-rescue',
      result: evaluateConfiguredAiDecision({
        input: healInput,
        currentTime: 0,
        configuration: {
          individualStrategy: 'SUPPORT',
          teamStrategy: 'LOSS_MINIMIZATION',
          skillPolicies: [{ skillId: HEAL.id, policy: 'AGGRESSIVE_USE' }],
        },
        supportProjections: [
          {
            candidateId: healCandidateId,
            targets: [
              {
                battleUnitId: 'ally.patient',
                rawHealing: 50,
                appliedHealing: 40,
                preventedDamage: 0,
                usefulActionCount: 0,
              },
            ],
          },
        ],
        pendingThreats: [
          {
            threatId: 'threat.patient',
            resolvesAt: 50,
            expectedDamage: 40,
            targetBattleUnitId: 'ally.patient',
          },
        ],
      }),
      rawHealing: 50,
      appliedHealing: 40,
    }),
    Object.freeze({
      observationId: 'cautious-telegraph-evade',
      result: evaluateConfiguredAiDecision({
        input: moveInput,
        currentTime: 0,
        configuration: {
          individualStrategy: 'CAUTIOUS',
          teamStrategy: 'STABLE_CLEAR',
        },
        pendingThreats: [
          {
            threatId: 'telegraph.corner',
            resolvesAt: 5_000,
            expectedDamage: 30,
            targetPositionIds: ['ALLY:0:0'],
          },
        ],
      }),
    }),
    Object.freeze({
      observationId: 'bloom-priority',
      result: evaluateConfiguredAiDecision({
        input: bloomInput,
        currentTime: 0,
        configuration: {
          individualStrategy: 'BLOOM_PRIORITY',
          teamStrategy: 'INDIVIDUAL_PRIORITY',
        },
      }),
      selectedSkillIsBloom: true,
    }),
    Object.freeze({
      observationId: 'auto-disabled-fallback',
      result: evaluateConfiguredAiDecision({
        input: moveInput,
        currentTime: 0,
        configuration: {
          individualStrategy: 'STANDARD',
          teamStrategy: 'INDIVIDUAL_PRIORITY',
          skillPolicies: [{ skillId: LIGHT.id, policy: 'AUTO_DISABLED' }],
        },
      }),
    }),
  ])

  return collectAiRegressionMetrics(observations)
}

export function serializeReferenceAiRegressionBenchmark(): string {
  return JSON.stringify(runReferenceAiRegressionBenchmark(), null, 2)
}
