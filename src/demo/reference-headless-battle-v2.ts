import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  createBarrierLayer,
  consumeBarrierLayers,
  getTotalBarrierCapacity,
} from '../battle/barrier'
import { createBattlefieldRegion } from '../battle/battlefield-region'
import { getBoardPositionId } from '../battle/board'
import {
  assertValidBattleState,
  createBattleState,
  resolveBattleUnitDefeat,
  type BattleState,
} from '../battle/defeat-and-victory'
import type {
  ActiveEffectMutation,
  ActiveEffectState,
} from '../battle/effect-framework'
import {
  EMPTY_BATTLE_EVENT_LOG,
  appendBattleEvent,
  recordActiveEffectMutation,
  recordBarrierConsumption,
  recordBattleEnded,
  recordBattleStarted,
  recordUnitDefeated,
  type BattleEventLog,
} from '../battle/event-log'
import {
  applyBurnStatus,
  applyPoisonStatus,
  resolveTurnStartStatusConditions,
  type StatusDamageTrigger,
} from '../battle/status-conditions'
import { summonBattleUnit } from '../battle/summon-and-revive'
import {
  createTelegraphResolveEvent,
  resolveTelegraphEvent,
} from '../battle/telegraph'
import { cancelTimelineEvent } from '../battle/timeline-queue'
import { resolveBattleTimeout, type BattleTimeoutResolution } from '../battle/timeout-resolution'
import {
  createBattleUnitState,
  withBattleUnitHp,
  type BattleUnitId,
  type BattleUnitState,
} from '../battle/unit-state'

export const REFERENCE_V2_TIMES = Object.freeze({
  POISON_APPLIED: 5,
  BURN_APPLIED: 6,
  BARRIER_HIT: 10,
  TELEGRAPH_DECLARED: 15,
  SUMMON: 20,
  TELEGRAPH_RESOLVED: 30,
  POISON_TRIGGERED: 40,
  BURN_TRIGGERED: 50,
  TIMEOUT: 60,
})

export const REFERENCE_V2_SPECIES: readonly MonsterSpecies[] = Object.freeze([
  Object.freeze({
    id: 'species.reference-v2.caster',
    rarity: 3,
    attributeId: 'attribute.wind',
    primarySpeciesId: 'species-group.reference-v2-caster',
    tagIds: Object.freeze([]),
    stats: Object.freeze({ hp: 120, attack: 32, defense: 12, speed: 5 }),
    innateSkillId: 'skill.reference-v2.telegraph',
  }),
  Object.freeze({
    id: 'species.reference-v2.guard',
    rarity: 3,
    attributeId: 'attribute.earth',
    primarySpeciesId: 'species-group.reference-v2-guard',
    tagIds: Object.freeze([]),
    stats: Object.freeze({ hp: 140, attack: 22, defense: 30, speed: 2 }),
    innateSkillId: 'skill.reference-v2.guard-hit',
  }),
  Object.freeze({
    id: 'species.reference-v2.summoner',
    rarity: 3,
    attributeId: 'attribute.fire',
    primarySpeciesId: 'species-group.reference-v2-summoner',
    tagIds: Object.freeze([]),
    stats: Object.freeze({ hp: 130, attack: 28, defense: 18, speed: 3 }),
    innateSkillId: 'skill.reference-v2.summon',
  }),
  Object.freeze({
    id: 'species.reference-v2.victim',
    rarity: 2,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'species-group.reference-v2-victim',
    tagIds: Object.freeze([]),
    stats: Object.freeze({ hp: 100, attack: 18, defense: 10, speed: 2 }),
    innateSkillId: 'skill.reference-v2.victim-hit',
  }),
  Object.freeze({
    id: 'species.reference-v2.minion',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'species-group.reference-v2-minion',
    tagIds: Object.freeze([]),
    stats: Object.freeze({ hp: 60, attack: 16, defense: 8, speed: 4 }),
    innateSkillId: 'skill.reference-v2.minion-hit',
  }),
])

export const REFERENCE_V2_SKILLS: readonly SkillDefinition[] = Object.freeze([
  Object.freeze({
    id: 'skill.reference-v2.telegraph',
    slotType: 'INNATE',
    actionCost: 130,
    targetType: 'SINGLE_ENEMY',
    reachMethod: 'ARC',
    damageMultiplierPermille: 1000,
    telegraphDelay: 15,
  }),
  Object.freeze({
    id: 'skill.reference-v2.guard-hit',
    slotType: 'INNATE',
    actionCost: 100,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  }),
  Object.freeze({
    id: 'skill.reference-v2.summon',
    slotType: 'INNATE',
    actionCost: 120,
    targetType: 'SELF',
    damageMultiplierPermille: 1,
  }),
  Object.freeze({
    id: 'skill.reference-v2.victim-hit',
    slotType: 'INNATE',
    actionCost: 100,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  }),
  Object.freeze({
    id: 'skill.reference-v2.minion-hit',
    slotType: 'INNATE',
    actionCost: 100,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  }),
])

export type ReferenceV2TraceKind =
  | 'POISON_APPLIED'
  | 'BURN_APPLIED'
  | 'BARRIER_ABSORBED'
  | 'TELEGRAPH_DECLARED'
  | 'UNIT_SUMMONED'
  | 'REGION_ENTERED'
  | 'TELEGRAPH_RESOLVED'
  | 'STATUS_TRIGGERED'
  | 'UNIT_DEFEATED'
  | 'TIMEOUT_RESOLVED'

export interface ReferenceV2TraceEvent {
  readonly sequence: number
  readonly virtualTime: number
  readonly kind: ReferenceV2TraceKind
  readonly subjectId: string
  readonly value: number | string | null
}

export interface ReferenceV2UnitSummary {
  readonly battleUnitId: BattleUnitId
  readonly hp: number
  readonly barrierTotal: number
  readonly effectIds: readonly string[]
  readonly defeated: boolean
  readonly positionId: string
}

export interface ReferenceHeadlessBattleV2Summary {
  readonly outcome: BattleTimeoutResolution['outcome']
  readonly timeoutCriterion: BattleTimeoutResolution['decisiveCriterion']
  readonly finalVirtualTime: number
  readonly battleEventCount: number
  readonly traceEventCount: number
  readonly units: readonly ReferenceV2UnitSummary[]
}

export interface ReferenceHeadlessBattleV2Result {
  readonly summary: ReferenceHeadlessBattleV2Summary
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly trace: readonly ReferenceV2TraceEvent[]
  readonly timeoutResolution: BattleTimeoutResolution
}

function getSpecies(id: string): MonsterSpecies {
  const species = REFERENCE_V2_SPECIES.find((candidate) => candidate.id === id)
  if (species === undefined) {
    throw new Error(`reference v2 species is missing: ${id}`)
  }
  return species
}

function getSkill(id: string): SkillDefinition {
  const skill = REFERENCE_V2_SKILLS.find((candidate) => candidate.id === id)
  if (skill === undefined) {
    throw new Error(`reference v2 skill is missing: ${id}`)
  }
  return skill
}

function getUnit(battle: BattleState, battleUnitId: BattleUnitId): BattleUnitState {
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`reference v2 unit is missing: ${battleUnitId}`)
  }
  return unit
}

function replaceUnit(battle: BattleState, updatedUnit: BattleUnitState): BattleState {
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

function replaceTimeline(battle: BattleState, timeline: BattleState['timeline']): BattleState {
  const nextBattle: BattleState = Object.freeze({ ...battle, timeline })
  assertValidBattleState(nextBattle)
  return nextBattle
}

function appendTrace(
  trace: ReferenceV2TraceEvent[],
  virtualTime: number,
  kind: ReferenceV2TraceKind,
  subjectId: string,
  value: number | string | null,
): void {
  trace.push(
    Object.freeze({
      sequence: trace.length,
      virtualTime,
      kind,
      subjectId,
      value,
    }),
  )
}

function recordMutations(
  log: BattleEventLog,
  mutations: readonly ActiveEffectMutation[],
  virtualTime: number,
): BattleEventLog {
  return mutations.reduce(
    (current, mutation) => recordActiveEffectMutation(current, mutation, virtualTime),
    log,
  )
}

function getDurationMutation(trigger: StatusDamageTrigger): ActiveEffectMutation | null {
  if (trigger.durationChange !== null) {
    return Object.freeze({
      kind: 'MERGED',
      before: trigger.durationChange.before,
      after: trigger.durationChange.after,
    })
  }
  return trigger.removalMutation
}

function applyStatusTrigger(
  battle: BattleState,
  log: BattleEventLog,
  targetBattleUnitId: BattleUnitId,
  virtualTime: number,
  trace: ReferenceV2TraceEvent[],
): { readonly battle: BattleState; readonly log: BattleEventLog } {
  const target = getUnit(battle, targetBattleUnitId)
  const species = getSpecies(target.speciesId)
  const resolution = resolveTurnStartStatusConditions(target, species)
  let nextLog = log

  for (const trigger of resolution.triggers) {
    nextLog = appendBattleEvent(nextLog, {
      kind: 'damage_applied',
      virtualTime,
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
    const mutation = getDurationMutation(trigger)
    if (mutation !== null) {
      nextLog = recordActiveEffectMutation(nextLog, mutation, virtualTime)
    }
    appendTrace(
      trace,
      virtualTime,
      'STATUS_TRIGGERED',
      trigger.targetBattleUnitId,
      `${trigger.statusId}:${trigger.appliedDamage}`,
    )
  }

  if (!resolution.state.defeated) {
    return Object.freeze({
      battle: replaceUnit(battle, resolution.state),
      log: nextLog,
    })
  }

  const nextBattle = resolveBattleUnitDefeat({
    battle,
    defeatedUnit: resolution.state,
    killerBattleUnitId:
      resolution.triggers.at(-1)?.sourceBattleUnitId === targetBattleUnitId
        ? null
        : resolution.triggers.at(-1)?.sourceBattleUnitId ?? null,
    currentTime: virtualTime,
  })
  const record = nextBattle.defeatRecords.at(-1)
  if (record === undefined) {
    throw new Error('reference v2 status defeat must create a defeat record')
  }
  nextLog = recordUnitDefeated(nextLog, record)
  appendTrace(trace, virtualTime, 'UNIT_DEFEATED', targetBattleUnitId, record.killerBattleUnitId)
  return Object.freeze({ battle: nextBattle, log: nextLog })
}

function summarizeUnits(battle: BattleState): readonly ReferenceV2UnitSummary[] {
  return Object.freeze(
    battle.units
      .map((unit) =>
        Object.freeze({
          battleUnitId: unit.battleUnitId,
          hp: unit.hp,
          barrierTotal: getTotalBarrierCapacity(unit.barriers),
          effectIds: Object.freeze(
            unit.effects.map((effect: ActiveEffectState) => effect.effectId).sort(),
          ),
          defeated: unit.defeated,
          positionId: getBoardPositionId(unit.position),
        }),
      )
      .sort((left, right) => left.battleUnitId.localeCompare(right.battleUnitId)),
  )
}

export function runReferenceHeadlessBattleV2(): ReferenceHeadlessBattleV2Result {
  const allyCaster = createBattleUnitState(getSpecies('species.reference-v2.caster'), {
    battleUnitId: 'ally.caster',
    position: { side: 'ALLY', row: 0, column: 0 },
  })
  const allyGuard = createBattleUnitState(getSpecies('species.reference-v2.guard'), {
    battleUnitId: 'ally.guard',
    position: { side: 'ALLY', row: 0, column: 1 },
    initialBarriers: [
      createBarrierLayer({
        barrierLayerId: 'barrier.reference-v2.guard',
        sourceBattleUnitId: 'ally.caster',
        targetBattleUnitId: 'ally.guard',
        capacity: 25,
        applicationSequence: 0,
      }),
    ],
  })
  const enemySummoner = createBattleUnitState(
    getSpecies('species.reference-v2.summoner'),
    {
      battleUnitId: 'enemy.summoner',
      position: { side: 'ENEMY', row: 0, column: 0 },
    },
  )
  const enemyVictim = createBattleUnitState(getSpecies('species.reference-v2.victim'), {
    battleUnitId: 'enemy.victim',
    position: { side: 'ENEMY', row: 0, column: 2 },
  })

  let battle = createBattleState({
    units: [allyCaster, allyGuard, enemySummoner, enemyVictim],
  })
  let log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, battle)
  const trace: ReferenceV2TraceEvent[] = []

  const poison = applyPoisonStatus({
    target: getUnit(battle, 'enemy.victim'),
    targetSpecies: getSpecies('species.reference-v2.victim'),
    sourceBattleUnitId: 'ally.caster',
    currentTime: REFERENCE_V2_TIMES.POISON_APPLIED,
    applicationSequence: 0,
    damagePerStack: 50,
    stacks: 2,
    triggerCount: 1,
  })
  battle = replaceUnit(battle, poison.state)
  log = recordMutations(log, poison.mutations, REFERENCE_V2_TIMES.POISON_APPLIED)
  appendTrace(
    trace,
    REFERENCE_V2_TIMES.POISON_APPLIED,
    'POISON_APPLIED',
    'enemy.victim',
    2,
  )

  const burn = applyBurnStatus({
    target: getUnit(battle, 'ally.guard'),
    targetSpecies: getSpecies('species.reference-v2.guard'),
    sourceBattleUnitId: 'enemy.summoner',
    currentTime: REFERENCE_V2_TIMES.BURN_APPLIED,
    applicationSequence: 10,
    damagePerTrigger: 6,
    triggerCount: 1,
  })
  battle = replaceUnit(battle, burn.state)
  log = recordMutations(log, burn.mutations, REFERENCE_V2_TIMES.BURN_APPLIED)
  appendTrace(trace, REFERENCE_V2_TIMES.BURN_APPLIED, 'BURN_APPLIED', 'ally.guard', 6)

  const guardBefore = getUnit(battle, 'ally.guard')
  const barrier = consumeBarrierLayers(guardBefore.barriers, 20)
  const guardAfter = Object.freeze({ ...guardBefore, barriers: barrier.barriers })
  battle = replaceUnit(battle, guardAfter)
  for (const consumption of barrier.consumptions) {
    log = recordBarrierConsumption(log, {
      virtualTime: REFERENCE_V2_TIMES.BARRIER_HIT,
      sourceBattleUnitId: 'enemy.summoner',
      targetBattleUnitId: 'ally.guard',
      skillId: null,
      consumption,
    })
  }
  appendTrace(
    trace,
    REFERENCE_V2_TIMES.BARRIER_HIT,
    'BARRIER_ABSORBED',
    'ally.guard',
    barrier.absorbedDamage,
  )

  const telegraphTarget = Object.freeze({ side: 'ENEMY' as const, row: 1 as const, column: 1 as const })
  const telegraphEvent = createTelegraphResolveEvent({
    telegraphId: 'telegraph.reference-v2',
    sourceBattleUnitId: 'ally.caster',
    skill: getSkill('skill.reference-v2.telegraph'),
    targetPositions: [telegraphTarget],
    currentTime: REFERENCE_V2_TIMES.TELEGRAPH_DECLARED,
    sequence: 0,
  })
  battle = replaceTimeline(battle, {
    events: Object.freeze([telegraphEvent]),
  })
  appendTrace(
    trace,
    REFERENCE_V2_TIMES.TELEGRAPH_DECLARED,
    'TELEGRAPH_DECLARED',
    telegraphEvent.payload.telegraphId,
    getBoardPositionId(telegraphTarget),
  )

  const region = createBattlefieldRegion({
    battlefieldRegionId: 'region.reference-v2.summon-cell',
    effectId: 'effect.region.reference-v2',
    sourceBattleUnitId: 'ally.caster',
    positions: [telegraphTarget],
    createdAt: REFERENCE_V2_TIMES.TELEGRAPH_DECLARED,
    duration: 100,
  })
  const summon = summonBattleUnit({
    battle,
    summonerBattleUnitId: 'enemy.summoner',
    summonedBattleUnitId: 'enemy.minion',
    summonedSpecies: getSpecies('species.reference-v2.minion'),
    destination: telegraphTarget,
    currentTime: REFERENCE_V2_TIMES.SUMMON,
    initialActionCost: 100,
    tiePriority: 10,
    regions: [region],
  })
  battle = summon.battle
  appendTrace(trace, REFERENCE_V2_TIMES.SUMMON, 'UNIT_SUMMONED', 'enemy.minion', summon.summonedSchedule.nextActionTime)
  for (const entry of summon.regionEntries) {
    appendTrace(
      trace,
      entry.triggeredAt,
      'REGION_ENTERED',
      entry.battlefieldRegionId,
      entry.battleUnitId,
    )
  }

  const telegraph = resolveTelegraphEvent({ event: telegraphEvent, battle })
  if (telegraph.hitBattleUnitIds.join(',') !== 'enemy.minion') {
    throw new Error('reference v2 telegraph must hit the summoned minion')
  }
  battle = replaceTimeline(
    battle,
    cancelTimelineEvent(battle.timeline, telegraphEvent.id).queue,
  )
  const minionBefore = getUnit(battle, 'enemy.minion')
  const minionAfter = withBattleUnitHp(
    minionBefore,
    getSpecies('species.reference-v2.minion'),
    minionBefore.hp - 30,
  )
  battle = replaceUnit(battle, minionAfter)
  log = appendBattleEvent(log, {
    kind: 'damage_applied',
    virtualTime: REFERENCE_V2_TIMES.TELEGRAPH_RESOLVED,
    payload: {
      sourceBattleUnitId: 'ally.caster',
      targetBattleUnitId: 'enemy.minion',
      skillId: 'skill.reference-v2.telegraph',
      calculatedDamage: 30,
      appliedDamage: 30,
      hpBefore: minionBefore.hp,
      hpAfter: minionAfter.hp,
    },
  })
  appendTrace(
    trace,
    REFERENCE_V2_TIMES.TELEGRAPH_RESOLVED,
    'TELEGRAPH_RESOLVED',
    telegraph.telegraphId,
    telegraph.hitBattleUnitIds.join(','),
  )

  const poisonTrigger = applyStatusTrigger(
    battle,
    log,
    'enemy.victim',
    REFERENCE_V2_TIMES.POISON_TRIGGERED,
    trace,
  )
  battle = poisonTrigger.battle
  log = poisonTrigger.log

  const burnTrigger = applyStatusTrigger(
    battle,
    log,
    'ally.guard',
    REFERENCE_V2_TIMES.BURN_TRIGGERED,
    trace,
  )
  battle = burnTrigger.battle
  log = burnTrigger.log

  const maxHpByBattleUnitId = Object.freeze(
    Object.fromEntries(
      battle.units.map((unit) => [unit.battleUnitId, getSpecies(unit.speciesId).stats.hp]),
    ),
  )
  const timeoutResolution = resolveBattleTimeout({
    battle,
    log,
    maxHpByBattleUnitId,
  })
  log = recordBattleEnded(
    log,
    timeoutResolution.outcome,
    REFERENCE_V2_TIMES.TIMEOUT,
  )
  appendTrace(
    trace,
    REFERENCE_V2_TIMES.TIMEOUT,
    'TIMEOUT_RESOLVED',
    timeoutResolution.decisiveCriterion,
    timeoutResolution.outcome,
  )

  const frozenTrace = Object.freeze([...trace])
  const summary: ReferenceHeadlessBattleV2Summary = Object.freeze({
    outcome: timeoutResolution.outcome,
    timeoutCriterion: timeoutResolution.decisiveCriterion,
    finalVirtualTime: REFERENCE_V2_TIMES.TIMEOUT,
    battleEventCount: log.events.length,
    traceEventCount: frozenTrace.length,
    units: summarizeUnits(battle),
  })
  return Object.freeze({
    summary,
    battle,
    log,
    trace: frozenTrace,
    timeoutResolution,
  })
}

export function formatReferenceHeadlessBattleV2(
  result: ReferenceHeadlessBattleV2Result,
): string {
  return JSON.stringify(
    {
      summary: result.summary,
      timeoutResolution: result.timeoutResolution,
      trace: result.trace,
      events: result.log.events,
    },
    null,
    2,
  )
}
