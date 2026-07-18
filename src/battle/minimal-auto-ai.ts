import {
  assertValidMonsterSpecies,
  type MonsterSpecies,
} from '../content/monster-species'
import {
  assertValidSkillDefinition,
  type SkillDefinition,
} from '../content/skill-definition'
import {
  getBoardPositionId,
  toGlobalRow,
  type BoardPosition,
} from './board'
import { getDirectEffectiveTarget } from './direct-targeting'
import {
  assertValidBattleState,
  type BattleState,
} from './defeat-and-victory'
import { getNormalMovementCandidates } from './normal-movement'
import { calculateSingleTargetDamage } from './single-target-damage'
import {
  assertValidBattleUnitState,
  type BattleUnitId,
  type BattleUnitState,
} from './unit-state'

export const MINIMAL_AI_DAMAGE_SCORE_SCALE = 1000
export const MINIMAL_AI_DEFEAT_BONUS = 1_000_000

export interface MinimalAutoAiInput {
  readonly battle: BattleState
  readonly actorBattleUnitId: BattleUnitId
  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly availableDirectSkills: readonly SkillDefinition[]
}

export interface MinimalAiAttackScore {
  readonly immediateDamageScore: number
  readonly defeatBonus: number
  readonly actionCostPenalty: number
  readonly total: number
}

export interface MinimalAiAttackReason {
  readonly code: 'LOWEST_COST_DEFEAT' | 'HIGHEST_ATTACK_SCORE'
  readonly predictedDamage: number
  readonly appliedDamage: number
  readonly defeatsTarget: boolean
  readonly targetHp: number
  readonly targetMaxHp: number
  readonly actionCost: number
  readonly score: MinimalAiAttackScore
}

export interface MinimalAiAttackDecision {
  readonly kind: 'USE_SKILL'
  readonly actorBattleUnitId: BattleUnitId
  readonly skillId: string
  readonly targetBattleUnitId: BattleUnitId
  readonly score: number
  readonly reason: MinimalAiAttackReason
}

export interface MinimalAiMovementReason {
  readonly code: 'APPROACH_DIRECT_COLUMN'
  readonly targetBattleUnitId: BattleUnitId
  readonly currentColumnDistance: number
  readonly columnDistanceAfterMove: number
  readonly rowDistanceAfterMove: number
  readonly destinationPositionId: string
}

export interface MinimalAiMovementDecision {
  readonly kind: 'MOVE'
  readonly actorBattleUnitId: BattleUnitId
  readonly destination: BoardPosition
  readonly score: number
  readonly reason: MinimalAiMovementReason
}

export interface MinimalAiWaitReason {
  readonly code: 'NO_ATTACK_OR_PURPOSEFUL_MOVE'
}

export interface MinimalAiWaitDecision {
  readonly kind: 'WAIT'
  readonly actorBattleUnitId: BattleUnitId
  readonly score: 0
  readonly reason: MinimalAiWaitReason
}

export type MinimalAutoAiDecision =
  | MinimalAiAttackDecision
  | MinimalAiMovementDecision
  | MinimalAiWaitDecision

interface ValidatedMinimalAutoAiInput {
  readonly actor: BattleUnitState
  readonly actorSpecies: MonsterSpecies
  readonly livingEnemies: readonly BattleUnitState[]
}

interface MovementTargetPreview {
  readonly target: BattleUnitState
  readonly columnDistance: number
  readonly rowDistance: number
  readonly targetMaxHp: number
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function compareNumbersAscending(left: number, right: number): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function compareNumbersDescending(left: number, right: number): number {
  return compareNumbersAscending(right, left)
}

function compareHpRatios(
  leftHp: number,
  leftMaxHp: number,
  rightHp: number,
  rightMaxHp: number,
): number {
  const leftScaled = BigInt(leftHp) * BigInt(rightMaxHp)
  const rightScaled = BigInt(rightHp) * BigInt(leftMaxHp)
  if (leftScaled === rightScaled) {
    return 0
  }
  return leftScaled < rightScaled ? -1 : 1
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

function getRequiredActor(battle: BattleState, actorBattleUnitId: BattleUnitId): BattleUnitState {
  if (actorBattleUnitId.trim().length === 0) {
    throw new Error('actorBattleUnitId must be a non-empty string')
  }

  const actor = battle.units.find((unit) => unit.battleUnitId === actorBattleUnitId)
  if (actor === undefined) {
    throw new Error(`actor must belong to the battle: ${actorBattleUnitId}`)
  }
  return actor
}

function validateMinimalAutoAiInput(input: MinimalAutoAiInput): ValidatedMinimalAutoAiInput {
  assertValidBattleState(input.battle)
  if (input.battle.outcome !== 'ONGOING') {
    throw new Error('minimal auto AI requires an ongoing battle')
  }

  const actor = getRequiredActor(input.battle, input.actorBattleUnitId)
  if (actor.defeated) {
    throw new Error('defeated actor cannot select an action')
  }

  const seenSkillIds = new Set<string>()
  for (const skill of input.availableDirectSkills) {
    assertValidSkillDefinition(skill)
    if (seenSkillIds.has(skill.id)) {
      throw new Error(`availableDirectSkills must not contain duplicate ids: ${skill.id}`)
    }
    seenSkillIds.add(skill.id)
  }

  for (const unit of input.battle.units) {
    const species = getRequiredSpecies(input.speciesById, unit.speciesId)
    assertValidBattleUnitState(unit, species)
  }

  const actorSpecies = getRequiredSpecies(input.speciesById, actor.speciesId)
  const livingEnemies = Object.freeze(
    input.battle.units.filter((unit) => unit.side !== actor.side && !unit.defeated),
  )

  return Object.freeze({ actor, actorSpecies, livingEnemies })
}

function calculateAttackScore(
  appliedDamage: number,
  defeatsTarget: boolean,
  actionCost: number,
): MinimalAiAttackScore {
  const immediateDamageScoreBig =
    BigInt(appliedDamage) * BigInt(MINIMAL_AI_DAMAGE_SCORE_SCALE)
  const defeatBonusBig = defeatsTarget ? BigInt(MINIMAL_AI_DEFEAT_BONUS) : 0n
  const actionCostPenaltyBig = BigInt(actionCost)
  const totalBig = immediateDamageScoreBig + defeatBonusBig - actionCostPenaltyBig

  const values = [immediateDamageScoreBig, defeatBonusBig, actionCostPenaltyBig, totalBig]
  if (values.some((value) => value > BigInt(Number.MAX_SAFE_INTEGER))) {
    throw new Error('minimal AI attack score must be a safe integer')
  }
  if (totalBig < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('minimal AI attack score must be a safe integer')
  }

  return Object.freeze({
    immediateDamageScore: Number(immediateDamageScoreBig),
    defeatBonus: Number(defeatBonusBig),
    actionCostPenalty: Number(actionCostPenaltyBig),
    total: Number(totalBig),
  })
}

function compareAttackDecisions(
  left: MinimalAiAttackDecision,
  right: MinimalAiAttackDecision,
): number {
  const scoreDifference = compareNumbersDescending(left.score, right.score)
  if (scoreDifference !== 0) {
    return scoreDifference
  }

  const costDifference = compareNumbersAscending(
    left.reason.actionCost,
    right.reason.actionCost,
  )
  if (costDifference !== 0) {
    return costDifference
  }

  if (left.reason.defeatsTarget !== right.reason.defeatsTarget) {
    return left.reason.defeatsTarget ? -1 : 1
  }

  const hpRatioDifference = compareHpRatios(
    left.reason.targetHp,
    left.reason.targetMaxHp,
    right.reason.targetHp,
    right.reason.targetMaxHp,
  )
  if (hpRatioDifference !== 0) {
    return hpRatioDifference
  }

  const skillDifference = compareIds(left.skillId, right.skillId)
  if (skillDifference !== 0) {
    return skillDifference
  }
  return compareIds(left.targetBattleUnitId, right.targetBattleUnitId)
}

export function enumerateMinimalAiAttackCandidates(
  input: MinimalAutoAiInput,
): readonly MinimalAiAttackDecision[] {
  const { actor, actorSpecies } = validateMinimalAutoAiInput(input)
  const target = getDirectEffectiveTarget(input.battle, actor.battleUnitId)
  if (target === null || input.availableDirectSkills.length === 0) {
    return Object.freeze([])
  }

  const targetSpecies = getRequiredSpecies(input.speciesById, target.speciesId)
  const candidates = input.availableDirectSkills.map((skill) => {
    const predictedDamage = calculateSingleTargetDamage(
      actorSpecies.stats.attack,
      targetSpecies.stats.defense,
      skill.damageMultiplierPermille,
    )
    const appliedDamage = Math.min(predictedDamage, target.hp)
    const defeatsTarget = predictedDamage >= target.hp
    const score = calculateAttackScore(appliedDamage, defeatsTarget, skill.actionCost)
    const reason = Object.freeze({
      code: defeatsTarget ? 'LOWEST_COST_DEFEAT' : 'HIGHEST_ATTACK_SCORE',
      predictedDamage,
      appliedDamage,
      defeatsTarget,
      targetHp: target.hp,
      targetMaxHp: targetSpecies.stats.hp,
      actionCost: skill.actionCost,
      score,
    } satisfies MinimalAiAttackReason)

    return Object.freeze({
      kind: 'USE_SKILL',
      actorBattleUnitId: actor.battleUnitId,
      skillId: skill.id,
      targetBattleUnitId: target.battleUnitId,
      score: score.total,
      reason,
    } satisfies MinimalAiAttackDecision)
  })

  candidates.sort(compareAttackDecisions)
  return Object.freeze(candidates)
}

function getMovementTargetPreview(
  position: BoardPosition,
  enemies: readonly BattleUnitState[],
  speciesById: Readonly<Record<string, MonsterSpecies>>,
): MovementTargetPreview {
  const previews = enemies.map((target) => {
    const targetSpecies = getRequiredSpecies(speciesById, target.speciesId)
    return {
      target,
      columnDistance: Math.abs(position.column - target.position.column),
      rowDistance: Math.abs(toGlobalRow(position) - toGlobalRow(target.position)),
      targetMaxHp: targetSpecies.stats.hp,
    }
  })

  previews.sort((left, right) => {
    const columnDifference = compareNumbersAscending(
      left.columnDistance,
      right.columnDistance,
    )
    if (columnDifference !== 0) {
      return columnDifference
    }

    const rowDifference = compareNumbersAscending(left.rowDistance, right.rowDistance)
    if (rowDifference !== 0) {
      return rowDifference
    }

    const hpRatioDifference = compareHpRatios(
      left.target.hp,
      left.targetMaxHp,
      right.target.hp,
      right.targetMaxHp,
    )
    if (hpRatioDifference !== 0) {
      return hpRatioDifference
    }

    return compareIds(left.target.battleUnitId, right.target.battleUnitId)
  })

  const preview = previews[0]
  if (preview === undefined) {
    throw new Error('movement target preview requires a living enemy')
  }
  return preview
}

function compareMovementDecisions(
  left: MinimalAiMovementDecision,
  right: MinimalAiMovementDecision,
): number {
  const columnDifference = compareNumbersAscending(
    left.reason.columnDistanceAfterMove,
    right.reason.columnDistanceAfterMove,
  )
  if (columnDifference !== 0) {
    return columnDifference
  }

  const rowDifference = compareNumbersAscending(
    left.reason.rowDistanceAfterMove,
    right.reason.rowDistanceAfterMove,
  )
  if (rowDifference !== 0) {
    return rowDifference
  }

  const globalRowDifference = compareNumbersAscending(
    toGlobalRow(left.destination),
    toGlobalRow(right.destination),
  )
  if (globalRowDifference !== 0) {
    return globalRowDifference
  }

  const columnPriority = compareNumbersAscending(
    left.destination.column,
    right.destination.column,
  )
  if (columnPriority !== 0) {
    return columnPriority
  }

  return compareIds(
    left.reason.targetBattleUnitId,
    right.reason.targetBattleUnitId,
  )
}

export function enumerateMinimalAiMovementCandidates(
  input: MinimalAutoAiInput,
): readonly MinimalAiMovementDecision[] {
  const { actor, livingEnemies } = validateMinimalAutoAiInput(input)
  if (getDirectEffectiveTarget(input.battle, actor.battleUnitId) !== null) {
    return Object.freeze([])
  }

  const currentTargetPreview = getMovementTargetPreview(
    actor.position,
    livingEnemies,
    input.speciesById,
  )
  const candidates = getNormalMovementCandidates(input.battle, actor.battleUnitId)
    .map((destination) => {
      const targetPreview = getMovementTargetPreview(
        destination,
        livingEnemies,
        input.speciesById,
      )
      if (targetPreview.columnDistance >= currentTargetPreview.columnDistance) {
        return null
      }

      const destinationPositionId = getBoardPositionId(destination)
      const score = -(
        targetPreview.columnDistance * 100 + targetPreview.rowDistance
      )
      return Object.freeze({
        kind: 'MOVE',
        actorBattleUnitId: actor.battleUnitId,
        destination: Object.freeze({ ...destination }),
        score,
        reason: Object.freeze({
          code: 'APPROACH_DIRECT_COLUMN',
          targetBattleUnitId: targetPreview.target.battleUnitId,
          currentColumnDistance: currentTargetPreview.columnDistance,
          columnDistanceAfterMove: targetPreview.columnDistance,
          rowDistanceAfterMove: targetPreview.rowDistance,
          destinationPositionId,
        }),
      } satisfies MinimalAiMovementDecision)
    })
    .filter((candidate): candidate is MinimalAiMovementDecision => candidate !== null)

  candidates.sort(compareMovementDecisions)
  return Object.freeze(candidates)
}

export function selectMinimalAutoAiAction(input: MinimalAutoAiInput): MinimalAutoAiDecision {
  validateMinimalAutoAiInput(input)

  const attack = enumerateMinimalAiAttackCandidates(input)[0]
  if (attack !== undefined) {
    return attack
  }

  const movement = enumerateMinimalAiMovementCandidates(input)[0]
  if (movement !== undefined) {
    return movement
  }

  return Object.freeze({
    kind: 'WAIT',
    actorBattleUnitId: input.actorBattleUnitId,
    score: 0,
    reason: Object.freeze({ code: 'NO_ATTACK_OR_PURPOSEFUL_MOVE' }),
  })
}
