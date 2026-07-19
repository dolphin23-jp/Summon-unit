import {
  assertValidMonsterSpecies,
  type MonsterSpecies,
} from '../content/monster-species'
import {
  COLUMNS,
  LOCAL_ROWS,
  areAdjacent,
  getAdjacentPositions,
  type BoardPosition,
  type Side,
} from './board'
import {
  assertValidBattleState,
  getBoardOccupant,
  type BattleState,
  type BoardOccupant,
  type DefeatRecord,
} from './defeat-and-victory'
import {
  assertValidUnitActionSchedule,
  rescheduleUnitActionAfterAction,
  type BattleTime,
  type UnitActionSchedule,
} from './action-scheduling'
import { getModifiedBattleStatValue } from './stat-modifiers'
import { isMovementLocked } from './status-conditions'
import {
  assertValidBattleUnitState,
  type BattleUnitId,
  type BattleUnitState,
} from './unit-state'

export const NORMAL_MOVEMENT_ACTION_COST = 75

export interface PerformNormalMovementInput {
  readonly battle: BattleState
  readonly actorBattleUnitId: BattleUnitId
  readonly actorSpecies: MonsterSpecies
  readonly actorSchedule: UnitActionSchedule
  readonly destination: BoardPosition
  readonly currentTime: BattleTime
}

export interface NormalMovementResult {
  readonly battle: BattleState
  readonly actorSchedule: UnitActionSchedule
  readonly battleUnitId: BattleUnitId
  readonly from: BoardPosition
  readonly to: BoardPosition
  readonly effectiveActionCost: number
  readonly effectiveSpeed: number
}

const VALID_SIDES: readonly Side[] = Object.freeze(['ALLY', 'ENEMY'])
const EMPTY_POSITIONS: readonly BoardPosition[] = Object.freeze([])

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function assertValidBoardPosition(position: BoardPosition, field: string): void {
  if (!VALID_SIDES.includes(position.side)) {
    throw new Error(`${field}.side must be ALLY or ENEMY`)
  }
  if (!LOCAL_ROWS.includes(position.row)) {
    throw new Error(`${field}.row must be 0, 1, or 2`)
  }
  if (!COLUMNS.includes(position.column)) {
    throw new Error(`${field}.column must be 0, 1, or 2`)
  }
}

function freezePosition(position: BoardPosition): BoardPosition {
  return Object.freeze({ ...position })
}

function freezeUnit(unit: BattleUnitState): BattleUnitState {
  return Object.freeze({
    ...unit,
    position: freezePosition(unit.position),
  })
}

function freezeOccupant(occupant: BoardOccupant): BoardOccupant {
  return Object.freeze({
    battleUnitId: occupant.battleUnitId,
    position: freezePosition(occupant.position),
  })
}

function freezeDefeatRecord(record: DefeatRecord): DefeatRecord {
  return Object.freeze({ ...record })
}

function getRequiredBattleUnit(battle: BattleState, battleUnitId: BattleUnitId): BattleUnitState {
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`battle unit must belong to the battle: ${battleUnitId}`)
  }
  return unit
}

export function getNormalMovementCandidates(
  battle: BattleState,
  battleUnitId: BattleUnitId,
): readonly BoardPosition[] {
  assertValidBattleState(battle)
  const unit = getRequiredBattleUnit(battle, battleUnitId)
  assertValidBoardPosition(unit.position, 'unit.position')

  if (battle.outcome !== 'ONGOING' || unit.defeated || isMovementLocked(unit)) {
    return EMPTY_POSITIONS
  }

  return Object.freeze(
    getAdjacentPositions(unit.position)
      .filter((position) => getBoardOccupant(battle, position) === null)
      .map(freezePosition),
  )
}

function assertCanPerformNormalMovement(
  input: PerformNormalMovementInput,
  actor: BattleUnitState,
): void {
  if (input.battle.outcome !== 'ONGOING') {
    throw new Error('cannot move after the battle has ended')
  }
  if (actor.defeated) {
    throw new Error('defeated unit cannot move')
  }
  if (isMovementLocked(actor)) {
    throw new Error('movement-locked unit cannot move')
  }
  if (input.actorSchedule.battleUnitId !== actor.battleUnitId) {
    throw new Error('actorSchedule.battleUnitId must match actorBattleUnitId')
  }
  if (input.currentTime !== input.actorSchedule.nextActionTime) {
    throw new Error('currentTime must match actorSchedule.nextActionTime')
  }
  if (input.destination.side !== actor.side) {
    throw new Error('normal movement must stay within the actor side')
  }
  if (!areAdjacent(actor.position, input.destination)) {
    throw new Error('normal movement destination must be an adjacent position')
  }
  if (getBoardOccupant(input.battle, input.destination) !== null) {
    throw new Error('normal movement destination must be empty')
  }
}

function createMovedBattleState(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  destination: BoardPosition,
): BattleState {
  const movedActor = freezeUnit({
    ...actor,
    position: destination,
  })
  assertValidBattleUnitState(movedActor, actorSpecies)

  const units = Object.freeze(
    battle.units.map((unit) =>
      freezeUnit(unit.battleUnitId === actor.battleUnitId ? movedActor : unit),
    ),
  )
  const occupancy = Object.freeze(
    battle.occupancy.map((occupant) =>
      freezeOccupant(
        occupant.battleUnitId === actor.battleUnitId
          ? { battleUnitId: actor.battleUnitId, position: destination }
          : occupant,
      ),
    ),
  )
  const defeatRecords = Object.freeze(battle.defeatRecords.map(freezeDefeatRecord))

  const movedBattle: BattleState = Object.freeze({
    units,
    occupancy,
    timeline: battle.timeline,
    defeatRecords,
    outcome: battle.outcome,
  })
  assertValidBattleState(movedBattle)
  return movedBattle
}

export function performNormalMovement(input: PerformNormalMovementInput): NormalMovementResult {
  assertValidBattleState(input.battle)
  assertValidMonsterSpecies(input.actorSpecies)
  assertValidUnitActionSchedule(input.actorSchedule)
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')
  assertValidBoardPosition(input.destination, 'destination')

  const actor = getRequiredBattleUnit(input.battle, input.actorBattleUnitId)
  assertValidBoardPosition(actor.position, 'actor.position')
  assertValidBattleUnitState(actor, input.actorSpecies)
  assertCanPerformNormalMovement(input, actor)

  const battle = createMovedBattleState(
    input.battle,
    actor,
    input.actorSpecies,
    input.destination,
  )
  const effectiveActionCost = getModifiedBattleStatValue(
    NORMAL_MOVEMENT_ACTION_COST,
    actor.effects,
    'ACTION_COST',
  )
  const effectiveSpeed = getModifiedBattleStatValue(
    input.actorSpecies.stats.speed,
    actor.effects,
    'SPEED',
  )
  const actorSchedule = rescheduleUnitActionAfterAction(
    input.actorSchedule,
    input.currentTime,
    effectiveActionCost,
    effectiveSpeed,
  )

  return Object.freeze({
    battle,
    actorSchedule,
    battleUnitId: actor.battleUnitId,
    from: freezePosition(actor.position),
    to: freezePosition(input.destination),
    effectiveActionCost,
    effectiveSpeed,
  })
}
