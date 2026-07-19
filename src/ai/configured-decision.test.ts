import { describe, expect, it } from 'vitest'
import { createBattleState } from '../battle/defeat-and-victory'
import { createTimelineQueue } from '../battle/timeline-queue'
import { createBattleUnitState } from '../battle/unit-state'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { enumerateAiActionCandidates } from './action-evaluation'
import { evaluateConfiguredAiDecision } from './configured-decision'
import {
  AI_INDIVIDUAL_STRATEGIES,
  AI_SKILL_POLICIES,
  AI_TEAM_STRATEGIES,
  resolveAiStrategyWeights,
} from './strategy-presets'

const LIGHT: SkillDefinition = Object.freeze({
  id: 'skill.config.light',
  slotType: 'INNATE',
  actionCost: 60,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'DIRECT',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 700,
})
const BLOOM: SkillDefinition = Object.freeze({
  id: 'skill.config.bloom',
  slotType: 'BLOOM',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'DIRECT',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 1300,
})
const HEAL: SkillDefinition = Object.freeze({
  id: 'skill.config.heal',
  slotType: 'GENERIC',
  actionCost: 70,
  targetType: 'SINGLE_ALLY',
  reachMethod: 'SNIPE',
  areaMask: 'SINGLE',
  damageMultiplierPermille: 1,
})

const SPECIES: readonly MonsterSpecies[] = Object.freeze([
  Object.freeze({
    id: 'species.config.actor',
    rarity: 2,
    attributeId: 'attribute.fire',
    primarySpeciesId: 'group.config.actor',
    tagIds: Object.freeze(['tag.config']),
    innateSkillId: LIGHT.id,
    stats: Object.freeze({ hp: 100, attack: 40, defense: 10, speed: 10 }),
  }),
  Object.freeze({
    id: 'species.config.ally',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'group.config.ally',
    tagIds: Object.freeze(['tag.config']),
    innateSkillId: LIGHT.id,
    stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 5 }),
  }),
  Object.freeze({
    id: 'species.config.enemy',
    rarity: 2,
    attributeId: 'attribute.wind',
    primarySpeciesId: 'group.config.enemy',
    tagIds: Object.freeze(['tag.config']),
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
    throw new Error(`missing species: ${id}`)
  }
  return value
}

function createInput(skills: readonly SkillDefinition[] = [LIGHT, BLOOM, HEAL]) {
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
        createBattleUnitState(species('species.config.actor'), {
          battleUnitId: 'ally.actor',
          position: { side: 'ALLY', row: 1, column: 1 },
        }),
        createBattleUnitState(species('species.config.ally'), {
          battleUnitId: 'ally.patient',
          position: { side: 'ALLY', row: 2, column: 2 },
          initialHp: 20,
        }),
        createBattleUnitState(species('species.config.enemy'), {
          battleUnitId: 'enemy.front',
          position: { side: 'ENEMY', row: 0, column: 1 },
          initialHp: 15,
        }),
      ],
    }),
  })
}

function skillCandidateId(
  input: ReturnType<typeof createInput>,
  skillId: string,
  targetId: string,
): string {
  const candidate = enumerateAiActionCandidates(input).find(
    (value) =>
      value.kind === 'USE_SKILL' &&
      value.skillId === skillId &&
      value.selectedTargetBattleUnitId === targetId,
  )
  if (candidate === undefined) {
    throw new Error(`missing candidate: ${skillId}`)
  }
  return candidate.candidateId
}

const STANDARD_CONFIGURATION = Object.freeze({
  individualStrategy: 'STANDARD' as const,
  teamStrategy: 'INDIVIDUAL_PRIORITY' as const,
})

describe('configured AI decisions', () => {
  it('defines all documented individual, team, and skill policy presets', () => {
    expect(AI_INDIVIDUAL_STRATEGIES).toEqual([
      'STANDARD',
      'ASSAULT',
      'CAUTIOUS',
      'SUPPORT',
      'POSITIONAL',
      'FIXED_TURRET',
      'BLOOM_PRIORITY',
      'BLOOM_CONSERVE',
    ])
    expect(AI_TEAM_STRATEGIES).toEqual([
      'FAST_KILL',
      'STABLE_CLEAR',
      'LOSS_MINIMIZATION',
      'INDIVIDUAL_PRIORITY',
    ])
    expect(AI_SKILL_POLICIES).toEqual([
      'AGGRESSIVE_USE',
      'STANDARD',
      'CONDITIONAL',
      'CONSERVE',
      'AUTO_DISABLED',
    ])
  })

  it('combines individual and team strategies into deterministic integer weights', () => {
    const assault = resolveAiStrategyWeights({
      individualStrategy: 'ASSAULT',
      teamStrategy: 'FAST_KILL',
    })
    const cautious = resolveAiStrategyWeights({
      individualStrategy: 'CAUTIOUS',
      teamStrategy: 'LOSS_MINIMIZATION',
    })

    expect(assault.immediateDamage).toBeGreaterThan(cautious.immediateDamage)
    expect(cautious.telegraphUnavoidableRisk).toBeGreaterThan(
      assault.telegraphUnavoidableRisk,
    )
    expect(Object.values(assault).every(Number.isSafeInteger)).toBe(true)
  })

  it('creates a one-line reason and complete detailed score log', () => {
    const input = createInput([LIGHT, BLOOM])
    const result = evaluateConfiguredAiDecision({
      input,
      currentTime: 0,
      configuration: STANDARD_CONFIGURATION,
    })

    expect(result.selected?.preview.candidate.candidateId).toBe(
      skillCandidateId(input, LIGHT.id, 'enemy.front'),
    )
    expect(result.log?.oneLine).toContain('理由: 最小コストで撃破可能')
    expect(result.log?.components.map((component) => component.id)).toContain(
      'strategy.individual-candidate',
    )
    expect(result.log?.components.map((component) => component.id)).toContain(
      'policy.skill',
    )
    expect(result.log?.candidates[0]).toMatchObject({ rank: 1 })
  })

  it('applies bloom priority, fixed turret, and skill policy modifiers', () => {
    const input = createInput([LIGHT, BLOOM])
    const bloomPriority = evaluateConfiguredAiDecision({
      input,
      currentTime: 0,
      configuration: {
        individualStrategy: 'BLOOM_PRIORITY',
        teamStrategy: 'INDIVIDUAL_PRIORITY',
      },
    })
    expect(bloomPriority.selected?.preview.candidate.candidateId).toBe(
      skillCandidateId(input, BLOOM.id, 'enemy.front'),
    )

    const turret = evaluateConfiguredAiDecision({
      input,
      currentTime: 0,
      configuration: {
        individualStrategy: 'FIXED_TURRET',
        teamStrategy: 'INDIVIDUAL_PRIORITY',
      },
    })
    const move = turret.evaluations.find(
      (evaluation) => evaluation.preview.kind === 'MOVE',
    )
    expect(
      move?.score.components.find(
        (component) => component.id === 'strategy.individual-candidate',
      )?.value,
    ).toBe(-12_000)

    const aggressive = evaluateConfiguredAiDecision({
      input,
      currentTime: 0,
      configuration: {
        ...STANDARD_CONFIGURATION,
        skillPolicies: [{ skillId: BLOOM.id, policy: 'AGGRESSIVE_USE' }],
      },
    })
    const bloom = aggressive.evaluations.find(
      (evaluation) =>
        evaluation.preview.kind === 'USE_SKILL' &&
        evaluation.preview.candidate.skillId === BLOOM.id,
    )
    expect(
      bloom?.score.components.find((component) => component.id === 'policy.skill')
        ?.value,
    ).toBe(2_000)
  })

  it('excludes disabled and unmet conditional skills from AUTO decisions', () => {
    const input = createInput([LIGHT, BLOOM])
    const result = evaluateConfiguredAiDecision({
      input,
      currentTime: 0,
      configuration: {
        ...STANDARD_CONFIGURATION,
        skillPolicies: [
          { skillId: LIGHT.id, policy: 'AUTO_DISABLED' },
          { skillId: BLOOM.id, policy: 'CONDITIONAL', conditionSatisfied: false },
        ],
      },
    })

    expect(result.selected?.preview.kind).toBe('MOVE')
    expect(result.log?.excludedCandidates).toHaveLength(2)
    expect(result.log?.excludedCandidates.map((candidate) => candidate.reason)).toEqual([
      'CONDITION_UNMET',
      'AUTO_DISABLED',
    ])
  })

  it('allows support strategy and skill policy to select an urgent rescue', () => {
    const input = createInput([LIGHT, HEAL])
    const healId = skillCandidateId(input, HEAL.id, 'ally.patient')
    const result = evaluateConfiguredAiDecision({
      input,
      currentTime: 0,
      configuration: {
        individualStrategy: 'SUPPORT',
        teamStrategy: 'LOSS_MINIMIZATION',
        skillPolicies: [{ skillId: HEAL.id, policy: 'AGGRESSIVE_USE' }],
      },
      supportProjections: [
        {
          candidateId: healId,
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
    })

    expect(result.selected?.preview.candidate.candidateId).toBe(healId)
    expect(result.log?.reasonText).toBe('次の行動前に味方を救援できる')
  })

  it('returns byte-identical configured decisions for 100 runs', () => {
    const input = createInput()
    const run = () =>
      JSON.stringify(
        evaluateConfiguredAiDecision({
          input,
          currentTime: 0,
          configuration: {
            individualStrategy: 'CAUTIOUS',
            teamStrategy: 'STABLE_CLEAR',
            skillPolicies: [{ skillId: BLOOM.id, policy: 'CONSERVE' }],
          },
          dangerZones: [
            {
              dangerId: 'danger.left',
              positionIds: ['ALLY:1:0'],
              expectedDamage: 20,
            },
          ],
        }),
      )
    const expected = run()
    for (let index = 0; index < 100; index += 1) {
      expect(run()).toBe(expected)
    }
  })

  it('rejects duplicate and unavailable skill policies', () => {
    const input = createInput([LIGHT])
    expect(() =>
      evaluateConfiguredAiDecision({
        input,
        currentTime: 0,
        configuration: {
          ...STANDARD_CONFIGURATION,
          skillPolicies: [
            { skillId: LIGHT.id, policy: 'STANDARD' },
            { skillId: LIGHT.id, policy: 'CONSERVE' },
          ],
        },
      }),
    ).toThrow('skill policy must be unique')
    expect(() =>
      evaluateConfiguredAiDecision({
        input,
        currentTime: 0,
        configuration: {
          ...STANDARD_CONFIGURATION,
          skillPolicies: [{ skillId: 'missing', policy: 'STANDARD' }],
        },
      }),
    ).toThrow('unavailable skill')
  })
})
