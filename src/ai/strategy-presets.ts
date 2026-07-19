import type { SkillId } from '../content/skill-definition'
import {
  DEFAULT_AI_STANDARD_SCORE_WEIGHTS,
  type AiStandardScoreWeights,
} from './standard-scorers'

export const AI_INDIVIDUAL_STRATEGIES = [
  'STANDARD',
  'ASSAULT',
  'CAUTIOUS',
  'SUPPORT',
  'POSITIONAL',
  'FIXED_TURRET',
  'BLOOM_PRIORITY',
  'BLOOM_CONSERVE',
] as const
export type AiIndividualStrategy = (typeof AI_INDIVIDUAL_STRATEGIES)[number]

export const AI_TEAM_STRATEGIES = [
  'FAST_KILL',
  'STABLE_CLEAR',
  'LOSS_MINIMIZATION',
  'INDIVIDUAL_PRIORITY',
] as const
export type AiTeamStrategy = (typeof AI_TEAM_STRATEGIES)[number]

export const AI_SKILL_POLICIES = [
  'AGGRESSIVE_USE',
  'STANDARD',
  'CONDITIONAL',
  'CONSERVE',
  'AUTO_DISABLED',
] as const
export type AiSkillPolicy = (typeof AI_SKILL_POLICIES)[number]

export interface AiSkillPolicySetting {
  readonly skillId: SkillId
  readonly policy: AiSkillPolicy
  readonly conditionSatisfied?: boolean
}

export interface AiDecisionConfiguration {
  readonly individualStrategy: AiIndividualStrategy
  readonly teamStrategy: AiTeamStrategy
  readonly skillPolicies?: readonly AiSkillPolicySetting[]
}

type WeightKey = keyof AiStandardScoreWeights
type Multipliers = Partial<Readonly<Record<WeightKey, number>>>

const SCALE = 1000

const INDIVIDUAL: Readonly<Record<AiIndividualStrategy, Multipliers>> = Object.freeze({
  STANDARD: Object.freeze({}),
  ASSAULT: Object.freeze({
    immediateDamage: 1300,
    defeatFlat: 1300,
    defeatMaxHp: 1200,
    overkill: 700,
    heavySkillWaste: 700,
    actualHealing: 700,
    rescue: 700,
    preventedDamage: 700,
    staticDanger: 600,
    telegraphEvade: 600,
    telegraphDeferredRisk: 600,
    telegraphUnavoidableRisk: 600,
    actionCost: 900,
  }),
  CAUTIOUS: Object.freeze({
    immediateDamage: 800,
    defeatFlat: 900,
    actualHealing: 1100,
    rescue: 1400,
    preventedDamage: 1300,
    coverReceived: 1400,
    allyCovered: 1200,
    staticDanger: 1500,
    immediateBacktrack: 1300,
    oscillation: 1400,
    telegraphEvade: 1500,
    telegraphDeferredRisk: 1400,
    telegraphUnavoidableRisk: 1600,
    telegraphMitigation: 1400,
  }),
  SUPPORT: Object.freeze({
    immediateDamage: 650,
    defeatFlat: 750,
    actualHealing: 1500,
    overheal: 1300,
    rescue: 1700,
    preventedDamage: 1500,
    usefulSupportAction: 1700,
    coverReceived: 1100,
    allyCovered: 1300,
  }),
  POSITIONAL: Object.freeze({
    immediateDamage: 900,
    coverReceived: 1600,
    allyCovered: 1600,
    lineOfSightTarget: 1600,
    nextActionDamage: 1700,
    staticDanger: 1400,
    immediateBacktrack: 1500,
    oscillation: 1700,
  }),
  FIXED_TURRET: Object.freeze({
    immediateDamage: 1200,
    defeatFlat: 1200,
    lineOfSightTarget: 1300,
    nextActionDamage: 400,
    staticDanger: 900,
  }),
  BLOOM_PRIORITY: Object.freeze({}),
  BLOOM_CONSERVE: Object.freeze({}),
})

const TEAM: Readonly<Record<AiTeamStrategy, Multipliers>> = Object.freeze({
  FAST_KILL: Object.freeze({
    immediateDamage: 1200,
    defeatFlat: 1400,
    defeatMaxHp: 1200,
    actualHealing: 700,
    rescue: 750,
    preventedDamage: 700,
    usefulSupportAction: 700,
    staticDanger: 700,
    telegraphEvade: 700,
    telegraphDeferredRisk: 700,
    telegraphUnavoidableRisk: 700,
    actionCost: 1200,
  }),
  STABLE_CLEAR: Object.freeze({
    actualHealing: 1150,
    rescue: 1250,
    preventedDamage: 1200,
    usefulSupportAction: 1150,
    coverReceived: 1200,
    allyCovered: 1200,
    staticDanger: 1200,
    immediateBacktrack: 1200,
    oscillation: 1300,
    telegraphEvade: 1200,
    telegraphDeferredRisk: 1200,
    telegraphUnavoidableRisk: 1300,
    telegraphMitigation: 1200,
  }),
  LOSS_MINIMIZATION: Object.freeze({
    immediateDamage: 800,
    defeatFlat: 850,
    actualHealing: 1400,
    overheal: 1200,
    rescue: 1600,
    preventedDamage: 1500,
    usefulSupportAction: 1400,
    coverReceived: 1400,
    allyCovered: 1400,
    staticDanger: 1600,
    immediateBacktrack: 1400,
    oscillation: 1600,
    telegraphEvade: 1600,
    telegraphDeferredRisk: 1500,
    telegraphUnavoidableRisk: 1700,
    telegraphMitigation: 1500,
  }),
  INDIVIDUAL_PRIORITY: Object.freeze({}),
})

function assertSafeNonNegative(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`)
  }
}

function scaledWeight(base: number, individual: number, team: number): number {
  assertSafeNonNegative(base, 'base weight')
  assertSafeNonNegative(individual, 'individual multiplier')
  assertSafeNonNegative(team, 'team multiplier')
  const divisor = BigInt(SCALE * SCALE)
  const result =
    (BigInt(base) * BigInt(individual) * BigInt(team) + divisor / 2n) / divisor
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('resolved weight must be a safe integer')
  }
  return Number(result)
}

export function resolveAiStrategyWeights(
  configuration: AiDecisionConfiguration,
  overrides: Partial<AiStandardScoreWeights> = {},
): AiStandardScoreWeights {
  if (!AI_INDIVIDUAL_STRATEGIES.includes(configuration.individualStrategy)) {
    throw new Error('individualStrategy is invalid')
  }
  if (!AI_TEAM_STRATEGIES.includes(configuration.teamStrategy)) {
    throw new Error('teamStrategy is invalid')
  }
  const base = { ...DEFAULT_AI_STANDARD_SCORE_WEIGHTS, ...overrides }
  const individual = INDIVIDUAL[configuration.individualStrategy]
  const team = TEAM[configuration.teamStrategy]
  const result = {} as Record<WeightKey, number>
  for (const key of Object.keys(DEFAULT_AI_STANDARD_SCORE_WEIGHTS) as WeightKey[]) {
    result[key] = scaledWeight(
      base[key],
      individual[key] ?? SCALE,
      team[key] ?? SCALE,
    )
  }
  return Object.freeze(result)
}

export function validateAiSkillPolicies(
  availableSkillIds: ReadonlySet<SkillId>,
  settings: readonly AiSkillPolicySetting[] = [],
): ReadonlyMap<SkillId, AiSkillPolicySetting> {
  const result = new Map<SkillId, AiSkillPolicySetting>()
  for (const setting of settings) {
    if (!availableSkillIds.has(setting.skillId)) {
      throw new Error(`skill policy references unavailable skill: ${setting.skillId}`)
    }
    if (!AI_SKILL_POLICIES.includes(setting.policy)) {
      throw new Error(`skill policy is invalid: ${setting.policy}`)
    }
    if (result.has(setting.skillId)) {
      throw new Error(`skill policy must be unique: ${setting.skillId}`)
    }
    result.set(setting.skillId, Object.freeze({ ...setting }))
  }
  return result
}
