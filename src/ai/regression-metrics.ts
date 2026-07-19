import type { AiConfiguredDecisionResult } from './configured-decision'

export interface AiRegressionObservation {
  readonly observationId: string
  readonly result: AiConfiguredDecisionResult
  readonly rawHealing?: number
  readonly appliedHealing?: number
  readonly recentActorPositionIds?: readonly string[]
  readonly selectedSkillIsBloom?: boolean
}

export interface AiRegressionMetrics {
  readonly decisionCount: number
  readonly skillSelectionCount: number
  readonly moveSelectionCount: number
  readonly bloomSelectionCount: number
  readonly rawHealingTotal: number
  readonly appliedHealingTotal: number
  readonly overhealPermille: number
  readonly calculatedDamageTotal: number
  readonly appliedDamageTotal: number
  readonly overkillPermille: number
  readonly backtrackSelectionCount: number
  readonly oscillationSelectionCount: number
  readonly backtrackPermilleOfMoves: number
  readonly oscillationPermilleOfMoves: number
  readonly excludedPolicyCandidateCount: number
  readonly selectedCandidateIds: readonly string[]
  readonly reasonTexts: readonly string[]
}

function assertSafeNonNegative(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`)
  }
}

function add(values: readonly number[], field: string): number {
  const total = values.reduce((sum, value) => {
    assertSafeNonNegative(value, field)
    return sum + BigInt(value)
  }, 0n)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${field} total must be a safe integer`)
  }
  return Number(total)
}

function permille(numerator: number, denominator: number): number {
  assertSafeNonNegative(numerator, 'ratio numerator')
  assertSafeNonNegative(denominator, 'ratio denominator')
  if (denominator === 0) {
    return 0
  }
  return Number((BigInt(numerator) * 1000n) / BigInt(denominator))
}

export function collectAiRegressionMetrics(
  observations: readonly AiRegressionObservation[],
): AiRegressionMetrics {
  const ids = new Set<string>()
  for (const observation of observations) {
    if (observation.observationId.trim().length === 0) {
      throw new Error('observationId must be a non-empty string')
    }
    if (ids.has(observation.observationId)) {
      throw new Error(`observationId must be unique: ${observation.observationId}`)
    }
    ids.add(observation.observationId)
    assertSafeNonNegative(observation.rawHealing ?? 0, 'rawHealing')
    assertSafeNonNegative(observation.appliedHealing ?? 0, 'appliedHealing')
    if ((observation.appliedHealing ?? 0) > (observation.rawHealing ?? 0)) {
      throw new Error('appliedHealing must not exceed rawHealing')
    }
    if (observation.result.selected === null || observation.result.log === null) {
      throw new Error('regression observation must contain a selected decision')
    }
  }

  const selected = observations.map((observation) => observation.result.selected!)
  const moveObservations = observations.filter(
    (observation) => observation.result.selected?.preview.kind === 'MOVE',
  )
  const rawHealingTotal = add(
    observations.map((observation) => observation.rawHealing ?? 0),
    'raw healing',
  )
  const appliedHealingTotal = add(
    observations.map((observation) => observation.appliedHealing ?? 0),
    'applied healing',
  )
  const calculatedDamageTotal = add(
    selected.map((evaluation) =>
      evaluation.preview.kind === 'USE_SKILL'
        ? evaluation.preview.totalCalculatedDamage
        : 0,
    ),
    'calculated damage',
  )
  const appliedDamageTotal = add(
    selected.map((evaluation) =>
      evaluation.preview.kind === 'USE_SKILL'
        ? evaluation.preview.totalAppliedDamage
        : 0,
    ),
    'applied damage',
  )
  const backtrackSelectionCount = moveObservations.filter((observation) => {
    const preview = observation.result.selected?.preview
    return (
      preview?.kind === 'MOVE' &&
      observation.recentActorPositionIds?.[0] === preview.toPositionId
    )
  }).length
  const oscillationSelectionCount = moveObservations.filter((observation) => {
    const preview = observation.result.selected?.preview
    return (
      preview?.kind === 'MOVE' &&
      observation.recentActorPositionIds?.[0] === preview.toPositionId &&
      observation.recentActorPositionIds?.[1] === preview.fromPositionId
    )
  }).length

  return Object.freeze({
    decisionCount: observations.length,
    skillSelectionCount: selected.filter(
      (evaluation) => evaluation.preview.kind === 'USE_SKILL',
    ).length,
    moveSelectionCount: moveObservations.length,
    bloomSelectionCount: observations.filter(
      (observation) => observation.selectedSkillIsBloom === true,
    ).length,
    rawHealingTotal,
    appliedHealingTotal,
    overhealPermille: permille(
      rawHealingTotal - appliedHealingTotal,
      rawHealingTotal,
    ),
    calculatedDamageTotal,
    appliedDamageTotal,
    overkillPermille: permille(
      calculatedDamageTotal - appliedDamageTotal,
      calculatedDamageTotal,
    ),
    backtrackSelectionCount,
    oscillationSelectionCount,
    backtrackPermilleOfMoves: permille(
      backtrackSelectionCount,
      moveObservations.length,
    ),
    oscillationPermilleOfMoves: permille(
      oscillationSelectionCount,
      moveObservations.length,
    ),
    excludedPolicyCandidateCount: observations.reduce(
      (sum, observation) =>
        sum + (observation.result.log?.excludedCandidates.length ?? 0),
      0,
    ),
    selectedCandidateIds: Object.freeze(
      observations.map(
        (observation) => observation.result.selected!.preview.candidate.candidateId,
      ),
    ),
    reasonTexts: Object.freeze(
      observations.map((observation) => observation.result.log!.reasonText),
    ),
  })
}
