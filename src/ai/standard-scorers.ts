import { calculateNextActionTime, type BattleTime } from '../battle/action-scheduling'
import {
  ALL_BOARD_POSITIONS,
  getBoardPositionId,
  type BoardPosition,
} from '../battle/board'
import {
  assertValidBattleState,
  type BattleState,
} from '../battle/defeat-and-victory'
import { getModifiedBattleStatValue } from '../battle/stat-modifiers'
import type { BattleUnitId, BattleUnitState } from '../battle/unit-state'
import type { MonsterSpecies } from '../content/monster-species'
import {
  compareAiActionEvaluations,
  enumerateAiActionCandidates,
  evaluateAiActionPreview,
  previewAiActionCandidate,
  type AiActionEvaluation,
  type AiActionResultPreview,
  type AiEvaluationInput,
  type AiPreviewScorer,
  type AiSkillActionResultPreview,
} from './action-evaluation'

export interface AiStandardScoreWeights {
  readonly immediateDamage: number
  readonly defeatFlat: number
  readonly defeatMaxHp: number
  readonly overkill: number
  readonly heavySkillWaste: number
  readonly actualHealing: number
  readonly overheal: number
  readonly rescue: number
  readonly preventedDamage: number
  readonly usefulSupportAction: number
  readonly coverReceived: number
  readonly allyCovered: number
  readonly lineOfSightTarget: number
  readonly nextActionDamage: number
  readonly staticDanger: number
  readonly immediateBacktrack: number
  readonly oscillation: number
  readonly telegraphEvade: number
  readonly telegraphDeferredRisk: number
  readonly telegraphUnavoidableRisk: number
  readonly telegraphMitigation: number
  readonly actionCost: number
}

export const DEFAULT_AI_STANDARD_SCORE_WEIGHTS: AiStandardScoreWeights = Object.freeze({
  immediateDamage: 100,
  defeatFlat: 5_000,
  defeatMaxHp: 10,
  overkill: 80,
  heavySkillWaste: 20,
  actualHealing: 100,
  overheal: 80,
  rescue: 6_000,
  preventedDamage: 80,
  usefulSupportAction: 300,
  coverReceived: 400,
  allyCovered: 250,
  lineOfSightTarget: 200,
  nextActionDamage: 25,
  staticDanger: 100,
  immediateBacktrack: 1_000,
  oscillation: 1_500,
  telegraphEvade: 120,
  telegraphDeferredRisk: 25,
  telegraphUnavoidableRisk: 120,
  telegraphMitigation: 100,
  actionCost: 10,
})

export interface AiProjectedSupportTarget {
  readonly battleUnitId: BattleUnitId
  readonly rawHealing: number
  readonly appliedHealing: number
  readonly preventedDamage: number
  readonly usefulActionCount: number
}

export interface AiCandidateSupportProjection {
  readonly candidateId: string
  readonly targets: readonly AiProjectedSupportTarget[]
}

export interface AiDangerZone {
  readonly dangerId: string
  readonly positionIds: readonly string[]
  readonly expectedDamage: number
}

export interface AiPendingThreat {
  readonly threatId: string
  readonly resolvesAt: BattleTime
  readonly expectedDamage: number
  readonly targetBattleUnitId?: BattleUnitId
  readonly targetPositionIds?: readonly string[]
}

export interface AiStandardScoringContext {
  readonly input: AiEvaluationInput
  readonly currentTime: BattleTime
  readonly supportProjections?: readonly AiCandidateSupportProjection[]
  readonly dangerZones?: readonly AiDangerZone[]
  readonly pendingThreats?: readonly AiPendingThreat[]
  readonly recentActorPositionIds?: readonly string[]
  readonly weights?: Partial<AiStandardScoreWeights>
}

interface CandidatePositionMetrics {
  readonly coverReceived: number
  readonly alliesCovered: number
  readonly lineOfSightTargetCount: number
  readonly nextActionDamage: number
  readonly staticDangerDamage: number
  readonly immediateBacktrack: boolean
  readonly oscillation: boolean
}

interface CandidateSupportMetrics {
  readonly rawHealing: number
  readonly appliedHealing: number
  readonly preventedDamage: number
  readonly usefulActionCount: number
  readonly rescueCount: number
  readonly preventedDamageForActor: number
}

interface CandidateTelegraphMetrics {
  readonly escapedDamage: number
  readonly deferredRiskDamage: number
  readonly unavoidableRiskDamage: number
  readonly mitigatedUnavoidableDamage: number
}

interface CandidateMetrics {
  readonly preview: AiActionResultPreview
  readonly heavyWasteCost: number
  readonly position: CandidatePositionMetrics
  readonly support: CandidateSupportMetrics
  readonly telegraph: CandidateTelegraphMetrics
}

interface PreparedStandardScoring {
  readonly previews: readonly AiActionResultPreview[]
  readonly scorers: readonly AiPreviewScorer[]
}

const EMPTY_SUPPORT_PROJECTIONS: readonly AiCandidateSupportProjection[] = Object.freeze([])
const EMPTY_DANGER_ZONES: readonly AiDangerZone[] = Object.freeze([])
const EMPTY_PENDING_THREATS: readonly AiPendingThreat[] = Object.freeze([])
const EMPTY_POSITION_HISTORY: readonly string[] = Object.freeze([])
const POSITION_IDS = new Set(ALL_BOARD_POSITIONS.map(getBoardPositionId))

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function assertPositionId(positionId: string, field: string): void {
  if (!POSITION_IDS.has(positionId)) {
    throw new Error(`${field} must be a valid board position id`)
  }
}

function safeProduct(value: number, weight: number, field: string): number {
  assertSafeIntegerAtLeast(value, 0, `${field} value`)
  assertSafeIntegerAtLeast(weight, 0, `${field} weight`)
  const product = BigInt(value) * BigInt(weight)
  if (product > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${field} score must be a safe integer`)
  }
  return Number(product)
}

function safeAdd(values: readonly number[], field: string): number {
  let total = 0n
  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${field} values must be safe integers`)
    }
    total += BigInt(value)
  }
  if (
    total > BigInt(Number.MAX_SAFE_INTEGER) ||
    total < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error(`${field} must be a safe integer`)
  }
  return Number(total)
}

function getRequiredUnit(
  battle: BattleState,
  battleUnitId: BattleUnitId,
): BattleUnitState {
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`battle unit is missing: ${battleUnitId}`)
  }
  return unit
}

function getRequiredSpecies(
  speciesById: Readonly<Record<string, MonsterSpecies>>,
  speciesId: string,
): MonsterSpecies {
  const species = speciesById[speciesId]
  if (species === undefined) {
    throw new Error(`species master is missing: ${speciesId}`)
  }
  return species
}

function resolveWeights(
  overrides: Partial<AiStandardScoreWeights> | undefined,
): AiStandardScoreWeights {
  const weights = Object.freeze({
    ...DEFAULT_AI_STANDARD_SCORE_WEIGHTS,
    ...(overrides ?? {}),
  })
  for (const [name, value] of Object.entries(weights)) {
    assertSafeIntegerAtLeast(value, 0, `weights.${name}`)
  }
  return weights
}

function freezePosition(position: BoardPosition): BoardPosition {
  return Object.freeze({ ...position })
}

function createBattleWithActorPosition(
  input: AiEvaluationInput,
  position: BoardPosition,
): BattleState {
  const actor = getRequiredUnit(input.battle, input.actorBattleUnitId)
  if (position.side !== actor.side) {
    throw new Error('virtual actor position must remain on the actor side')
  }
  if (getBoardPositionId(position) === getBoardPositionId(actor.position)) {
    return input.battle
  }

  const units = Object.freeze(
    input.battle.units.map((unit) =>
      unit.battleUnitId === actor.battleUnitId
        ? Object.freeze({ ...unit, position: freezePosition(position) })
        : unit,
    ),
  )
  const occupancy = Object.freeze(
    input.battle.occupancy.map((occupant) =>
      occupant.battleUnitId === actor.battleUnitId
        ? Object.freeze({
            battleUnitId: occupant.battleUnitId,
            position: freezePosition(position),
          })
        : occupant,
    ),
  )
  const battle: BattleState = Object.freeze({
    ...input.battle,
    units,
    occupancy,
  })
  assertValidBattleState(battle)
  return battle
}

function getFinalPosition(
  input: AiEvaluationInput,
  preview: AiActionResultPreview,
): BoardPosition {
  if (preview.kind === 'MOVE') {
    return preview.candidate.destination
  }
  return getRequiredUnit(input.battle, input.actorBattleUnitId).position
}

function getVirtualInput(
  input: AiEvaluationInput,
  preview: AiActionResultPreview,
): AiEvaluationInput {
  const finalPosition = getFinalPosition(input, preview)
  const battle = createBattleWithActorPosition(input, finalPosition)
  return battle === input.battle
    ? input
    : Object.freeze({ ...input, battle })
}

function getCoverMetrics(
  input: AiEvaluationInput,
  preview: AiActionResultPreview,
): Pick<CandidatePositionMetrics, 'coverReceived' | 'alliesCovered'> {
  const actor = getRequiredUnit(input.battle, input.actorBattleUnitId)
  const position = getFinalPosition(input, preview)
  const allies = input.battle.units.filter(
    (unit) =>
      !unit.defeated &&
      unit.side === actor.side &&
      unit.battleUnitId !== actor.battleUnitId &&
      unit.position.column === position.column,
  )
  return Object.freeze({
    coverReceived: allies.some((unit) => unit.position.row < position.row) ? 1 : 0,
    alliesCovered: allies.filter((unit) => unit.position.row > position.row).length,
  })
}

function getFutureAttackMetrics(
  input: AiEvaluationInput,
  preview: AiActionResultPreview,
): Pick<CandidatePositionMetrics, 'lineOfSightTargetCount' | 'nextActionDamage'> {
  const virtualInput = getVirtualInput(input, preview)
  const futureSkillPreviews = enumerateAiActionCandidates(virtualInput)
    .filter((candidate) => candidate.kind === 'USE_SKILL')
    .map((candidate) => previewAiActionCandidate(virtualInput, candidate))
    .filter(
      (candidatePreview): candidatePreview is AiSkillActionResultPreview =>
        candidatePreview.kind === 'USE_SKILL' &&
        candidatePreview.totalAppliedDamage > 0,
    )
  const targetIds = new Set<BattleUnitId>()
  let nextActionDamage = 0
  for (const futurePreview of futureSkillPreviews) {
    for (const result of futurePreview.targetResults) {
      if (result.appliedDamage > 0) {
        targetIds.add(result.battleUnitId)
      }
    }
    nextActionDamage = Math.max(nextActionDamage, futurePreview.totalAppliedDamage)
  }
  return Object.freeze({
    lineOfSightTargetCount: targetIds.size,
    nextActionDamage,
  })
}

function getPositionMetrics(
  context: AiStandardScoringContext,
  preview: AiActionResultPreview,
): CandidatePositionMetrics {
  const positionId = getBoardPositionId(getFinalPosition(context.input, preview))
  const dangerZones = context.dangerZones ?? EMPTY_DANGER_ZONES
  const staticDangerDamage = safeAdd(
    dangerZones
      .filter((zone) => zone.positionIds.includes(positionId))
      .map((zone) => zone.expectedDamage),
    'static danger damage',
  )
  const history = context.recentActorPositionIds ?? EMPTY_POSITION_HISTORY
  const immediateBacktrack =
    preview.kind === 'MOVE' && history[0] === preview.toPositionId
  const oscillation =
    immediateBacktrack &&
    history[1] === preview.fromPositionId

  return Object.freeze({
    ...getCoverMetrics(context.input, preview),
    ...getFutureAttackMetrics(context.input, preview),
    staticDangerDamage,
    immediateBacktrack,
    oscillation,
  })
}

function getTargetResultMap(
  preview: AiSkillActionResultPreview,
): ReadonlyMap<BattleUnitId, number> {
  return new Map(
    preview.targetResults
      .filter((result) => result.appliedDamage > 0)
      .map((result) => [result.battleUnitId, result.appliedDamage]),
  )
}

function isAtLeastEquivalentAttack(
  candidate: AiActionResultPreview,
  reference: AiActionResultPreview,
): boolean {
  if (candidate.kind !== 'USE_SKILL' || reference.kind !== 'USE_SKILL') {
    return false
  }
  const referenceDamage = getTargetResultMap(reference)
  if (referenceDamage.size === 0) {
    return false
  }
  const candidateDamage = getTargetResultMap(candidate)
  for (const [battleUnitId, appliedDamage] of referenceDamage) {
    if ((candidateDamage.get(battleUnitId) ?? 0) < appliedDamage) {
      return false
    }
  }
  return true
}

function getHeavyWasteCost(
  preview: AiActionResultPreview,
  previews: readonly AiActionResultPreview[],
): number {
  if (preview.kind !== 'USE_SKILL' || preview.totalAppliedDamage === 0) {
    return 0
  }
  const equivalentCosts = previews
    .filter((candidate) => isAtLeastEquivalentAttack(candidate, preview))
    .map((candidate) => candidate.actionCost)
  const cheapest = equivalentCosts.length === 0
    ? preview.actionCost
    : Math.min(...equivalentCosts)
  return Math.max(0, preview.actionCost - cheapest)
}

function getNextUnitTurnTime(
  battle: BattleState,
  battleUnitId: BattleUnitId,
): BattleTime | null {
  for (const event of battle.timeline.events) {
    if (event.kind !== 'UNIT_TURN') {
      continue
    }
    const payload = event.payload as { readonly battleUnitId?: unknown }
    if (payload.battleUnitId === battleUnitId) {
      return event.time
    }
  }
  return null
}

function getThreatDamageBeforeNextTurn(
  context: AiStandardScoringContext,
  unit: BattleUnitState,
): number {
  const nextTurnTime = getNextUnitTurnTime(context.input.battle, unit.battleUnitId)
  const deadline = nextTurnTime ?? Number.MAX_SAFE_INTEGER
  const positionId = getBoardPositionId(unit.position)
  return safeAdd(
    (context.pendingThreats ?? EMPTY_PENDING_THREATS)
      .filter(
        (threat) =>
          threat.resolvesAt <= deadline &&
          (threat.targetBattleUnitId === unit.battleUnitId ||
            (threat.targetPositionIds ?? []).includes(positionId)),
      )
      .map((threat) => threat.expectedDamage),
    `incoming threat damage for ${unit.battleUnitId}`,
  )
}

function getCurrentBarrierCapacity(unit: BattleUnitState): number {
  return safeAdd(
    unit.barriers.map((barrier) => barrier.remainingCapacity),
    `barrier capacity for ${unit.battleUnitId}`,
  )
}

function getSupportMetrics(
  context: AiStandardScoringContext,
  preview: AiActionResultPreview,
  supportByCandidateId: ReadonlyMap<string, AiCandidateSupportProjection>,
): CandidateSupportMetrics {
  const projection = supportByCandidateId.get(preview.candidate.candidateId)
  const targets =
    projection?.targets ??
    (preview.kind === 'USE_SKILL'
      ? preview.targetResults
          .filter((target) => target.rawHealing > 0)
          .map((target) =>
            Object.freeze({
              battleUnitId: target.battleUnitId,
              rawHealing: target.rawHealing,
              appliedHealing: target.appliedHealing,
              preventedDamage: 0,
              usefulActionCount: target.appliedHealing > 0 ? 1 : 0,
            }),
          )
      : [])
  if (targets.length === 0) {
    return Object.freeze({
      rawHealing: 0,
      appliedHealing: 0,
      preventedDamage: 0,
      usefulActionCount: 0,
      rescueCount: 0,
      preventedDamageForActor: 0,
    })
  }

  let rescueCount = 0
  for (const target of targets) {
    const unit = getRequiredUnit(context.input.battle, target.battleUnitId)
    const incomingDamage = getThreatDamageBeforeNextTurn(context, unit)
    const effectiveHpBefore = unit.hp + getCurrentBarrierCapacity(unit)
    const effectiveHpAfter =
      effectiveHpBefore + target.appliedHealing + target.preventedDamage
    if (
      incomingDamage >= effectiveHpBefore &&
      effectiveHpAfter > incomingDamage
    ) {
      rescueCount += 1
    }
  }

  const actorProjection = targets.find(
    (target) => target.battleUnitId === context.input.actorBattleUnitId,
  )
  return Object.freeze({
    rawHealing: safeAdd(
      targets.map((target) => target.rawHealing),
      'raw healing',
    ),
    appliedHealing: safeAdd(
      targets.map((target) => target.appliedHealing),
      'applied healing',
    ),
    preventedDamage: safeAdd(
      targets.map((target) => target.preventedDamage),
      'prevented damage',
    ),
    usefulActionCount: safeAdd(
      targets.map((target) => target.usefulActionCount),
      'useful support action count',
    ),
    rescueCount,
    preventedDamageForActor: actorProjection?.preventedDamage ?? 0,
  })
}

function getTelegraphMetrics(
  context: AiStandardScoringContext,
  preview: AiActionResultPreview,
  support: CandidateSupportMetrics,
): CandidateTelegraphMetrics {
  const actor = getRequiredUnit(context.input.battle, context.input.actorBattleUnitId)
  const species = getRequiredSpecies(context.input.speciesById, actor.speciesId)
  const effectiveSpeed = getModifiedBattleStatValue(
    species.stats.speed,
    actor.effects,
    'SPEED',
  )
  const nextActionTime = calculateNextActionTime(
    context.currentTime,
    preview.actionCost,
    effectiveSpeed,
  )
  const currentPositionId = getBoardPositionId(actor.position)
  const finalPositionId = getBoardPositionId(getFinalPosition(context.input, preview))

  let escapedDamage = 0
  let deferredRiskDamage = 0
  let unavoidableRiskDamage = 0
  for (const threat of context.pendingThreats ?? EMPTY_PENDING_THREATS) {
    const positionIds = threat.targetPositionIds ?? EMPTY_POSITION_HISTORY
    const currentThreatened = positionIds.includes(currentPositionId)
    const finalThreatened = positionIds.includes(finalPositionId)
    if (currentThreatened && !finalThreatened) {
      escapedDamage = safeAdd(
        [escapedDamage, threat.expectedDamage],
        'escaped telegraph damage',
      )
      continue
    }
    if (!finalThreatened) {
      continue
    }
    if (nextActionTime < threat.resolvesAt) {
      deferredRiskDamage = safeAdd(
        [deferredRiskDamage, threat.expectedDamage],
        'deferred telegraph risk',
      )
    } else {
      unavoidableRiskDamage = safeAdd(
        [unavoidableRiskDamage, threat.expectedDamage],
        'unavoidable telegraph risk',
      )
    }
  }

  const mitigatedUnavoidableDamage = Math.min(
    unavoidableRiskDamage,
    support.preventedDamageForActor,
  )
  return Object.freeze({
    escapedDamage,
    deferredRiskDamage,
    unavoidableRiskDamage:
      unavoidableRiskDamage - mitigatedUnavoidableDamage,
    mitigatedUnavoidableDamage,
  })
}

function validateSupportProjections(
  context: AiStandardScoringContext,
  candidateIds: ReadonlySet<string>,
): ReadonlyMap<string, AiCandidateSupportProjection> {
  const result = new Map<string, AiCandidateSupportProjection>()
  for (const [projectionIndex, projection] of (
    context.supportProjections ?? EMPTY_SUPPORT_PROJECTIONS
  ).entries()) {
    assertNonEmptyString(
      projection.candidateId,
      `supportProjections[${projectionIndex}].candidateId`,
    )
    if (!candidateIds.has(projection.candidateId)) {
      throw new Error(`support projection candidate is not available: ${projection.candidateId}`)
    }
    if (result.has(projection.candidateId)) {
      throw new Error(`support projection candidateId must be unique: ${projection.candidateId}`)
    }
    const targetIds = new Set<string>()
    const targets = projection.targets.map((target, targetIndex) => {
      const prefix = `supportProjections[${projectionIndex}].targets[${targetIndex}]`
      assertNonEmptyString(target.battleUnitId, `${prefix}.battleUnitId`)
      const unit = getRequiredUnit(context.input.battle, target.battleUnitId)
      const actor = getRequiredUnit(context.input.battle, context.input.actorBattleUnitId)
      if (unit.side !== actor.side) {
        throw new Error(`${prefix}.battleUnitId must reference an ally`)
      }
      if (targetIds.has(target.battleUnitId)) {
        throw new Error(`${prefix}.battleUnitId must be unique within the projection`)
      }
      targetIds.add(target.battleUnitId)
      assertSafeIntegerAtLeast(target.rawHealing, 0, `${prefix}.rawHealing`)
      assertSafeIntegerAtLeast(target.appliedHealing, 0, `${prefix}.appliedHealing`)
      assertSafeIntegerAtLeast(target.preventedDamage, 0, `${prefix}.preventedDamage`)
      assertSafeIntegerAtLeast(target.usefulActionCount, 0, `${prefix}.usefulActionCount`)
      if (target.appliedHealing > target.rawHealing) {
        throw new Error(`${prefix}.appliedHealing must not exceed rawHealing`)
      }
      const species = getRequiredSpecies(context.input.speciesById, unit.speciesId)
      if (target.appliedHealing > species.stats.hp - unit.hp) {
        throw new Error(`${prefix}.appliedHealing must not exceed missing HP`)
      }
      return Object.freeze({ ...target })
    })
    result.set(
      projection.candidateId,
      Object.freeze({
        candidateId: projection.candidateId,
        targets: Object.freeze(targets),
      }),
    )
  }
  return result
}

function validateDangerZones(context: AiStandardScoringContext): void {
  const ids = new Set<string>()
  for (const [index, zone] of (context.dangerZones ?? EMPTY_DANGER_ZONES).entries()) {
    assertNonEmptyString(zone.dangerId, `dangerZones[${index}].dangerId`)
    if (ids.has(zone.dangerId)) {
      throw new Error(`danger zone id must be unique: ${zone.dangerId}`)
    }
    ids.add(zone.dangerId)
    assertSafeIntegerAtLeast(zone.expectedDamage, 0, `dangerZones[${index}].expectedDamage`)
    if (zone.positionIds.length === 0) {
      throw new Error(`dangerZones[${index}].positionIds must not be empty`)
    }
    const positions = new Set<string>()
    for (const [positionIndex, positionId] of zone.positionIds.entries()) {
      assertPositionId(positionId, `dangerZones[${index}].positionIds[${positionIndex}]`)
      if (positions.has(positionId)) {
        throw new Error(`dangerZones[${index}].positionIds must be unique`)
      }
      positions.add(positionId)
    }
  }
}

function validatePendingThreats(context: AiStandardScoringContext): void {
  const ids = new Set<string>()
  for (const [index, threat] of (
    context.pendingThreats ?? EMPTY_PENDING_THREATS
  ).entries()) {
    assertNonEmptyString(threat.threatId, `pendingThreats[${index}].threatId`)
    if (ids.has(threat.threatId)) {
      throw new Error(`pending threat id must be unique: ${threat.threatId}`)
    }
    ids.add(threat.threatId)
    assertSafeIntegerAtLeast(threat.resolvesAt, context.currentTime, `pendingThreats[${index}].resolvesAt`)
    assertSafeIntegerAtLeast(threat.expectedDamage, 0, `pendingThreats[${index}].expectedDamage`)
    const positions = threat.targetPositionIds ?? EMPTY_POSITION_HISTORY
    if (threat.targetBattleUnitId === undefined && positions.length === 0) {
      throw new Error(`pendingThreats[${index}] must target a unit or position`)
    }
    if (threat.targetBattleUnitId !== undefined) {
      getRequiredUnit(context.input.battle, threat.targetBattleUnitId)
    }
    const seen = new Set<string>()
    for (const [positionIndex, positionId] of positions.entries()) {
      assertPositionId(positionId, `pendingThreats[${index}].targetPositionIds[${positionIndex}]`)
      if (seen.has(positionId)) {
        throw new Error(`pendingThreats[${index}].targetPositionIds must be unique`)
      }
      seen.add(positionId)
    }
  }
}

function validatePositionHistory(context: AiStandardScoringContext): void {
  for (const [index, positionId] of (
    context.recentActorPositionIds ?? EMPTY_POSITION_HISTORY
  ).entries()) {
    assertPositionId(positionId, `recentActorPositionIds[${index}]`)
  }
}

function createScorers(
  weights: AiStandardScoreWeights,
  metricsByCandidateId: ReadonlyMap<string, CandidateMetrics>,
): readonly AiPreviewScorer[] {
  const getMetrics = (preview: AiActionResultPreview): CandidateMetrics => {
    const metrics = metricsByCandidateId.get(preview.candidate.candidateId)
    if (metrics === undefined) {
      throw new Error(`standard score metrics are missing: ${preview.candidate.candidateId}`)
    }
    return metrics
  }
  return Object.freeze([
    Object.freeze({
      id: 'attack.immediate-damage',
      priority: 10,
      score: (preview: AiActionResultPreview) =>
        preview.kind === 'USE_SKILL'
          ? safeProduct(preview.totalAppliedDamage, weights.immediateDamage, 'immediate damage')
          : 0,
    }),
    Object.freeze({
      id: 'attack.defeat-value',
      priority: 11,
      score: (preview: AiActionResultPreview) => {
        if (preview.kind !== 'USE_SKILL') {
          return 0
        }
        return safeAdd(
          preview.targetResults
            .filter((result) => result.defeatsTarget)
            .map((result) =>
              safeAdd(
                [
                  weights.defeatFlat,
                  safeProduct(result.maxHp, weights.defeatMaxHp, 'defeat max HP'),
                ],
                'defeat value',
              ),
            ),
          'total defeat value',
        )
      },
    }),
    Object.freeze({
      id: 'attack.overkill-penalty',
      priority: 12,
      score: (preview: AiActionResultPreview) =>
        preview.kind === 'USE_SKILL'
          ? -safeProduct(
              preview.totalCalculatedDamage - preview.totalAppliedDamage,
              weights.overkill,
              'overkill',
            )
          : 0,
    }),
    Object.freeze({
      id: 'attack.heavy-skill-waste-penalty',
      priority: 13,
      score: (preview: AiActionResultPreview) =>
        -safeProduct(
          getMetrics(preview).heavyWasteCost,
          weights.heavySkillWaste,
          'heavy skill waste',
        ),
    }),
    Object.freeze({
      id: 'support.actual-healing',
      priority: 20,
      score: (preview: AiActionResultPreview) =>
        safeProduct(
          getMetrics(preview).support.appliedHealing,
          weights.actualHealing,
          'actual healing',
        ),
    }),
    Object.freeze({
      id: 'support.overheal-penalty',
      priority: 21,
      score: (preview: AiActionResultPreview) => {
        const support = getMetrics(preview).support
        return -safeProduct(
          support.rawHealing - support.appliedHealing,
          weights.overheal,
          'overheal',
        )
      },
    }),
    Object.freeze({
      id: 'support.rescue-before-enemy-action',
      priority: 22,
      score: (preview: AiActionResultPreview) =>
        safeProduct(
          getMetrics(preview).support.rescueCount,
          weights.rescue,
          'rescue',
        ),
    }),
    Object.freeze({
      id: 'support.prevented-damage',
      priority: 23,
      score: (preview: AiActionResultPreview) =>
        safeProduct(
          getMetrics(preview).support.preventedDamage,
          weights.preventedDamage,
          'prevented damage',
        ),
    }),
    Object.freeze({
      id: 'support.useful-actions',
      priority: 24,
      score: (preview: AiActionResultPreview) =>
        safeProduct(
          getMetrics(preview).support.usefulActionCount,
          weights.usefulSupportAction,
          'useful support actions',
        ),
    }),
    Object.freeze({
      id: 'position.cover',
      priority: 30,
      score: (preview: AiActionResultPreview) => {
        const position = getMetrics(preview).position
        return safeAdd(
          [
            safeProduct(position.coverReceived, weights.coverReceived, 'cover received'),
            safeProduct(position.alliesCovered, weights.allyCovered, 'allies covered'),
          ],
          'cover score',
        )
      },
    }),
    Object.freeze({
      id: 'position.line-of-sight',
      priority: 31,
      score: (preview: AiActionResultPreview) =>
        safeProduct(
          getMetrics(preview).position.lineOfSightTargetCount,
          weights.lineOfSightTarget,
          'line of sight',
        ),
    }),
    Object.freeze({
      id: 'position.next-action-value',
      priority: 32,
      score: (preview: AiActionResultPreview) =>
        preview.kind === 'MOVE'
          ? safeProduct(
              getMetrics(preview).position.nextActionDamage,
              weights.nextActionDamage,
              'next action damage',
            )
          : 0,
    }),
    Object.freeze({
      id: 'position.static-danger-penalty',
      priority: 33,
      score: (preview: AiActionResultPreview) =>
        -safeProduct(
          getMetrics(preview).position.staticDangerDamage,
          weights.staticDanger,
          'static danger',
        ),
    }),
    Object.freeze({
      id: 'position.backtrack-penalty',
      priority: 34,
      score: (preview: AiActionResultPreview) => {
        const position = getMetrics(preview).position
        return -safeAdd(
          [
            position.immediateBacktrack ? weights.immediateBacktrack : 0,
            position.oscillation ? weights.oscillation : 0,
          ],
          'backtrack penalty',
        )
      },
    }),
    Object.freeze({
      id: 'telegraph.response',
      priority: 40,
      score: (preview: AiActionResultPreview) => {
        const telegraph = getMetrics(preview).telegraph
        return safeAdd(
          [
            safeProduct(telegraph.escapedDamage, weights.telegraphEvade, 'telegraph evade'),
            -safeProduct(
              telegraph.deferredRiskDamage,
              weights.telegraphDeferredRisk,
              'telegraph deferred risk',
            ),
            -safeProduct(
              telegraph.unavoidableRiskDamage,
              weights.telegraphUnavoidableRisk,
              'telegraph unavoidable risk',
            ),
            safeProduct(
              telegraph.mitigatedUnavoidableDamage,
              weights.telegraphMitigation,
              'telegraph mitigation',
            ),
          ],
          'telegraph response',
        )
      },
    }),
    Object.freeze({
      id: 'tempo.action-cost-penalty',
      priority: 50,
      score: (preview: AiActionResultPreview) =>
        -safeProduct(preview.actionCost, weights.actionCost, 'action cost'),
    }),
  ] satisfies readonly AiPreviewScorer[])
}

function prepareStandardScoring(
  context: AiStandardScoringContext,
): PreparedStandardScoring {
  assertValidBattleState(context.input.battle)
  assertSafeIntegerAtLeast(context.currentTime, 0, 'currentTime')
  validateDangerZones(context)
  validatePendingThreats(context)
  validatePositionHistory(context)
  const weights = resolveWeights(context.weights)
  const previews = Object.freeze(
    enumerateAiActionCandidates(context.input).map((candidate) =>
      previewAiActionCandidate(context.input, candidate),
    ),
  )
  const candidateIds = new Set(previews.map((preview) => preview.candidate.candidateId))
  const supportByCandidateId = validateSupportProjections(context, candidateIds)
  const metricsByCandidateId = new Map<string, CandidateMetrics>()
  for (const preview of previews) {
    const support = getSupportMetrics(context, preview, supportByCandidateId)
    metricsByCandidateId.set(
      preview.candidate.candidateId,
      Object.freeze({
        preview,
        heavyWasteCost: getHeavyWasteCost(preview, previews),
        position: getPositionMetrics(context, preview),
        support,
        telegraph: getTelegraphMetrics(context, preview, support),
      }),
    )
  }
  return Object.freeze({
    previews,
    scorers: createScorers(weights, metricsByCandidateId),
  })
}

export function createStandardAiScorers(
  context: AiStandardScoringContext,
): readonly AiPreviewScorer[] {
  return prepareStandardScoring(context).scorers
}

export function evaluateStandardAiActions(
  context: AiStandardScoringContext,
): readonly AiActionEvaluation[] {
  const prepared = prepareStandardScoring(context)
  const evaluations = prepared.previews.map((preview) =>
    evaluateAiActionPreview(preview, prepared.scorers),
  )
  evaluations.sort(compareAiActionEvaluations)
  return Object.freeze(evaluations)
}

export function selectBestStandardAiAction(
  context: AiStandardScoringContext,
): AiActionEvaluation | null {
  return evaluateStandardAiActions(context)[0] ?? null
}
