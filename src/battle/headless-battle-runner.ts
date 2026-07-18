import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  createInitialUnitActionSchedule,
  createOrderedUnitTurnEvents,
  createUnitTurnEvent,
  registerUnitTurnEvent,
  rescheduleUnitActionAfterAction,
  type BattleTime,
  type UnitActionSchedule,
  type UnitTurnEventPayload,
} from './action-scheduling'
import { getBoardPositionId, type BoardPosition } from './board'
import {
  assertValidBattleState,
  createBattleState,
  resolveBattleUnitDefeat,
  type BattleOutcome,
  type BattleState,
} from './defeat-and-victory'
import {
  EMPTY_BATTLE_EVENT_LOG,
  recordBattleStarted,
  recordSingleTargetSkillResolution,
  recordTurnStarted,
  recordUnitMoved,
  type BattleEventLog,
} from './event-log'
import {
  selectMinimalAutoAiAction,
  type MinimalAutoAiDecision,
} from './minimal-auto-ai'
import { performNormalMovement } from './normal-movement'
import { useSingleTargetInnateSkill } from './single-target-damage'
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

export const HEADLESS_INITIAL_ACTION_COST = 100
export const HEADLESS_WAIT_ACTION_COST = 50
export const DEFAULT_HEADLESS_MAX_ACTIONS = 500

export interface HeadlessBattleUnitDefinition {
  readonly battleUnitId: BattleUnitId
  readonly speciesId: string
  readonly position: BoardPosition
  readonly initialHp?: number
  readonly tiePriority: number
}

export interface HeadlessBattleDefinition {
  readonly species: readonly MonsterSpecies[]
  readonly skills: readonly SkillDefinition[]
  readonly units: readonly HeadlessBattleUnitDefinition[]
  readonly initialActionCost?: number
  readonly maxActions?: number
}

export type HeadlessBattleTermination = 'BATTLE_ENDED' | 'ACTION_LIMIT_REACHED'

export interface HeadlessBattleUnitSummary {
  readonly battleUnitId: BattleUnitId
  readonly speciesId: string
  readonly side: BattleUnitState['side']
  readonly hp: number
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

function withTimeline(battle: BattleState, timeline: TimelineQueue): BattleState {
  const nextBattle: BattleState = Object.freeze({
    ...battle,
    timeline,
  })
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
    })
  })

  const initialActionCost = definition.initialActionCost ?? HEADLESS_INITIAL_ACTION_COST
  assertSafeIntegerAtLeast(initialActionCost, 1, 'initialActionCost')

  const schedules = new Map<BattleUnitId, UnitActionSchedule>()
  definition.units.forEach((unitDefinition, index) => {
    assertSafeIntegerAtLeast(unitDefinition.tiePriority, 0, 'tiePriority')
    const unit = units[index]
    const species = getRequiredSpecies(speciesById, unit.speciesId)
    schedules.set(
      unit.battleUnitId,
      createInitialUnitActionSchedule(
        unit,
        species,
        initialActionCost,
        unitDefinition.tiePriority,
      ),
    )
  })

  const initialEvents = createOrderedUnitTurnEvents([...schedules.values()])
  const battle = createBattleState({
    units,
    timeline: createTimelineQueue(initialEvents),
  })

  return Object.freeze({
    battle,
    context: Object.freeze({ speciesById, skillById, schedules }),
    nextTimelineSequence: initialEvents.length,
  })
}

function executeSkillDecision(
  battle: BattleState,
  log: BattleEventLog,
  decision: Extract<MinimalAutoAiDecision, { readonly kind: 'USE_SKILL' }>,
  schedule: UnitActionSchedule,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): {
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly schedule: UnitActionSchedule
} {
  const actor = getRequiredUnit(battle, decision.actorBattleUnitId)
  const target = getRequiredUnit(battle, decision.targetBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
  const skill = getRequiredSkill(context.skillById, decision.skillId)
  const resolution = useSingleTargetInnateSkill({
    actor,
    actorSpecies,
    actorSchedule: schedule,
    target,
    targetSpecies,
    skill,
    currentTime,
  })

  let nextBattle = resolution.target.defeated
    ? resolveBattleUnitDefeat({
        battle,
        defeatedUnit: resolution.target,
        killerBattleUnitId: actor.battleUnitId,
        currentTime,
      })
    : replaceLivingUnit(battle, resolution.target)

  const outcome = nextBattle.outcome === 'ONGOING' ? undefined : nextBattle.outcome
  const nextLog = recordSingleTargetSkillResolution(log, {
    virtualTime: currentTime,
    actorBattleUnitId: actor.battleUnitId,
    targetBattleUnitId: target.battleUnitId,
    skillId: skill.id,
    calculatedDamage: resolution.calculatedDamage,
    appliedDamage: resolution.appliedDamage,
    targetHpBefore: target.hp,
    targetHpAfter: resolution.target.hp,
    outcome,
  })

  nextBattle = withTimeline(nextBattle, nextBattle.timeline)
  return Object.freeze({
    battle: nextBattle,
    log: nextLog,
    schedule: resolution.actorSchedule,
  })
}

function executeMovementDecision(
  battle: BattleState,
  log: BattleEventLog,
  decision: Extract<MinimalAutoAiDecision, { readonly kind: 'MOVE' }>,
  schedule: UnitActionSchedule,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): {
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly schedule: UnitActionSchedule
} {
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
): {
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly schedule: UnitActionSchedule
} {
  const actor = getRequiredUnit(battle, decision.actorBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  return Object.freeze({
    battle,
    log,
    schedule: rescheduleUnitActionAfterAction(
      schedule,
      currentTime,
      HEADLESS_WAIT_ACTION_COST,
      actorSpecies.stats.speed,
    ),
  })
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

    const schedule = context.schedules.get(actor.battleUnitId)
    if (schedule === undefined) {
      throw new Error(`schedule is missing: ${actor.battleUnitId}`)
    }
    if (schedule.nextActionTime !== popped.event.time) {
      throw new Error('scheduled turn time must match the unit schedule')
    }

    finalVirtualTime = popped.event.time
    battle = withTimeline(battle, popped.queue)
    log = recordTurnStarted(log, actor.battleUnitId, finalVirtualTime)

    const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
    const decision = selectMinimalAutoAiAction({
      battle,
      actorBattleUnitId: actor.battleUnitId,
      speciesById: context.speciesById,
      availableDirectSkills: [getRequiredSkill(context.skillById, actorSpecies.innateSkillId)],
    })

    const executed =
      decision.kind === 'USE_SKILL'
        ? executeSkillDecision(battle, log, decision, schedule, finalVirtualTime, context)
        : decision.kind === 'MOVE'
          ? executeMovementDecision(battle, log, decision, schedule, finalVirtualTime, context)
          : executeWaitDecision(battle, log, decision, schedule, finalVirtualTime, context)

    battle = executed.battle
    log = executed.log
    context.schedules.set(actor.battleUnitId, executed.schedule)
    totalActions += 1

    if (battle.outcome === 'ONGOING') {
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
