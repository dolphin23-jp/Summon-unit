import { getAttributeMultiplierPermille } from '../content/attribute'
import {
  assertValidMonsterSpecies,
  type MonsterSpecies,
} from '../content/monster-species'
import {
  assertValidSkillDefinition,
  resolveSkillAttributeId,
  resolveSkillReachMethod,
  resolveSkillTelegraphDelay,
  type SkillDefinition,
  type SkillId,
} from '../content/skill-definition'
import {
  ALL_BOARD_POSITIONS,
  getBoardPositionId,
  type BoardPosition,
} from '../battle/board'
import {
  assertValidBattleState,
  getBoardOccupant,
  type BattleState,
} from '../battle/defeat-and-victory'
import {
  NORMAL_MOVEMENT_ACTION_COST,
  getNormalMovementCandidates,
} from '../battle/normal-movement'
import {
  isBattlefieldPositionOccupied,
  type OccupyingBoardObjectState,
} from '../battle/occupying-board-object'
import {
  getSkillReachTargetCandidates,
  getSkillReachablePositions,
  resolveSkillAreaTargets,
  resolveSkillReach,
  type SkillAreaResolution,
  type SkillReachResolution,
} from '../battle/reach-and-area'
import { calculateSingleTargetDamage } from '../battle/single-target-damage'
import { getModifiedBattleStatValue } from '../battle/stat-modifiers'
import {
  assertValidBattleUnitState,
  type BattleUnitId,
  type BattleUnitState,
} from '../battle/unit-state'

const CANDIDATE_KIND_PRIORITY = Object.freeze({
  USE_SKILL: 0,
  MOVE: 1,
} as const)

export type AiActionKind = keyof typeof CANDIDATE_KIND_PRIORITY

export interface AiEvaluationInput {
  readonly battle: BattleState
  readonly actorBattleUnitId: BattleUnitId
  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly availableSkills: readonly SkillDefinition[]
  readonly occupyingObjects?: readonly OccupyingBoardObjectState[]
}

interface AiActionCandidateBase<TKind extends AiActionKind> {
  readonly candidateId: string
  readonly kind: TKind
  readonly actorBattleUnitId: BattleUnitId
}

export interface AiSkillActionCandidate extends AiActionCandidateBase<'USE_SKILL'> {
  readonly skillId: SkillId
  readonly selectedTargetBattleUnitId: BattleUnitId | null
  readonly selectedTargetPosition: BoardPosition | null
}

export interface AiMoveActionCandidate extends AiActionCandidateBase<'MOVE'> {
  readonly destination: BoardPosition
}

export type AiActionCandidate = AiSkillActionCandidate | AiMoveActionCandidate

export interface AiPredictedTargetResult {
  readonly battleUnitId: BattleUnitId
  readonly positionId: string
  readonly hpBefore: number
  readonly maxHp: number
  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly hpAfter: number
  readonly defeatsTarget: boolean
  readonly effectiveAttack: number | null
  readonly effectiveDefense: number | null
  readonly attributeMultiplierPermille: number | null
}

interface AiActionResultPreviewBase<TCandidate extends AiActionCandidate> {
  readonly candidate: TCandidate
  readonly actionCost: number
  readonly affectedPositionIds: readonly string[]
  readonly targetResults: readonly AiPredictedTargetResult[]
}

export interface AiSkillActionResultPreview
  extends AiActionResultPreviewBase<AiSkillActionCandidate> {
  readonly kind: 'USE_SKILL'
  readonly reach: SkillReachResolution
  readonly area: SkillAreaResolution
  readonly telegraphDelay: number | null
  readonly totalCalculatedDamage: number
  readonly totalAppliedDamage: number
  readonly defeatedTargetBattleUnitIds: readonly BattleUnitId[]
}

export interface AiMoveActionResultPreview
  extends AiActionResultPreviewBase<AiMoveActionCandidate> {
  readonly kind: 'MOVE'
  readonly fromPositionId: string
  readonly toPositionId: string
}

export type AiActionResultPreview =
  | AiSkillActionResultPreview
  | AiMoveActionResultPreview

export interface AiScoreComponent {
  readonly id: string
  readonly priority: number
  readonly value: number
}

export interface AiScoreBreakdown {
  readonly components: readonly AiScoreComponent[]
  readonly total: number
}

export interface AiPreviewScorer {
  readonly id: string
  readonly priority: number
  readonly score: (preview: AiActionResultPreview) => number
}

export interface AiActionEvaluation {
  readonly preview: AiActionResultPreview
  readonly score: AiScoreBreakdown
  readonly actionCost: number
  readonly defeatsTarget: boolean
  readonly targetHpRatioNumerator: number
  readonly targetHpRatioDenominator: number
  readonly boardPriority: number
  readonly tieBreakKey: string
}

const EMPTY_OBJECTS: readonly OccupyingBoardObjectState[] = Object.freeze([])
const BOARD_POSITION_PRIORITY = new Map(
  ALL_BOARD_POSITIONS.map((position, index) => [getBoardPositionId(position), index]),
)

function assertNonEmptyId(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer`)
  }
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function compareCandidates(left: AiActionCandidate, right: AiActionCandidate): number {
  const kindDifference =
    CANDIDATE_KIND_PRIORITY[left.kind] - CANDIDATE_KIND_PRIORITY[right.kind]
  return kindDifference !== 0
    ? kindDifference
    : compareIds(left.candidateId, right.candidateId)
}

function freezePosition(position: BoardPosition): BoardPosition {
  return Object.freeze({ ...position })
}

function getRequiredActor(input: AiEvaluationInput): BattleUnitState {
  assertNonEmptyId(input.actorBattleUnitId, 'actorBattleUnitId')
  const actor = input.battle.units.find(
    (unit) => unit.battleUnitId === input.actorBattleUnitId,
  )
  if (actor === undefined) {
    throw new Error(`actor must belong to the battle: ${input.actorBattleUnitId}`)
  }
  if (actor.defeated) {
    throw new Error('defeated actor cannot be evaluated')
  }
  return actor
}

function getRequiredSpecies(
  speciesById: Readonly<Record<string, MonsterSpecies>>,
  speciesId: string,
): MonsterSpecies {
  const species = speciesById[speciesId]
  if (species === undefined) {
    throw new Error(`species master is missing: ${speciesId}`)
  }
  assertValidMonsterSpecies(species)
  return species
}

function validateInput(input: AiEvaluationInput): BattleUnitState {
  assertValidBattleState(input.battle)
  if (input.battle.outcome !== 'ONGOING') {
    throw new Error('AI evaluation requires an ongoing battle')
  }

  const actor = getRequiredActor(input)
  for (const unit of input.battle.units) {
    assertValidBattleUnitState(
      unit,
      getRequiredSpecies(input.speciesById, unit.speciesId),
    )
  }

  const skillIds = new Set<string>()
  for (const skill of input.availableSkills) {
    assertValidSkillDefinition(skill)
    if (skillIds.has(skill.id)) {
      throw new Error(`availableSkills must not repeat skill id: ${skill.id}`)
    }
    skillIds.add(skill.id)
  }

  return actor
}

function getSkillCandidateId(
  skillId: SkillId,
  targetBattleUnitId: BattleUnitId | null,
  targetPosition: BoardPosition | null,
): string {
  return [
    'skill',
    skillId,
    'target',
    targetBattleUnitId ?? '-',
    'position',
    targetPosition === null ? '-' : getBoardPositionId(targetPosition),
  ].join(':')
}

function createSkillCandidate(
  actorBattleUnitId: BattleUnitId,
  skillId: SkillId,
  selectedTargetBattleUnitId: BattleUnitId | null,
  selectedTargetPosition: BoardPosition | null,
): AiSkillActionCandidate {
  const position =
    selectedTargetPosition === null ? null : freezePosition(selectedTargetPosition)
  return Object.freeze({
    candidateId: getSkillCandidateId(
      skillId,
      selectedTargetBattleUnitId,
      position,
    ),
    kind: 'USE_SKILL',
    actorBattleUnitId,
    skillId,
    selectedTargetBattleUnitId,
    selectedTargetPosition: position,
  })
}

function enumerateSkillCandidates(
  input: AiEvaluationInput,
  actor: BattleUnitState,
  skill: SkillDefinition,
): readonly AiSkillActionCandidate[] {
  const reachMethod = resolveSkillReachMethod(skill)

  if (reachMethod === 'GLOBAL') {
    return Object.freeze([
      createSkillCandidate(actor.battleUnitId, skill.id, null, null),
    ])
  }

  if (reachMethod === 'SELF') {
    return Object.freeze([
      createSkillCandidate(
        actor.battleUnitId,
        skill.id,
        actor.battleUnitId,
        actor.position,
      ),
    ])
  }

  if (reachMethod === 'ARC') {
    return Object.freeze(
      getSkillReachablePositions(input.battle, actor.battleUnitId, skill).map(
        (position) => {
          const occupant = getBoardOccupant(input.battle, position)
          return createSkillCandidate(
            actor.battleUnitId,
            skill.id,
            occupant?.battleUnitId ?? null,
            position,
          )
        },
      ),
    )
  }

  return Object.freeze(
    getSkillReachTargetCandidates(input.battle, actor.battleUnitId, skill).map(
      (target) =>
        createSkillCandidate(
          actor.battleUnitId,
          skill.id,
          target.battleUnitId,
          target.position,
        ),
    ),
  )
}

function enumerateMoveCandidates(
  input: AiEvaluationInput,
  actor: BattleUnitState,
): readonly AiMoveActionCandidate[] {
  const objects = input.occupyingObjects ?? EMPTY_OBJECTS
  return Object.freeze(
    getNormalMovementCandidates(input.battle, actor.battleUnitId)
      .filter(
        (destination) =>
          !isBattlefieldPositionOccupied(input.battle, objects, destination),
      )
      .map((destination) => {
        const frozenDestination = freezePosition(destination)
        return Object.freeze({
          candidateId: `move:${getBoardPositionId(frozenDestination)}`,
          kind: 'MOVE',
          actorBattleUnitId: actor.battleUnitId,
          destination: frozenDestination,
        } satisfies AiMoveActionCandidate)
      }),
  )
}

export function enumerateAiActionCandidates(
  input: AiEvaluationInput,
): readonly AiActionCandidate[] {
  const actor = validateInput(input)
  const candidates: AiActionCandidate[] = []

  for (const skill of input.availableSkills) {
    candidates.push(...enumerateSkillCandidates(input, actor, skill))
  }
  candidates.push(...enumerateMoveCandidates(input, actor))
  candidates.sort(compareCandidates)
  return Object.freeze(candidates)
}

function getRequiredSkill(
  input: AiEvaluationInput,
  skillId: SkillId,
): SkillDefinition {
  const skill = input.availableSkills.find((candidate) => candidate.id === skillId)
  if (skill === undefined) {
    throw new Error(`candidate skill is not available: ${skillId}`)
  }
  return skill
}

function getRequiredUnit(
  battle: BattleState,
  battleUnitId: BattleUnitId,
): BattleUnitState {
  const unit = battle.units.find(
    (candidate) => candidate.battleUnitId === battleUnitId,
  )
  if (unit === undefined) {
    throw new Error(`battle unit is missing: ${battleUnitId}`)
  }
  return unit
}

function getSkillAffectedTargets(
  battle: BattleState,
  reach: SkillReachResolution,
  area: SkillAreaResolution,
): readonly BattleUnitState[] {
  const orderedIds =
    reach.reachMethod === 'PIERCE'
      ? [
          ...reach.traversedBattleUnitIds,
          ...area.targets.map((target) => target.battleUnitId),
        ]
      : area.targets.map((target) => target.battleUnitId)
  const seen = new Set<string>()
  const targets: BattleUnitState[] = []
  for (const battleUnitId of orderedIds) {
    if (seen.has(battleUnitId)) {
      continue
    }
    seen.add(battleUnitId)
    const unit = getRequiredUnit(battle, battleUnitId)
    if (!unit.defeated) {
      targets.push(unit)
    }
  }
  return Object.freeze(targets)
}

function addSafeIntegers(values: readonly number[], field: string): number {
  const total = values.reduce((sum, value) => {
    assertSafeInteger(value, field)
    return sum + BigInt(value)
  }, 0n)
  if (
    total > BigInt(Number.MAX_SAFE_INTEGER) ||
    total < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error(`${field} total must be a safe integer`)
  }
  return Number(total)
}

function previewTargetDamage(
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  target: BattleUnitState,
  targetSpecies: MonsterSpecies,
  skill: SkillDefinition,
): AiPredictedTargetResult {
  if (actor.side === target.side) {
    return Object.freeze({
      battleUnitId: target.battleUnitId,
      positionId: getBoardPositionId(target.position),
      hpBefore: target.hp,
      maxHp: targetSpecies.stats.hp,
      calculatedDamage: 0,
      appliedDamage: 0,
      hpAfter: target.hp,
      defeatsTarget: false,
      effectiveAttack: null,
      effectiveDefense: null,
      attributeMultiplierPermille: null,
    })
  }

  const effectiveAttack = getModifiedBattleStatValue(
    actorSpecies.stats.attack,
    actor.effects,
    'ATTACK',
  )
  const effectiveDefense = getModifiedBattleStatValue(
    targetSpecies.stats.defense,
    target.effects,
    'DEFENSE',
  )
  const attributeMultiplierPermille = getAttributeMultiplierPermille(
    resolveSkillAttributeId(skill),
    targetSpecies.attributeId,
  )
  const calculatedDamage = calculateSingleTargetDamage(
    effectiveAttack,
    effectiveDefense,
    skill.damageMultiplierPermille,
    attributeMultiplierPermille,
  )
  const appliedDamage = Math.min(calculatedDamage, target.hp)
  const hpAfter = target.hp - appliedDamage

  return Object.freeze({
    battleUnitId: target.battleUnitId,
    positionId: getBoardPositionId(target.position),
    hpBefore: target.hp,
    maxHp: targetSpecies.stats.hp,
    calculatedDamage,
    appliedDamage,
    hpAfter,
    defeatsTarget: hpAfter === 0,
    effectiveAttack,
    effectiveDefense,
    attributeMultiplierPermille,
  })
}

function assertCandidateActor(
  input: AiEvaluationInput,
  candidate: AiActionCandidate,
): void {
  if (candidate.actorBattleUnitId !== input.actorBattleUnitId) {
    throw new Error('candidate actor must match actorBattleUnitId')
  }
}

function previewSkillCandidate(
  input: AiEvaluationInput,
  actor: BattleUnitState,
  candidate: AiSkillActionCandidate,
): AiSkillActionResultPreview {
  const skill = getRequiredSkill(input, candidate.skillId)
  const reach = resolveSkillReach({
    battle: input.battle,
    actorBattleUnitId: actor.battleUnitId,
    skill,
    selectedTargetBattleUnitId:
      candidate.selectedTargetBattleUnitId ?? undefined,
    selectedTargetPosition: candidate.selectedTargetPosition ?? undefined,
  })
  const area = resolveSkillAreaTargets({
    battle: input.battle,
    actorBattleUnitId: actor.battleUnitId,
    skill,
    reach,
  })
  const actorSpecies = getRequiredSpecies(input.speciesById, actor.speciesId)
  const targetResults = getSkillAffectedTargets(input.battle, reach, area).map(
    (target) =>
      previewTargetDamage(
        actor,
        actorSpecies,
        target,
        getRequiredSpecies(input.speciesById, target.speciesId),
        skill,
      ),
  )
  const totalCalculatedDamage = addSafeIntegers(
    targetResults.map((result) => result.calculatedDamage),
    'calculated damage',
  )
  const totalAppliedDamage = addSafeIntegers(
    targetResults.map((result) => result.appliedDamage),
    'applied damage',
  )

  return Object.freeze({
    kind: 'USE_SKILL',
    candidate,
    actionCost: getModifiedBattleStatValue(
      skill.actionCost,
      actor.effects,
      'ACTION_COST',
    ),
    affectedPositionIds: Object.freeze(
      area.positions.map((position) => getBoardPositionId(position)),
    ),
    targetResults: Object.freeze(targetResults),
    reach,
    area,
    telegraphDelay: resolveSkillTelegraphDelay(skill),
    totalCalculatedDamage,
    totalAppliedDamage,
    defeatedTargetBattleUnitIds: Object.freeze(
      targetResults
        .filter((result) => result.defeatsTarget)
        .map((result) => result.battleUnitId),
    ),
  })
}

function previewMoveCandidate(
  input: AiEvaluationInput,
  actor: BattleUnitState,
  candidate: AiMoveActionCandidate,
): AiMoveActionResultPreview {
  const validDestination = enumerateMoveCandidates(input, actor).some(
    (move) => move.candidateId === candidate.candidateId,
  )
  if (!validDestination) {
    throw new Error('move candidate destination is no longer available')
  }

  return Object.freeze({
    kind: 'MOVE',
    candidate,
    actionCost: getModifiedBattleStatValue(
      NORMAL_MOVEMENT_ACTION_COST,
      actor.effects,
      'ACTION_COST',
    ),
    affectedPositionIds: Object.freeze([
      getBoardPositionId(actor.position),
      getBoardPositionId(candidate.destination),
    ]),
    targetResults: Object.freeze([]),
    fromPositionId: getBoardPositionId(actor.position),
    toPositionId: getBoardPositionId(candidate.destination),
  })
}

export function previewAiActionCandidate(
  input: AiEvaluationInput,
  candidate: AiActionCandidate,
): AiActionResultPreview {
  const actor = validateInput(input)
  assertCandidateActor(input, candidate)
  return candidate.kind === 'USE_SKILL'
    ? previewSkillCandidate(input, actor, candidate)
    : previewMoveCandidate(input, actor, candidate)
}

function compareScoreComponents(
  left: AiScoreComponent,
  right: AiScoreComponent,
): number {
  const priorityDifference = left.priority - right.priority
  return priorityDifference !== 0
    ? priorityDifference
    : compareIds(left.id, right.id)
}

export function composeAiScore(
  components: readonly AiScoreComponent[],
): AiScoreBreakdown {
  const ids = new Set<string>()
  const frozen = components.map((component) => {
    assertNonEmptyId(component.id, 'score component id')
    assertSafeInteger(component.priority, `score component ${component.id} priority`)
    assertSafeInteger(component.value, `score component ${component.id} value`)
    if (ids.has(component.id)) {
      throw new Error(`score component id must be unique: ${component.id}`)
    }
    ids.add(component.id)
    return Object.freeze({ ...component })
  })
  frozen.sort(compareScoreComponents)
  return Object.freeze({
    components: Object.freeze(frozen),
    total: addSafeIntegers(
      frozen.map((component) => component.value),
      'AI score',
    ),
  })
}

function validateScorers(
  scorers: readonly AiPreviewScorer[],
): readonly AiPreviewScorer[] {
  const ids = new Set<string>()
  const ordered = [...scorers]
  for (const scorer of ordered) {
    assertNonEmptyId(scorer.id, 'scorer.id')
    assertSafeInteger(scorer.priority, `scorer ${scorer.id} priority`)
    if (ids.has(scorer.id)) {
      throw new Error(`scorer id must be unique: ${scorer.id}`)
    }
    ids.add(scorer.id)
  }
  ordered.sort((left, right) => {
    const priorityDifference = left.priority - right.priority
    return priorityDifference !== 0
      ? priorityDifference
      : compareIds(left.id, right.id)
  })
  return Object.freeze(ordered)
}

function getPrimaryTargetResult(
  preview: AiActionResultPreview,
): AiPredictedTargetResult | null {
  if (preview.kind === 'MOVE' || preview.targetResults.length === 0) {
    return null
  }
  const primaryBattleUnitId =
    preview.reach.actualTargetBattleUnitId ??
    preview.reach.selectedTargetBattleUnitId
  if (primaryBattleUnitId !== null) {
    const primary = preview.targetResults.find(
      (result) => result.battleUnitId === primaryBattleUnitId,
    )
    if (primary !== undefined) {
      return primary
    }
  }
  return [...preview.targetResults].sort((left, right) => {
    const leftScaled = BigInt(left.hpBefore) * BigInt(right.maxHp)
    const rightScaled = BigInt(right.hpBefore) * BigInt(left.maxHp)
    if (leftScaled !== rightScaled) {
      return leftScaled < rightScaled ? -1 : 1
    }
    return compareIds(left.battleUnitId, right.battleUnitId)
  })[0] ?? null
}

function getPreviewBoardPriority(preview: AiActionResultPreview): number {
  const positionId =
    preview.kind === 'MOVE'
      ? preview.toPositionId
      : preview.candidate.selectedTargetPosition === null
        ? preview.affectedPositionIds[0]
        : getBoardPositionId(preview.candidate.selectedTargetPosition)
  if (positionId === undefined) {
    return Number.MAX_SAFE_INTEGER
  }
  return BOARD_POSITION_PRIORITY.get(positionId) ?? Number.MAX_SAFE_INTEGER
}

export function evaluateAiActionPreview(
  preview: AiActionResultPreview,
  scorers: readonly AiPreviewScorer[],
): AiActionEvaluation {
  const orderedScorers = validateScorers(scorers)
  const components = orderedScorers.map((scorer) => {
    const value = scorer.score(preview)
    assertSafeInteger(value, `scorer ${scorer.id} result`)
    return Object.freeze({
      id: scorer.id,
      priority: scorer.priority,
      value,
    })
  })
  const primaryTarget = getPrimaryTargetResult(preview)
  return Object.freeze({
    preview,
    score: composeAiScore(components),
    actionCost: preview.actionCost,
    defeatsTarget:
      preview.kind === 'USE_SKILL' &&
      preview.defeatedTargetBattleUnitIds.length > 0,
    targetHpRatioNumerator: primaryTarget?.hpBefore ?? 1,
    targetHpRatioDenominator: primaryTarget?.maxHp ?? 1,
    boardPriority: getPreviewBoardPriority(preview),
    tieBreakKey: preview.candidate.candidateId,
  })
}

function compareTargetHpRatio(
  left: AiActionEvaluation,
  right: AiActionEvaluation,
): number {
  const leftScaled =
    BigInt(left.targetHpRatioNumerator) *
    BigInt(right.targetHpRatioDenominator)
  const rightScaled =
    BigInt(right.targetHpRatioNumerator) *
    BigInt(left.targetHpRatioDenominator)
  if (leftScaled === rightScaled) {
    return 0
  }
  return leftScaled < rightScaled ? -1 : 1
}

export function compareAiActionEvaluations(
  left: AiActionEvaluation,
  right: AiActionEvaluation,
): number {
  if (left.score.total !== right.score.total) {
    return left.score.total > right.score.total ? -1 : 1
  }
  if (left.actionCost !== right.actionCost) {
    return left.actionCost - right.actionCost
  }
  if (left.defeatsTarget !== right.defeatsTarget) {
    return left.defeatsTarget ? -1 : 1
  }
  const hpRatioDifference = compareTargetHpRatio(left, right)
  if (hpRatioDifference !== 0) {
    return hpRatioDifference
  }
  if (left.boardPriority !== right.boardPriority) {
    return left.boardPriority - right.boardPriority
  }
  return compareIds(left.tieBreakKey, right.tieBreakKey)
}

export function evaluateAiActionCandidates(
  input: AiEvaluationInput,
  scorers: readonly AiPreviewScorer[],
): readonly AiActionEvaluation[] {
  const evaluations = enumerateAiActionCandidates(input).map((candidate) =>
    evaluateAiActionPreview(previewAiActionCandidate(input, candidate), scorers),
  )
  evaluations.sort(compareAiActionEvaluations)
  return Object.freeze(evaluations)
}

export function selectBestAiActionEvaluation(
  input: AiEvaluationInput,
  scorers: readonly AiPreviewScorer[],
): AiActionEvaluation | null {
  return evaluateAiActionCandidates(input, scorers)[0] ?? null
}
