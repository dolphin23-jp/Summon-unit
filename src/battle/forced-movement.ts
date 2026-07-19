import {
  COLUMNS,
  GLOBAL_ROWS,
  fromGlobalRow,
  isSamePosition,
  toGlobalRow,
  type BoardPosition,
  type Column,
  type GlobalRow,
} from './board'
import {
  assertValidBattleState,
  getBoardOccupant,
  type BattleState,
  type BoardOccupant,
} from './defeat-and-victory'
import type { BattleUnitId, BattleUnitState } from './unit-state'

export const FORCED_MOVEMENT_KINDS = [
  'PUSH',
  'PULL',
  'LATERAL_LEFT',
  'LATERAL_RIGHT',
] as const
export type ForcedMovementKind = (typeof FORCED_MOVEMENT_KINDS)[number]

export const FORCED_MOVEMENT_FAILURE_REASONS = [
  'BATTLE_ENDED',
  'SOURCE_DEFEATED',
  'TARGET_DEFEATED',
  'INVALID_ALIGNMENT',
  'OUT_OF_BOUNDS',
  'CROSS_SIDE',
  'OCCUPIED',
] as const
export type ForcedMovementFailureReason =
  (typeof FORCED_MOVEMENT_FAILURE_REASONS)[number]

export interface ResolveForcedMovementInput {
  readonly battle: BattleState
  readonly sourceBattleUnitId: BattleUnitId
  readonly targetBattleUnitId: BattleUnitId
  readonly kind: ForcedMovementKind
}

export interface ForcedMovementResult {
  readonly battle: BattleState
  readonly sourceBattleUnitId: BattleUnitId
  readonly targetBattleUnitId: BattleUnitId
  readonly kind: ForcedMovementKind
  readonly success: boolean
  readonly failureReason: ForcedMovementFailureReason | null
  readonly from: BoardPosition
  readonly to: BoardPosition | null
  readonly attemptedDestination: BoardPosition | null
}

function freezePosition(position: BoardPosition): BoardPosition {
  return Object.freeze({ ...position })
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

function freezeOccupant(occupant: BoardOccupant): BoardOccupant {
  return Object.freeze({
    battleUnitId: occupant.battleUnitId,
    position: freezePosition(occupant.position),
  })
}

function createFailureResult(
  input: ResolveForcedMovementInput,
  target: BattleUnitState,
  failureReason: ForcedMovementFailureReason,
  attemptedDestination: BoardPosition | null = null,
): ForcedMovementResult {
  return Object.freeze({
    battle: input.battle,
    sourceBattleUnitId: input.sourceBattleUnitId,
    targetBattleUnitId: input.targetBattleUnitId,
    kind: input.kind,
    success: false,
    failureReason,
    from: freezePosition(target.position),
    to: null,
    attemptedDestination:
      attemptedDestination === null ? null : freezePosition(attemptedDestination),
  })
}

function getPushPullStep(
  source: BattleUnitState,
  target: BattleUnitState,
  kind: 'PUSH' | 'PULL',
): { readonly row: number; readonly column: number } | null {
  const sourceRow = toGlobalRow(source.position)
  const targetRow = toGlobalRow(target.position)
  const rowDifference = targetRow - sourceRow
  const columnDifference = target.position.column - source.position.column

  if (rowDifference !== 0 && columnDifference !== 0) {
    return null
  }

  const direction = kind === 'PUSH' ? 1 : -1
  return Object.freeze({
    row: Math.sign(rowDifference) * direction,
    column: Math.sign(columnDifference) * direction,
  })
}

function getAttemptedDestination(
  source: BattleUnitState,
  target: BattleUnitState,
  kind: ForcedMovementKind,
):
  | { readonly kind: 'POSITION'; readonly position: BoardPosition }
  | { readonly kind: 'INVALID_ALIGNMENT' }
  | { readonly kind: 'OUT_OF_BOUNDS' } {
  let rowOffset = 0
  let columnOffset = 0

  if (kind === 'LATERAL_LEFT') {
    columnOffset = -1
  } else if (kind === 'LATERAL_RIGHT') {
    columnOffset = 1
  } else {
    const step = getPushPullStep(source, target, kind)
    if (step === null || (step.row === 0 && step.column === 0)) {
      return Object.freeze({ kind: 'INVALID_ALIGNMENT' })
    }
    rowOffset = step.row
    columnOffset = step.column
  }

  const destinationRow = toGlobalRow(target.position) + rowOffset
  const destinationColumn = target.position.column + columnOffset
  if (
    !GLOBAL_ROWS.includes(destinationRow as GlobalRow) ||
    !COLUMNS.includes(destinationColumn as Column)
  ) {
    return Object.freeze({ kind: 'OUT_OF_BOUNDS' })
  }

  return Object.freeze({
    kind: 'POSITION',
    position: freezePosition(
      fromGlobalRow(destinationRow as GlobalRow, destinationColumn as Column),
    ),
  })
}

function createMovedBattleState(
  battle: BattleState,
  target: BattleUnitState,
  destination: BoardPosition,
): BattleState {
  const movedTarget: BattleUnitState = Object.freeze({
    ...target,
    position: freezePosition(destination),
  })
  const units = Object.freeze(
    battle.units.map((unit) =>
      unit.battleUnitId === target.battleUnitId ? movedTarget : unit,
    ),
  )
  const occupancy = Object.freeze(
    battle.occupancy.map((occupant) =>
      freezeOccupant(
        occupant.battleUnitId === target.battleUnitId
          ? { battleUnitId: target.battleUnitId, position: destination }
          : occupant,
      ),
    ),
  )
  const nextBattle: BattleState = Object.freeze({
    ...battle,
    units,
    occupancy,
  })
  assertValidBattleState(nextBattle)
  return nextBattle
}

export function resolveForcedMovement(
  input: ResolveForcedMovementInput,
): ForcedMovementResult {
  assertValidBattleState(input.battle)
  if (!FORCED_MOVEMENT_KINDS.includes(input.kind)) {
    throw new Error('kind must be a supported forced movement kind')
  }
  if (input.sourceBattleUnitId === input.targetBattleUnitId) {
    throw new Error('forced movement source and target must differ')
  }

  const source = getRequiredUnit(
    input.battle,
    input.sourceBattleUnitId,
    'sourceBattleUnitId',
  )
  const target = getRequiredUnit(
    input.battle,
    input.targetBattleUnitId,
    'targetBattleUnitId',
  )

  if (input.battle.outcome !== 'ONGOING') {
    return createFailureResult(input, target, 'BATTLE_ENDED')
  }
  if (source.defeated) {
    return createFailureResult(input, target, 'SOURCE_DEFEATED')
  }
  if (target.defeated) {
    return createFailureResult(input, target, 'TARGET_DEFEATED')
  }

  const attempted = getAttemptedDestination(source, target, input.kind)
  if (attempted.kind === 'INVALID_ALIGNMENT') {
    return createFailureResult(input, target, 'INVALID_ALIGNMENT')
  }
  if (attempted.kind === 'OUT_OF_BOUNDS') {
    return createFailureResult(input, target, 'OUT_OF_BOUNDS')
  }

  const destination = attempted.position
  if (destination.side !== target.side) {
    return createFailureResult(input, target, 'CROSS_SIDE', destination)
  }
  if (isSamePosition(destination, target.position)) {
    return createFailureResult(input, target, 'INVALID_ALIGNMENT', destination)
  }
  if (getBoardOccupant(input.battle, destination) !== null) {
    return createFailureResult(input, target, 'OCCUPIED', destination)
  }

  return Object.freeze({
    battle: createMovedBattleState(input.battle, target, destination),
    sourceBattleUnitId: source.battleUnitId,
    targetBattleUnitId: target.battleUnitId,
    kind: input.kind,
    success: true,
    failureReason: null,
    from: freezePosition(target.position),
    to: freezePosition(destination),
    attemptedDestination: freezePosition(destination),
  })
}
