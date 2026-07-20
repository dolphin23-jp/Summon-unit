import type { SkillId } from '../content/skill-definition'
import { areAdjacent, getBoardPositionId, type BoardPosition } from './board'
import type { BattleTime } from './action-scheduling'
import type { BattleOutcome, BattleState, DefeatRecord } from './defeat-and-victory'
import {
  EFFECT_DURATION_UNITS,
  type ActiveEffectMutation,
  type ActiveEffectState,
  type EffectDurationUnit,
  type EffectRemovalReason,
} from './effect-framework'
import type { BarrierLayerConsumption } from './barrier'
import type { GuardShareState } from './guard-share'
import type { BattleUnitId } from './unit-state'

export const BATTLE_EVENT_KINDS = [
  'battle_started',
  'turn_started',
  'unit_moved',
  'skill_used',
  'guard_shared',
  'barrier_absorbed',
  'damage_applied',
  'healing_applied',
  'effect_applied',
  'effect_merged',
  'effect_removed',
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

export interface UnitMovedPayload {
  readonly battleUnitId: BattleUnitId
  readonly fromPositionId: string
  readonly toPositionId: string
}

export interface SkillUsedPayload {
  readonly actorBattleUnitId: BattleUnitId
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId
}

export interface GuardSharedPayload {
  readonly sourceBattleUnitId: BattleUnitId
  readonly protectedBattleUnitId: BattleUnitId
  readonly guardBattleUnitId: BattleUnitId
  readonly skillId: SkillId | null
  readonly finalDamage: number
  readonly retainedDamage: number
  readonly redirectedDamage: number
  readonly sharePermille: number
}

export interface BarrierAbsorbedPayload {
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId | null
  readonly barrierLayerId: string
  readonly barrierSourceBattleUnitId: BattleUnitId | null
  readonly absorbedDamage: number
  readonly remainingCapacityBefore: number
  readonly remainingCapacityAfter: number
  readonly broken: boolean
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

export interface HealingAppliedPayload {
  readonly sourceBattleUnitId: BattleUnitId
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId
  readonly baseHealing: number
  readonly modifiedHealing: number
  readonly appliedHealing: number
  readonly overheal: number
  readonly hpBefore: number
  readonly hpAfter: number
}

export interface EffectAppliedPayload {
  readonly activeEffectId: string
  readonly effectId: string
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly strength: number
  readonly stacks: number
  readonly stackLimit: number
  readonly durationUnit: EffectDurationUnit
  readonly durationRemaining: number | null
}

export interface EffectMergedPayload extends EffectAppliedPayload {
  readonly previousSourceBattleUnitId: BattleUnitId | null
  readonly previousStrength: number
  readonly previousStacks: number
  readonly previousDurationRemaining: number | null
}

export interface EffectRemovedPayload extends EffectAppliedPayload {
  readonly reason: EffectRemovalReason
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
export type UnitMovedEvent = BattleEventBase<'unit_moved', UnitMovedPayload>
export type SkillUsedEvent = BattleEventBase<'skill_used', SkillUsedPayload>
export type GuardSharedEvent = BattleEventBase<'guard_shared', GuardSharedPayload>
export type BarrierAbsorbedEvent = BattleEventBase<'barrier_absorbed', BarrierAbsorbedPayload>
export type DamageAppliedEvent = BattleEventBase<'damage_applied', DamageAppliedPayload>
export type HealingAppliedEvent = BattleEventBase<'healing_applied', HealingAppliedPayload>
export type EffectAppliedEvent = BattleEventBase<'effect_applied', EffectAppliedPayload>
export type EffectMergedEvent = BattleEventBase<'effect_merged', EffectMergedPayload>
export type EffectRemovedEvent = BattleEventBase<'effect_removed', EffectRemovedPayload>
export type UnitDefeatedEvent = BattleEventBase<'unit_defeated', UnitDefeatedPayload>
export type BattleEndedEvent = BattleEventBase<'battle_ended', BattleEndedPayload>

export type BattleEvent =
  | BattleStartedEvent
  | TurnStartedEvent
  | UnitMovedEvent
  | SkillUsedEvent
  | GuardSharedEvent
  | BarrierAbsorbedEvent
  | DamageAppliedEvent
  | HealingAppliedEvent
  | EffectAppliedEvent
  | EffectMergedEvent
  | EffectRemovedEvent
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

export interface RecordUnitMovedInput {
  readonly virtualTime: BattleTime
  readonly battleUnitId: BattleUnitId
  readonly from: BoardPosition
  readonly to: BoardPosition
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

export interface RecordGuardSharedInput {
  readonly virtualTime: BattleTime
  readonly sourceBattleUnitId: BattleUnitId
  readonly skillId: SkillId | null
  readonly guardShare: GuardShareState
  readonly finalDamage: number
  readonly retainedDamage: number
  readonly redirectedDamage: number
}

export interface RecordBarrierConsumptionInput {
  readonly virtualTime: BattleTime
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId | null
  readonly consumption: BarrierLayerConsumption
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

function parseBoardPositionId(positionId: string, field: string): BoardPosition {
  const match = /^(ALLY|ENEMY):([0-2]):([0-2])$/.exec(positionId)
  if (match === null) {
    throw new Error(`${field} must be a valid board position id`)
  }
  return {
    side: match[1] as BoardPosition['side'],
    row: Number(match[2]) as BoardPosition['row'],
    column: Number(match[3]) as BoardPosition['column'],
  }
}

function assertValidEffectDurationFields(
  unit: EffectDurationUnit,
  remaining: number | null,
  field: string,
): void {
  if (!EFFECT_DURATION_UNITS.includes(unit)) {
    throw new Error(`${field}.unit is invalid`)
  }
  if (unit === 'BATTLE') {
    if (remaining !== null) {
      throw new Error(`${field}.remaining must be null for BATTLE`)
    }
    return
  }
  if (remaining === null) {
    throw new Error(`${field}.remaining must be present for counted duration`)
  }
  assertSafeIntegerAtLeast(remaining, 1, `${field}.remaining`)
}

function assertValidEffectSnapshot(payload: EffectAppliedPayload, field = 'effect'): void {
  assertNonEmptyId(payload.activeEffectId, `${field}.activeEffectId`)
  assertNonEmptyId(payload.effectId, `${field}.effectId`)
  if (payload.sourceBattleUnitId !== null) {
    assertNonEmptyId(payload.sourceBattleUnitId, `${field}.sourceBattleUnitId`)
  }
  assertNonEmptyId(payload.targetBattleUnitId, `${field}.targetBattleUnitId`)
  assertSafeIntegerAtLeast(payload.strength, 0, `${field}.strength`)
  assertSafeIntegerAtLeast(payload.stacks, 1, `${field}.stacks`)
  assertSafeIntegerAtLeast(payload.stackLimit, 1, `${field}.stackLimit`)
  if (payload.stacks > payload.stackLimit) {
    throw new Error(`${field}.stacks must not exceed ${field}.stackLimit`)
  }
  assertValidEffectDurationFields(
    payload.durationUnit,
    payload.durationRemaining,
    `${field}.duration`,
  )
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
    case 'unit_moved': {
      assertNonEmptyId(event.payload.battleUnitId, 'battleUnitId')
      const from = parseBoardPositionId(event.payload.fromPositionId, 'fromPositionId')
      const to = parseBoardPositionId(event.payload.toPositionId, 'toPositionId')
      if (!areAdjacent(from, to)) {
        throw new Error('unit_moved positions must be adjacent on the same side')
      }
      return
    }
    case 'skill_used':
      assertNonEmptyId(event.payload.actorBattleUnitId, 'actorBattleUnitId')
      assertNonEmptyId(event.payload.targetBattleUnitId, 'targetBattleUnitId')
      assertNonEmptyId(event.payload.skillId, 'skillId')
      if (event.payload.actorBattleUnitId === event.payload.targetBattleUnitId) {
        throw new Error('skill actor and target must differ')
      }
      return
    case 'guard_shared': {
      const payload = event.payload
      assertNonEmptyId(payload.sourceBattleUnitId, 'sourceBattleUnitId')
      assertNonEmptyId(payload.protectedBattleUnitId, 'protectedBattleUnitId')
      assertNonEmptyId(payload.guardBattleUnitId, 'guardBattleUnitId')
      if (payload.skillId !== null) {
        assertNonEmptyId(payload.skillId, 'skillId')
      }
      assertSafeIntegerAtLeast(payload.finalDamage, 1, 'finalDamage')
      assertSafeIntegerAtLeast(payload.retainedDamage, 0, 'retainedDamage')
      assertSafeIntegerAtLeast(payload.redirectedDamage, 0, 'redirectedDamage')
      assertSafeIntegerAtLeast(payload.sharePermille, 1, 'sharePermille')
      if (payload.sharePermille > 1000) {
        throw new Error('sharePermille must not exceed 1000')
      }
      if (payload.retainedDamage + payload.redirectedDamage !== payload.finalDamage) {
        throw new Error('guard-share damage parts must equal finalDamage')
      }
      return
    }
    case 'barrier_absorbed': {
      const payload = event.payload
      if (payload.sourceBattleUnitId !== null) {
        assertNonEmptyId(payload.sourceBattleUnitId, 'sourceBattleUnitId')
      }
      if (payload.skillId !== null) {
        assertNonEmptyId(payload.skillId, 'skillId')
      }
      if (payload.barrierSourceBattleUnitId !== null) {
        assertNonEmptyId(payload.barrierSourceBattleUnitId, 'barrierSourceBattleUnitId')
      }
      assertNonEmptyId(payload.targetBattleUnitId, 'targetBattleUnitId')
      assertNonEmptyId(payload.barrierLayerId, 'barrierLayerId')
      assertSafeIntegerAtLeast(payload.absorbedDamage, 1, 'absorbedDamage')
      assertSafeIntegerAtLeast(payload.remainingCapacityBefore, 1, 'remainingCapacityBefore')
      assertSafeIntegerAtLeast(payload.remainingCapacityAfter, 0, 'remainingCapacityAfter')
      if (
        payload.remainingCapacityBefore - payload.remainingCapacityAfter !==
        payload.absorbedDamage
      ) {
        throw new Error('barrier capacity delta must equal absorbedDamage')
      }
      if (payload.broken !== (payload.remainingCapacityAfter === 0)) {
        throw new Error('barrier broken must match zero remaining capacity')
      }
      return
    }
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
    case 'healing_applied': {
      const payload = event.payload
      assertNonEmptyId(payload.sourceBattleUnitId, 'sourceBattleUnitId')
      assertNonEmptyId(payload.targetBattleUnitId, 'targetBattleUnitId')
      assertNonEmptyId(payload.skillId, 'skillId')
      assertSafeIntegerAtLeast(payload.baseHealing, 1, 'baseHealing')
      assertSafeIntegerAtLeast(payload.modifiedHealing, 0, 'modifiedHealing')
      assertSafeIntegerAtLeast(payload.appliedHealing, 0, 'appliedHealing')
      assertSafeIntegerAtLeast(payload.overheal, 0, 'overheal')
      assertSafeIntegerAtLeast(payload.hpBefore, 1, 'hpBefore')
      assertSafeIntegerAtLeast(payload.hpAfter, 1, 'hpAfter')
      if (payload.appliedHealing + payload.overheal !== payload.modifiedHealing) {
        throw new Error('appliedHealing + overheal must equal modifiedHealing')
      }
      if (payload.hpAfter - payload.hpBefore !== payload.appliedHealing) {
        throw new Error('hpAfter - hpBefore must equal appliedHealing')
      }
      return
    }
    case 'effect_applied':
      assertValidEffectSnapshot(event.payload)
      return
    case 'effect_merged':
      assertValidEffectSnapshot(event.payload)
      if (event.payload.previousSourceBattleUnitId !== null) {
        assertNonEmptyId(
          event.payload.previousSourceBattleUnitId,
          'effect.previousSourceBattleUnitId',
        )
      }
      assertSafeIntegerAtLeast(event.payload.previousStrength, 0, 'effect.previousStrength')
      assertSafeIntegerAtLeast(event.payload.previousStacks, 1, 'effect.previousStacks')
      if (event.payload.previousStacks > event.payload.stackLimit) {
        throw new Error('effect.previousStacks must not exceed effect.stackLimit')
      }
      assertValidEffectDurationFields(
        event.payload.durationUnit,
        event.payload.previousDurationRemaining,
        'effect.previousDuration',
      )
      return
    case 'effect_removed':
      assertValidEffectSnapshot(event.payload)
      if (
        !['EXPIRED', 'DISPELLED', 'REPLACED', 'BATTLE_ENDED', 'SCRIPT'].includes(
          event.payload.reason,
        )
      ) {
        throw new Error('effect removal reason is invalid')
      }
      return
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

export function recordUnitMoved(
  log: BattleEventLog,
  input: RecordUnitMovedInput,
): BattleEventLog {
  assertNonEmptyId(input.battleUnitId, 'battleUnitId')
  assertSafeIntegerAtLeast(input.virtualTime, 0, 'virtualTime')
  return appendBattleEvent(log, {
    kind: 'unit_moved',
    virtualTime: input.virtualTime,
    payload: {
      battleUnitId: input.battleUnitId,
      fromPositionId: getBoardPositionId(input.from),
      toPositionId: getBoardPositionId(input.to),
    },
  })
}

export function recordGuardShared(
  log: BattleEventLog,
  input: RecordGuardSharedInput,
): BattleEventLog {
  return appendBattleEvent(log, {
    kind: 'guard_shared',
    virtualTime: input.virtualTime,
    payload: {
      sourceBattleUnitId: input.sourceBattleUnitId,
      protectedBattleUnitId: input.guardShare.protectedBattleUnitId,
      guardBattleUnitId: input.guardShare.guardBattleUnitId,
      skillId: input.skillId,
      finalDamage: input.finalDamage,
      retainedDamage: input.retainedDamage,
      redirectedDamage: input.redirectedDamage,
      sharePermille: input.guardShare.sharePermille,
    },
  })
}

export function recordBarrierConsumption(
  log: BattleEventLog,
  input: RecordBarrierConsumptionInput,
): BattleEventLog {
  return appendBattleEvent(log, {
    kind: 'barrier_absorbed',
    virtualTime: input.virtualTime,
    payload: {
      sourceBattleUnitId: input.sourceBattleUnitId,
      targetBattleUnitId: input.targetBattleUnitId,
      skillId: input.skillId,
      barrierLayerId: input.consumption.before.barrierLayerId,
      barrierSourceBattleUnitId: input.consumption.before.sourceBattleUnitId,
      absorbedDamage: input.consumption.absorbedDamage,
      remainingCapacityBefore: input.consumption.before.remainingCapacity,
      remainingCapacityAfter: input.consumption.after?.remainingCapacity ?? 0,
      broken: input.consumption.broken,
    },
  })
}

function getEffectSnapshot(effect: ActiveEffectState): EffectAppliedPayload {
  return {
    activeEffectId: effect.activeEffectId,
    effectId: effect.effectId,
    sourceBattleUnitId: effect.sourceBattleUnitId,
    targetBattleUnitId: effect.targetBattleUnitId,
    strength: effect.strength,
    stacks: effect.stacks,
    stackLimit: effect.stackLimit,
    durationUnit: effect.duration.unit,
    durationRemaining: effect.duration.remaining,
  }
}

export function recordActiveEffectMutation(
  log: BattleEventLog,
  mutation: ActiveEffectMutation,
  virtualTime: BattleTime,
): BattleEventLog {
  assertSafeIntegerAtLeast(virtualTime, 0, 'virtualTime')
  switch (mutation.kind) {
    case 'APPLIED':
      return appendBattleEvent(log, {
        kind: 'effect_applied',
        virtualTime,
        payload: getEffectSnapshot(mutation.after),
      })
    case 'MERGED':
      return appendBattleEvent(log, {
        kind: 'effect_merged',
        virtualTime,
        payload: {
          ...getEffectSnapshot(mutation.after),
          previousSourceBattleUnitId: mutation.before.sourceBattleUnitId,
          previousStrength: mutation.before.strength,
          previousStacks: mutation.before.stacks,
          previousDurationRemaining: mutation.before.duration.remaining,
        },
      })
    case 'REMOVED':
      return appendBattleEvent(log, {
        kind: 'effect_removed',
        virtualTime,
        payload: {
          ...getEffectSnapshot(mutation.before),
          reason: mutation.reason,
        },
      })
  }
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
