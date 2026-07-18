import { getBoardPositionId, isSamePosition, type BoardPosition, type Side } from './board'
import { getUnitTurnEventId, type BattleTime } from './action-scheduling'
import {
  cancelTimelineEvent,
  createTimelineQueue,
  type TimelineQueue,
} from './timeline-queue'
import type { BattleUnitId, BattleUnitState } from './unit-state'

export type BattleOutcome = 'ONGOING' | 'ALLY_VICTORY' | 'ALLY_DEFEAT'

export interface BoardOccupant {
  readonly battleUnitId: BattleUnitId
  readonly position: BoardPosition
}

export interface DefeatRecord {
  readonly defeatedBattleUnitId: BattleUnitId
  readonly killerBattleUnitId: BattleUnitId | null
  readonly defeatedAt: BattleTime
}

export interface BattleState {
  readonly units: readonly BattleUnitState[]
  readonly occupancy: readonly BoardOccupant[]
  readonly timeline: TimelineQueue
  readonly defeatRecords: readonly DefeatRecord[]
  readonly outcome: BattleOutcome
}

export interface CreateBattleStateInput {
  readonly units: readonly BattleUnitState[]
  readonly timeline?: TimelineQueue
}

export interface ResolveBattleUnitDefeatInput {
  readonly battle: BattleState
  readonly defeatedUnit: BattleUnitState
  readonly currentTime: BattleTime
  readonly killerBattleUnitId?: BattleUnitId | null
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

function assertBasicUnitState(unit: BattleUnitState): void {
  assertNonEmptyId(unit.battleUnitId, 'unit.battleUnitId')
  assertNonEmptyId(unit.speciesId, 'unit.speciesId')
  assertSafeIntegerAtLeast(unit.hp, 0, 'unit.hp')

  if (unit.sourceInstanceId !== null) {
    assertNonEmptyId(unit.sourceInstanceId, 'unit.sourceInstanceId')
  }

  if (unit.side !== unit.position.side) {
    throw new Error('unit.side must match unit.position.side')
  }

  if (unit.defeated !== (unit.hp === 0)) {
    throw new Error('unit.defeated must be true exactly when unit.hp is 0')
  }
}

function cloneUnit(unit: BattleUnitState): BattleUnitState {
  return Object.freeze({
    ...unit,
    position: Object.freeze({ ...unit.position }),
  })
}

function freezeOccupant(occupant: BoardOccupant): BoardOccupant {
  return Object.freeze({
    battleUnitId: occupant.battleUnitId,
    position: Object.freeze({ ...occupant.position }),
  })
}

function freezeDefeatRecord(record: DefeatRecord): DefeatRecord {
  return Object.freeze({ ...record })
}

function freezeBattleState(state: BattleState): BattleState {
  return Object.freeze({
    units: Object.freeze(state.units.map(cloneUnit)),
    occupancy: Object.freeze(state.occupancy.map(freezeOccupant)),
    timeline: state.timeline,
    defeatRecords: Object.freeze(state.defeatRecords.map(freezeDefeatRecord)),
    outcome: state.outcome,
  })
}

function countUnitsOnSide(units: readonly BattleUnitState[], side: Side): number {
  return units.filter((unit) => unit.side === side).length
}

export function evaluateBattleOutcome(units: readonly BattleUnitState[]): BattleOutcome {
  const hasLivingAlly = units.some((unit) => unit.side === 'ALLY' && !unit.defeated)
  const hasLivingEnemy = units.some((unit) => unit.side === 'ENEMY' && !unit.defeated)

  if (!hasLivingAlly) {
    return 'ALLY_DEFEAT'
  }

  if (!hasLivingEnemy) {
    return 'ALLY_VICTORY'
  }

  return 'ONGOING'
}

function createOccupancy(units: readonly BattleUnitState[]): readonly BoardOccupant[] {
  return units
    .filter((unit) => !unit.defeated)
    .map((unit) => ({ battleUnitId: unit.battleUnitId, position: unit.position }))
}

export function assertValidBattleState(battle: BattleState): void {
  const unitIds = new Set<string>()
  const unitById = new Map<string, BattleUnitState>()

  for (const unit of battle.units) {
    assertBasicUnitState(unit)
    if (unitIds.has(unit.battleUnitId)) {
      throw new Error(`battleUnitId must be unique: ${unit.battleUnitId}`)
    }
    unitIds.add(unit.battleUnitId)
    unitById.set(unit.battleUnitId, unit)
  }

  const allyCount = countUnitsOnSide(battle.units, 'ALLY')
  const enemyCount = countUnitsOnSide(battle.units, 'ENEMY')
  if (allyCount < 1 || allyCount > 9) {
    throw new Error('battle must contain between 1 and 9 ally units')
  }
  if (enemyCount < 1 || enemyCount > 9) {
    throw new Error('battle must contain between 1 and 9 enemy units')
  }

  const occupiedUnitIds = new Set<string>()
  const occupiedPositionIds = new Set<string>()
  for (const occupant of battle.occupancy) {
    assertNonEmptyId(occupant.battleUnitId, 'occupant.battleUnitId')
    const unit = unitById.get(occupant.battleUnitId)
    if (unit === undefined) {
      throw new Error(`occupant must reference a battle unit: ${occupant.battleUnitId}`)
    }
    if (unit.defeated) {
      throw new Error(`defeated unit must not occupy the board: ${occupant.battleUnitId}`)
    }
    if (!isSamePosition(unit.position, occupant.position)) {
      throw new Error(`occupant position must match unit position: ${occupant.battleUnitId}`)
    }
    if (occupiedUnitIds.has(occupant.battleUnitId)) {
      throw new Error(`unit must occupy at most one position: ${occupant.battleUnitId}`)
    }

    const positionId = getBoardPositionId(occupant.position)
    if (occupiedPositionIds.has(positionId)) {
      throw new Error(`board position must have at most one occupant: ${positionId}`)
    }

    occupiedUnitIds.add(occupant.battleUnitId)
    occupiedPositionIds.add(positionId)
  }

  for (const unit of battle.units) {
    const isOccupying = occupiedUnitIds.has(unit.battleUnitId)
    if (!unit.defeated && !isOccupying) {
      throw new Error(`living unit must occupy the board: ${unit.battleUnitId}`)
    }
    if (unit.defeated && isOccupying) {
      throw new Error(`defeated unit must not occupy the board: ${unit.battleUnitId}`)
    }
  }

  const recordedDefeats = new Set<string>()
  for (const record of battle.defeatRecords) {
    assertNonEmptyId(record.defeatedBattleUnitId, 'record.defeatedBattleUnitId')
    assertSafeIntegerAtLeast(record.defeatedAt, 0, 'record.defeatedAt')

    if (recordedDefeats.has(record.defeatedBattleUnitId)) {
      throw new Error(`defeat must be recorded at most once: ${record.defeatedBattleUnitId}`)
    }

    const defeatedUnit = unitById.get(record.defeatedBattleUnitId)
    if (defeatedUnit === undefined || !defeatedUnit.defeated) {
      throw new Error(`defeat record must reference a defeated unit: ${record.defeatedBattleUnitId}`)
    }

    if (record.killerBattleUnitId !== null) {
      assertNonEmptyId(record.killerBattleUnitId, 'record.killerBattleUnitId')
      if (!unitById.has(record.killerBattleUnitId)) {
        throw new Error(`killer must reference a battle unit: ${record.killerBattleUnitId}`)
      }
      if (record.killerBattleUnitId === record.defeatedBattleUnitId) {
        throw new Error('killerBattleUnitId must differ from defeatedBattleUnitId')
      }
    }

    recordedDefeats.add(record.defeatedBattleUnitId)
  }

  const expectedOutcome = evaluateBattleOutcome(battle.units)
  if (battle.outcome !== expectedOutcome) {
    throw new Error(`battle.outcome must be ${expectedOutcome}`)
  }
}

export function createBattleState(input: CreateBattleStateInput): BattleState {
  for (const unit of input.units) {
    assertBasicUnitState(unit)
    if (unit.defeated) {
      throw new Error('initial battle units must not be defeated')
    }
  }

  const battle = freezeBattleState({
    units: input.units,
    occupancy: createOccupancy(input.units),
    timeline: input.timeline ?? createTimelineQueue(),
    defeatRecords: [],
    outcome: 'ONGOING',
  })

  assertValidBattleState(battle)
  return battle
}

function assertSameUnitIdentity(current: BattleUnitState, updated: BattleUnitState): void {
  if (current.battleUnitId !== updated.battleUnitId) {
    throw new Error('updated unit id must match the current unit')
  }
  if (current.sourceInstanceId !== updated.sourceInstanceId) {
    throw new Error('updated sourceInstanceId must not change')
  }
  if (current.speciesId !== updated.speciesId) {
    throw new Error('updated speciesId must not change')
  }
  if (current.side !== updated.side) {
    throw new Error('updated side must not change')
  }
  if (!isSamePosition(current.position, updated.position)) {
    throw new Error('updated position must not change during defeat resolution')
  }
}

export function resolveBattleUnitDefeat(input: ResolveBattleUnitDefeatInput): BattleState {
  assertValidBattleState(input.battle)
  assertBasicUnitState(input.defeatedUnit)
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')

  const killerBattleUnitId = input.killerBattleUnitId ?? null
  const existingRecord = input.battle.defeatRecords.find(
    (record) => record.defeatedBattleUnitId === input.defeatedUnit.battleUnitId,
  )
  if (existingRecord !== undefined) {
    return input.battle
  }

  if (input.battle.outcome !== 'ONGOING') {
    throw new Error('cannot resolve another defeat after the battle has ended')
  }

  const currentIndex = input.battle.units.findIndex(
    (unit) => unit.battleUnitId === input.defeatedUnit.battleUnitId,
  )
  if (currentIndex === -1) {
    throw new Error(`defeated unit must belong to the battle: ${input.defeatedUnit.battleUnitId}`)
  }

  const currentUnit = input.battle.units[currentIndex]
  assertSameUnitIdentity(currentUnit, input.defeatedUnit)

  if (currentUnit.defeated) {
    throw new Error('current battle unit is already defeated')
  }
  if (!input.defeatedUnit.defeated || input.defeatedUnit.hp !== 0) {
    throw new Error('defeat resolution requires a unit with 0 HP')
  }

  if (killerBattleUnitId !== null) {
    assertNonEmptyId(killerBattleUnitId, 'killerBattleUnitId')
    if (killerBattleUnitId === input.defeatedUnit.battleUnitId) {
      throw new Error('killerBattleUnitId must differ from defeatedBattleUnitId')
    }
    if (!input.battle.units.some((unit) => unit.battleUnitId === killerBattleUnitId)) {
      throw new Error(`killer must belong to the battle: ${killerBattleUnitId}`)
    }
  }

  const units = input.battle.units.map((unit, index) =>
    index === currentIndex ? input.defeatedUnit : unit,
  )
  const occupancy = input.battle.occupancy.filter(
    (occupant) => occupant.battleUnitId !== input.defeatedUnit.battleUnitId,
  )
  const timeline = cancelTimelineEvent(
    input.battle.timeline,
    getUnitTurnEventId(input.defeatedUnit.battleUnitId),
  ).queue
  const defeatRecords = [
    ...input.battle.defeatRecords,
    {
      defeatedBattleUnitId: input.defeatedUnit.battleUnitId,
      killerBattleUnitId,
      defeatedAt: input.currentTime,
    },
  ]

  const battle = freezeBattleState({
    units,
    occupancy,
    timeline,
    defeatRecords,
    outcome: evaluateBattleOutcome(units),
  })

  assertValidBattleState(battle)
  return battle
}

export function getBoardOccupant(
  battle: BattleState,
  position: BoardPosition,
): BoardOccupant | null {
  return (
    battle.occupancy.find((occupant) => isSamePosition(occupant.position, position)) ?? null
  )
}
