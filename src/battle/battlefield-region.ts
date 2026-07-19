import type { BattleTime } from './action-scheduling'
import {
  ALL_BOARD_POSITIONS,
  COLUMNS,
  LOCAL_ROWS,
  getBoardPositionId,
  isSamePosition,
  type BoardPosition,
} from './board'
import {
  resolveForcedMovement,
  type ForcedMovementResult,
  type ResolveForcedMovementInput,
} from './forced-movement'
import type { BattleUnitId } from './unit-state'

export type BattlefieldRegionId = string

export const BATTLEFIELD_REGION_ENTRY_CAUSES = [
  'NORMAL_MOVEMENT',
  'FORCED_MOVEMENT',
  'SUMMON',
] as const
export type BattlefieldRegionEntryCause =
  (typeof BATTLEFIELD_REGION_ENTRY_CAUSES)[number]

export interface BattlefieldRegionState {
  readonly battlefieldRegionId: BattlefieldRegionId
  readonly effectId: string
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly positions: readonly BoardPosition[]
  readonly createdAt: BattleTime
  readonly expiresAt: BattleTime | null
}

export interface CreateBattlefieldRegionInput {
  readonly battlefieldRegionId: BattlefieldRegionId
  readonly effectId: string
  readonly sourceBattleUnitId?: BattleUnitId | null
  readonly positions: readonly BoardPosition[]
  readonly createdAt: BattleTime
  readonly duration?: BattleTime | null
}

export interface ResolveBattlefieldRegionEntriesInput {
  readonly regions: readonly BattlefieldRegionState[]
  readonly battleUnitId: BattleUnitId
  readonly from: BoardPosition | null
  readonly to: BoardPosition
  readonly cause: BattlefieldRegionEntryCause
  readonly currentTime: BattleTime
}

export interface BattlefieldRegionEntryTrigger {
  readonly battlefieldRegionId: BattlefieldRegionId
  readonly effectId: string
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly battleUnitId: BattleUnitId
  readonly cause: BattlefieldRegionEntryCause
  readonly enteredPosition: BoardPosition
  readonly enteredPositionId: string
  readonly triggeredAt: BattleTime
}

export interface ResolveForcedMovementWithRegionsInput extends ResolveForcedMovementInput {
  readonly regions: readonly BattlefieldRegionState[]
  readonly currentTime: BattleTime
}

export interface ForcedMovementWithRegionsResult {
  readonly movement: ForcedMovementResult
  readonly regionEntries: readonly BattlefieldRegionEntryTrigger[]
}

const POSITION_ORDER = new Map(
  ALL_BOARD_POSITIONS.map((position, index) => [getBoardPositionId(position), index]),
)
const EMPTY_REGION_ENTRIES: readonly BattlefieldRegionEntryTrigger[] = Object.freeze([])

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

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function freezePositions(positions: readonly BoardPosition[]): readonly BoardPosition[] {
  if (positions.length === 0) {
    throw new Error('region.positions must contain at least one position')
  }
  const seen = new Set<string>()
  const frozen = positions.map((position, index) => {
    assertValidPosition(position, `region.positions[${index}]`)
    const positionId = getBoardPositionId(position)
    if (seen.has(positionId)) {
      throw new Error(`region.positions must not repeat ${positionId}`)
    }
    seen.add(positionId)
    return freezePosition(position)
  })
  frozen.sort(
    (left, right) =>
      (POSITION_ORDER.get(getBoardPositionId(left)) ?? Number.MAX_SAFE_INTEGER) -
      (POSITION_ORDER.get(getBoardPositionId(right)) ?? Number.MAX_SAFE_INTEGER),
  )
  return Object.freeze(frozen)
}

function freezeRegion(region: BattlefieldRegionState): BattlefieldRegionState {
  return Object.freeze({
    ...region,
    positions: freezePositions(region.positions),
  })
}

export function assertValidBattlefieldRegionState(region: BattlefieldRegionState): void {
  assertNonEmptyId(region.battlefieldRegionId, 'region.battlefieldRegionId')
  assertNonEmptyId(region.effectId, 'region.effectId')
  if (region.sourceBattleUnitId !== null) {
    assertNonEmptyId(region.sourceBattleUnitId, 'region.sourceBattleUnitId')
  }
  freezePositions(region.positions)
  assertSafeIntegerAtLeast(region.createdAt, 0, 'region.createdAt')
  if (region.expiresAt !== null) {
    assertSafeIntegerAtLeast(region.expiresAt, 1, 'region.expiresAt')
    if (region.expiresAt <= region.createdAt) {
      throw new Error('region.expiresAt must be later than region.createdAt')
    }
  }
}

export function createBattlefieldRegion(
  input: CreateBattlefieldRegionInput,
): BattlefieldRegionState {
  assertSafeIntegerAtLeast(input.createdAt, 0, 'createdAt')
  const duration = input.duration ?? null
  if (duration !== null) {
    assertSafeIntegerAtLeast(duration, 1, 'duration')
  }
  const expiresAt = duration === null ? null : input.createdAt + duration
  if (expiresAt !== null && !Number.isSafeInteger(expiresAt)) {
    throw new Error('region expiration time must be a safe integer')
  }
  const region = freezeRegion({
    battlefieldRegionId: input.battlefieldRegionId,
    effectId: input.effectId,
    sourceBattleUnitId: input.sourceBattleUnitId ?? null,
    positions: input.positions,
    createdAt: input.createdAt,
    expiresAt,
  })
  assertValidBattlefieldRegionState(region)
  return region
}

export function freezeBattlefieldRegionCollection(
  regions: readonly BattlefieldRegionState[],
): readonly BattlefieldRegionState[] {
  const ids = new Set<string>()
  const frozen = regions.map((region) => {
    assertValidBattlefieldRegionState(region)
    if (ids.has(region.battlefieldRegionId)) {
      throw new Error(`battlefieldRegionId must be unique: ${region.battlefieldRegionId}`)
    }
    ids.add(region.battlefieldRegionId)
    return freezeRegion(region)
  })
  frozen.sort((left, right) =>
    compareIds(left.battlefieldRegionId, right.battlefieldRegionId),
  )
  return Object.freeze(frozen)
}

export function isBattlefieldRegionActive(
  region: BattlefieldRegionState,
  currentTime: BattleTime,
): boolean {
  assertValidBattlefieldRegionState(region)
  assertSafeIntegerAtLeast(currentTime, 0, 'currentTime')
  return currentTime >= region.createdAt &&
    (region.expiresAt === null || currentTime < region.expiresAt)
}

export function isPositionInBattlefieldRegion(
  region: BattlefieldRegionState,
  position: BoardPosition,
): boolean {
  assertValidBattlefieldRegionState(region)
  assertValidPosition(position, 'position')
  return region.positions.some((candidate) => isSamePosition(candidate, position))
}

export function resolveBattlefieldRegionEntries(
  input: ResolveBattlefieldRegionEntriesInput,
): readonly BattlefieldRegionEntryTrigger[] {
  assertNonEmptyId(input.battleUnitId, 'battleUnitId')
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')
  assertValidPosition(input.to, 'to')
  if (input.from !== null) {
    assertValidPosition(input.from, 'from')
  }
  if (!BATTLEFIELD_REGION_ENTRY_CAUSES.includes(input.cause)) {
    throw new Error('cause must be a supported battlefield region entry cause')
  }
  if (input.cause === 'SUMMON' && input.from !== null) {
    throw new Error('SUMMON region entry must not have a previous position')
  }
  if (input.cause !== 'SUMMON' && input.from === null) {
    throw new Error(`${input.cause} region entry requires a previous position`)
  }

  const regions = freezeBattlefieldRegionCollection(input.regions)
  const entries = regions
    .filter((region) => isBattlefieldRegionActive(region, input.currentTime))
    .filter((region) => isPositionInBattlefieldRegion(region, input.to))
    .filter(
      (region) =>
        input.from === null || !isPositionInBattlefieldRegion(region, input.from),
    )
    .map((region) =>
      Object.freeze({
        battlefieldRegionId: region.battlefieldRegionId,
        effectId: region.effectId,
        sourceBattleUnitId: region.sourceBattleUnitId,
        battleUnitId: input.battleUnitId,
        cause: input.cause,
        enteredPosition: freezePosition(input.to),
        enteredPositionId: getBoardPositionId(input.to),
        triggeredAt: input.currentTime,
      } satisfies BattlefieldRegionEntryTrigger),
    )

  return entries.length === 0 ? EMPTY_REGION_ENTRIES : Object.freeze(entries)
}

export function resolveForcedMovementWithRegions(
  input: ResolveForcedMovementWithRegionsInput,
): ForcedMovementWithRegionsResult {
  const movement = resolveForcedMovement({
    battle: input.battle,
    sourceBattleUnitId: input.sourceBattleUnitId,
    targetBattleUnitId: input.targetBattleUnitId,
    kind: input.kind,
  })
  if (!movement.success || movement.to === null) {
    return Object.freeze({ movement, regionEntries: EMPTY_REGION_ENTRIES })
  }

  const regionEntries = resolveBattlefieldRegionEntries({
    regions: input.regions,
    battleUnitId: movement.targetBattleUnitId,
    from: movement.from,
    to: movement.to,
    cause: 'FORCED_MOVEMENT',
    currentTime: input.currentTime,
  })
  return Object.freeze({ movement, regionEntries })
}
