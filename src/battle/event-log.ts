import type { SkillId } from '../content/skill-definition'
import type { BattleTime } from './action-scheduling'
import type { BattleOutcome, BattleState, DefeatRecord } from './defeat-and-victory'
import type { BattleUnitId } from './unit-state'

export const BATTLE_EVENT_KINDS = [
  'battle_started',
  'turn_started',
  'skill_used',
  'damage_applied',
  'unit_defeated',
  'battle_ended',
] as const

export type BattleEventKind = (typeof BATTLE_EVENT_KINDS)[number]
export type FinishedBattleOutcome = Exclude<BattleOutcome, 'ONGOING'>

export interface BattleStartedPayload {
  readonly allyBattleUnitIds: readonly BattleUnitId[]
  readonly enemyBattleUnitIds: readonly BattleUnitId[]
}

export interface TurnStartedPayload {
  readonly battleUnitId: BattleUnitId
}

export interface SkillUsedPayload {
  readonly actorBattleUnitId: BattleUnitId
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId
}

export interface DamageAppliedPayload {
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId | null
  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly hpBefore: number
  readonly hpAfter: number
}

export interface UnitDefeatedPayload {
  readonly defeatedBattleUnitId: BattleUnitId
  readonly killerBattleUnitId: BattleUnitId | null
}

export interface BattleEndedPayload {
  readonly outcome: FinishedBattleOutcome
}

interface BattleEventBase<TKind extends BattleEventKind, TPayload> {
  readonly id: string
  readonly kind: TKind
  readonly sequence: number
  readonly virtualTime: BattleTime
  readonly payload: TPayload
}

export type BattleStartedEvent = BattleEventBase<'battle_started', BattleStartedPayload>
export type TurnStartedEvent = BattleEventBase<'turn_started', TurnStartedPayload>
export type SkillUsedEvent = BattleEventBase<'skill_used', SkillUsedPayload>
export type DamageAppliedEvent = BattleEventBase<'damage_applied', DamageAppliedPayload>
export type UnitDefeatedEvent = BattleEventBase<'unit_defeated', UnitDefeatedPayload>
export type BattleEndedEvent = BattleEventBase<'battle_ended', BattleEndedPayload>

export type BattleEvent =
  | BattleStartedEvent
  | TurnStartedEvent
  | SkillUsedEvent
  | DamageAppliedEvent
  | UnitDefeatedEvent
  | BattleEndedEvent

export type BattleEventInput = BattleEvent extends infer TEvent
  ? TEvent extends BattleEvent
    ? Omit<TEvent, 'id' | 'sequence'>
    : never
  : never

export interface BattleEventLog {
  readonly events: readonly BattleEvent[]
  readonly nextSequence: number
}

export interface RecordSingleTargetSkillResolutionInput {
  readonly virtualTime: BattleTime
  readonly actorBattleUnitId: BattleUnitId
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId
  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly targetHpBefore: number
  readonly targetHpAfter: number
  readonly outcome?: FinishedBattleOutcome
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

function freezeIds(ids: readonly BattleUnitId[]): readonly BattleUnitId[] {
  return Object.freeze([...ids])
}

function freezeEvent(event: BattleEvent): BattleEvent {
  if (event.kind === 'battle_started') {
    return Object.freeze({
      ...event,
      payload: Object.freeze({
        allyBattleUnitIds: freezeIds(event.payload.allyBattleUnitIds),
        enemyBattleUnitIds: freezeIds(event.payload.enemyBattleUnitIds),
      }),
    })
  }

  return Object.freeze({
    ...event,
    payload: Object.freeze({ ...event.payload }),
  }) as BattleEvent
}

function freezeLog(events: readonly BattleEvent[]): BattleEventLog {
  return Object.freeze({
    events: Object.freeze(events.map(freezeEvent)),
    nextSequence: events.length,
  })
}

export const EMPTY_BATTLE_EVENT_LOG: BattleEventLog = freezeLog([])

export function getBattleEventId(sequence: number): string {
  assertSafeIntegerAtLeast(sequence, 0, 'sequence')
  return `battle-event:${sequence}`
}

function assertUniqueUnitIds(ids: readonly BattleUnitId[], field: string): void {
  const seen = new Set<string>()
  for (const id of ids) {
    assertNonEmptyId(id, `${field}[]`)
    if (seen.has(id)) {
      throw new Error(`${field} must not contain duplicate battle unit ids: ${id}`)
    }
    seen.add(id)
  }
}

export function assertValidBattleEvent(event: BattleEvent): void {
  assertSafeIntegerAtLeast(event.sequence, 0, 'event.sequence')
  assertSafeIntegerAtLeast(event.virtualTime, 0, 'event.virtualTime')

  if (event.id !== getBattleEventId(event.sequence)) {
    throw new Error('event.id must match event.sequence')
  }

  if (!BATTLE_EVENT_KINDS.includes(event.kind)) {
    throw new Error('event.kind is invalid')
  }

  switch (event.kind) {
    case 'battle_started': {
      const { allyBattleUnitIds, enemyBattleUnitIds } = event.payload
      if (allyBattleUnitIds.length < 1 || allyBattleUnitIds.length > 9) {
        throw new Error('battle_started must contain between 1 and 9 ally units')
      }
      if (enemyBattleUnitIds.length < 1 || enemyBattleUnitIds.length > 9) {
        throw new Error('battle_started must contain between 1 and 9 enemy units')
      }
      assertUniqueUnitIds(allyBattleUnitIds, 'allyBattleUnitIds')
      assertUniqueUnitIds(enemyBattleUnitIds, 'enemyBattleUnitIds')
      const allIds = new Set(allyBattleUnitIds)
      for (const id of enemyBattleUnitIds) {
        if (allIds.has(id)) {
          throw new Error(`battle_started unit ids must be unique across sides: ${id}`)
        }
      }
      return
    }
    case 'turn_started':
      assertNonEmptyId(event.payload.battleUnitId, 'battleUnitId')
      return
    case 'skill_used':
      assertNonEmptyId(event.payload.actorBattleUnitId, 'actorBattleUnitId')
      assertNonEmptyId(event.payload.targetBattleUnitId, 'targetBattleUnitId')
      assertNonEmptyId(event.payload.skillId, 'skillId')
      if (event.payload.actorBattleUnitId === event.payload.targetBattleUnitId) {
        throw new Error('skill actor and target must differ')
      }
      return
    case 'damage_applied': {
      const payload = event.payload
      if (payload.sourceBattleUnitId !== null) {
        assertNonEmptyId(payload.sourceBattleUnitId, 'sourceBattleUnitId')
      }
      if (payload.skillId !== null) {
        assertNonEmptyId(payload.skillId, 'skillId')
      }
      assertNonEmptyId(payload.targetBattleUnitId, 'targetBattleUnitId')
      assertSafeIntegerAtLeast(payload.calculatedDamage, 1, 'calculatedDamage')
      assertSafeIntegerAtLeast(payload.appliedDamage, 1, 'appliedDamage')
      assertSafeIntegerAtLeast(payload.hpBefore, 1, 'hpBefore')
      assertSafeIntegerAtLeast(payload.hpAfter, 0, 'hpAfter')
      if (payload.appliedDamage > payload.calculatedDamage) {
        throw new Error('appliedDamage must not exceed calculatedDamage')
      }
      if (payload.hpBefore - payload.hpAfter !== payload.appliedDamage) {
        throw new Error('hpBefore - hpAfter must equal appliedDamage')
      }
      return
    }
    case 'unit_defeated':
      assertNonEmptyId(event.payload.defeatedBattleUnitId, 'defeatedBattleUnitId')
      if (event.payload.killerBattleUnitId !== null) {
        assertNonEmptyId(event.payload.killerBattleUnitId, 'killerBattleUnitId')
        if (event.payload.killerBattleUnitId === event.payload.defeatedBattleUnitId) {
          throw new Error('killerBattleUnitId must differ from defeatedBattleUnitId')
        }
      }
      return
    case 'battle_ended':
      if (event.payload.outcome !== 'ALLY_VICTORY' && event.payload.outcome !== 'ALLY_DEFEAT') {
        throw new Error('battle_ended outcome must be a finished battle outcome')
      }
  }
}

export function assertValidBattleEventLog(log: BattleEventLog): void {
  if (log.nextSequence !== log.events.length) {
    throw new Error('log.nextSequence must equal log.events.length')
  }

  let previousTime = 0
  for (const [index, event] of log.events.entries()) {
    assertValidBattleEvent(event)
    if (event.sequence !== index) {
      throw new Error('battle event sequences must be continuous from 0')
    }
    if (index > 0 && event.virtualTime < previousTime) {
      throw new Error('battle event virtualTime must not move backwards')
    }
    previousTime = event.virtualTime
  }
}

export function createBattleEventLog(initialEvents: readonly BattleEvent[] = []): BattleEventLog {
  const log = freezeLog(initialEvents)
  assertValidBattleEventLog(log)
  return log
}

export function appendBattleEvent(
  log: BattleEventLog,
  input: BattleEventInput,
): BattleEventLog {
  assertValidBattleEventLog(log)

  const previousEvent = log.events.at(-1)
  if (previousEvent !== undefined && input.virtualTime < previousEvent.virtualTime) {
    throw new Error('battle event virtualTime must not move backwards')
  }

  const sequence = log.nextSequence
  const event = freezeEvent({
    ...input,
    id: getBattleEventId(sequence),
    sequence,
  } as BattleEvent)
  assertValidBattleEvent(event)

  return freezeLog([...log.events, event])
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

export function recordBattleStarted(
  log: BattleEventLog,
  battle: BattleState,
  virtualTime: BattleTime = 0,
): BattleEventLog {
  if (log.events.length !== 0) {
    throw new Error('battle_started must be the first event')
  }
  if (battle.outcome !== 'ONGOING') {
    throw new Error('battle_started requires an ongoing battle')
  }

  const allyBattleUnitIds = battle.units
    .filter((unit) => unit.side === 'ALLY')
    .map((unit) => unit.battleUnitId)
    .sort(compareIds)
  const enemyBattleUnitIds = battle.units
    .filter((unit) => unit.side === 'ENEMY')
    .map((unit) => unit.battleUnitId)
    .sort(compareIds)

  return appendBattleEvent(log, {
    kind: 'battle_started',
    virtualTime,
    payload: { allyBattleUnitIds, enemyBattleUnitIds },
  })
}

export function recordTurnStarted(
  log: BattleEventLog,
  battleUnitId: BattleUnitId,
  virtualTime: BattleTime,
): BattleEventLog {
  return appendBattleEvent(log, {
    kind: 'turn_started',
    virtualTime,
    payload: { battleUnitId },
  })
}

export function recordUnitDefeated(
  log: BattleEventLog,
  record: DefeatRecord,
): BattleEventLog {
  return appendBattleEvent(log, {
    kind: 'unit_defeated',
    virtualTime: record.defeatedAt,
    payload: {
      defeatedBattleUnitId: record.defeatedBattleUnitId,
      killerBattleUnitId: record.killerBattleUnitId,
    },
  })
}

export function recordBattleEnded(
  log: BattleEventLog,
  outcome: FinishedBattleOutcome,
  virtualTime: BattleTime,
): BattleEventLog {
  return appendBattleEvent(log, {
    kind: 'battle_ended',
    virtualTime,
    payload: { outcome },
  })
}

export function recordSingleTargetSkillResolution(
  log: BattleEventLog,
  input: RecordSingleTargetSkillResolutionInput,
): BattleEventLog {
  assertNonEmptyId(input.actorBattleUnitId, 'actorBattleUnitId')
  assertNonEmptyId(input.targetBattleUnitId, 'targetBattleUnitId')
  assertNonEmptyId(input.skillId, 'skillId')
  assertSafeIntegerAtLeast(input.virtualTime, 0, 'virtualTime')
  assertSafeIntegerAtLeast(input.calculatedDamage, 1, 'calculatedDamage')
  assertSafeIntegerAtLeast(input.appliedDamage, 1, 'appliedDamage')
  assertSafeIntegerAtLeast(input.targetHpBefore, 1, 'targetHpBefore')
  assertSafeIntegerAtLeast(input.targetHpAfter, 0, 'targetHpAfter')

  if (input.actorBattleUnitId === input.targetBattleUnitId) {
    throw new Error('skill actor and target must differ')
  }
  if (input.appliedDamage > input.calculatedDamage) {
    throw new Error('appliedDamage must not exceed calculatedDamage')
  }
  if (input.targetHpBefore - input.targetHpAfter !== input.appliedDamage) {
    throw new Error('targetHpBefore - targetHpAfter must equal appliedDamage')
  }
  if (input.outcome !== undefined && input.targetHpAfter !== 0) {
    throw new Error('battle outcome can only be recorded after a defeating hit')
  }

  let nextLog = appendBattleEvent(log, {
    kind: 'skill_used',
    virtualTime: input.virtualTime,
    payload: {
      actorBattleUnitId: input.actorBattleUnitId,
      targetBattleUnitId: input.targetBattleUnitId,
      skillId: input.skillId,
    },
  })

  nextLog = appendBattleEvent(nextLog, {
    kind: 'damage_applied',
    virtualTime: input.virtualTime,
    payload: {
      sourceBattleUnitId: input.actorBattleUnitId,
      targetBattleUnitId: input.targetBattleUnitId,
      skillId: input.skillId,
      calculatedDamage: input.calculatedDamage,
      appliedDamage: input.appliedDamage,
      hpBefore: input.targetHpBefore,
      hpAfter: input.targetHpAfter,
    },
  })

  if (input.targetHpAfter === 0) {
    nextLog = appendBattleEvent(nextLog, {
      kind: 'unit_defeated',
      virtualTime: input.virtualTime,
      payload: {
        defeatedBattleUnitId: input.targetBattleUnitId,
        killerBattleUnitId: input.actorBattleUnitId,
      },
    })
  }

  if (input.outcome !== undefined) {
    nextLog = recordBattleEnded(nextLog, input.outcome, input.virtualTime)
  }

  return nextLog
}
