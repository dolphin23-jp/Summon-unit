import { describe, expect, it } from 'vitest'
import type { BoardPosition } from './board'
import { getBoardPositionId } from './board'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  createInitialUnitActionSchedule,
  createOrderedUnitTurnEvents,
  createUnitTurnEvent,
  registerUnitTurnEvent,
  type UnitActionSchedule,
  type UnitTurnEventPayload,
} from './action-scheduling'
import {
  assertValidBattleState,
  createBattleState,
  resolveBattleUnitDefeat,
  type BattleState,
} from './defeat-and-victory'
import {
  assertValidBattleEventLog,
  createBattleEventLog,
  recordBattleStarted,
  recordSingleTargetSkillResolution,
  recordTurnStarted,
  type BattleEventLog,
} from './event-log'
import { useSingleTargetInnateSkill } from './single-target-damage'
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

interface ReferenceUnitDefinition {
  readonly battleUnitId: BattleUnitId
  readonly sourceInstanceId: string
  readonly speciesId: string
  readonly position: BoardPosition
}

interface ReferenceSnapshot {
  readonly outcome: BattleState['outcome']
  readonly units: readonly {
    readonly battleUnitId: BattleUnitId
    readonly speciesId: string
    readonly hp: number
    readonly defeated: boolean
  }[]
  readonly occupancy: readonly {
    readonly battleUnitId: BattleUnitId
    readonly positionId: string
  }[]
  readonly defeatRecords: BattleState['defeatRecords']
  readonly timeline: readonly {
    readonly id: string
    readonly time: number
    readonly priority: number
    readonly sequence: number
    readonly kind: string
    readonly battleUnitId: BattleUnitId
    readonly actionCount: number
    readonly lastActionTime: number
    readonly tiePriority: number
  }[]
  readonly events: BattleEventLog['events']
}

const REFERENCE_INITIAL_ACTION_COST = 100
const REFERENCE_TIE_PRIORITY = 0
const REFERENCE_MAX_TURNS = 10

function freezeSpecies(species: MonsterSpecies): MonsterSpecies {
  return Object.freeze({
    ...species,
    tagIds: Object.freeze([...species.tagIds]),
    stats: Object.freeze({ ...species.stats }),
  })
}

function freezeSkill(skill: SkillDefinition): SkillDefinition {
  return Object.freeze({ ...skill })
}

const REFERENCE_SKILLS: Readonly<Record<string, SkillDefinition>> = Object.freeze({
  'skill.reference.blade-slash': freezeSkill({
    id: 'skill.reference.blade-slash',
    slotType: 'INNATE',
    actionCost: REFERENCE_INITIAL_ACTION_COST,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  }),
  'skill.reference.decoy-tap': freezeSkill({
    id: 'skill.reference.decoy-tap',
    slotType: 'INNATE',
    actionCost: REFERENCE_INITIAL_ACTION_COST,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  }),
  'skill.reference.guard-bump': freezeSkill({
    id: 'skill.reference.guard-bump',
    slotType: 'INNATE',
    actionCost: REFERENCE_INITIAL_ACTION_COST,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  }),
  'skill.reference.raptor-bite': freezeSkill({
    id: 'skill.reference.raptor-bite',
    slotType: 'INNATE',
    actionCost: REFERENCE_INITIAL_ACTION_COST,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  }),
})

const REFERENCE_SPECIES: Readonly<Record<string, MonsterSpecies>> = Object.freeze({
  'species.reference.blade': freezeSpecies({
    id: 'species.reference.blade',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'species-group.reference-blade',
    tagIds: ['tag.reference'],
    stats: { hp: 20, attack: 30, defense: 0, speed: 4 },
    innateSkillId: 'skill.reference.blade-slash',
  }),
  'species.reference.decoy': freezeSpecies({
    id: 'species.reference.decoy',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'species-group.reference-decoy',
    tagIds: ['tag.reference'],
    stats: { hp: 20, attack: 1, defense: 0, speed: 1 },
    innateSkillId: 'skill.reference.decoy-tap',
  }),
  'species.reference.guard': freezeSpecies({
    id: 'species.reference.guard',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'species-group.reference-guard',
    tagIds: ['tag.reference'],
    stats: { hp: 20, attack: 1, defense: 0, speed: 2 },
    innateSkillId: 'skill.reference.guard-bump',
  }),
  'species.reference.raptor': freezeSpecies({
    id: 'species.reference.raptor',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'species-group.reference-raptor',
    tagIds: ['tag.reference'],
    stats: { hp: 20, attack: 30, defense: 0, speed: 5 },
    innateSkillId: 'skill.reference.raptor-bite',
  }),
})

const REFERENCE_UNIT_DEFINITIONS: readonly ReferenceUnitDefinition[] = Object.freeze([
  Object.freeze({
    battleUnitId: 'unit.ally.blade.a',
    sourceInstanceId: 'instance.reference.ally.blade.a',
    speciesId: 'species.reference.blade',
    position: Object.freeze({ side: 'ALLY', row: 0, column: 0 }),
  }),
  Object.freeze({
    battleUnitId: 'unit.ally.blade.b',
    sourceInstanceId: 'instance.reference.ally.blade.b',
    speciesId: 'species.reference.blade',
    position: Object.freeze({ side: 'ALLY', row: 0, column: 1 }),
  }),
  Object.freeze({
    battleUnitId: 'unit.ally.decoy',
    sourceInstanceId: 'instance.reference.ally.decoy',
    speciesId: 'species.reference.decoy',
    position: Object.freeze({ side: 'ALLY', row: 0, column: 2 }),
  }),
  Object.freeze({
    battleUnitId: 'unit.enemy.guard',
    sourceInstanceId: 'instance.reference.enemy.guard',
    speciesId: 'species.reference.guard',
    position: Object.freeze({ side: 'ENEMY', row: 0, column: 0 }),
  }),
  Object.freeze({
    battleUnitId: 'unit.enemy.raptor',
    sourceInstanceId: 'instance.reference.enemy.raptor',
    speciesId: 'species.reference.raptor',
    position: Object.freeze({ side: 'ENEMY', row: 0, column: 1 }),
  }),
])

const REFERENCE_TARGETS: Readonly<Record<BattleUnitId, BattleUnitId>> = Object.freeze({
  'unit.ally.blade.a': 'unit.enemy.raptor',
  'unit.ally.blade.b': 'unit.enemy.guard',
  'unit.enemy.raptor': 'unit.ally.decoy',
})

function getRequired<T>(record: Readonly<Record<string, T>>, id: string, field: string): T {
  const value = record[id]
  if (value === undefined) {
    throw new Error(`${field} is missing for ${id}`)
  }
  return value
}

function getUnitById(battle: BattleState, battleUnitId: BattleUnitId): BattleUnitState {
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`battle unit is missing: ${battleUnitId}`)
  }
  return unit
}

function withTimeline(battle: BattleState, timeline: TimelineQueue): BattleState {
  const nextBattle: BattleState = Object.freeze({ ...battle, timeline })
  assertValidBattleState(nextBattle)
  return nextBattle
}

function getUnitTurnPayload(event: ScheduledEvent): UnitTurnEventPayload {
  if (event.kind !== 'UNIT_TURN') {
    throw new Error(`reference scenario only supports UNIT_TURN events: ${event.kind}`)
  }
  return event.payload as UnitTurnEventPayload
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function createReferenceUnits(reverseInputOrder: boolean): readonly BattleUnitState[] {
  const definitions = reverseInputOrder
    ? [...REFERENCE_UNIT_DEFINITIONS].reverse()
    : REFERENCE_UNIT_DEFINITIONS

  return definitions.map((definition) => {
    const species = getRequired(REFERENCE_SPECIES, definition.speciesId, 'species')
    return createBattleUnitState(species, {
      battleUnitId: definition.battleUnitId,
      sourceInstanceId: definition.sourceInstanceId,
      position: definition.position,
    })
  })
}

function createReferenceSchedules(
  units: readonly BattleUnitState[],
): Map<BattleUnitId, UnitActionSchedule> {
  return new Map(
    units.map((unit) => {
      const species = getRequired(REFERENCE_SPECIES, unit.speciesId, 'species')
      return [
        unit.battleUnitId,
        createInitialUnitActionSchedule(
          unit,
          species,
          REFERENCE_INITIAL_ACTION_COST,
          REFERENCE_TIE_PRIORITY,
        ),
      ] as const
    }),
  )
}

function createReferenceSnapshot(battle: BattleState, log: BattleEventLog): ReferenceSnapshot {
  const units = battle.units
    .map((unit) => ({
      battleUnitId: unit.battleUnitId,
      speciesId: unit.speciesId,
      hp: unit.hp,
      defeated: unit.defeated,
    }))
    .sort((left, right) => compareIds(left.battleUnitId, right.battleUnitId))

  const occupancy = battle.occupancy
    .map((occupant) => ({
      battleUnitId: occupant.battleUnitId,
      positionId: getBoardPositionId(occupant.position),
    }))
    .sort((left, right) => compareIds(left.battleUnitId, right.battleUnitId))

  const timeline = battle.timeline.events.map((event) => {
    const payload = getUnitTurnPayload(event)
    return {
      id: event.id,
      time: event.time,
      priority: event.priority,
      sequence: event.sequence,
      kind: event.kind,
      battleUnitId: payload.battleUnitId,
      actionCount: payload.tie.actionCount,
      lastActionTime: payload.tie.lastActionTime,
      tiePriority: payload.tie.tiePriority,
    }
  })

  return {
    outcome: battle.outcome,
    units,
    occupancy,
    defeatRecords: battle.defeatRecords,
    timeline,
    events: log.events,
  }
}

function runReferenceBattle(reverseInputOrder = false): ReferenceSnapshot {
  const units = createReferenceUnits(reverseInputOrder)
  const schedules = createReferenceSchedules(units)
  const initialEvents = createOrderedUnitTurnEvents([...schedules.values()])
  let nextTimelineSequence = initialEvents.length
  let battle = createBattleState({
    units,
    timeline: createTimelineQueue(initialEvents),
  })
  let log = recordBattleStarted(createBattleEventLog(), battle)
  let turnCount = 0

  while (battle.outcome === 'ONGOING') {
    turnCount += 1
    if (turnCount > REFERENCE_MAX_TURNS) {
      throw new Error('reference battle exceeded the maximum scripted turn count')
    }

    const popped = popTimelineEvent(battle.timeline)
    if (popped.event === null) {
      throw new Error('reference battle timeline became empty before battle end')
    }

    battle = withTimeline(battle, popped.queue)
    const event = popped.event
    const payload = getUnitTurnPayload(event)
    const actor = getUnitById(battle, payload.battleUnitId)
    const actorSpecies = getRequired(REFERENCE_SPECIES, actor.speciesId, 'actor species')
    const actorSkill = getRequired(
      REFERENCE_SKILLS,
      actorSpecies.innateSkillId,
      'actor innate skill',
    )
    const actorSchedule = schedules.get(actor.battleUnitId)
    if (actorSchedule === undefined) {
      throw new Error(`actor schedule is missing: ${actor.battleUnitId}`)
    }
    if (actorSchedule.nextActionTime !== event.time) {
      throw new Error(`actor schedule time does not match event time: ${actor.battleUnitId}`)
    }

    const targetBattleUnitId = getRequired(
      REFERENCE_TARGETS,
      actor.battleUnitId,
      'scripted target',
    )
    const target = getUnitById(battle, targetBattleUnitId)
    const targetSpecies = getRequired(REFERENCE_SPECIES, target.speciesId, 'target species')

    log = recordTurnStarted(log, actor.battleUnitId, event.time)
    const skillResult = useSingleTargetInnateSkill({
      actor,
      actorSpecies,
      actorSchedule,
      target,
      targetSpecies,
      skill: actorSkill,
      currentTime: event.time,
    })
    schedules.set(actor.battleUnitId, skillResult.actorSchedule)

    if (!skillResult.target.defeated) {
      throw new Error('every scripted reference hit must defeat its target')
    }

    battle = resolveBattleUnitDefeat({
      battle,
      defeatedUnit: skillResult.target,
      currentTime: event.time,
      killerBattleUnitId: actor.battleUnitId,
    })

    log = recordSingleTargetSkillResolution(log, {
      virtualTime: event.time,
      actorBattleUnitId: actor.battleUnitId,
      targetBattleUnitId: target.battleUnitId,
      skillId: actorSkill.id,
      calculatedDamage: skillResult.calculatedDamage,
      appliedDamage: skillResult.appliedDamage,
      targetHpBefore: target.hp,
      targetHpAfter: skillResult.target.hp,
      outcome: battle.outcome === 'ONGOING' ? undefined : battle.outcome,
    })

    if (battle.outcome === 'ONGOING') {
      const nextEvent = createUnitTurnEvent(skillResult.actorSchedule, nextTimelineSequence)
      nextTimelineSequence += 1
      battle = withTimeline(battle, registerUnitTurnEvent(battle.timeline, nextEvent))
    }
  }

  assertValidBattleState(battle)
  assertValidBattleEventLog(log)
  return createReferenceSnapshot(battle, log)
}

const REFERENCE_SNAPSHOT: ReferenceSnapshot = {
  outcome: 'ALLY_VICTORY',
  units: [
    {
      battleUnitId: 'unit.ally.blade.a',
      speciesId: 'species.reference.blade',
      hp: 20,
      defeated: false,
    },
    {
      battleUnitId: 'unit.ally.blade.b',
      speciesId: 'species.reference.blade',
      hp: 20,
      defeated: false,
    },
    {
      battleUnitId: 'unit.ally.decoy',
      speciesId: 'species.reference.decoy',
      hp: 0,
      defeated: true,
    },
    {
      battleUnitId: 'unit.enemy.guard',
      speciesId: 'species.reference.guard',
      hp: 0,
      defeated: true,
    },
    {
      battleUnitId: 'unit.enemy.raptor',
      speciesId: 'species.reference.raptor',
      hp: 0,
      defeated: true,
    },
  ],
  occupancy: [
    { battleUnitId: 'unit.ally.blade.a', positionId: 'ALLY:0:0' },
    { battleUnitId: 'unit.ally.blade.b', positionId: 'ALLY:0:1' },
  ],
  defeatRecords: [
    {
      defeatedBattleUnitId: 'unit.ally.decoy',
      killerBattleUnitId: 'unit.enemy.raptor',
      defeatedAt: 20_000,
    },
    {
      defeatedBattleUnitId: 'unit.enemy.raptor',
      killerBattleUnitId: 'unit.ally.blade.a',
      defeatedAt: 25_000,
    },
    {
      defeatedBattleUnitId: 'unit.enemy.guard',
      killerBattleUnitId: 'unit.ally.blade.b',
      defeatedAt: 25_000,
    },
  ],
  timeline: [
    {
      id: 'unit-turn:unit.ally.blade.a',
      time: 50_000,
      priority: 0,
      sequence: 6,
      kind: 'UNIT_TURN',
      battleUnitId: 'unit.ally.blade.a',
      actionCount: 1,
      lastActionTime: 25_000,
      tiePriority: 0,
    },
  ],
  events: [
    {
      id: 'battle-event:0',
      kind: 'battle_started',
      sequence: 0,
      virtualTime: 0,
      payload: {
        allyBattleUnitIds: [
          'unit.ally.blade.a',
          'unit.ally.blade.b',
          'unit.ally.decoy',
        ],
        enemyBattleUnitIds: ['unit.enemy.guard', 'unit.enemy.raptor'],
      },
    },
    {
      id: 'battle-event:1',
      kind: 'turn_started',
      sequence: 1,
      virtualTime: 20_000,
      payload: { battleUnitId: 'unit.enemy.raptor' },
    },
    {
      id: 'battle-event:2',
      kind: 'skill_used',
      sequence: 2,
      virtualTime: 20_000,
      payload: {
        actorBattleUnitId: 'unit.enemy.raptor',
        targetBattleUnitId: 'unit.ally.decoy',
        skillId: 'skill.reference.raptor-bite',
      },
    },
    {
      id: 'battle-event:3',
      kind: 'damage_applied',
      sequence: 3,
      virtualTime: 20_000,
      payload: {
        sourceBattleUnitId: 'unit.enemy.raptor',
        targetBattleUnitId: 'unit.ally.decoy',
        skillId: 'skill.reference.raptor-bite',
        calculatedDamage: 30,
        appliedDamage: 20,
        hpBefore: 20,
        hpAfter: 0,
      },
    },
    {
      id: 'battle-event:4',
      kind: 'unit_defeated',
      sequence: 4,
      virtualTime: 20_000,
      payload: {
        defeatedBattleUnitId: 'unit.ally.decoy',
        killerBattleUnitId: 'unit.enemy.raptor',
      },
    },
    {
      id: 'battle-event:5',
      kind: 'turn_started',
      sequence: 5,
      virtualTime: 25_000,
      payload: { battleUnitId: 'unit.ally.blade.a' },
    },
    {
      id: 'battle-event:6',
      kind: 'skill_used',
      sequence: 6,
      virtualTime: 25_000,
      payload: {
        actorBattleUnitId: 'unit.ally.blade.a',
        targetBattleUnitId: 'unit.enemy.raptor',
        skillId: 'skill.reference.blade-slash',
      },
    },
    {
      id: 'battle-event:7',
      kind: 'damage_applied',
      sequence: 7,
      virtualTime: 25_000,
      payload: {
        sourceBattleUnitId: 'unit.ally.blade.a',
        targetBattleUnitId: 'unit.enemy.raptor',
        skillId: 'skill.reference.blade-slash',
        calculatedDamage: 30,
        appliedDamage: 20,
        hpBefore: 20,
        hpAfter: 0,
      },
    },
    {
      id: 'battle-event:8',
      kind: 'unit_defeated',
      sequence: 8,
      virtualTime: 25_000,
      payload: {
        defeatedBattleUnitId: 'unit.enemy.raptor',
        killerBattleUnitId: 'unit.ally.blade.a',
      },
    },
    {
      id: 'battle-event:9',
      kind: 'turn_started',
      sequence: 9,
      virtualTime: 25_000,
      payload: { battleUnitId: 'unit.ally.blade.b' },
    },
    {
      id: 'battle-event:10',
      kind: 'skill_used',
      sequence: 10,
      virtualTime: 25_000,
      payload: {
        actorBattleUnitId: 'unit.ally.blade.b',
        targetBattleUnitId: 'unit.enemy.guard',
        skillId: 'skill.reference.blade-slash',
      },
    },
    {
      id: 'battle-event:11',
      kind: 'damage_applied',
      sequence: 11,
      virtualTime: 25_000,
      payload: {
        sourceBattleUnitId: 'unit.ally.blade.b',
        targetBattleUnitId: 'unit.enemy.guard',
        skillId: 'skill.reference.blade-slash',
        calculatedDamage: 30,
        appliedDamage: 20,
        hpBefore: 20,
        hpAfter: 0,
      },
    },
    {
      id: 'battle-event:12',
      kind: 'unit_defeated',
      sequence: 12,
      virtualTime: 25_000,
      payload: {
        defeatedBattleUnitId: 'unit.enemy.guard',
        killerBattleUnitId: 'unit.ally.blade.b',
      },
    },
    {
      id: 'battle-event:13',
      kind: 'battle_ended',
      sequence: 13,
      virtualTime: 25_000,
      payload: { outcome: 'ALLY_VICTORY' },
    },
  ],
}

describe('deterministic reference battle', () => {
  it('matches the readable reference state and complete event sequence', () => {
    expect(runReferenceBattle()).toEqual(REFERENCE_SNAPSHOT)
  })

  it('produces the exact same state and events across 100 fresh runs', () => {
    for (let runIndex = 0; runIndex < 100; runIndex += 1) {
      const reverseInputOrder = runIndex % 2 === 1
      expect(
        runReferenceBattle(reverseInputOrder),
        `reference run ${runIndex + 1} with ${reverseInputOrder ? 'reversed' : 'canonical'} input order`,
      ).toEqual(REFERENCE_SNAPSHOT)
    }
  })

  it('does not retain state between invocations or depend on earlier test execution', () => {
    const first = runReferenceBattle()
    const second = runReferenceBattle(true)

    expect(first).toEqual(REFERENCE_SNAPSHOT)
    expect(second).toEqual(REFERENCE_SNAPSHOT)
    expect(second).not.toBe(first)
    expect(second.events).not.toBe(first.events)
    expect(second.units).not.toBe(first.units)
  })
})
