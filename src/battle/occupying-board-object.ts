import {
  COLUMNS,
  LOCAL_ROWS,
  getBoardPositionId,
  isSameColumn,
  isSamePosition,
  toGlobalRow,
  type BoardPosition,
} from './board'
import {
  assertValidBattleState,
  getBoardOccupant,
  type BattleState,
} from './defeat-and-victory'
import type { BattleUnitId, BattleUnitState } from './unit-state'

export type BoardObjectId = string

export interface OccupyingBoardObjectState {
  readonly boardObjectId: BoardObjectId
  readonly objectTypeId: string
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly position: BoardPosition
  readonly maxHp: number
  readonly hp: number
  readonly destroyed: boolean
  readonly blocksDirect: boolean
}

export interface CreateOccupyingBoardObjectInput {
  readonly boardObjectId: BoardObjectId
  readonly objectTypeId: string
  readonly sourceBattleUnitId?: BattleUnitId | null
  readonly position: BoardPosition
  readonly maxHp: number
  readonly initialHp?: number
  readonly blocksDirect?: boolean
}

export interface ResolveBoardObjectDamageInput {
  readonly objects: readonly OccupyingBoardObjectState[]
  readonly boardObjectId: BoardObjectId
  readonly damage: number
}

export interface BoardObjectDamageResult {
  readonly objects: readonly OccupyingBoardObjectState[]
  readonly before: OccupyingBoardObjectState
  readonly after: OccupyingBoardObjectState
  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly destroyed: boolean
}

export type BattlefieldOccupant =
  | {
      readonly kind: 'UNIT'
      readonly id: BattleUnitId
      readonly position: BoardPosition
    }
  | {
      readonly kind: 'BOARD_OBJECT'
      readonly id: BoardObjectId
      readonly position: BoardPosition
    }

export type DirectLineEntity =
  | {
      readonly kind: 'UNIT'
      readonly id: BattleUnitId
      readonly position: BoardPosition
      readonly positionId: string
      readonly distance: number
    }
  | {
      readonly kind: 'BOARD_OBJECT'
      readonly id: BoardObjectId
      readonly position: BoardPosition
      readonly positionId: string
      readonly distance: number
    }

export interface ResolveDirectTargetWithBoardObjectsInput {
  readonly battle: BattleState
  readonly objects: readonly OccupyingBoardObjectState[]
  readonly attackerBattleUnitId: BattleUnitId
  readonly intendedTargetBattleUnitId: BattleUnitId
}

export interface ResolveDirectTargetWithBoardObjectsResult {
  readonly intendedTargetBattleUnitId: BattleUnitId
  readonly actualTarget: DirectLineEntity
  readonly blocked: boolean
  readonly blockingEntity: DirectLineEntity | null
  readonly lineEntities: readonly DirectLineEntity[]
}

function assertNonEmptyId(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function assertValidPosition(position: BoardPosition, field: string): void {
  if (position.side !== 'ALLY' && position.side !== 'ENEMY') {
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

function freezeObject(object: OccupyingBoardObjectState): OccupyingBoardObjectState {
  return Object.freeze({
    ...object,
    position: freezePosition(object.position),
  })
}

function freezeLineEntity(entity: DirectLineEntity): DirectLineEntity {
  return Object.freeze({
    ...entity,
    position: freezePosition(entity.position),
  }) as DirectLineEntity
}

export function assertValidOccupyingBoardObjectState(
  object: OccupyingBoardObjectState,
): void {
  assertNonEmptyId(object.boardObjectId, 'object.boardObjectId')
  assertNonEmptyId(object.objectTypeId, 'object.objectTypeId')
  if (object.sourceBattleUnitId !== null) {
    assertNonEmptyId(object.sourceBattleUnitId, 'object.sourceBattleUnitId')
  }
  assertValidPosition(object.position, 'object.position')
  assertSafeIntegerAtLeast(object.maxHp, 1, 'object.maxHp')
  assertSafeIntegerAtLeast(object.hp, 0, 'object.hp')
  if (object.hp > object.maxHp) {
    throw new Error('object.hp must not exceed object.maxHp')
  }
  if (object.destroyed !== (object.hp === 0)) {
    throw new Error('object.destroyed must be true exactly when object.hp is 0')
  }
  if (typeof object.blocksDirect !== 'boolean') {
    throw new Error('object.blocksDirect must be a boolean')
  }
}

export function createOccupyingBoardObjectState(
  input: CreateOccupyingBoardObjectInput,
): OccupyingBoardObjectState {
  const hp = input.initialHp ?? input.maxHp
  const object = freezeObject({
    boardObjectId: input.boardObjectId,
    objectTypeId: input.objectTypeId,
    sourceBattleUnitId: input.sourceBattleUnitId ?? null,
    position: input.position,
    maxHp: input.maxHp,
    hp,
    destroyed: hp === 0,
    blocksDirect: input.blocksDirect ?? true,
  })
  assertValidOccupyingBoardObjectState(object)
  return object
}

export function freezeOccupyingBoardObjectCollection(
  objects: readonly OccupyingBoardObjectState[],
): readonly OccupyingBoardObjectState[] {
  const ids = new Set<string>()
  const occupiedPositions = new Set<string>()
  const frozen = objects.map((object) => {
    assertValidOccupyingBoardObjectState(object)
    if (ids.has(object.boardObjectId)) {
      throw new Error(`boardObjectId must be unique: ${object.boardObjectId}`)
    }
    ids.add(object.boardObjectId)
    if (!object.destroyed) {
      const positionId = getBoardPositionId(object.position)
      if (occupiedPositions.has(positionId)) {
        throw new Error(`active board objects must not overlap: ${positionId}`)
      }
      occupiedPositions.add(positionId)
    }
    return freezeObject(object)
  })
  return Object.freeze(frozen)
}

export function assertBattlefieldOccupancy(
  battle: BattleState,
  objects: readonly OccupyingBoardObjectState[],
): void {
  assertValidBattleState(battle)
  const frozenObjects = freezeOccupyingBoardObjectCollection(objects)
  for (const object of frozenObjects) {
    if (!object.destroyed && getBoardOccupant(battle, object.position) !== null) {
      throw new Error(
        `active board object must not overlap a living unit: ${getBoardPositionId(object.position)}`,
      )
    }
  }
}

export function getOccupyingBoardObjectAt(
  objects: readonly OccupyingBoardObjectState[],
  position: BoardPosition,
): OccupyingBoardObjectState | null {
  assertValidPosition(position, 'position')
  const frozenObjects = freezeOccupyingBoardObjectCollection(objects)
  return (
    frozenObjects.find(
      (object) => !object.destroyed && isSamePosition(object.position, position),
    ) ?? null
  )
}

export function getBattlefieldOccupantAt(
  battle: BattleState,
  objects: readonly OccupyingBoardObjectState[],
  position: BoardPosition,
): BattlefieldOccupant | null {
  assertBattlefieldOccupancy(battle, objects)
  const unit = getBoardOccupant(battle, position)
  if (unit !== null) {
    return Object.freeze({
      kind: 'UNIT',
      id: unit.battleUnitId,
      position: freezePosition(unit.position),
    })
  }
  const object = getOccupyingBoardObjectAt(objects, position)
  if (object !== null) {
    return Object.freeze({
      kind: 'BOARD_OBJECT',
      id: object.boardObjectId,
      position: freezePosition(object.position),
    })
  }
  return null
}

export function isBattlefieldPositionOccupied(
  battle: BattleState,
  objects: readonly OccupyingBoardObjectState[],
  position: BoardPosition,
): boolean {
  return getBattlefieldOccupantAt(battle, objects, position) !== null
}

export function resolveOccupyingBoardObjectDamage(
  input: ResolveBoardObjectDamageInput,
): BoardObjectDamageResult {
  assertNonEmptyId(input.boardObjectId, 'boardObjectId')
  assertSafeIntegerAtLeast(input.damage, 1, 'damage')
  const objects = freezeOccupyingBoardObjectCollection(input.objects)
  const before = objects.find((object) => object.boardObjectId === input.boardObjectId)
  if (before === undefined) {
    throw new Error(`boardObjectId must reference an object: ${input.boardObjectId}`)
  }
  if (before.destroyed) {
    throw new Error('destroyed board object cannot receive damage')
  }

  const appliedDamage = Math.min(input.damage, before.hp)
  const hp = before.hp - appliedDamage
  const after = freezeObject({
    ...before,
    hp,
    destroyed: hp === 0,
  })
  const nextObjects = Object.freeze(
    objects.map((object) =>
      object.boardObjectId === before.boardObjectId ? after : object,
    ),
  )

  return Object.freeze({
    objects: nextObjects,
    before,
    after,
    calculatedDamage: input.damage,
    appliedDamage,
    destroyed: after.destroyed,
  })
}

function getRequiredLivingUnit(
  battle: BattleState,
  battleUnitId: BattleUnitId,
  field: string,
): BattleUnitState {
  assertNonEmptyId(battleUnitId, field)
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`${field} must reference a battle unit: ${battleUnitId}`)
  }
  if (unit.defeated) {
    throw new Error(`${field} must reference a living battle unit`)
  }
  return unit
}

function isTowardOpponent(attacker: BattleUnitState, position: BoardPosition): boolean {
  const attackerRow = toGlobalRow(attacker.position)
  const candidateRow = toGlobalRow(position)
  return attacker.side === 'ALLY' ? candidateRow < attackerRow : candidateRow > attackerRow
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

export function getDirectLineEntities(
  battle: BattleState,
  objects: readonly OccupyingBoardObjectState[],
  attackerBattleUnitId: BattleUnitId,
): readonly DirectLineEntity[] {
  assertBattlefieldOccupancy(battle, objects)
  const attacker = getRequiredLivingUnit(battle, attackerBattleUnitId, 'attackerBattleUnitId')
  const attackerRow = toGlobalRow(attacker.position)

  const unitEntities: DirectLineEntity[] = battle.units
    .filter(
      (unit) =>
        !unit.defeated &&
        unit.side !== attacker.side &&
        isSameColumn(unit.position, attacker.position) &&
        isTowardOpponent(attacker, unit.position),
    )
    .map((unit) =>
      freezeLineEntity({
        kind: 'UNIT',
        id: unit.battleUnitId,
        position: unit.position,
        positionId: getBoardPositionId(unit.position),
        distance: Math.abs(toGlobalRow(unit.position) - attackerRow),
      }),
    )

  const objectEntities: DirectLineEntity[] = objects
    .filter(
      (object) =>
        !object.destroyed &&
        object.blocksDirect &&
        isSameColumn(object.position, attacker.position) &&
        isTowardOpponent(attacker, object.position),
    )
    .map((object) =>
      freezeLineEntity({
        kind: 'BOARD_OBJECT',
        id: object.boardObjectId,
        position: object.position,
        positionId: getBoardPositionId(object.position),
        distance: Math.abs(toGlobalRow(object.position) - attackerRow),
      }),
    )

  return Object.freeze(
    [...unitEntities, ...objectEntities].sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance
      }
      if (left.kind !== right.kind) {
        return left.kind === 'BOARD_OBJECT' ? -1 : 1
      }
      return compareIds(left.id, right.id)
    }),
  )
}

export function resolveDirectTargetWithBoardObjects(
  input: ResolveDirectTargetWithBoardObjectsInput,
): ResolveDirectTargetWithBoardObjectsResult {
  assertBattlefieldOccupancy(input.battle, input.objects)
  const attacker = getRequiredLivingUnit(
    input.battle,
    input.attackerBattleUnitId,
    'attackerBattleUnitId',
  )
  const intendedTarget = getRequiredLivingUnit(
    input.battle,
    input.intendedTargetBattleUnitId,
    'intendedTargetBattleUnitId',
  )
  if (intendedTarget.side === attacker.side) {
    throw new Error('DIRECT intended target must be an enemy')
  }
  if (!isSameColumn(intendedTarget.position, attacker.position)) {
    throw new Error('DIRECT intended target must be in the attacker column')
  }

  const lineEntities = getDirectLineEntities(
    input.battle,
    input.objects,
    input.attackerBattleUnitId,
  )
  const actualTarget = lineEntities[0]
  if (actualTarget === undefined) {
    throw new Error('DIRECT targeting requires a target or blocking object in the attacker column')
  }
  const blocked =
    actualTarget.kind !== 'UNIT' || actualTarget.id !== input.intendedTargetBattleUnitId

  return Object.freeze({
    intendedTargetBattleUnitId: input.intendedTargetBattleUnitId,
    actualTarget,
    blocked,
    blockingEntity: blocked ? actualTarget : null,
    lineEntities,
  })
}
