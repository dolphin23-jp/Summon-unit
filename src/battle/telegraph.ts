import {
  assertValidSkillDefinition,
  resolveSkillTelegraphDelay,
  type SkillDefinition,
  type SkillId,
} from '../content/skill-definition'
import type { BattleTime } from './action-scheduling'
import {
  ALL_BOARD_POSITIONS,
  COLUMNS,
  LOCAL_ROWS,
  getBoardPositionId,
  type BoardPosition,
} from './board'
import type { BattleState } from './defeat-and-victory'
import {
  assertBattlefieldOccupancy,
  freezeOccupyingBoardObjectCollection,
  getBattlefieldOccupantAt,
  type BattlefieldOccupant,
  type OccupyingBoardObjectState,
} from './occupying-board-object'
import {
  pushTimelineEvent,
  type ScheduledEvent,
  type TimelineQueue,
} from './timeline-queue'
import type { BattleUnitId } from './unit-state'

export type TelegraphId = string

export const TELEGRAPH_RESOLVE_EVENT_PRIORITY = -100

export interface TelegraphResolvePayload {
  readonly telegraphId: TelegraphId
  readonly sourceBattleUnitId: BattleUnitId
  readonly skillId: SkillId
  readonly declaredAt: BattleTime
  readonly targetPositions: readonly BoardPosition[]
}

export interface CreateTelegraphResolveEventInput {
  readonly telegraphId: TelegraphId
  readonly sourceBattleUnitId: BattleUnitId
  readonly skill: SkillDefinition
  readonly targetPositions: readonly BoardPosition[]
  readonly currentTime: BattleTime
  readonly sequence: number
}

export interface ScheduleTelegraphInput extends CreateTelegraphResolveEventInput {
  readonly queue: TimelineQueue
}

export interface ScheduledTelegraphResult {
  readonly queue: TimelineQueue
  readonly event: ScheduledEvent<TelegraphResolvePayload>
}

export interface ResolveTelegraphEventInput {
  readonly event: ScheduledEvent<TelegraphResolvePayload>
  readonly battle: BattleState
  readonly objects?: readonly OccupyingBoardObjectState[]
}

export interface TelegraphImpactPosition {
  readonly position: BoardPosition
  readonly positionId: string
  readonly occupant: BattlefieldOccupant | null
}

export interface TelegraphResolution {
  readonly telegraphId: TelegraphId
  readonly sourceBattleUnitId: BattleUnitId
  readonly skillId: SkillId
  readonly declaredAt: BattleTime
  readonly resolvedAt: BattleTime
  readonly impacts: readonly TelegraphImpactPosition[]
  readonly hitBattleUnitIds: readonly BattleUnitId[]
  readonly hitBoardObjectIds: readonly string[]
  readonly emptyPositionIds: readonly string[]
}

const POSITION_ORDER = new Map(
  ALL_BOARD_POSITIONS.map((position, index) => [getBoardPositionId(position), index]),
)

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

function freezeTargetPositions(
  positions: readonly BoardPosition[],
): readonly BoardPosition[] {
  if (positions.length === 0) {
    throw new Error('targetPositions must contain at least one position')
  }
  const seen = new Set<string>()
  const frozen = positions.map((position, index) => {
    assertValidPosition(position, `targetPositions[${index}]`)
    const positionId = getBoardPositionId(position)
    if (seen.has(positionId)) {
      throw new Error(`targetPositions must not repeat ${positionId}`)
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

function freezePayload(payload: TelegraphResolvePayload): TelegraphResolvePayload {
  return Object.freeze({
    ...payload,
    targetPositions: freezeTargetPositions(payload.targetPositions),
  })
}

export function getTelegraphResolveEventId(telegraphId: TelegraphId): string {
  assertNonEmptyId(telegraphId, 'telegraphId')
  return `telegraph-resolve:${telegraphId}`
}

export function assertValidTelegraphResolveEvent(
  event: ScheduledEvent<TelegraphResolvePayload>,
): void {
  if (event.kind !== 'TELEGRAPH_RESOLVE') {
    throw new Error('telegraph event kind must be TELEGRAPH_RESOLVE')
  }
  assertSafeIntegerAtLeast(event.time, 0, 'event.time')
  if (event.priority !== TELEGRAPH_RESOLVE_EVENT_PRIORITY) {
    throw new Error('telegraph event priority is invalid')
  }
  assertSafeIntegerAtLeast(event.sequence, 0, 'event.sequence')
  assertNonEmptyId(event.payload.telegraphId, 'event.payload.telegraphId')
  assertNonEmptyId(
    event.payload.sourceBattleUnitId,
    'event.payload.sourceBattleUnitId',
  )
  assertNonEmptyId(event.payload.skillId, 'event.payload.skillId')
  assertSafeIntegerAtLeast(event.payload.declaredAt, 0, 'event.payload.declaredAt')
  if (event.time <= event.payload.declaredAt) {
    throw new Error('telegraph resolve time must be later than declaredAt')
  }
  freezeTargetPositions(event.payload.targetPositions)
  if (event.id !== getTelegraphResolveEventId(event.payload.telegraphId)) {
    throw new Error('telegraph event id must match telegraphId')
  }
}

export function createTelegraphResolveEvent(
  input: CreateTelegraphResolveEventInput,
): ScheduledEvent<TelegraphResolvePayload> {
  assertValidSkillDefinition(input.skill)
  assertNonEmptyId(input.telegraphId, 'telegraphId')
  assertNonEmptyId(input.sourceBattleUnitId, 'sourceBattleUnitId')
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')
  assertSafeIntegerAtLeast(input.sequence, 0, 'sequence')
  const delay = resolveSkillTelegraphDelay(input.skill)
  if (delay === null) {
    throw new Error('skill must define telegraphDelay to create a telegraph event')
  }
  const resolveTime = input.currentTime + delay
  if (!Number.isSafeInteger(resolveTime)) {
    throw new Error('telegraph resolve time must be a safe integer')
  }

  const event: ScheduledEvent<TelegraphResolvePayload> = Object.freeze({
    id: getTelegraphResolveEventId(input.telegraphId),
    time: resolveTime,
    priority: TELEGRAPH_RESOLVE_EVENT_PRIORITY,
    sequence: input.sequence,
    kind: 'TELEGRAPH_RESOLVE',
    payload: freezePayload({
      telegraphId: input.telegraphId,
      sourceBattleUnitId: input.sourceBattleUnitId,
      skillId: input.skill.id,
      declaredAt: input.currentTime,
      targetPositions: input.targetPositions,
    }),
  })
  assertValidTelegraphResolveEvent(event)
  return event
}

export function scheduleTelegraph(
  input: ScheduleTelegraphInput,
): ScheduledTelegraphResult {
  const event = createTelegraphResolveEvent(input)
  return Object.freeze({
    queue: pushTimelineEvent(input.queue, event),
    event,
  })
}

export function resolveTelegraphEvent(
  input: ResolveTelegraphEventInput,
): TelegraphResolution {
  assertValidTelegraphResolveEvent(input.event)
  const objects = freezeOccupyingBoardObjectCollection(input.objects ?? [])
  assertBattlefieldOccupancy(input.battle, objects)

  const impacts = input.event.payload.targetPositions.map((position) => {
    const occupant = getBattlefieldOccupantAt(input.battle, objects, position)
    return Object.freeze({
      position: freezePosition(position),
      positionId: getBoardPositionId(position),
      occupant,
    } satisfies TelegraphImpactPosition)
  })

  const hitBattleUnitIds = impacts.flatMap((impact) =>
    impact.occupant?.kind === 'UNIT' ? [impact.occupant.id] : [],
  )
  const hitBoardObjectIds = impacts.flatMap((impact) =>
    impact.occupant?.kind === 'BOARD_OBJECT' ? [impact.occupant.id] : [],
  )
  const emptyPositionIds = impacts.flatMap((impact) =>
    impact.occupant === null ? [impact.positionId] : [],
  )

  return Object.freeze({
    telegraphId: input.event.payload.telegraphId,
    sourceBattleUnitId: input.event.payload.sourceBattleUnitId,
    skillId: input.event.payload.skillId,
    declaredAt: input.event.payload.declaredAt,
    resolvedAt: input.event.time,
    impacts: Object.freeze(impacts),
    hitBattleUnitIds: Object.freeze(hitBattleUnitIds),
    hitBoardObjectIds: Object.freeze(hitBoardObjectIds),
    emptyPositionIds: Object.freeze(emptyPositionIds),
  })
}
