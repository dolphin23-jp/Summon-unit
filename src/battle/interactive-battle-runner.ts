import type { AiActionEvaluation } from '../ai/action-evaluation'
import { evaluateStandardAiActions } from '../ai/standard-scorers'
import {
  evaluateConfiguredAiDecision,
  type AiConfiguredDecisionResult,
  type AiDecisionReasonLog,
} from '../ai/configured-decision'
import type { AiDecisionConfiguration } from '../ai/strategy-presets'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition, SkillSlotType } from '../content/skill-definition'
import {
  assertValidUnitActionSchedule,
  createInitialUnitActionSchedule,
  createOrderedUnitTurnEvents,
  createUnitTurnEvent,
  registerUnitTurnEvent,
  rescheduleUnitActionAfterAction,
  type BattleTime,
  type UnitActionSchedule,
  type UnitTurnEventPayload,
} from './action-scheduling'
import { getTotalBarrierCapacity, type BarrierLayerState } from './barrier'
import {
  resolveBarrierGuardDamage,
  type DamageRecipientResolution,
} from './barrier-guard-resolution'
import { getBoardPositionId, type BoardPosition } from './board'
import {
  createBossPhaseRuntimeState,
  normalizeBossEncounterDefinition,
  reserveBossPhaseChange,
  resolveBossPhaseChange,
  type BossEncounterDefinition,
  type BossPhaseRuntimeState,
} from './boss-phase'
import {
  assertValidBattleState,
  createBattleState,
  resolveBattleUnitDefeat,
  type BattleOutcome,
  type BattleState,
} from './defeat-and-victory'
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
import { performNormalMovement } from './normal-movement'
import { getSkillReachTargetCandidates } from './reach-and-area'
import { getModifiedBattleStatValue } from './stat-modifiers'
import {
  createManualActionPreview,
  createWaitManualActionPreview,
  type ManualActionCategory,
  type ManualActionPreview,
} from './manual-action-preview'
import {
  assertValidSkillUsageBook,
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
  type ScheduledEvent,
  type TimelineQueue,
} from './timeline-queue'
import {
  createBattleUnitState,
  type BattleUnitId,
  type BattleUnitState,
} from './unit-state'
import {
  EMPTY_WAIT_ACTION_STATE,
  assertValidWaitActionState,
  performWaitAction,
  resetWaitActionState,
  type WaitActionState,
} from './wait-action'

export const HEADLESS_INITIAL_ACTION_COST = 100
export const HEADLESS_WAIT_ACTION_COST = 50
export const DEFAULT_HEADLESS_MAX_ACTIONS = 500
export const MANUAL_WAIT_CANDIDATE_ID = 'manual:wait'

const DEFAULT_AI_CONFIGURATION: AiDecisionConfiguration = Object.freeze({
  individualStrategy: 'STANDARD',
  teamStrategy: 'STABLE_CLEAR',
})

export interface HeadlessBattleUnitDefinition {
  readonly battleUnitId: BattleUnitId
  readonly speciesId: string
  readonly position: BoardPosition
  readonly initialHp?: number
  readonly initialBarriers?: readonly BarrierLayerState[]
  readonly initialEffects?: readonly ActiveEffectState[]
  readonly equippedSkillIds?: readonly string[]
  readonly tiePriority: number
}

export interface HeadlessBattleDefinition {
  readonly species: readonly MonsterSpecies[]
  readonly skills: readonly SkillDefinition[]
  readonly units: readonly HeadlessBattleUnitDefinition[]
  readonly guardShares?: readonly GuardShareState[]
  readonly aiConfigurations?: Readonly<Record<BattleUnitId, AiDecisionConfiguration>>
  readonly boss?: BossEncounterDefinition
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
  readonly bossPhase: BossPhaseRuntimeState | null
}

export type InteractiveBattleStatus =
  | 'READY'
  | 'AWAITING_MANUAL_ACTION'
  | 'BATTLE_ENDED'
  | 'ACTION_LIMIT_REACHED'

export interface InteractiveManualActionOption {
  readonly candidateId: string
  readonly kind: 'USE_SKILL' | 'MOVE' | 'WAIT'
  readonly category: ManualActionCategory
  readonly skillId: string | null
  readonly label: string
  readonly targetLabel: string
  readonly targetPositionId: string | null
  readonly recommended: boolean
  readonly preview: ManualActionPreview
}

export interface InteractivePendingManualAction {
  readonly actorBattleUnitId: BattleUnitId
  readonly recommendedCandidateId: string
  readonly options: readonly InteractiveManualActionOption[]
  readonly reasonLog: AiDecisionReasonLog | null
}

export interface InteractiveBattleSnapshot {
  readonly status: InteractiveBattleStatus
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly currentVirtualTime: BattleTime
  readonly totalActions: number
  readonly manualAllyActionRequested: boolean
  readonly pendingManualAction: InteractivePendingManualAction | null
  readonly lastDecisionLog: AiDecisionReasonLog | null
  readonly bossPhase: BossPhaseRuntimeState | null
}

export const INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION = 1

export interface InteractiveBattleRuntimeEntry<T> {
  readonly battleUnitId: BattleUnitId
  readonly value: T
}

export interface InteractiveBattleStableSnapshot {
  readonly snapshotVersion: typeof INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly currentVirtualTime: BattleTime
  readonly totalActions: number
  readonly manualAllyActionRequested: boolean
  readonly lastDecisionLog: AiDecisionReasonLog | null
  readonly bossPhase: BossPhaseRuntimeState | null
  readonly nextTimelineSequence: number
  readonly schedules: readonly UnitActionSchedule[]
  readonly waitStates: readonly InteractiveBattleRuntimeEntry<WaitActionState>[]
  readonly skillUsageBooks: readonly InteractiveBattleRuntimeEntry<SkillUsageBook>[]
  readonly skillIdsByBattleUnitId: readonly InteractiveBattleRuntimeEntry<readonly string[]>[]
  readonly recentPositionIds: readonly InteractiveBattleRuntimeEntry<readonly string[]>[]
}

export type InteractiveBattleListener = (snapshot: InteractiveBattleSnapshot) => void

export interface InteractiveBattleRunner {
  getSnapshot(): InteractiveBattleSnapshot
  getStableSnapshot(): InteractiveBattleStableSnapshot
  subscribe(listener: InteractiveBattleListener): () => void
  step(): InteractiveBattleSnapshot
  requestManualAllyAction(): InteractiveBattleSnapshot
  cancelManualAllyActionRequest(): InteractiveBattleSnapshot
  submitManualAction(candidateId: string): InteractiveBattleSnapshot
  resumeRecommendedAction(): InteractiveBattleSnapshot
  getResult(): HeadlessBattleRunResult
}

interface HeadlessBattleContext {
  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly skillById: Readonly<Record<string, SkillDefinition>>
  readonly schedules: Map<BattleUnitId, UnitActionSchedule>
  readonly waitStates: Map<BattleUnitId, WaitActionState>
  readonly skillUsageBooks: Map<BattleUnitId, SkillUsageBook>
  readonly skillIdsByBattleUnitId: Map<BattleUnitId, readonly string[]>
  readonly recentPositionIds: Map<BattleUnitId, readonly string[]>
  readonly aiConfigurations: Readonly<Record<BattleUnitId, AiDecisionConfiguration>>
  readonly guardShares: readonly GuardShareState[]
}

type RunnerDecision =
  | {
      readonly kind: 'USE_SKILL'
      readonly actorBattleUnitId: BattleUnitId
      readonly evaluation: AiActionEvaluation
    }
  | {
      readonly kind: 'MOVE'
      readonly actorBattleUnitId: BattleUnitId
      readonly destination: BoardPosition
    }
  | {
      readonly kind: 'WAIT'
      readonly actorBattleUnitId: BattleUnitId
    }

interface ExecutedHeadlessAction {
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly schedule: UnitActionSchedule
}

interface PendingManualExecution {
  readonly actor: BattleUnitState
  readonly actorSpecies: MonsterSpecies
  readonly schedule: UnitActionSchedule
  readonly currentTime: BattleTime
  readonly decisionResult: AiConfiguredDecisionResult
  readonly manualEvaluations: readonly AiActionEvaluation[]
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

function getRequiredSkillIds(
  context: HeadlessBattleContext,
  battleUnitId: BattleUnitId,
): readonly string[] {
  const skillIds = context.skillIdsByBattleUnitId.get(battleUnitId)
  if (skillIds === undefined) {
    throw new Error(`skill loadout is missing: ${battleUnitId}`)
  }
  return skillIds
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

function freezeAiConfigurations(
  definition: HeadlessBattleDefinition,
  units: readonly BattleUnitState[],
): Readonly<Record<BattleUnitId, AiDecisionConfiguration>> {
  const configured: Readonly<Record<BattleUnitId, AiDecisionConfiguration>> =
    definition.aiConfigurations ?? Object.freeze({})
  const result: Record<BattleUnitId, AiDecisionConfiguration> = {}
  for (const battleUnitId of Object.keys(configured)) {
    if (!units.some((unit) => unit.battleUnitId === battleUnitId)) {
      throw new Error(`ai configuration references unknown unit: ${battleUnitId}`)
    }
  }
  for (const unit of units) {
    const configuration = configured[unit.battleUnitId] ?? DEFAULT_AI_CONFIGURATION
    result[unit.battleUnitId] = Object.freeze({
      ...configuration,
      skillPolicies:
        configuration.skillPolicies === undefined
          ? undefined
          : Object.freeze(configuration.skillPolicies.map((policy) => Object.freeze({ ...policy }))),
    })
  }
  return Object.freeze(result)
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
  const skillIdsByBattleUnitId = new Map<BattleUnitId, readonly string[]>()
  const recentPositionIds = new Map<BattleUnitId, readonly string[]>()
  definition.units.forEach((unitDefinition, index) => {
    assertSafeIntegerAtLeast(unitDefinition.tiePriority, 0, 'tiePriority')
    const unit = units[index]
    const species = getRequiredSpecies(speciesById, unit.speciesId)
    const skillIds = [species.innateSkillId, ...(unitDefinition.equippedSkillIds ?? [])]
    if (new Set(skillIds).size !== skillIds.length) {
      throw new Error(`equipped skill ids must be unique: ${unit.battleUnitId}`)
    }
    const skills = skillIds.map((skillId) => getRequiredSkill(skillById, skillId))
    if (skills[0]?.slotType !== 'INNATE') {
      throw new Error(`innate skill must use INNATE slot: ${unit.battleUnitId}`)
    }
    for (const equipped of skills.slice(1)) {
      if (equipped.slotType === 'INNATE') {
        throw new Error(`equipped skill must use GENERIC or BLOOM slot: ${equipped.id}`)
      }
    }
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
    skillUsageBooks.set(unit.battleUnitId, createSkillUsageBook(skills))
    skillIdsByBattleUnitId.set(unit.battleUnitId, Object.freeze(skillIds))
    recentPositionIds.set(
      unit.battleUnitId,
      Object.freeze([getBoardPositionId(unit.position)]),
    )
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
      skillIdsByBattleUnitId,
      recentPositionIds,
      aiConfigurations: freezeAiConfigurations(definition, units),
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
  decision: Extract<RunnerDecision, { readonly kind: 'USE_SKILL' }>,
  schedule: UnitActionSchedule,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): ExecutedHeadlessAction {
  const actor = getRequiredUnit(battle, decision.actorBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const preview = decision.evaluation.preview
  if (preview.kind !== 'USE_SKILL') {
    throw new Error('skill decision must carry a skill preview')
  }
  const skill = getRequiredSkill(context.skillById, preview.candidate.skillId)
  const targetBattleUnitId =
    preview.reach.actualTargetBattleUnitId ?? preview.targetResults[0]?.battleUnitId
  if (targetBattleUnitId === null || targetBattleUnitId === undefined) {
    throw new Error('damage skill requires at least one resolved target')
  }
  const effectiveSpeed = getModifiedBattleStatValue(
    actorSpecies.stats.speed,
    actor.effects,
    'SPEED',
  )
  const actorSchedule = rescheduleUnitActionAfterAction(
    schedule,
    currentTime,
    preview.actionCost,
    effectiveSpeed,
  )
  const defeatCountBefore = battle.defeatRecords.length
  let nextBattle = battle
  let nextLog = appendBattleEvent(log, {
    kind: 'skill_used',
    virtualTime: currentTime,
    payload: {
      actorBattleUnitId: actor.battleUnitId,
      targetBattleUnitId,
      skillId: skill.id,
    },
  })

  for (const predicted of preview.targetResults) {
    if (nextBattle.outcome !== 'ONGOING') {
      break
    }
    const target = getRequiredUnit(nextBattle, predicted.battleUnitId)
    if (target.defeated || predicted.calculatedDamage === 0) {
      continue
    }
    const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
    const mitigation = resolveBarrierGuardDamage({
      finalDamage: predicted.calculatedDamage,
      target,
      targetSpecies,
      guard: getLivingGuard(nextBattle, target, context),
    })
    nextBattle = applyRecipientResolution(
      nextBattle,
      mitigation.target,
      actor.battleUnitId,
      currentTime,
    )
    if (mitigation.guardShare !== null && nextBattle.outcome === 'ONGOING') {
      nextBattle = applyRecipientResolution(
        nextBattle,
        mitigation.guardShare.guard,
        actor.battleUnitId,
        currentTime,
      )
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
    schedule: actorSchedule,
  })
}

function executeMovementDecision(
  battle: BattleState,
  log: BattleEventLog,
  decision: Extract<RunnerDecision, { readonly kind: 'MOVE' }>,
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
  decision: Extract<RunnerDecision, { readonly kind: 'WAIT' }>,
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

function getDurationChangeMutation(change: EffectDurationChange): ActiveEffectMutation {
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
  return battle.units.some((unit) => unit.battleUnitId === trigger.sourceBattleUnitId)
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

function getUsableSkills(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  context: HeadlessBattleContext,
): readonly SkillDefinition[] {
  const usageBook = getRequiredSkillUsageBook(context, actor.battleUnitId)
  const usable = getRequiredSkillIds(context, actor.battleUnitId)
    .map((skillId) => getRequiredSkill(context.skillById, skillId))
    .filter((skill) => {
      if (skill.targetType !== 'SINGLE_ENEMY') {
        return false
      }
      return getSkillReachTargetCandidates(battle, actor.battleUnitId, skill).some(
        (target) =>
          canUseSkillWithUsageState({
            usageBook,
            skill,
            actor,
            actorSpecies,
            target,
            targetSpecies: getRequiredSpecies(context.speciesById, target.speciesId),
          }),
      )
    })
  return Object.freeze(usable)
}

function completeHeadlessActionState(
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  decision: RunnerDecision,
  context: HeadlessBattleContext,
): void {
  const skillIds = getRequiredSkillIds(context, actor.battleUnitId)
  if (!skillIds.includes(actorSpecies.innateSkillId)) {
    throw new Error(`skill loadout must include innate skill: ${actor.battleUnitId}`)
  }
  const skills = skillIds.map((skillId) => getRequiredSkill(context.skillById, skillId))
  const usageBook = getRequiredSkillUsageBook(context, actor.battleUnitId)
  context.skillUsageBooks.set(
    actor.battleUnitId,
    completeActorActionSkillUsage(
      usageBook,
      skills,
      decision.kind === 'USE_SKILL'
        ? decision.evaluation.preview.candidate.kind === 'USE_SKILL'
          ? decision.evaluation.preview.candidate.skillId
          : null
        : null,
    ),
  )
  if (decision.kind !== 'WAIT') {
    context.waitStates.set(actor.battleUnitId, resetWaitActionState())
  }
}

function updateRecentPositionHistory(
  battle: BattleState,
  battleUnitId: BattleUnitId,
  context: HeadlessBattleContext,
): void {
  const unit = getRequiredUnit(battle, battleUnitId)
  const previous = context.recentPositionIds.get(battleUnitId) ?? Object.freeze([])
  context.recentPositionIds.set(
    battleUnitId,
    Object.freeze([...previous, getBoardPositionId(unit.position)].slice(-3)),
  )
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

function getConfiguredDecision(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): AiConfiguredDecisionResult {
  return evaluateConfiguredAiDecision({
    input: Object.freeze({
      battle,
      actorBattleUnitId: actor.battleUnitId,
      speciesById: context.speciesById,
      availableSkills: getUsableSkills(battle, actor, actorSpecies, context),
    }),
    currentTime,
    recentActorPositionIds: context.recentPositionIds.get(actor.battleUnitId),
    configuration: context.aiConfigurations[actor.battleUnitId] ?? DEFAULT_AI_CONFIGURATION,
  })
}


function getManualEvaluations(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): readonly AiActionEvaluation[] {
  return Object.freeze(
    evaluateStandardAiActions({
      input: Object.freeze({
        battle,
        actorBattleUnitId: actor.battleUnitId,
        speciesById: context.speciesById,
        availableSkills: getUsableSkills(battle, actor, actorSpecies, context),
      }),
      currentTime,
      recentActorPositionIds: context.recentPositionIds.get(actor.battleUnitId),
    }).filter(
      (evaluation) =>
        evaluation.preview.kind === 'MOVE' || evaluation.preview.targetResults.length > 0,
    ),
  )
}

function evaluationToDecision(
  actorBattleUnitId: BattleUnitId,
  evaluation: AiActionEvaluation | null,
): RunnerDecision {
  if (evaluation === null) {
    return Object.freeze({ kind: 'WAIT', actorBattleUnitId })
  }
  const candidate = evaluation.preview.candidate
  if (candidate.kind === 'MOVE') {
    return Object.freeze({
      kind: 'MOVE',
      actorBattleUnitId,
      destination: candidate.destination,
    })
  }
  if (evaluation.preview.kind !== 'USE_SKILL') {
    throw new Error('skill candidate must have a skill preview')
  }
  if (evaluation.preview.targetResults.length === 0) {
    return Object.freeze({ kind: 'WAIT', actorBattleUnitId })
  }
  return Object.freeze({ kind: 'USE_SKILL', actorBattleUnitId, evaluation })
}

function actionOptionLabel(evaluation: AiActionEvaluation): string {
  if (evaluation.preview.kind === 'MOVE') {
    return '通常移動'
  }
  return evaluation.preview.candidate.skillId
}

function optionCategory(
  evaluation: AiActionEvaluation,
  context: HeadlessBattleContext,
): SkillSlotType | 'MOVE' {
  return evaluation.preview.kind === 'MOVE'
    ? 'MOVE'
    : getRequiredSkill(
        context.skillById,
        evaluation.preview.candidate.skillId,
      ).slotType
}

function optionTargetLabel(evaluation: AiActionEvaluation): string {
  if (evaluation.preview.kind === 'MOVE') {
    return evaluation.preview.toPositionId
  }
  const selected = evaluation.preview.candidate.selectedTargetBattleUnitId
  const position = evaluation.preview.candidate.selectedTargetPosition
  return selected ?? (position === null ? '対象なし' : getBoardPositionId(position))
}

function createPendingManualAction(
  pending: PendingManualExecution,
  battle: BattleState,
  context: HeadlessBattleContext,
  nextTimelineSequence: number,
): InteractivePendingManualAction {
  const recommendedCandidateId =
    pending.decisionResult.selected?.preview.candidate.candidateId ?? MANUAL_WAIT_CANDIDATE_ID
  const options: InteractiveManualActionOption[] = pending.manualEvaluations.map(
    (evaluation) => {
      const candidate = evaluation.preview.candidate
      const category = optionCategory(evaluation, context)
      const preview = createManualActionPreview({
        battle,
        actor: pending.actor,
        actorSpecies: pending.actorSpecies,
        actorSchedule: pending.schedule,
        currentTime: pending.currentTime,
        nextTimelineSequence,
        evaluation,
        speciesById: context.speciesById,
        guardShares: context.guardShares,
      })
      return Object.freeze({
        candidateId: candidate.candidateId,
        kind: evaluation.preview.kind,
        category,
        skillId: candidate.kind === 'USE_SKILL' ? candidate.skillId : null,
        label: actionOptionLabel(evaluation),
        targetLabel: optionTargetLabel(evaluation),
        targetPositionId: preview.selectedTargetPositionId,
        recommended: candidate.candidateId === recommendedCandidateId,
        preview,
      })
    },
  )
  const wait = performWaitAction({
    actor: pending.actor,
    actorSpecies: pending.actorSpecies,
    actorSchedule: pending.schedule,
    currentTime: pending.currentTime,
    waitState: getRequiredWaitState(context, pending.actor.battleUnitId),
  })
  options.push(
    Object.freeze({
      candidateId: MANUAL_WAIT_CANDIDATE_ID,
      kind: 'WAIT',
      category: 'WAIT',
      skillId: null,
      label: '待機',
      targetLabel: 'その場で待機',
      targetPositionId: null,
      recommended: recommendedCandidateId === MANUAL_WAIT_CANDIDATE_ID,
      preview: createWaitManualActionPreview({
        battle,
        actor: pending.actor,
        schedule: pending.schedule,
        effectiveActionCost: wait.effectiveActionCost,
        nextSchedule: wait.actorSchedule,
        nextTimelineSequence,
      }),
    }),
  )
  return Object.freeze({
    actorBattleUnitId: pending.actor.battleUnitId,
    recommendedCandidateId,
    options: Object.freeze(options),
    reasonLog: pending.decisionResult.log,
  })
}

function createRuntimeEntries<T>(
  values: ReadonlyMap<BattleUnitId, T>,
): readonly InteractiveBattleRuntimeEntry<T>[] {
  return Object.freeze(
    [...values.entries()]
      .sort(([left], [right]) => compareIds(left, right))
      .map(([battleUnitId, value]) => Object.freeze({ battleUnitId, value })),
  )
}

function restoreRuntimeEntries<T>(input: {
  readonly entries: readonly InteractiveBattleRuntimeEntry<T>[]
  readonly expectedBattleUnitIds: ReadonlySet<BattleUnitId>
  readonly field: string
  readonly validate: (value: T, battleUnitId: BattleUnitId) => void
}): Map<BattleUnitId, T> {
  if (input.entries.length !== input.expectedBattleUnitIds.size) {
    throw new Error(`${input.field} must contain every battle unit exactly once`)
  }
  const restored = new Map<BattleUnitId, T>()
  for (const entry of input.entries) {
    if (!input.expectedBattleUnitIds.has(entry.battleUnitId)) {
      throw new Error(`${input.field} references unknown unit: ${entry.battleUnitId}`)
    }
    if (restored.has(entry.battleUnitId)) {
      throw new Error(`${input.field} contains duplicate unit: ${entry.battleUnitId}`)
    }
    input.validate(entry.value, entry.battleUnitId)
    restored.set(entry.battleUnitId, entry.value)
  }
  return restored
}

class InteractiveBattleRunnerImpl implements InteractiveBattleRunner {
  private battle: BattleState
  private readonly context: HeadlessBattleContext
  private readonly maxActions: number
  private nextTimelineSequence: number
  private log: BattleEventLog
  private currentVirtualTime: BattleTime = 0
  private totalActions = 0
  private manualAllyActionRequested = false
  private pendingManualExecution: PendingManualExecution | null = null
  private lastDecisionLog: AiDecisionReasonLog | null = null
  private readonly bossDefinition: BossEncounterDefinition | null
  private bossPhase: BossPhaseRuntimeState | null
  private readonly listeners = new Set<InteractiveBattleListener>()

  constructor(
    definition: HeadlessBattleDefinition,
    stableSnapshot?: InteractiveBattleStableSnapshot,
  ) {
    this.maxActions = definition.maxActions ?? DEFAULT_HEADLESS_MAX_ACTIONS
    assertSafeIntegerAtLeast(this.maxActions, 1, 'maxActions')
    const initial = createInitialBattle(definition)
    this.battle = initial.battle
    this.context = initial.context
    this.nextTimelineSequence = initial.nextTimelineSequence
    this.log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, this.battle)
    const knownSkillIds = new Set(Object.keys(this.context.skillById))
    this.bossDefinition =
      definition.boss === undefined
        ? null
        : normalizeBossEncounterDefinition(definition.boss, knownSkillIds)
    this.bossPhase =
      this.bossDefinition === null
        ? null
        : createBossPhaseRuntimeState(this.bossDefinition, this.battle, knownSkillIds)
    if (this.bossDefinition !== null && this.bossPhase !== null) {
      const loadedSkillIds = new Set(
        getRequiredSkillIds(this.context, this.bossDefinition.bossBattleUnitId),
      )
      for (const phase of this.bossDefinition.phases) {
        for (const skillId of phase.actionSkillIds) {
          if (!loadedSkillIds.has(skillId)) {
            throw new Error(`boss phase skill must be equipped: ${skillId}`)
          }
        }
      }
      this.setBossActionSkills(this.bossPhase.actionSkillIds)
    }
    if (stableSnapshot !== undefined) {
      this.restoreStableSnapshot(stableSnapshot)
    }
  }

  getSnapshot(): InteractiveBattleSnapshot {
    return Object.freeze({
      status: this.getStatus(),
      battle: this.battle,
      log: this.log,
      currentVirtualTime: this.currentVirtualTime,
      totalActions: this.totalActions,
      manualAllyActionRequested: this.manualAllyActionRequested,
      pendingManualAction:
        this.pendingManualExecution === null
          ? null
          : createPendingManualAction(
              this.pendingManualExecution,
              this.battle,
              this.context,
              this.nextTimelineSequence,
            ),
      lastDecisionLog: this.lastDecisionLog,
      bossPhase: this.bossPhase,
    })
  }


  getStableSnapshot(): InteractiveBattleStableSnapshot {
    if (this.pendingManualExecution !== null) {
      throw new Error('cannot capture a stable snapshot during manual action selection')
    }
    return Object.freeze({
      snapshotVersion: INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION,
      battle: this.battle,
      log: this.log,
      currentVirtualTime: this.currentVirtualTime,
      totalActions: this.totalActions,
      manualAllyActionRequested: this.manualAllyActionRequested,
      lastDecisionLog: this.lastDecisionLog,
      bossPhase: this.bossPhase,
      nextTimelineSequence: this.nextTimelineSequence,
      schedules: Object.freeze(
        [...this.context.schedules.values()].sort((left, right) =>
          compareIds(left.battleUnitId, right.battleUnitId),
        ),
      ),
      waitStates: createRuntimeEntries(this.context.waitStates),
      skillUsageBooks: createRuntimeEntries(this.context.skillUsageBooks),
      skillIdsByBattleUnitId: createRuntimeEntries(this.context.skillIdsByBattleUnitId),
      recentPositionIds: createRuntimeEntries(this.context.recentPositionIds),
    })
  }

  subscribe(listener: InteractiveBattleListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  step(): InteractiveBattleSnapshot {
    if (this.pendingManualExecution !== null || this.isTerminal()) {
      return this.getSnapshot()
    }

    const popped = popTimelineEvent(this.battle.timeline)
    if (popped.event === null) {
      throw new Error('ongoing interactive battle must have a scheduled event')
    }
    if (popped.event.kind === 'PHASE_CHANGE') {
      this.currentVirtualTime = popped.event.time
      this.battle = withTimeline(this.battle, popped.queue)
      this.resolveBossPhaseEvent(popped.event)
      return this.publish()
    }
    if (popped.event.kind !== 'UNIT_TURN') {
      throw new Error(`unsupported interactive timeline event: ${popped.event.kind}`)
    }

    const payload = popped.event.payload as UnitTurnEventPayload
    const actor = getRequiredUnit(this.battle, payload.battleUnitId)
    if (actor.defeated) {
      throw new Error(`defeated unit received a turn: ${actor.battleUnitId}`)
    }
    const schedule = getRequiredSchedule(this.context, actor.battleUnitId)
    if (schedule.nextActionTime !== popped.event.time) {
      throw new Error('scheduled turn time must match the unit schedule')
    }

    this.currentVirtualTime = popped.event.time
    this.battle = withTimeline(this.battle, popped.queue)
    this.log = recordTurnStarted(this.log, actor.battleUnitId, this.currentVirtualTime)

    const statusStart = applyTurnStartStatuses(
      this.battle,
      this.log,
      actor.battleUnitId,
      this.currentVirtualTime,
      this.context,
    )
    this.battle = statusStart.battle
    this.log = statusStart.log
    if (statusStart.defeated) {
      return this.publish()
    }

    const readyActor = getRequiredUnit(this.battle, actor.battleUnitId)
    const actorSpecies = getRequiredSpecies(this.context.speciesById, readyActor.speciesId)
    const decisionResult = getConfiguredDecision(
      this.battle,
      readyActor,
      actorSpecies,
      this.currentVirtualTime,
      this.context,
    )

    if (this.manualAllyActionRequested && readyActor.side === 'ALLY') {
      this.manualAllyActionRequested = false
      this.pendingManualExecution = Object.freeze({
        actor: readyActor,
        actorSpecies,
        schedule,
        currentTime: this.currentVirtualTime,
        decisionResult,
        manualEvaluations: getManualEvaluations(
          this.battle,
          readyActor,
          actorSpecies,
          this.currentVirtualTime,
          this.context,
        ),
      })
      return this.publish()
    }

    this.executeDecision(
      readyActor,
      actorSpecies,
      schedule,
      evaluationToDecision(readyActor.battleUnitId, decisionResult.selected),
      decisionResult.log,
    )
    return this.publish()
  }

  requestManualAllyAction(): InteractiveBattleSnapshot {
    if (!this.isTerminal() && this.pendingManualExecution === null) {
      this.manualAllyActionRequested = true
    }
    return this.publish()
  }

  cancelManualAllyActionRequest(): InteractiveBattleSnapshot {
    if (this.pendingManualExecution !== null) {
      return this.resumeRecommendedAction()
    }
    this.manualAllyActionRequested = false
    return this.publish()
  }

  submitManualAction(candidateId: string): InteractiveBattleSnapshot {
    const pending = this.pendingManualExecution
    if (pending === null) {
      throw new Error('manual action can only be submitted at a manual interrupt point')
    }

    let decision: RunnerDecision
    let reasonLog: AiDecisionReasonLog | null = pending.decisionResult.log
    if (candidateId === MANUAL_WAIT_CANDIDATE_ID) {
      decision = Object.freeze({
        kind: 'WAIT',
        actorBattleUnitId: pending.actor.battleUnitId,
      })
      reasonLog = null
    } else {
      const evaluation = pending.manualEvaluations.find(
        (candidate) => candidate.preview.candidate.candidateId === candidateId,
      )
      if (evaluation === undefined) {
        throw new Error(`manual candidate is not available: ${candidateId}`)
      }
      decision = evaluationToDecision(pending.actor.battleUnitId, evaluation)
    }

    this.pendingManualExecution = null
    this.executeDecision(
      pending.actor,
      pending.actorSpecies,
      pending.schedule,
      decision,
      reasonLog,
    )
    return this.publish()
  }

  resumeRecommendedAction(): InteractiveBattleSnapshot {
    const pending = this.pendingManualExecution
    if (pending === null) {
      this.manualAllyActionRequested = false
      return this.publish()
    }
    const candidateId =
      pending.decisionResult.selected?.preview.candidate.candidateId ??
      MANUAL_WAIT_CANDIDATE_ID
    return this.submitManualAction(candidateId)
  }

  getResult(): HeadlessBattleRunResult {
    if (!this.isTerminal()) {
      throw new Error('interactive battle result is only available after termination')
    }
    const termination: HeadlessBattleTermination =
      this.battle.outcome === 'ONGOING' ? 'ACTION_LIMIT_REACHED' : 'BATTLE_ENDED'
    return Object.freeze({
      summary: createSummary(
        this.battle,
        this.log,
        this.context.schedules,
        termination,
        this.currentVirtualTime,
        this.totalActions,
      ),
      battle: this.battle,
      log: this.log,
      bossPhase: this.bossPhase,
    })
  }


  private restoreStableSnapshot(snapshot: InteractiveBattleStableSnapshot): void {
    if (snapshot.snapshotVersion !== INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION) {
      throw new Error(`unsupported battle snapshot version: ${String(snapshot.snapshotVersion)}`)
    }
    assertSafeIntegerAtLeast(snapshot.currentVirtualTime, 0, 'snapshot currentVirtualTime')
    assertSafeIntegerAtLeast(snapshot.totalActions, 0, 'snapshot totalActions')
    assertSafeIntegerAtLeast(snapshot.nextTimelineSequence, 0, 'snapshot nextTimelineSequence')
    if (typeof snapshot.manualAllyActionRequested !== 'boolean') {
      throw new Error('snapshot manualAllyActionRequested must be boolean')
    }
    assertValidBattleState(snapshot.battle)
    const expectedBattleUnitIds = new Set(this.battle.units.map((unit) => unit.battleUnitId))
    const restoredBattleUnitIds = new Set(snapshot.battle.units.map((unit) => unit.battleUnitId))
    if (
      expectedBattleUnitIds.size !== restoredBattleUnitIds.size ||
      [...expectedBattleUnitIds].some((battleUnitId) => !restoredBattleUnitIds.has(battleUnitId))
    ) {
      throw new Error('snapshot battle units do not match the battle definition')
    }
    if (snapshot.schedules.length !== expectedBattleUnitIds.size) {
      throw new Error('snapshot schedules must contain every battle unit exactly once')
    }
    const schedules = new Map<BattleUnitId, UnitActionSchedule>()
    for (const schedule of snapshot.schedules) {
      assertValidUnitActionSchedule(schedule)
      if (!expectedBattleUnitIds.has(schedule.battleUnitId)) {
        throw new Error(`snapshot schedule references unknown unit: ${schedule.battleUnitId}`)
      }
      if (schedules.has(schedule.battleUnitId)) {
        throw new Error(`snapshot schedules contain duplicate unit: ${schedule.battleUnitId}`)
      }
      schedules.set(schedule.battleUnitId, schedule)
    }
    const waitStates = restoreRuntimeEntries({
      entries: snapshot.waitStates,
      expectedBattleUnitIds,
      field: 'snapshot waitStates',
      validate: (value) => assertValidWaitActionState(value),
    })
    const skillUsageBooks = restoreRuntimeEntries({
      entries: snapshot.skillUsageBooks,
      expectedBattleUnitIds,
      field: 'snapshot skillUsageBooks',
      validate: (value) => assertValidSkillUsageBook(value),
    })
    const skillIdsByBattleUnitId = restoreRuntimeEntries({
      entries: snapshot.skillIdsByBattleUnitId,
      expectedBattleUnitIds,
      field: 'snapshot skillIdsByBattleUnitId',
      validate: (value, battleUnitId) => {
        if (value.length === 0 || new Set(value).size !== value.length) {
          throw new Error(`snapshot skill loadout is invalid: ${battleUnitId}`)
        }
        for (const skillId of value) getRequiredSkill(this.context.skillById, skillId)
      },
    })
    const recentPositionIds = restoreRuntimeEntries({
      entries: snapshot.recentPositionIds,
      expectedBattleUnitIds,
      field: 'snapshot recentPositionIds',
      validate: (value, battleUnitId) => {
        if (value.length === 0 || value.some((positionId) => positionId.trim().length === 0)) {
          throw new Error(`snapshot recent positions are invalid: ${battleUnitId}`)
        }
      },
    })
    if ((this.bossDefinition === null) !== (snapshot.bossPhase === null)) {
      throw new Error('snapshot boss phase does not match the battle definition')
    }
    this.battle = snapshot.battle
    this.log = snapshot.log
    this.currentVirtualTime = snapshot.currentVirtualTime
    this.totalActions = snapshot.totalActions
    this.manualAllyActionRequested = snapshot.manualAllyActionRequested
    this.pendingManualExecution = null
    this.lastDecisionLog = snapshot.lastDecisionLog
    this.bossPhase = snapshot.bossPhase
    this.nextTimelineSequence = snapshot.nextTimelineSequence
    this.context.schedules.clear()
    for (const [battleUnitId, value] of schedules) this.context.schedules.set(battleUnitId, value)
    this.context.waitStates.clear()
    for (const [battleUnitId, value] of waitStates) this.context.waitStates.set(battleUnitId, value)
    this.context.skillUsageBooks.clear()
    for (const [battleUnitId, value] of skillUsageBooks) {
      this.context.skillUsageBooks.set(battleUnitId, value)
    }
    this.context.skillIdsByBattleUnitId.clear()
    for (const [battleUnitId, value] of skillIdsByBattleUnitId) {
      this.context.skillIdsByBattleUnitId.set(battleUnitId, Object.freeze([...value]))
    }
    this.context.recentPositionIds.clear()
    for (const [battleUnitId, value] of recentPositionIds) {
      this.context.recentPositionIds.set(battleUnitId, Object.freeze([...value]))
    }
  }

  private executeDecision(
    actor: BattleUnitState,
    actorSpecies: MonsterSpecies,
    schedule: UnitActionSchedule,
    decision: RunnerDecision,
    reasonLog: AiDecisionReasonLog | null,
  ): void {
    const executed =
      decision.kind === 'USE_SKILL'
        ? executeSkillDecision(
            this.battle,
            this.log,
            decision,
            schedule,
            this.currentVirtualTime,
            this.context,
          )
        : decision.kind === 'MOVE'
          ? executeMovementDecision(
              this.battle,
              this.log,
              decision,
              schedule,
              this.currentVirtualTime,
              this.context,
            )
          : executeWaitDecision(
              this.battle,
              this.log,
              decision,
              schedule,
              this.currentVirtualTime,
              this.context,
            )

    this.battle = executed.battle
    this.log = executed.log
    this.context.schedules.set(actor.battleUnitId, executed.schedule)
    completeHeadlessActionState(actor, actorSpecies, decision, this.context)
    this.totalActions += 1
    this.lastDecisionLog = reasonLog

    if (this.battle.outcome === 'ONGOING') {
      const durationProgress = consumeActorTargetActionDurations(
        this.battle,
        this.log,
        actor.battleUnitId,
        this.currentVirtualTime,
        this.context,
      )
      this.battle = durationProgress.battle
      this.log = durationProgress.log
      this.reserveBossPhaseEvent()
      this.battle = registerNextTurn(
        this.battle,
        executed.schedule,
        this.nextTimelineSequence,
      )
      this.nextTimelineSequence += 1
    }
    updateRecentPositionHistory(this.battle, actor.battleUnitId, this.context)
  }

  private setBossActionSkills(skillIds: readonly string[]): void {
    if (this.bossDefinition === null) return
    const bossBattleUnitId = this.bossDefinition.bossBattleUnitId
    const frozenSkillIds = Object.freeze([...skillIds])
    const boss = getRequiredUnit(this.battle, bossBattleUnitId)
    const species = getRequiredSpecies(this.context.speciesById, boss.speciesId)
    if (!frozenSkillIds.includes(species.innateSkillId)) {
      throw new Error('boss phase action table must include the innate skill')
    }
    const skills = frozenSkillIds.map((skillId) =>
      getRequiredSkill(this.context.skillById, skillId),
    )
    this.context.skillIdsByBattleUnitId.set(bossBattleUnitId, frozenSkillIds)
    this.context.skillUsageBooks.set(bossBattleUnitId, createSkillUsageBook(skills))
  }

  private reserveBossPhaseEvent(): void {
    if (this.bossDefinition === null || this.bossPhase === null) return
    const reserved = reserveBossPhaseChange({
      battle: this.battle,
      state: this.bossPhase,
      definition: this.bossDefinition,
      speciesById: this.context.speciesById,
      knownSkillIds: new Set(Object.keys(this.context.skillById)),
      currentTime: this.currentVirtualTime,
      sequence: this.nextTimelineSequence,
    })
    this.battle = reserved.battle
    this.bossPhase = reserved.state
    this.nextTimelineSequence = reserved.nextSequence
  }

  private resolveBossPhaseEvent(event: ScheduledEvent): void {
    if (this.bossDefinition === null || this.bossPhase === null) {
      throw new Error('PHASE_CHANGE event requires a boss encounter')
    }
    const resolved = resolveBossPhaseChange({
      battle: this.battle,
      state: this.bossPhase,
      definition: this.bossDefinition,
      event,
      speciesById: this.context.speciesById,
      knownSkillIds: new Set(Object.keys(this.context.skillById)),
      barrierApplicationSequence: event.sequence,
    })
    this.battle = resolved.battle
    this.bossPhase = resolved.state
    this.setBossActionSkills(resolved.actionSkillIds)
    this.reserveBossPhaseEvent()
  }

  private getStatus(): InteractiveBattleStatus {
    if (this.pendingManualExecution !== null) {
      return 'AWAITING_MANUAL_ACTION'
    }
    if (this.battle.outcome !== 'ONGOING') {
      return 'BATTLE_ENDED'
    }
    if (this.totalActions >= this.maxActions) {
      return 'ACTION_LIMIT_REACHED'
    }
    return 'READY'
  }

  private isTerminal(): boolean {
    const status = this.getStatus()
    return status === 'BATTLE_ENDED' || status === 'ACTION_LIMIT_REACHED'
  }

  private publish(): InteractiveBattleSnapshot {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
    return snapshot
  }
}

export function createInteractiveBattleRunner(
  definition: HeadlessBattleDefinition,
  stableSnapshot?: InteractiveBattleStableSnapshot,
): InteractiveBattleRunner {
  return new InteractiveBattleRunnerImpl(definition, stableSnapshot)
}

export function runHeadlessBattle(
  definition: HeadlessBattleDefinition,
): HeadlessBattleRunResult {
  const runner = createInteractiveBattleRunner(definition)
  while (runner.getSnapshot().status === 'READY') {
    runner.step()
  }
  return runner.getResult()
}
