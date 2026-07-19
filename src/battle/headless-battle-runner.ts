import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  createInitialUnitActionSchedule,
  createOrderedUnitTurnEvents,
  createUnitTurnEvent,
  registerUnitTurnEvent,
  type BattleTime,
  type UnitActionSchedule,
  type UnitTurnEventPayload,
} from './action-scheduling'
import { getTotalBarrierCapacity, type BarrierLayerState } from './barrier'
import { resolveBarrierGuardDamage, type DamageRecipientResolution } from './barrier-guard-resolution'
import { getBoardPositionId, type BoardPosition } from './board'
import {
  assertValidBattleState,
  createBattleState,
  resolveBattleUnitDefeat,
  type BattleOutcome,
  type BattleState,
} from './defeat-and-victory'
import { getDirectEffectiveTarget } from './direct-targeting'
import type {
  ActiveEffectMutation,
  ActiveEffectState,
} from './effect-framework'
import {
  EMPTY_BATTLE_EVENT_LOG,
  appendBattleEvent,
  recordActiveEffectMutation,
  recordBarrierConsumption,
  recordBattleEnded,
  recordBattleStarted,
  recordGuardShared,
  recordTurnStarted,
  recordUnitDefeated,
  recordUnitMoved,
  type BattleEventLog,
} from './event-log'
import {
  freezeGuardShareCollection,
  getGuardShareForProtectedUnit,
  type GuardShareState,
} from './guard-share'
import {
  selectMinimalAutoAiAction,
  type MinimalAutoAiDecision,
} from './minimal-auto-ai'
import { performNormalMovement } from './normal-movement'
import { scheduleSingleTargetInnateSkill } from './single-target-damage'
import {
  canUseSkillWithUsageState,
  completeActorActionSkillUsage,
  createSkillUsageBook,
  type SkillUsageBook,
} from './skill-usage'
import {
  consumeTargetActionDurations,
  resolveTurnStartStatusConditions,
  type EffectDurationChange,
  type StatusDamageTrigger,
} from './status-conditions'
import {
  createTimelineQueue,
  popTimelineEvent,
  type TimelineQueue,
} from './timeline-queue'
import {
  createBattleUnitState,
  type BattleUnitId,
  type BattleUnitState,
} from './unit-state'
import {
  EMPTY_WAIT_ACTION_STATE,
  performWaitAction,
  resetWaitActionState,
  type WaitActionState,
} from './wait-action'

export const HEADLESS_INITIAL_ACTION_COST = 100
export const HEADLESS_WAIT_ACTION_COST = 50
export const DEFAULT_HEADLESS_MAX_ACTIONS = 500

export interface HeadlessBattleUnitDefinition {
  readonly battleUnitId: BattleUnitId
  readonly speciesId: string
  readonly position: BoardPosition
  readonly initialHp?: number
  readonly initialBarriers?: readonly BarrierLayerState[]
  readonly initialEffects?: readonly ActiveEffectState[]
  readonly tiePriority: number
}

export interface HeadlessBattleDefinition {
  readonly species: readonly MonsterSpecies[]
  readonly skills: readonly SkillDefinition[]
  readonly units: readonly HeadlessBattleUnitDefinition[]
  readonly guardShares?: readonly GuardShareState[]
  readonly initialActionCost?: number
  readonly maxActions?: number
}

export type HeadlessBattleTermination = 'BATTLE_ENDED' | 'ACTION_LIMIT_REACHED'

export interface HeadlessBattleUnitSummary {
  readonly battleUnitId: BattleUnitId
  readonly speciesId: string
  readonly side: BattleUnitState['side']
  readonly hp: number
  readonly barrierTotal: number
  readonly defeated: boolean
  readonly positionId: string
  readonly actionCount: number
}

export interface HeadlessBattleSummary {
  readonly termination: HeadlessBattleTermination
  readonly outcome: BattleOutcome
  readonly finalVirtualTime: BattleTime
  readonly totalActions: number
  readonly eventCount: number
  readonly units: readonly HeadlessBattleUnitSummary[]
}

export interface HeadlessBattleRunResult {
  readonly summary: HeadlessBattleSummary
  readonly battle: BattleState
  readonly log: BattleEventLog
}

interface HeadlessBattleContext {
  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly skillById: Readonly<Record<string, SkillDefinition>>
  readonly schedules: Map<BattleUnitId, UnitActionSchedule>
  readonly waitStates: Map<BattleUnitId, WaitActionState>
  readonly skillUsageBooks: Map<BattleUnitId, SkillUsageBook>
  readonly guardShares: readonly GuardShareState[]
}

interface ExecutedHeadlessAction {
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly schedule: UnitActionSchedule
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function createUniqueMap<T extends { readonly id: string }>(
  values: readonly T[],
  field: string,
): Readonly<Record<string, T>> {
  const result: Record<string, T> = {}
  for (const value of values) {
    if (value.id.trim().length === 0) {
      throw new Error(`${field} id must be a non-empty string`)
    }
    if (result[value.id] !== undefined) {
      throw new Error(`${field} ids must be unique: ${value.id}`)
    }
    result[value.id] = value
  }
  return Object.freeze(result)
}

function getRequiredSpecies(
  speciesById: Readonly<Record<string, MonsterSpecies>>,
  speciesId: string,
): MonsterSpecies {
  const species = speciesById[speciesId]
  if (species === undefined) {
    throw new Error(`species master is missing: ${speciesId}`)
  }
  return species
}

function getRequiredSkill(
  skillById: Readonly<Record<string, SkillDefinition>>,
  skillId: string,
): SkillDefinition {
  const skill = skillById[skillId]
  if (skill === undefined) {
    throw new Error(`skill master is missing: ${skillId}`)
  }
  return skill
}

function getRequiredUnit(battle: BattleState, battleUnitId: BattleUnitId): BattleUnitState {
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`battle unit is missing: ${battleUnitId}`)
  }
  return unit
}

function getRequiredSchedule(
  context: HeadlessBattleContext,
  battleUnitId: BattleUnitId,
): UnitActionSchedule {
  const schedule = context.schedules.get(battleUnitId)
  if (schedule === undefined) {
    throw new Error(`schedule is missing: ${battleUnitId}`)
  }
  return schedule
}

function getRequiredWaitState(
  context: HeadlessBattleContext,
  battleUnitId: BattleUnitId,
): WaitActionState {
  const state = context.waitStates.get(battleUnitId)
  if (state === undefined) {
    throw new Error(`wait action state is missing: ${battleUnitId}`)
  }
  return state
}

function getRequiredSkillUsageBook(
  context: HeadlessBattleContext,
  battleUnitId: BattleUnitId,
): SkillUsageBook {
  const book = context.skillUsageBooks.get(battleUnitId)
  if (book === undefined) {
    throw new Error(`skill usage book is missing: ${battleUnitId}`)
  }
  return book
}

function withTimeline(battle: BattleState, timeline: TimelineQueue): BattleState {
  const nextBattle: BattleState = Object.freeze({ ...battle, timeline })
  assertValidBattleState(nextBattle)
  return nextBattle
}

function replaceLivingUnit(battle: BattleState, updatedUnit: BattleUnitState): BattleState {
  if (updatedUnit.defeated) {
    throw new Error('replaceLivingUnit requires a living unit')
  }
  const existing = getRequiredUnit(battle, updatedUnit.battleUnitId)
  if (existing.defeated) {
    throw new Error('cannot replace an already defeated battle unit')
  }
  const nextBattle: BattleState = Object.freeze({
    ...battle,
    units: Object.freeze(
      battle.units.map((unit) =>
        unit.battleUnitId === updatedUnit.battleUnitId ? updatedUnit : unit,
      ),
    ),
  })
  assertValidBattleState(nextBattle)
  return nextBattle
}

function registerNextTurn(
  battle: BattleState,
  schedule: UnitActionSchedule,
  timelineSequence: number,
): BattleState {
  const event = createUnitTurnEvent(schedule, timelineSequence)
  return withTimeline(battle, registerUnitTurnEvent(battle.timeline, event))
}

function validateGuardShares(
  guardShares: readonly GuardShareState[],
  units: readonly BattleUnitState[],
): readonly GuardShareState[] {
  const frozen = freezeGuardShareCollection(guardShares)
  for (const guardShare of frozen) {
    const protectedUnit = units.find(
      (unit) => unit.battleUnitId === guardShare.protectedBattleUnitId,
    )
    const guardUnit = units.find(
      (unit) => unit.battleUnitId === guardShare.guardBattleUnitId,
    )
    if (protectedUnit === undefined || guardUnit === undefined) {
      throw new Error('guard share units must belong to the battle')
    }
    if (protectedUnit.side !== guardUnit.side) {
      throw new Error('guard share requires units on the same side')
    }
  }
  return frozen
}

function createInitialBattle(definition: HeadlessBattleDefinition): {
  readonly battle: BattleState
  readonly context: HeadlessBattleContext
  readonly nextTimelineSequence: number
} {
  if (definition.units.length < 2) {
    throw new Error('headless battle requires at least two units')
  }

  const speciesById = createUniqueMap(definition.species, 'species')
  const skillById = createUniqueMap(definition.skills, 'skill')
  const unitIds = new Set<string>()
  const units = definition.units.map((unitDefinition) => {
    if (unitIds.has(unitDefinition.battleUnitId)) {
      throw new Error(`battleUnitId must be unique: ${unitDefinition.battleUnitId}`)
    }
    unitIds.add(unitDefinition.battleUnitId)
    const species = getRequiredSpecies(speciesById, unitDefinition.speciesId)
    getRequiredSkill(skillById, species.innateSkillId)
    return createBattleUnitState(species, {
      battleUnitId: unitDefinition.battleUnitId,
      position: unitDefinition.position,
      initialHp: unitDefinition.initialHp,
      initialBarriers: unitDefinition.initialBarriers,
      initialEffects: unitDefinition.initialEffects,
    })
  })

  const initialActionCost = definition.initialActionCost ?? HEADLESS_INITIAL_ACTION_COST
  assertSafeIntegerAtLeast(initialActionCost, 1, 'initialActionCost')
  const schedules = new Map<BattleUnitId, UnitActionSchedule>()
  const waitStates = new Map<BattleUnitId, WaitActionState>()
  const skillUsageBooks = new Map<BattleUnitId, SkillUsageBook>()
  definition.units.forEach((unitDefinition, index) => {
    assertSafeIntegerAtLeast(unitDefinition.tiePriority, 0, 'tiePriority')
    const unit = units[index]
    const species = getRequiredSpecies(speciesById, unit.speciesId)
    const innateSkill = getRequiredSkill(skillById, species.innateSkillId)
    schedules.set(
      unit.battleUnitId,
      createInitialUnitActionSchedule(
        unit,
        species,
        initialActionCost,
        unitDefinition.tiePriority,
      ),
    )
    waitStates.set(unit.battleUnitId, EMPTY_WAIT_ACTION_STATE)
    skillUsageBooks.set(unit.battleUnitId, createSkillUsageBook([innateSkill]))
  })

  const initialEvents = createOrderedUnitTurnEvents([...schedules.values()])
  const battle = createBattleState({
    units,
    timeline: createTimelineQueue(initialEvents),
  })
  return Object.freeze({
    battle,
    context: Object.freeze({
      speciesById,
      skillById,
      schedules,
      waitStates,
      skillUsageBooks,
      guardShares: validateGuardShares(definition.guardShares ?? [], units),
    }),
    nextTimelineSequence: initialEvents.length,
  })
}

function getLivingGuard(
  battle: BattleState,
  target: BattleUnitState,
  context: HeadlessBattleContext,
): {
  readonly unit: BattleUnitState
  readonly species: MonsterSpecies
  readonly guardShare: GuardShareState
} | null {
  const guardShare = getGuardShareForProtectedUnit(
    context.guardShares,
    target.battleUnitId,
  )
  if (guardShare === null) {
    return null
  }
  const guard = getRequiredUnit(battle, guardShare.guardBattleUnitId)
  if (guard.defeated) {
    return null
  }
  return Object.freeze({
    unit: guard,
    species: getRequiredSpecies(context.speciesById, guard.speciesId),
    guardShare,
  })
}

function applyRecipientResolution(
  battle: BattleState,
  resolution: DamageRecipientResolution,
  killerBattleUnitId: BattleUnitId,
  currentTime: BattleTime,
): BattleState {
  return resolution.after.defeated
    ? resolveBattleUnitDefeat({
        battle,
        defeatedUnit: resolution.after,
        killerBattleUnitId,
        currentTime,
      })
    : replaceLivingUnit(battle, resolution.after)
}

function recordRecipientResolution(
  log: BattleEventLog,
  resolution: DamageRecipientResolution,
  sourceBattleUnitId: BattleUnitId,
  skillId: string,
  currentTime: BattleTime,
): BattleEventLog {
  let nextLog = log
  for (const consumption of resolution.barrierConsumptions) {
    nextLog = recordBarrierConsumption(nextLog, {
      virtualTime: currentTime,
      sourceBattleUnitId,
      targetBattleUnitId: resolution.before.battleUnitId,
      skillId,
      consumption,
    })
  }
  if (resolution.hpDamage > 0) {
    nextLog = appendBattleEvent(nextLog, {
      kind: 'damage_applied',
      virtualTime: currentTime,
      payload: {
        sourceBattleUnitId,
        targetBattleUnitId: resolution.before.battleUnitId,
        skillId,
        calculatedDamage: resolution.assignedDamage,
        appliedDamage: resolution.hpDamage,
        hpBefore: resolution.before.hp,
        hpAfter: resolution.after.hp,
      },
    })
  }
  return nextLog
}

function executeSkillDecision(
  battle: BattleState,
  log: BattleEventLog,
  decision: Extract<MinimalAutoAiDecision, { readonly kind: 'USE_SKILL' }>,
  schedule: UnitActionSchedule,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): ExecutedHeadlessAction {
  const actor = getRequiredUnit(battle, decision.actorBattleUnitId)
  const target = getRequiredUnit(battle, decision.targetBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
  const skill = getRequiredSkill(context.skillById, decision.skillId)
  const scheduled = scheduleSingleTargetInnateSkill({
    actor,
    actorSpecies,
    actorSchedule: schedule,
    target,
    targetSpecies,
    skill,
    currentTime,
  })
  const mitigation = resolveBarrierGuardDamage({
    finalDamage: scheduled.calculatedDamage,
    target,
    targetSpecies,
    guard: getLivingGuard(battle, target, context),
  })

  const defeatCountBefore = battle.defeatRecords.length
  let nextBattle = applyRecipientResolution(
    battle,
    mitigation.target,
    actor.battleUnitId,
    currentTime,
  )
  if (mitigation.guardShare !== null) {
    nextBattle = applyRecipientResolution(
      nextBattle,
      mitigation.guardShare.guard,
      actor.battleUnitId,
      currentTime,
    )
  }

  let nextLog = appendBattleEvent(log, {
    kind: 'skill_used',
    virtualTime: currentTime,
    payload: {
      actorBattleUnitId: actor.battleUnitId,
      targetBattleUnitId: target.battleUnitId,
      skillId: skill.id,
    },
  })
  if (mitigation.guardShare !== null) {
    nextLog = recordGuardShared(nextLog, {
      virtualTime: currentTime,
      sourceBattleUnitId: actor.battleUnitId,
      skillId: skill.id,
      guardShare: mitigation.guardShare.guardShare,
      finalDamage: mitigation.finalDamage,
      retainedDamage: mitigation.guardShare.retainedDamage,
      redirectedDamage: mitigation.guardShare.redirectedDamage,
    })
  }
  nextLog = recordRecipientResolution(
    nextLog,
    mitigation.target,
    actor.battleUnitId,
    skill.id,
    currentTime,
  )
  if (mitigation.guardShare !== null) {
    nextLog = recordRecipientResolution(
      nextLog,
      mitigation.guardShare.guard,
      actor.battleUnitId,
      skill.id,
      currentTime,
    )
  }
  for (const defeatRecord of nextBattle.defeatRecords.slice(defeatCountBefore)) {
    nextLog = recordUnitDefeated(nextLog, defeatRecord)
  }
  if (nextBattle.outcome !== 'ONGOING') {
    nextLog = recordBattleEnded(nextLog, nextBattle.outcome, currentTime)
  }

  return Object.freeze({
    battle: withTimeline(nextBattle, nextBattle.timeline),
    log: nextLog,
    schedule: scheduled.actorSchedule,
  })
}

function executeMovementDecision(
  battle: BattleState,
  log: BattleEventLog,
  decision: Extract<MinimalAutoAiDecision, { readonly kind: 'MOVE' }>,
  schedule: UnitActionSchedule,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): ExecutedHeadlessAction {
  const actor = getRequiredUnit(battle, decision.actorBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const movement = performNormalMovement({
    battle,
    actorBattleUnitId: actor.battleUnitId,
    actorSpecies,
    actorSchedule: schedule,
    destination: decision.destination,
    currentTime,
  })
  return Object.freeze({
    battle: movement.battle,
    log: recordUnitMoved(log, {
      virtualTime: currentTime,
      battleUnitId: actor.battleUnitId,
      from: movement.from,
      to: movement.to,
    }),
    schedule: movement.actorSchedule,
  })
}

function executeWaitDecision(
  battle: BattleState,
  log: BattleEventLog,
  decision: Extract<MinimalAutoAiDecision, { readonly kind: 'WAIT' }>,
  schedule: UnitActionSchedule,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): ExecutedHeadlessAction {
  const actor = getRequiredUnit(battle, decision.actorBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const wait = performWaitAction({
    actor,
    actorSpecies,
    actorSchedule: schedule,
    currentTime,
    waitState: getRequiredWaitState(context, actor.battleUnitId),
  })
  context.waitStates.set(actor.battleUnitId, wait.waitState)
  return Object.freeze({ battle, log, schedule: wait.actorSchedule })
}

function getDurationChangeMutation(
  change: EffectDurationChange,
): ActiveEffectMutation {
  return Object.freeze({
    kind: 'MERGED',
    before: change.before,
    after: change.after,
  })
}

function recordStatusTriggers(
  log: BattleEventLog,
  triggers: readonly StatusDamageTrigger[],
  currentTime: BattleTime,
): BattleEventLog {
  let nextLog = log
  for (const trigger of triggers) {
    nextLog = appendBattleEvent(nextLog, {
      kind: 'damage_applied',
      virtualTime: currentTime,
      payload: {
        sourceBattleUnitId: trigger.sourceBattleUnitId,
        targetBattleUnitId: trigger.targetBattleUnitId,
        skillId: null,
        calculatedDamage: trigger.calculatedDamage,
        appliedDamage: trigger.appliedDamage,
        hpBefore: trigger.hpBefore,
        hpAfter: trigger.hpAfter,
      },
    })
    if (trigger.durationChange !== null) {
      nextLog = recordActiveEffectMutation(
        nextLog,
        getDurationChangeMutation(trigger.durationChange),
        currentTime,
      )
    }
    if (trigger.removalMutation !== null) {
      nextLog = recordActiveEffectMutation(
        nextLog,
        trigger.removalMutation,
        currentTime,
      )
    }
  }
  return nextLog
}

function getStatusKillerBattleUnitId(
  battle: BattleState,
  trigger: StatusDamageTrigger | undefined,
): BattleUnitId | null {
  if (trigger?.sourceBattleUnitId === null || trigger?.sourceBattleUnitId === undefined) {
    return null
  }
  if (trigger.sourceBattleUnitId === trigger.targetBattleUnitId) {
    return null
  }
  return battle.units.some(
    (unit) => unit.battleUnitId === trigger.sourceBattleUnitId,
  )
    ? trigger.sourceBattleUnitId
    : null
}

function applyTurnStartStatuses(
  battle: BattleState,
  log: BattleEventLog,
  actorBattleUnitId: BattleUnitId,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): {
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly defeated: boolean
} {
  const actor = getRequiredUnit(battle, actorBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const resolution = resolveTurnStartStatusConditions(actor, actorSpecies)
  if (resolution.triggers.length === 0) {
    return Object.freeze({ battle, log, defeated: false })
  }

  let nextLog = recordStatusTriggers(log, resolution.triggers, currentTime)
  if (!resolution.state.defeated) {
    return Object.freeze({
      battle: replaceLivingUnit(battle, resolution.state),
      log: nextLog,
      defeated: false,
    })
  }

  const killingTrigger = [...resolution.triggers]
    .reverse()
    .find((trigger) => trigger.hpAfter === 0)
  const nextBattle = resolveBattleUnitDefeat({
    battle,
    defeatedUnit: resolution.state,
    killerBattleUnitId: getStatusKillerBattleUnitId(battle, killingTrigger),
    currentTime,
  })
  const defeatRecord = nextBattle.defeatRecords.at(-1)
  if (defeatRecord === undefined) {
    throw new Error('status defeat must create a defeat record')
  }
  nextLog = recordUnitDefeated(nextLog, defeatRecord)
  if (nextBattle.outcome !== 'ONGOING') {
    nextLog = recordBattleEnded(nextLog, nextBattle.outcome, currentTime)
  }
  return Object.freeze({ battle: nextBattle, log: nextLog, defeated: true })
}

function consumeActorTargetActionDurations(
  battle: BattleState,
  log: BattleEventLog,
  actorBattleUnitId: BattleUnitId,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): { readonly battle: BattleState; readonly log: BattleEventLog } {
  const actor = getRequiredUnit(battle, actorBattleUnitId)
  if (actor.defeated) {
    return Object.freeze({ battle, log })
  }
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const resolution = consumeTargetActionDurations(actor, actorSpecies)
  if (resolution.changes.length === 0 && resolution.removals.length === 0) {
    return Object.freeze({ battle, log })
  }

  let nextLog = log
  for (const change of resolution.changes) {
    nextLog = recordActiveEffectMutation(
      nextLog,
      getDurationChangeMutation(change),
      currentTime,
    )
  }
  for (const removal of resolution.removals) {
    nextLog = recordActiveEffectMutation(nextLog, removal, currentTime)
  }
  return Object.freeze({
    battle: replaceLivingUnit(battle, resolution.state),
    log: nextLog,
  })
}

function getUsableDirectSkills(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  context: HeadlessBattleContext,
): readonly SkillDefinition[] {
  const skill = getRequiredSkill(context.skillById, actorSpecies.innateSkillId)
  if (skill.targetType !== 'SINGLE_ENEMY') {
    return Object.freeze([])
  }
  const target = getDirectEffectiveTarget(battle, actor.battleUnitId)
  if (target === null) {
    return Object.freeze([])
  }
  const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
  const usable = canUseSkillWithUsageState({
    usageBook: getRequiredSkillUsageBook(context, actor.battleUnitId),
    skill,
    actor,
    actorSpecies,
    target,
    targetSpecies,
  })
  return usable ? Object.freeze([skill]) : Object.freeze([])
}

function completeHeadlessActionState(
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  decision: MinimalAutoAiDecision,
  context: HeadlessBattleContext,
): void {
  const innateSkill = getRequiredSkill(context.skillById, actorSpecies.innateSkillId)
  const usageBook = getRequiredSkillUsageBook(context, actor.battleUnitId)
  context.skillUsageBooks.set(
    actor.battleUnitId,
    completeActorActionSkillUsage(
      usageBook,
      [innateSkill],
      decision.kind === 'USE_SKILL' ? decision.skillId : null,
    ),
  )
  if (decision.kind !== 'WAIT') {
    context.waitStates.set(actor.battleUnitId, resetWaitActionState())
  }
}

function createSummary(
  battle: BattleState,
  log: BattleEventLog,
  schedules: ReadonlyMap<BattleUnitId, UnitActionSchedule>,
  termination: HeadlessBattleTermination,
  finalVirtualTime: BattleTime,
  totalActions: number,
): HeadlessBattleSummary {
  const units = battle.units
    .map((unit) => {
      const schedule = schedules.get(unit.battleUnitId)
      if (schedule === undefined) {
        throw new Error(`schedule is missing: ${unit.battleUnitId}`)
      }
      return Object.freeze({
        battleUnitId: unit.battleUnitId,
        speciesId: unit.speciesId,
        side: unit.side,
        hp: unit.hp,
        barrierTotal: getTotalBarrierCapacity(unit.barriers),
        defeated: unit.defeated,
        positionId: getBoardPositionId(unit.position),
        actionCount: schedule.tie.actionCount,
      } satisfies HeadlessBattleUnitSummary)
    })
    .sort((left, right) => compareIds(left.battleUnitId, right.battleUnitId))

  return Object.freeze({
    termination,
    outcome: battle.outcome,
    finalVirtualTime,
    totalActions,
    eventCount: log.events.length,
    units: Object.freeze(units),
  })
}

export function runHeadlessBattle(definition: HeadlessBattleDefinition): HeadlessBattleRunResult {
  const maxActions = definition.maxActions ?? DEFAULT_HEADLESS_MAX_ACTIONS
  assertSafeIntegerAtLeast(maxActions, 1, 'maxActions')

  const initial = createInitialBattle(definition)
  let battle = initial.battle
  const context = initial.context
  let nextTimelineSequence = initial.nextTimelineSequence
  let log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, battle)
  let finalVirtualTime: BattleTime = 0
  let totalActions = 0

  while (battle.outcome === 'ONGOING' && totalActions < maxActions) {
    const popped = popTimelineEvent(battle.timeline)
    if (popped.event === null) {
      throw new Error('ongoing headless battle must have a scheduled event')
    }
    if (popped.event.kind !== 'UNIT_TURN') {
      throw new Error(`unsupported headless timeline event: ${popped.event.kind}`)
    }

    const payload = popped.event.payload as UnitTurnEventPayload
    const actor = getRequiredUnit(battle, payload.battleUnitId)
    if (actor.defeated) {
      throw new Error(`defeated unit received a turn: ${actor.battleUnitId}`)
    }
    const schedule = getRequiredSchedule(context, actor.battleUnitId)
    if (schedule.nextActionTime !== popped.event.time) {
      throw new Error('scheduled turn time must match the unit schedule')
    }

    finalVirtualTime = popped.event.time
    battle = withTimeline(battle, popped.queue)
    log = recordTurnStarted(log, actor.battleUnitId, finalVirtualTime)

    const statusStart = applyTurnStartStatuses(
      battle,
      log,
      actor.battleUnitId,
      finalVirtualTime,
      context,
    )
    battle = statusStart.battle
    log = statusStart.log
    if (statusStart.defeated) {
      continue
    }

    const readyActor = getRequiredUnit(battle, actor.battleUnitId)
    const actorSpecies = getRequiredSpecies(context.speciesById, readyActor.speciesId)
    const decision = selectMinimalAutoAiAction({
      battle,
      actorBattleUnitId: readyActor.battleUnitId,
      speciesById: context.speciesById,
      availableDirectSkills: getUsableDirectSkills(
        battle,
        readyActor,
        actorSpecies,
        context,
      ),
    })

    const executed =
      decision.kind === 'USE_SKILL'
        ? executeSkillDecision(battle, log, decision, schedule, finalVirtualTime, context)
        : decision.kind === 'MOVE'
          ? executeMovementDecision(battle, log, decision, schedule, finalVirtualTime, context)
          : executeWaitDecision(battle, log, decision, schedule, finalVirtualTime, context)

    battle = executed.battle
    log = executed.log
    context.schedules.set(readyActor.battleUnitId, executed.schedule)
    completeHeadlessActionState(readyActor, actorSpecies, decision, context)
    totalActions += 1

    if (battle.outcome === 'ONGOING') {
      const durationProgress = consumeActorTargetActionDurations(
        battle,
        log,
        readyActor.battleUnitId,
        finalVirtualTime,
        context,
      )
      battle = durationProgress.battle
      log = durationProgress.log
      battle = registerNextTurn(battle, executed.schedule, nextTimelineSequence)
      nextTimelineSequence += 1
    }
  }

  const termination: HeadlessBattleTermination =
    battle.outcome === 'ONGOING' ? 'ACTION_LIMIT_REACHED' : 'BATTLE_ENDED'
  const summary = createSummary(
    battle,
    log,
    context.schedules,
    termination,
    finalVirtualTime,
    totalActions,
  )
  return Object.freeze({ summary, battle, log })
}
