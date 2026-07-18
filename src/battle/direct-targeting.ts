import {
  getBoardPositionId,
  isSameColumn,
  toGlobalRow,
  type BoardPosition,
  type Column,
} from './board'
import { assertValidBattleState, type BattleState } from './defeat-and-victory'
import type { BattleUnitId, BattleUnitState } from './unit-state'

export type DirectTargetCandidateStatus = 'EFFECTIVE_TARGET' | 'BLOCKED'

export interface DirectTargetCandidatePreview {
  readonly battleUnitId: BattleUnitId
  readonly position: BoardPosition
  readonly positionId: string
  readonly distance: number
  readonly status: DirectTargetCandidateStatus
  readonly blockedByBattleUnitId: BattleUnitId | null
}

export interface DirectTargetingPreview {
  readonly attackerBattleUnitId: BattleUnitId
  readonly column: Column
  readonly effectiveTargetBattleUnitId: BattleUnitId | null
  readonly effectiveTargetPositionId: string | null
  readonly candidates: readonly DirectTargetCandidatePreview[]
}

export interface ResolveDirectTargetInput {
  readonly battle: BattleState
  readonly attackerBattleUnitId: BattleUnitId
  readonly intendedTargetBattleUnitId: BattleUnitId
}

export interface ResolveDirectTargetResult {
  readonly intendedTargetBattleUnitId: BattleUnitId
  readonly actualTargetBattleUnitId: BattleUnitId
  readonly blocked: boolean
  readonly blockingBattleUnitId: BattleUnitId | null
  readonly preview: DirectTargetingPreview
}

function getRequiredUnit(
  battle: BattleState,
  battleUnitId: BattleUnitId,
  field: string,
): BattleUnitState {
  if (battleUnitId.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }

  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`${field} must reference a battle unit: ${battleUnitId}`)
  }
  return unit
}

function getLivingAttacker(battle: BattleState, attackerBattleUnitId: BattleUnitId): BattleUnitState {
  const attacker = getRequiredUnit(battle, attackerBattleUnitId, 'attackerBattleUnitId')
  if (attacker.defeated) {
    throw new Error('defeated attacker cannot resolve DIRECT targeting')
  }
  return attacker
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function getDistance(attacker: BattleUnitState, target: BattleUnitState): number {
  return Math.abs(toGlobalRow(attacker.position) - toGlobalRow(target.position))
}

export function getSameColumnEnemyCandidates(
  battle: BattleState,
  attackerBattleUnitId: BattleUnitId,
): readonly BattleUnitState[] {
  assertValidBattleState(battle)
  const attacker = getLivingAttacker(battle, attackerBattleUnitId)

  const candidates = battle.units
    .filter(
      (unit) =>
        !unit.defeated &&
        unit.side !== attacker.side &&
        isSameColumn(unit.position, attacker.position),
    )
    .sort((left, right) => {
      const distanceDifference = getDistance(attacker, left) - getDistance(attacker, right)
      return distanceDifference !== 0
        ? distanceDifference
        : compareIds(left.battleUnitId, right.battleUnitId)
    })

  return Object.freeze([...candidates])
}

export function getDirectTargetingPreview(
  battle: BattleState,
  attackerBattleUnitId: BattleUnitId,
): DirectTargetingPreview {
  assertValidBattleState(battle)
  const attacker = getLivingAttacker(battle, attackerBattleUnitId)
  const candidates = getSameColumnEnemyCandidates(battle, attackerBattleUnitId)
  const effectiveTarget = candidates[0] ?? null

  const candidatePreviews = candidates.map((candidate, index) =>
    Object.freeze({
      battleUnitId: candidate.battleUnitId,
      position: Object.freeze({ ...candidate.position }),
      positionId: getBoardPositionId(candidate.position),
      distance: getDistance(attacker, candidate),
      status: index === 0 ? 'EFFECTIVE_TARGET' : 'BLOCKED',
      blockedByBattleUnitId: index === 0 ? null : effectiveTarget?.battleUnitId ?? null,
    } satisfies DirectTargetCandidatePreview),
  )

  return Object.freeze({
    attackerBattleUnitId,
    column: attacker.position.column,
    effectiveTargetBattleUnitId: effectiveTarget?.battleUnitId ?? null,
    effectiveTargetPositionId:
      effectiveTarget === null ? null : getBoardPositionId(effectiveTarget.position),
    candidates: Object.freeze(candidatePreviews),
  })
}

export function getDirectEffectiveTarget(
  battle: BattleState,
  attackerBattleUnitId: BattleUnitId,
): BattleUnitState | null {
  return getSameColumnEnemyCandidates(battle, attackerBattleUnitId)[0] ?? null
}

export function isDirectTargetExposed(
  battle: BattleState,
  attackerBattleUnitId: BattleUnitId,
  targetBattleUnitId: BattleUnitId,
): boolean {
  assertValidBattleState(battle)
  const target = getRequiredUnit(battle, targetBattleUnitId, 'targetBattleUnitId')
  if (target.defeated) {
    return false
  }

  const attacker = getLivingAttacker(battle, attackerBattleUnitId)
  if (target.side === attacker.side || !isSameColumn(target.position, attacker.position)) {
    return false
  }

  return getDirectEffectiveTarget(battle, attackerBattleUnitId)?.battleUnitId === targetBattleUnitId
}

export function resolveDirectTarget(input: ResolveDirectTargetInput): ResolveDirectTargetResult {
  assertValidBattleState(input.battle)
  const attacker = getLivingAttacker(input.battle, input.attackerBattleUnitId)
  const intendedTarget = getRequiredUnit(
    input.battle,
    input.intendedTargetBattleUnitId,
    'intendedTargetBattleUnitId',
  )

  if (intendedTarget.defeated) {
    throw new Error('DIRECT intended target must be alive')
  }
  if (intendedTarget.side === attacker.side) {
    throw new Error('DIRECT intended target must be an enemy')
  }
  if (!isSameColumn(intendedTarget.position, attacker.position)) {
    throw new Error('DIRECT intended target must be in the attacker column')
  }

  const preview = getDirectTargetingPreview(input.battle, input.attackerBattleUnitId)
  const actualTargetBattleUnitId = preview.effectiveTargetBattleUnitId
  if (actualTargetBattleUnitId === null) {
    throw new Error('DIRECT targeting requires a living enemy in the attacker column')
  }

  const blocked = actualTargetBattleUnitId !== input.intendedTargetBattleUnitId
  return Object.freeze({
    intendedTargetBattleUnitId: input.intendedTargetBattleUnitId,
    actualTargetBattleUnitId,
    blocked,
    blockingBattleUnitId: blocked ? actualTargetBattleUnitId : null,
    preview,
  })
}
