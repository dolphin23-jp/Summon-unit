import {
  assertValidMonsterSpecies,
  type MonsterSpecies,
} from '../content/monster-species'
import {
  assertValidUnitActionSchedule,
  calculateNextActionTime,
  createUnitTurnEvent,
  registerUnitTurnEvent,
  type BattleTime,
  type UnitActionSchedule,
} from './action-scheduling'
import {
  getAdjacentPositions,
  getBoardPositionId,
  type BoardPosition,
  type Side,
} from './board'
import {
  resolveBattlefieldRegionEntries,
  type BattlefieldRegionEntryTrigger,
  type BattlefieldRegionState,
} from './battlefield-region'
import {
  assertValidBattleState,
  evaluateBattleOutcome,
  type BattleState,
  type BoardOccupant,
  type DefeatRecord,
} from './defeat-and-victory'
import {
  isBattlefieldPositionOccupied,
  type OccupyingBoardObjectState,
} from './occupying-board-object'
import type { TimelineQueue } from './timeline-queue'
import {
  assertValidBattleUnitState,
  createBattleUnitState,
  type BattleUnitId,
  type BattleUnitState,
} from './unit-state'

export const REVIVE_HP_PERMILLE = 300

export interface BattleRevivalState {
  readonly revivedBattleUnitIds: readonly BattleUnitId[]
}

export interface SummonBattleUnitInput {
  readonly battle: BattleState
  readonly summonerBattleUnitId: BattleUnitId
  readonly summonedBattleUnitId: BattleUnitId
  readonly summonedSpecies: MonsterSpecies
  readonly destination: BoardPosition
  readonly currentTime: BattleTime
  readonly initialActionCost: number
  readonly tiePriority: number
  readonly occupyingObjects?: readonly OccupyingBoardObjectState[]
  readonly regions?: readonly BattlefieldRegionState[]
}

export interface SummonBattleUnitResult {
  readonly battle: BattleState
  readonly summonedUnit: BattleUnitState
  readonly summonedSchedule: UnitActionSchedule
  readonly regionEntries: readonly BattlefieldRegionEntryTrigger[]
}

export interface ReviveBattleUnitInput {
  readonly battle: BattleState
  readonly targetBattleUnitId: BattleUnitId
  readonly targetSpecies: MonsterSpecies
  readonly revivalState?: BattleRevivalState
  readonly currentTime: BattleTime
  readonly initialActionCost: number
  readonly tiePriority: number
  readonly occupyingObjects?: readonly OccupyingBoardObjectState[]
}

export interface ReviveBattleUnitResult {
  readonly battle: BattleState
  readonly revivalState: BattleRevivalState
  readonly revivedUnit: BattleUnitState
  readonly revivedSchedule: UnitActionSchedule
  readonly originalPosition: BoardPosition
  readonly destination: BoardPosition
  readonly restoredHp: number
}

const EMPTY_OBJECTS: readonly OccupyingBoardObjectState[] = Object.freeze([])
const EMPTY_REGIONS: readonly BattlefieldRegionState[] = Object.freeze([])
export const EMPTY_BATTLE_REVIVAL_STATE: BattleRevivalState = Object.freeze({
  revivedBattleUnitIds: Object.freeze([]),
})

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

function freezePosition(position: BoardPosition): BoardPosition {
  return Object.freeze({ ...position })
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

function freezeRevivalState(state: BattleRevivalState): BattleRevivalState {
  const seen = new Set<string>()
  const ids = [...state.revivedBattleUnitIds]
  for (const id of ids) {
    assertNonEmptyId(id, 'revivalState.revivedBattleUnitIds[]')
    if (seen.has(id)) {
      throw new Error(`revivalState must not repeat battle unit id: ${id}`)
    }
    seen.add(id)
  }
  ids.sort(compareIds)
  return Object.freeze({ revivedBattleUnitIds: Object.freeze(ids) })
}

export function assertValidBattleRevivalState(state: BattleRevivalState): void {
  freezeRevivalState(state)
}

export function createBattleRevivalState(
  revivedBattleUnitIds: readonly BattleUnitId[] = [],
): BattleRevivalState {
  return freezeRevivalState({ revivedBattleUnitIds })
}

function getRequiredUnit(
  battle: BattleState,
  battleUnitId: BattleUnitId,
  field: string,
): BattleUnitState {
  assertNonEmptyId(battleUnitId, field)
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`${field} must reference a battle unit: ${battleUnitId}`)
  }
  return unit
}

function getNextTimelineSequence(timeline: TimelineQueue): number {
  const maximum = timeline.events.reduce(
    (current, event) => Math.max(current, event.sequence),
    -1,
  )
  const next = maximum + 1
  assertSafeIntegerAtLeast(next, 0, 'timeline sequence')
  return next
}

function createEntrySchedule(
  unit: BattleUnitState,
  species: MonsterSpecies,
  currentTime: BattleTime,
  initialActionCost: number,
  tiePriority: number,
): UnitActionSchedule {
  assertSafeIntegerAtLeast(currentTime, 0, 'currentTime')
  assertSafeIntegerAtLeast(initialActionCost, 1, 'initialActionCost')
  assertSafeInteger(tiePriority, 'tiePriority')
  const schedule: UnitActionSchedule = Object.freeze({
    battleUnitId: unit.battleUnitId,
    nextActionTime: calculateNextActionTime(
      currentTime,
      initialActionCost,
      species.stats.speed,
    ),
    tie: Object.freeze({
      actionCount: 0,
      lastActionTime: currentTime,
      tiePriority,
      battleUnitId: unit.battleUnitId,
    }),
  })
  assertValidUnitActionSchedule(schedule)
  return schedule
}

function createBattleWithEntry(
  battle: BattleState,
  units: readonly BattleUnitState[],
  occupancy: readonly BoardOccupant[],
  timeline: TimelineQueue,
  defeatRecords: readonly DefeatRecord[] = battle.defeatRecords,
): BattleState {
  const nextBattle: BattleState = Object.freeze({
    units: Object.freeze([...units]),
    occupancy: Object.freeze(occupancy.map(freezeOccupant)),
    timeline,
    defeatRecords: Object.freeze(defeatRecords.map(freezeDefeatRecord)),
    outcome: evaluateBattleOutcome(units),
  })
  assertValidBattleState(nextBattle)
  return nextBattle
}

function countLivingSideUnits(battle: BattleState, side: Side): number {
  return battle.units.filter((unit) => unit.side === side && !unit.defeated).length
}

function assertCanEnterPosition(
  battle: BattleState,
  objects: readonly OccupyingBoardObjectState[],
  position: BoardPosition,
  field: string,
): void {
  if (isBattlefieldPositionOccupied(battle, objects, position)) {
    throw new Error(`${field} must be empty`)
  }
}

export function summonBattleUnit(input: SummonBattleUnitInput): SummonBattleUnitResult {
  assertValidBattleState(input.battle)
  assertValidMonsterSpecies(input.summonedSpecies)
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')
  assertSafeIntegerAtLeast(input.initialActionCost, 1, 'initialActionCost')
  assertSafeInteger(input.tiePriority, 'tiePriority')
  assertNonEmptyId(input.summonedBattleUnitId, 'summonedBattleUnitId')

  if (input.battle.outcome !== 'ONGOING') {
    throw new Error('cannot summon after the battle has ended')
  }
  const summoner = getRequiredUnit(
    input.battle,
    input.summonerBattleUnitId,
    'summonerBattleUnitId',
  )
  if (input.destination.side !== summoner.side) {
    throw new Error('summon destination must be on the summoner side')
  }
  if (
    input.battle.units.some(
      (unit) => unit.battleUnitId === input.summonedBattleUnitId,
    )
  ) {
    throw new Error(`battleUnitId must be unique: ${input.summonedBattleUnitId}`)
  }
  if (countLivingSideUnits(input.battle, summoner.side) >= 9) {
    throw new Error('summon side already occupies the nine-unit limit')
  }

  const objects = input.occupyingObjects ?? EMPTY_OBJECTS
  assertCanEnterPosition(input.battle, objects, input.destination, 'summon destination')

  const summonedUnit = createBattleUnitState(input.summonedSpecies, {
    battleUnitId: input.summonedBattleUnitId,
    sourceInstanceId: null,
    position: input.destination,
  })
  const summonedSchedule = createEntrySchedule(
    summonedUnit,
    input.summonedSpecies,
    input.currentTime,
    input.initialActionCost,
    input.tiePriority,
  )
  const timeline = registerUnitTurnEvent(
    input.battle.timeline,
    createUnitTurnEvent(
      summonedSchedule,
      getNextTimelineSequence(input.battle.timeline),
    ),
  )
  const battle = createBattleWithEntry(
    input.battle,
    [...input.battle.units, summonedUnit],
    [
      ...input.battle.occupancy,
      { battleUnitId: summonedUnit.battleUnitId, position: summonedUnit.position },
    ],
    timeline,
  )
  const regionEntries = resolveBattlefieldRegionEntries({
    regions: input.regions ?? EMPTY_REGIONS,
    battleUnitId: summonedUnit.battleUnitId,
    from: null,
    to: summonedUnit.position,
    cause: 'SUMMON',
    currentTime: input.currentTime,
  })

  return Object.freeze({
    battle,
    summonedUnit,
    summonedSchedule,
    regionEntries,
  })
}

function getRevivalDestination(
  battle: BattleState,
  objects: readonly OccupyingBoardObjectState[],
  originalPosition: BoardPosition,
): BoardPosition | null {
  if (!isBattlefieldPositionOccupied(battle, objects, originalPosition)) {
    return freezePosition(originalPosition)
  }
  const adjacent = getAdjacentPositions(originalPosition).find(
    (position) => !isBattlefieldPositionOccupied(battle, objects, position),
  )
  return adjacent === undefined ? null : freezePosition(adjacent)
}

function calculateReviveHp(maxHp: number): number {
  assertSafeIntegerAtLeast(maxHp, 1, 'maxHp')
  return Math.max(1, Math.ceil((maxHp * REVIVE_HP_PERMILLE) / 1000))
}

export function reviveBattleUnit(input: ReviveBattleUnitInput): ReviveBattleUnitResult {
  assertValidBattleState(input.battle)
  assertValidMonsterSpecies(input.targetSpecies)
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')
  assertSafeIntegerAtLeast(input.initialActionCost, 1, 'initialActionCost')
  assertSafeInteger(input.tiePriority, 'tiePriority')

  if (input.battle.outcome !== 'ONGOING') {
    throw new Error('cannot revive after the battle has ended')
  }
  const target = getRequiredUnit(
    input.battle,
    input.targetBattleUnitId,
    'targetBattleUnitId',
  )
  assertValidBattleUnitState(target, input.targetSpecies)
  if (!target.defeated) {
    throw new Error('revive target must be defeated')
  }
  const defeatRecord = input.battle.defeatRecords.find(
    (record) => record.defeatedBattleUnitId === target.battleUnitId,
  )
  if (defeatRecord === undefined) {
    throw new Error('revive target must have a defeat record')
  }
  if (input.currentTime < defeatRecord.defeatedAt) {
    throw new Error('currentTime must not be earlier than the target defeat')
  }

  const revivalState = freezeRevivalState(
    input.revivalState ?? EMPTY_BATTLE_REVIVAL_STATE,
  )
  if (revivalState.revivedBattleUnitIds.includes(target.battleUnitId)) {
    throw new Error('battle unit may be revived only once per battle')
  }

  const objects = input.occupyingObjects ?? EMPTY_OBJECTS
  const destination = getRevivalDestination(
    input.battle,
    objects,
    target.position,
  )
  if (destination === null) {
    throw new Error('revive target has no empty original or adjacent position')
  }

  const restoredHp = calculateReviveHp(input.targetSpecies.stats.hp)
  const revivedUnit: BattleUnitState = Object.freeze({
    ...target,
    position: destination,
    hp: restoredHp,
    barriers: Object.freeze([]),
    effects: Object.freeze([]),
    defeated: false,
  })
  assertValidBattleUnitState(revivedUnit, input.targetSpecies)
  const revivedSchedule = createEntrySchedule(
    revivedUnit,
    input.targetSpecies,
    input.currentTime,
    input.initialActionCost,
    input.tiePriority,
  )
  const timeline = registerUnitTurnEvent(
    input.battle.timeline,
    createUnitTurnEvent(
      revivedSchedule,
      getNextTimelineSequence(input.battle.timeline),
    ),
  )
  const units = input.battle.units.map((unit) =>
    unit.battleUnitId === revivedUnit.battleUnitId ? revivedUnit : unit,
  )
  const defeatRecords = input.battle.defeatRecords.filter(
    (record) => record.defeatedBattleUnitId !== revivedUnit.battleUnitId,
  )
  const battle = createBattleWithEntry(
    input.battle,
    units,
    [
      ...input.battle.occupancy,
      { battleUnitId: revivedUnit.battleUnitId, position: revivedUnit.position },
    ],
    timeline,
    defeatRecords,
  )
  const nextRevivalState = freezeRevivalState({
    revivedBattleUnitIds: [
      ...revivalState.revivedBattleUnitIds,
      revivedUnit.battleUnitId,
    ],
  })

  return Object.freeze({
    battle,
    revivalState: nextRevivalState,
    revivedUnit,
    revivedSchedule,
    originalPosition: freezePosition(target.position),
    destination: freezePosition(destination),
    restoredHp,
  })
}

export function getBattlefieldEntryPositionId(
  result: SummonBattleUnitResult | ReviveBattleUnitResult,
): string {
  return getBoardPositionId(
    'summonedUnit' in result ? result.summonedUnit.position : result.destination,
  )
}
