import {
  enumerateAiActionCandidates,
  previewAiActionCandidate,
  type AiActionCandidate,
  type AiActionEvaluation,
  type AiEvaluationInput,
  type AiSkillActionCandidate,
} from '../ai/action-evaluation'
import {
  evaluateConfiguredAiDecision,
  type AiConfiguredDecisionResult,
  type AiDecisionReasonLog,
} from '../ai/configured-decision'
import type { AiDecisionConfiguration } from '../ai/strategy-presets'
import type { MonsterSpecies } from '../content/monster-species'
import {
  resolveSkillReachMethod,
  type SkillDefinition,
  type SkillSlotType,
} from '../content/skill-definition'
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
import type { DamageRecipientResolution } from './barrier-guard-resolution'
import { getBoardPositionId, type BoardPosition } from './board'
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
  type GuardShareState,
} from './guard-share'
import {
  getPredictedUnitTurnRank,
  resolveManualSkillAction,
  type ManualActionPreview,
} from './manual-action-resolution'
import { performNormalMovement } from './normal-movement'
import {
  canUseSkillWithUsageState,
  completeActorActionSkillUsage,
  createSkillUsageBook,
  type SkillUsageBook,
} from './skill-usage'
import {
  consumeTargetActionDurations,
  isMovementLocked,
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
export const MANUAL_WAIT_CANDIDATE_ID = 'manual:wait'

const DEFAULT_AI_CONFIGURATION: AiDecisionConfiguration = Object.freeze({
  individualStrategy: 'STANDARD',
  teamStrategy: 'STABLE_CLEAR',
})

export interface HeadlessBattleUnitDefinition {
  readonly battleUnitId: BattleUnitId
  readonly speciesId: string
  readonly equippedSkillIds?: readonly string[]
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
  readonly aiConfigurations?: Readonly<Record<BattleUnitId, AiDecisionConfiguration>>
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

export type InteractiveBattleStatus =
  | 'READY'
  | 'AWAITING_MANUAL_ACTION'
  | 'BATTLE_ENDED'
  | 'ACTION_LIMIT_REACHED'

export type InteractiveManualActionSlot = SkillSlotType | 'MOVE' | 'WAIT'

export interface InteractiveManualActionOption {
  readonly candidateId: string
  readonly kind: 'USE_SKILL' | 'MOVE' | 'WAIT'
  readonly slot: InteractiveManualActionSlot
  readonly skillId: string | null
  readonly actionKey: string
  readonly actionLabel: string
  readonly targetLabel: string | null
  readonly label: string
  readonly selectedTargetBattleUnitId: BattleUnitId | null
  readonly selectedTargetPositionId: string | null
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
}

export type InteractiveBattleListener = (snapshot: InteractiveBattleSnapshot) => void

export interface InteractiveBattleRunner {
  getSnapshot(): InteractiveBattleSnapshot
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
  readonly skillsByUnitId: Readonly<Record<BattleUnitId, readonly SkillDefinition[]>>
  readonly schedules: Map<BattleUnitId, UnitActionSchedule>
  readonly waitStates: Map<BattleUnitId, WaitActionState>
  readonly skillUsageBooks: Map<BattleUnitId, SkillUsageBook>
  readonly recentPositionIds: Map<BattleUnitId, readonly string[]>
  readonly aiConfigurations: Readonly<Record<BattleUnitId, AiDecisionConfiguration>>
  readonly guardShares: readonly GuardShareState[]
}

type RunnerDecision =
  | {
      readonly kind: 'USE_SKILL'
      readonly actorBattleUnitId: BattleUnitId
      readonly candidate: AiSkillActionCandidate
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

interface PreparedManualAction {
  readonly option: InteractiveManualActionOption
  readonly decision: RunnerDecision
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
  readonly preparedActions: readonly PreparedManualAction[]
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

function getRequiredUnitSkills(
  context: HeadlessBattleContext,
  battleUnitId: BattleUnitId,
): readonly SkillDefinition[] {
  const skills = context.skillsByUnitId[battleUnitId]
  if (skills === undefined) {
    throw new Error(`unit skills are missing: ${battleUnitId}`)
  }
  return skills
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
  const skillsByUnitId: Record<BattleUnitId, readonly SkillDefinition[]> = {}
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
  const recentPositionIds = new Map<BattleUnitId, readonly string[]>()
  definition.units.forEach((unitDefinition, index) => {
    assertSafeIntegerAtLeast(unitDefinition.tiePriority, 0, 'tiePriority')
    const unit = units[index]
    const species = getRequiredSpecies(speciesById, unit.speciesId)
    const innateSkill = getRequiredSkill(skillById, species.innateSkillId)
    if (innateSkill.slotType !== 'INNATE') {
      throw new Error(`species innate skill must use INNATE slot: ${innateSkill.id}`)
    }
    const equippedIds = unitDefinition.equippedSkillIds ?? Object.freeze([])
    const seenSkillIds = new Set<string>([innateSkill.id])
    const unitSkills: SkillDefinition[] = [innateSkill]
    for (const skillId of equippedIds) {
      if (seenSkillIds.has(skillId)) {
        throw new Error(`unit skill ids must be unique: ${unitDefinition.battleUnitId}:${skillId}`)
      }
      const equipped = getRequiredSkill(skillById, skillId)
      if (equipped.slotType === 'INNATE') {
        throw new Error(`equipped skill must use GENERIC or BLOOM slot: ${skillId}`)
      }
      seenSkillIds.add(skillId)
      unitSkills.push(equipped)
    }
    skillsByUnitId[unit.battleUnitId] = Object.freeze(unitSkills)
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
    skillUsageBooks.set(unit.battleUnitId, createSkillUsageBook(unitSkills))
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
      skillsByUnitId: Object.freeze({ ...skillsByUnitId }),
      schedules,
      waitStates,
      skillUsageBooks,
      recentPositionIds,
      aiConfigurations: freezeAiConfigurations(definition, units),
      guardShares: validateGuardShares(definition.guardShares ?? [], units),
    }),
    nextTimelineSequence: initialEvents.length,
  })
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
  nextTimelineSequence: number,
): ExecutedHeadlessAction {
  const actor = getRequiredUnit(battle, decision.actorBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const evaluationInput = createEvaluationInput(battle, actor, actorSpecies, context)
  if (
    !enumerateAiActionCandidates(evaluationInput).some(
      (candidate) => candidate.candidateId === decision.candidate.candidateId,
    )
  ) {
    throw new Error(`skill candidate is no longer legal: ${decision.candidate.candidateId}`)
  }
  const skill = getRequiredSkill(context.skillById, decision.candidate.skillId)
  const resolution = resolveManualSkillAction({
    evaluationInput,
    candidate: decision.candidate,
    actorSchedule: schedule,
    currentTime,
    guardShares: context.guardShares,
    nextTimelineSequence,
    applicationSequenceStart: log.nextSequence,
  })
  const eventTargetBattleUnitId =
    resolution.preview.actualTargetBattleUnitId ??
    resolution.preview.selectedTargetBattleUnitId ??
    resolution.rawPreview.targetResults[0]?.battleUnitId ??
    actor.battleUnitId
  let nextLog = appendBattleEvent(log, {
    kind: 'skill_used',
    virtualTime: currentTime,
    payload: {
      actorBattleUnitId: actor.battleUnitId,
      targetBattleUnitId: eventTargetBattleUnitId,
      skillId: skill.id,
    },
  })

  for (const step of resolution.damageSteps) {
    if (step.resolution.guardShare !== null) {
      nextLog = recordGuardShared(nextLog, {
        virtualTime: currentTime,
        sourceBattleUnitId: actor.battleUnitId,
        skillId: skill.id,
        guardShare: step.resolution.guardShare.guardShare,
        finalDamage: step.resolution.finalDamage,
        retainedDamage: step.resolution.guardShare.retainedDamage,
        redirectedDamage: step.resolution.guardShare.redirectedDamage,
      })
    }
    nextLog = recordRecipientResolution(
      nextLog,
      step.resolution.target,
      actor.battleUnitId,
      skill.id,
      currentTime,
    )
    if (step.resolution.guardShare !== null) {
      nextLog = recordRecipientResolution(
        nextLog,
        step.resolution.guardShare.guard,
        actor.battleUnitId,
        skill.id,
        currentTime,
      )
    }
  }
  for (const movement of resolution.forcedMovementResults) {
    if (movement.success && movement.to !== null) {
      nextLog = recordUnitMoved(nextLog, {
        virtualTime: currentTime,
        battleUnitId: movement.targetBattleUnitId,
        from: movement.from,
        to: movement.to,
      })
    }
  }
  for (const mutation of resolution.effectMutations) {
    nextLog = recordActiveEffectMutation(nextLog, mutation, currentTime)
  }
  for (const defeatRecord of resolution.battle.defeatRecords.slice(
    battle.defeatRecords.length,
  )) {
    nextLog = recordUnitDefeated(nextLog, defeatRecord)
  }
  if (resolution.battle.outcome !== 'ONGOING') {
    nextLog = recordBattleEnded(nextLog, resolution.battle.outcome, currentTime)
  }

  return Object.freeze({
    battle: resolution.battle,
    log: nextLog,
    schedule: resolution.actorSchedule,
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

function isCandidateUsable(
  candidate: AiActionCandidate,
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  context: HeadlessBattleContext,
): boolean {
  if (candidate.kind === 'MOVE') {
    return !isMovementLocked(actor)
  }
  const skill = getRequiredSkill(context.skillById, candidate.skillId)
  if (
    candidate.selectedTargetBattleUnitId === null &&
    resolveSkillReachMethod(skill) !== 'GLOBAL'
  ) {
    return false
  }
  const target =
    candidate.selectedTargetBattleUnitId === null
      ? undefined
      : getRequiredUnit(battle, candidate.selectedTargetBattleUnitId)
  const targetSpecies =
    target === undefined
      ? undefined
      : getRequiredSpecies(context.speciesById, target.speciesId)
  return canUseSkillWithUsageState({
    usageBook: getRequiredSkillUsageBook(context, actor.battleUnitId),
    skill,
    actor,
    actorSpecies,
    target,
    targetSpecies,
  })
}

function createEvaluationInput(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  context: HeadlessBattleContext,
): AiEvaluationInput {
  const availableSkills = getRequiredUnitSkills(context, actor.battleUnitId)
  return Object.freeze({
    battle,
    actorBattleUnitId: actor.battleUnitId,
    speciesById: context.speciesById,
    availableSkills,
    candidateFilter: (candidate: AiActionCandidate) =>
      isCandidateUsable(candidate, battle, actor, actorSpecies, context),
  })
}


function completeHeadlessActionState(
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  decision: RunnerDecision,
  context: HeadlessBattleContext,
): void {
  const skills = getRequiredUnitSkills(context, actor.battleUnitId)
  const usageBook = getRequiredSkillUsageBook(context, actor.battleUnitId)
  context.skillUsageBooks.set(
    actor.battleUnitId,
    completeActorActionSkillUsage(
      usageBook,
      skills,
      decision.kind === 'USE_SKILL' ? decision.candidate.skillId : null,
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
    input: createEvaluationInput(battle, actor, actorSpecies, context),
    currentTime,
    recentActorPositionIds: context.recentPositionIds.get(actor.battleUnitId),
    configuration: context.aiConfigurations[actor.battleUnitId] ?? DEFAULT_AI_CONFIGURATION,
  })
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
  return Object.freeze({
    kind: 'USE_SKILL',
    actorBattleUnitId,
    candidate,
  })
}

function shortId(id: string): string {
  return id.split('.').at(-1) ?? id
}

function slotLabel(slot: SkillSlotType): string {
  switch (slot) {
    case 'INNATE':
      return '固有'
    case 'GENERIC':
      return '汎用'
    case 'BLOOM':
      return '開花'
  }
}

function createBasePreview(
  kind: ManualActionPreview['kind'],
  actionCost: number,
  nextActionTime: BattleTime,
  nextTimelineRank: number | null,
  affectedPositionIds: readonly string[],
  fromPositionId: string | null,
  toPositionId: string | null,
): ManualActionPreview {
  return Object.freeze({
    kind,
    actionCost,
    nextActionTime,
    nextTimelineRank,
    selectedTargetBattleUnitId: null,
    selectedTargetPositionId: toPositionId,
    affectedPositionIds: Object.freeze([...affectedPositionIds]),
    reachMethod: null,
    areaMask: null,
    blockedByBattleUnitId: null,
    actualTargetBattleUnitId: null,
    telegraphDelay: null,
    totalCalculatedDamage: 0,
    totalHpDamage: 0,
    damageRecipients: Object.freeze([]),
    defeatedBattleUnitIds: Object.freeze([]),
    statusChanges: Object.freeze([]),
    forcedMovements: Object.freeze([]),
    fromPositionId,
    toPositionId,
  })
}

function createPreparedManualActions(input: {
  readonly battle: BattleState
  readonly actor: BattleUnitState
  readonly actorSpecies: MonsterSpecies
  readonly schedule: UnitActionSchedule
  readonly currentTime: BattleTime
  readonly decisionResult: AiConfiguredDecisionResult
  readonly context: HeadlessBattleContext
  readonly nextTimelineSequence: number
  readonly applicationSequenceStart: number
}): readonly PreparedManualAction[] {
  const evaluationInput = createEvaluationInput(
    input.battle,
    input.actor,
    input.actorSpecies,
    input.context,
  )
  const recommendedCandidateId =
    input.decisionResult.selected?.preview.candidate.candidateId ??
    MANUAL_WAIT_CANDIDATE_ID
  const prepared: PreparedManualAction[] = []

  for (const candidate of enumerateAiActionCandidates(evaluationInput)) {
    if (candidate.kind === 'USE_SKILL') {
      const skill = getRequiredSkill(input.context.skillById, candidate.skillId)
      const resolution = resolveManualSkillAction({
        evaluationInput,
        candidate,
        actorSchedule: input.schedule,
        currentTime: input.currentTime,
        guardShares: input.context.guardShares,
        nextTimelineSequence: input.nextTimelineSequence,
        applicationSequenceStart: input.applicationSequenceStart,
      })
      const targetLabel =
        candidate.selectedTargetBattleUnitId ??
        (candidate.selectedTargetPosition === null
          ? '対象指定なし'
          : getBoardPositionId(candidate.selectedTargetPosition))
      const actionLabel = `${slotLabel(skill.slotType)} ${shortId(skill.id)}`
      prepared.push(
        Object.freeze({
          decision: Object.freeze({
            kind: 'USE_SKILL',
            actorBattleUnitId: input.actor.battleUnitId,
            candidate,
          }),
          option: Object.freeze({
            candidateId: candidate.candidateId,
            kind: 'USE_SKILL',
            slot: skill.slotType,
            skillId: skill.id,
            actionKey: `skill:${skill.id}`,
            actionLabel,
            targetLabel,
            label: `${actionLabel} → ${targetLabel}`,
            selectedTargetBattleUnitId: candidate.selectedTargetBattleUnitId,
            selectedTargetPositionId:
              candidate.selectedTargetPosition === null
                ? null
                : getBoardPositionId(candidate.selectedTargetPosition),
            recommended: candidate.candidateId === recommendedCandidateId,
            preview: resolution.preview,
          }),
        }),
      )
      continue
    }

    const rawPreview = previewAiActionCandidate(evaluationInput, candidate)
    if (rawPreview.kind !== 'MOVE') {
      throw new Error('move candidate must create a move preview')
    }
    const movement = performNormalMovement({
      battle: input.battle,
      actorBattleUnitId: input.actor.battleUnitId,
      actorSpecies: input.actorSpecies,
      actorSchedule: input.schedule,
      destination: candidate.destination,
      currentTime: input.currentTime,
    })
    const toPositionId = getBoardPositionId(candidate.destination)
    const preview = createBasePreview(
      'MOVE',
      rawPreview.actionCost,
      movement.actorSchedule.nextActionTime,
      getPredictedUnitTurnRank(
        movement.battle,
        movement.actorSchedule,
        input.nextTimelineSequence,
      ),
      rawPreview.affectedPositionIds,
      rawPreview.fromPositionId,
      rawPreview.toPositionId,
    )
    prepared.push(
      Object.freeze({
        decision: Object.freeze({
          kind: 'MOVE',
          actorBattleUnitId: input.actor.battleUnitId,
          destination: candidate.destination,
        }),
        option: Object.freeze({
          candidateId: candidate.candidateId,
          kind: 'MOVE',
          slot: 'MOVE',
          skillId: null,
          actionKey: 'MOVE',
          actionLabel: '通常移動',
          targetLabel: toPositionId,
          label: `移動 → ${toPositionId}`,
          selectedTargetBattleUnitId: null,
          selectedTargetPositionId: toPositionId,
          recommended: candidate.candidateId === recommendedCandidateId,
          preview,
        }),
      }),
    )
  }

  const wait = performWaitAction({
    actor: input.actor,
    actorSpecies: input.actorSpecies,
    actorSchedule: input.schedule,
    currentTime: input.currentTime,
    waitState: getRequiredWaitState(input.context, input.actor.battleUnitId),
  })
  prepared.push(
    Object.freeze({
      decision: Object.freeze({
        kind: 'WAIT',
        actorBattleUnitId: input.actor.battleUnitId,
      }),
      option: Object.freeze({
        candidateId: MANUAL_WAIT_CANDIDATE_ID,
        kind: 'WAIT',
        slot: 'WAIT',
        skillId: null,
        actionKey: 'WAIT',
        actionLabel: '待機',
        targetLabel: null,
        label: '待機',
        selectedTargetBattleUnitId: null,
        selectedTargetPositionId: null,
        recommended: recommendedCandidateId === MANUAL_WAIT_CANDIDATE_ID,
        preview: createBasePreview(
          'WAIT',
          wait.effectiveActionCost,
          wait.actorSchedule.nextActionTime,
          getPredictedUnitTurnRank(
            input.battle,
            wait.actorSchedule,
            input.nextTimelineSequence,
          ),
          [getBoardPositionId(input.actor.position)],
          getBoardPositionId(input.actor.position),
          getBoardPositionId(input.actor.position),
        ),
      }),
    }),
  )
  return Object.freeze(prepared)
}

function createPendingManualAction(
  pending: PendingManualExecution,
): InteractivePendingManualAction {
  return Object.freeze({
    actorBattleUnitId: pending.actor.battleUnitId,
    recommendedCandidateId:
      pending.decisionResult.selected?.preview.candidate.candidateId ??
      MANUAL_WAIT_CANDIDATE_ID,
    options: Object.freeze(pending.preparedActions.map((action) => action.option)),
    reasonLog: pending.decisionResult.log,
  })
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
  private readonly listeners = new Set<InteractiveBattleListener>()

  constructor(definition: HeadlessBattleDefinition) {
    this.maxActions = definition.maxActions ?? DEFAULT_HEADLESS_MAX_ACTIONS
    assertSafeIntegerAtLeast(this.maxActions, 1, 'maxActions')
    const initial = createInitialBattle(definition)
    this.battle = initial.battle
    this.context = initial.context
    this.nextTimelineSequence = initial.nextTimelineSequence
    this.log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, this.battle)
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
          : createPendingManualAction(this.pendingManualExecution),
      lastDecisionLog: this.lastDecisionLog,
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
      const preparedActions = createPreparedManualActions({
        battle: this.battle,
        actor: readyActor,
        actorSpecies,
        schedule,
        currentTime: this.currentVirtualTime,
        decisionResult,
        context: this.context,
        nextTimelineSequence: this.nextTimelineSequence,
        applicationSequenceStart: this.log.nextSequence,
      })
      this.pendingManualExecution = Object.freeze({
        actor: readyActor,
        actorSpecies,
        schedule,
        currentTime: this.currentVirtualTime,
        decisionResult,
        preparedActions,
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

    const prepared = pending.preparedActions.find(
      (action) => action.option.candidateId === candidateId,
    )
    if (prepared === undefined) {
      throw new Error(`manual candidate is not available: ${candidateId}`)
    }
    const reasonLog =
      candidateId === pending.decisionResult.selected?.preview.candidate.candidateId
        ? pending.decisionResult.log
        : null

    this.pendingManualExecution = null
    this.executeDecision(
      pending.actor,
      pending.actorSpecies,
      pending.schedule,
      prepared.decision,
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
    })
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
            this.nextTimelineSequence,
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
      this.battle = registerNextTurn(
        this.battle,
        executed.schedule,
        this.nextTimelineSequence,
      )
      this.nextTimelineSequence += 1
    }
    updateRecentPositionHistory(this.battle, actor.battleUnitId, this.context)
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
): InteractiveBattleRunner {
  return new InteractiveBattleRunnerImpl(definition)
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
