import type { SkillDefinition, SkillId } from '../content/skill-definition'
import {
  compareAiActionEvaluations,
  composeAiScore,
  type AiActionEvaluation,
  type AiScoreComponent,
} from './action-evaluation'
import {
  evaluateStandardAiActions,
  type AiStandardScoringContext,
} from './standard-scorers'
import {
  resolveAiStrategyWeights,
  validateAiSkillPolicies,
  type AiDecisionConfiguration,
  type AiSkillPolicy,
  type AiSkillPolicySetting,
} from './strategy-presets'

export interface AiConfiguredDecisionContext extends AiStandardScoringContext {
  readonly configuration: AiDecisionConfiguration
}

export type AiCandidateExclusionReason = 'AUTO_DISABLED' | 'CONDITION_UNMET'

export interface AiExcludedCandidateLog {
  readonly candidateId: string
  readonly reason: AiCandidateExclusionReason
}

export interface AiDecisionCandidateLog {
  readonly rank: number
  readonly candidateId: string
  readonly totalScore: number
  readonly scoreGapFromSelected: number
}

export interface AiDecisionReasonLog {
  readonly actorBattleUnitId: string
  readonly selectedCandidateId: string
  readonly actionText: string
  readonly reasonText: string
  readonly oneLine: string
  readonly primaryReasonComponentId: string | null
  readonly totalScore: number
  readonly scoreMargin: number | null
  readonly individualStrategy: AiDecisionConfiguration['individualStrategy']
  readonly teamStrategy: AiDecisionConfiguration['teamStrategy']
  readonly skillPolicy: AiSkillPolicy | null
  readonly components: readonly AiScoreComponent[]
  readonly candidates: readonly AiDecisionCandidateLog[]
  readonly excludedCandidates: readonly AiExcludedCandidateLog[]
}

export interface AiConfiguredDecisionResult {
  readonly selected: AiActionEvaluation | null
  readonly evaluations: readonly AiActionEvaluation[]
  readonly log: AiDecisionReasonLog | null
}

const INDIVIDUAL_PRIORITY = 60
const POLICY_PRIORITY = 70
const FIXED_TURRET_MOVE_PENALTY = 12_000
const BLOOM_STRATEGY_BONUS = 5_000
const AGGRESSIVE_SKILL_BONUS = 2_000
const CONSERVE_SKILL_PENALTY = 3_000

const REASON_TEXT: Readonly<Record<string, string>> = Object.freeze({
  'attack.immediate-damage': '即時ダメージが高い',
  'attack.defeat-value': '撃破価値が高い',
  'support.actual-healing': '実回復量が高い',
  'support.rescue-before-enemy-action': '次の行動前に味方を救援できる',
  'support.prevented-damage': '被害軽減価値が高い',
  'support.useful-actions': '支援効果を有効利用できる',
  'position.cover': '遮蔽上の価値が高い',
  'position.line-of-sight': '攻撃可能な対象を確保できる',
  'position.next-action-value': '移動後の次行動価値が高い',
  'telegraph.response': '予兆被害を抑えられる',
  'strategy.individual-candidate': '個体作戦に合致する',
  'policy.skill': '技ポリシーに合致する',
})

function safeDifference(left: number, right: number): number {
  const value = BigInt(left) - BigInt(right)
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error('score difference must be a safe integer')
  }
  return Number(value)
}

function getSkill(
  context: AiConfiguredDecisionContext,
  evaluation: AiActionEvaluation,
): SkillDefinition | null {
  const candidate = evaluation.preview.candidate
  if (!('skillId' in candidate)) {
    return null
  }
  const skill = context.input.availableSkills.find(
    (available) => available.id === candidate.skillId,
  )
  if (skill === undefined) {
    throw new Error(`evaluated skill is missing: ${candidate.skillId}`)
  }
  return skill
}

function getPolicy(
  skill: SkillDefinition | null,
  policies: ReadonlyMap<SkillId, AiSkillPolicySetting>,
): AiSkillPolicySetting | null {
  if (skill === null) {
    return null
  }
  return policies.get(skill.id) ?? Object.freeze({
    skillId: skill.id,
    policy: 'STANDARD' as const,
  })
}

function getExclusion(
  policy: AiSkillPolicySetting | null,
): AiCandidateExclusionReason | null {
  if (policy?.policy === 'AUTO_DISABLED') {
    return 'AUTO_DISABLED'
  }
  if (policy?.policy === 'CONDITIONAL' && policy.conditionSatisfied !== true) {
    return 'CONDITION_UNMET'
  }
  return null
}

function individualModifier(
  context: AiConfiguredDecisionContext,
  evaluation: AiActionEvaluation,
  skill: SkillDefinition | null,
): number {
  const strategy = context.configuration.individualStrategy
  if (strategy === 'FIXED_TURRET' && evaluation.preview.kind === 'MOVE') {
    return -FIXED_TURRET_MOVE_PENALTY
  }
  if (skill?.slotType === 'BLOOM') {
    if (strategy === 'BLOOM_PRIORITY') {
      return BLOOM_STRATEGY_BONUS
    }
    if (strategy === 'BLOOM_CONSERVE') {
      return -BLOOM_STRATEGY_BONUS
    }
  }
  return 0
}

function policyModifier(policy: AiSkillPolicySetting | null): number {
  if (policy?.policy === 'AGGRESSIVE_USE') {
    return AGGRESSIVE_SKILL_BONUS
  }
  if (policy?.policy === 'CONSERVE') {
    return -CONSERVE_SKILL_PENALTY
  }
  return 0
}

function configuredEvaluation(
  context: AiConfiguredDecisionContext,
  evaluation: AiActionEvaluation,
  policy: AiSkillPolicySetting | null,
): AiActionEvaluation {
  const skill = getSkill(context, evaluation)
  const extra: readonly AiScoreComponent[] = Object.freeze([
    Object.freeze({
      id: 'strategy.individual-candidate',
      priority: INDIVIDUAL_PRIORITY,
      value: individualModifier(context, evaluation, skill),
    }),
    Object.freeze({
      id: 'policy.skill',
      priority: POLICY_PRIORITY,
      value: policyModifier(policy),
    }),
  ])
  return Object.freeze({
    ...evaluation,
    score: composeAiScore([...evaluation.score.components, ...extra]),
  })
}

function actionText(actor: string, evaluation: AiActionEvaluation): string {
  if (evaluation.preview.kind === 'MOVE') {
    return `${actor}は${evaluation.preview.toPositionId}へ移動`
  }
  return `${actor}は${evaluation.preview.candidate.skillId}を使用`
}

function primaryReason(
  selected: AiActionEvaluation,
  evaluations: readonly AiActionEvaluation[],
): { readonly componentId: string | null; readonly text: string } {
  if (selected.defeatsTarget) {
    const lethalCosts = evaluations
      .filter((evaluation) => evaluation.defeatsTarget)
      .map((evaluation) => evaluation.actionCost)
    if (selected.actionCost === Math.min(...lethalCosts)) {
      return Object.freeze({
        componentId: 'attack.defeat-value',
        text: '最小コストで撃破可能',
      })
    }
  }

  let dominant: AiScoreComponent | null = null
  for (const component of selected.score.components) {
    if (
      component.value > 0 &&
      (dominant === null || component.value > dominant.value)
    ) {
      dominant = component
    }
  }
  if (dominant === null) {
    return Object.freeze({ componentId: null, text: '総合減点が最も小さい' })
  }
  return Object.freeze({
    componentId: dominant.id,
    text: REASON_TEXT[dominant.id] ?? `${dominant.id}の評価が高い`,
  })
}

function decisionLog(
  context: AiConfiguredDecisionContext,
  selected: AiActionEvaluation,
  evaluations: readonly AiActionEvaluation[],
  excluded: readonly AiExcludedCandidateLog[],
  policies: ReadonlyMap<SkillId, AiSkillPolicySetting>,
): AiDecisionReasonLog {
  const action = actionText(context.input.actorBattleUnitId, selected)
  const reason = primaryReason(selected, evaluations)
  const second = evaluations[1]
  const policy = getPolicy(getSkill(context, selected), policies)
  return Object.freeze({
    actorBattleUnitId: context.input.actorBattleUnitId,
    selectedCandidateId: selected.preview.candidate.candidateId,
    actionText: action,
    reasonText: reason.text,
    oneLine: `${action}。理由: ${reason.text}`,
    primaryReasonComponentId: reason.componentId,
    totalScore: selected.score.total,
    scoreMargin:
      second === undefined ? null : safeDifference(selected.score.total, second.score.total),
    individualStrategy: context.configuration.individualStrategy,
    teamStrategy: context.configuration.teamStrategy,
    skillPolicy: policy?.policy ?? null,
    components: selected.score.components,
    candidates: Object.freeze(
      evaluations.map((evaluation, index) => Object.freeze({
        rank: index + 1,
        candidateId: evaluation.preview.candidate.candidateId,
        totalScore: evaluation.score.total,
        scoreGapFromSelected: safeDifference(
          selected.score.total,
          evaluation.score.total,
        ),
      })),
    ),
    excludedCandidates: excluded,
  })
}

export function evaluateConfiguredAiDecision(
  context: AiConfiguredDecisionContext,
): AiConfiguredDecisionResult {
  const availableIds = new Set(context.input.availableSkills.map((skill) => skill.id))
  const policies = validateAiSkillPolicies(
    availableIds,
    context.configuration.skillPolicies,
  )
  const standardContext: AiStandardScoringContext = Object.freeze({
    input: context.input,
    currentTime: context.currentTime,
    supportProjections: context.supportProjections,
    dangerZones: context.dangerZones,
    pendingThreats: context.pendingThreats,
    recentActorPositionIds: context.recentActorPositionIds,
    weights: resolveAiStrategyWeights(context.configuration, context.weights),
  })
  const evaluations: AiActionEvaluation[] = []
  const excluded: AiExcludedCandidateLog[] = []

  for (const evaluation of evaluateStandardAiActions(standardContext)) {
    const policy = getPolicy(getSkill(context, evaluation), policies)
    const exclusion = getExclusion(policy)
    if (exclusion !== null) {
      excluded.push(Object.freeze({
        candidateId: evaluation.preview.candidate.candidateId,
        reason: exclusion,
      }))
    } else {
      evaluations.push(configuredEvaluation(context, evaluation, policy))
    }
  }

  evaluations.sort(compareAiActionEvaluations)
  excluded.sort((left, right) => left.candidateId.localeCompare(right.candidateId))
  const frozenEvaluations = Object.freeze(evaluations)
  const frozenExcluded = Object.freeze(excluded)
  const selected = frozenEvaluations[0] ?? null
  return Object.freeze({
    selected,
    evaluations: frozenEvaluations,
    log:
      selected === null
        ? null
        : decisionLog(context, selected, frozenEvaluations, frozenExcluded, policies),
  })
}
