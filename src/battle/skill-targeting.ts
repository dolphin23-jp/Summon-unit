import {
  assertValidSkillDefinition,
  resolveSkillTargetSelector,
  type SkillDefinition,
} from '../content/skill-definition'
import { areAdjacent } from './board'
import { assertValidBattleState, type BattleState } from './defeat-and-victory'
import type { BattleUnitId, BattleUnitState } from './unit-state'

export interface ResolveSkillTargetGroupInput {
  readonly battle: BattleState
  readonly actorBattleUnitId: BattleUnitId
  readonly skill: SkillDefinition
  readonly selectedTargetBattleUnitId?: BattleUnitId
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
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

function getLivingActor(battle: BattleState, actorBattleUnitId: BattleUnitId): BattleUnitState {
  const actor = getRequiredUnit(battle, actorBattleUnitId, 'actorBattleUnitId')
  if (actor.defeated) {
    throw new Error('defeated actor cannot select skill targets')
  }
  return actor
}

export function getSkillPrimaryTargetCandidates(
  battle: BattleState,
  actorBattleUnitId: BattleUnitId,
  skill: SkillDefinition,
): readonly BattleUnitState[] {
  assertValidBattleState(battle)
  assertValidSkillDefinition(skill)
  const actor = getLivingActor(battle, actorBattleUnitId)
  const selector = resolveSkillTargetSelector(skill)

  if (selector.side === 'SELF') {
    return Object.freeze([actor])
  }

  const candidates = battle.units
    .filter((unit) => {
      if (unit.defeated) {
        return false
      }
      return selector.side === 'ALLY' ? unit.side === actor.side : unit.side !== actor.side
    })
    .sort((left, right) => compareIds(left.battleUnitId, right.battleUnitId))

  return Object.freeze([...candidates])
}

export function resolveSkillTargetGroup(
  input: ResolveSkillTargetGroupInput,
): readonly BattleUnitState[] {
  assertValidBattleState(input.battle)
  assertValidSkillDefinition(input.skill)
  const actor = getLivingActor(input.battle, input.actorBattleUnitId)
  const selector = resolveSkillTargetSelector(input.skill)

  let primary: BattleUnitState
  if (selector.side === 'SELF') {
    if (
      input.selectedTargetBattleUnitId !== undefined &&
      input.selectedTargetBattleUnitId !== actor.battleUnitId
    ) {
      throw new Error('self-targeting skill must select the actor')
    }
    primary = actor
  } else {
    if (input.selectedTargetBattleUnitId === undefined) {
      throw new Error('selectedTargetBattleUnitId is required for non-self targeting')
    }
    primary = getRequiredUnit(
      input.battle,
      input.selectedTargetBattleUnitId,
      'selectedTargetBattleUnitId',
    )
    if (primary.defeated) {
      throw new Error('selected skill target must be alive')
    }
    if (selector.side === 'ALLY' && primary.side !== actor.side) {
      throw new Error('selected skill target must be an ally')
    }
    if (selector.side === 'ENEMY' && primary.side === actor.side) {
      throw new Error('selected skill target must be an enemy')
    }
  }

  if (selector.shape === 'SINGLE') {
    return Object.freeze([primary])
  }

  const adjacent = input.battle.units
    .filter(
      (unit) =>
        !unit.defeated &&
        unit.battleUnitId !== primary.battleUnitId &&
        unit.side === actor.side &&
        areAdjacent(unit.position, primary.position),
    )
    .sort((left, right) => compareIds(left.battleUnitId, right.battleUnitId))

  return Object.freeze([primary, ...adjacent])
}
