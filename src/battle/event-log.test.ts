import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { createBattleState } from './defeat-and-victory'
import {
  EMPTY_BATTLE_EVENT_LOG,
  appendBattleEvent,
  assertValidBattleEventLog,
  createBattleEventLog,
  getBattleEventId,
  recordBattleEnded,
  recordBattleStarted,
  recordSingleTargetSkillResolution,
  recordTurnStarted,
  recordUnitDefeated,
  type BattleEvent,
} from './event-log'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.log-wolf',
  rarity: 2,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze(['tag.beast']),
  innateSkillId: 'skill.log-bite',
  stats: Object.freeze({ hp: 120, attack: 30, defense: 20, speed: 3 }),
})

function createUnit(
  battleUnitId: string,
  side: 'ALLY' | 'ENEMY',
  column: 0 | 1 | 2,
) {
  return createBattleUnitState(species, {
    battleUnitId,
    position: { side, row: 0, column },
  })
}

function createBattle() {
  return createBattleState({
    units: [
      createUnit('ally.z', 'ALLY', 1),
      createUnit('enemy.b', 'ENEMY', 1),
      createUnit('ally.a', 'ALLY', 0),
      createUnit('enemy.a', 'ENEMY', 0),
    ],
  })
}

describe('battle event log', () => {
  it('records battle_started first with stable fixed-id ordering and immutable snapshots', () => {
    const battle = createBattle()
    const battleSnapshot = structuredClone(battle)
    const log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, battle)

    expect(log).toEqual({
      nextSequence: 1,
      events: [
        {
          id: 'battle-event:0',
          kind: 'battle_started',
          sequence: 0,
          virtualTime: 0,
          payload: {
            allyBattleUnitIds: ['ally.a', 'ally.z'],
            enemyBattleUnitIds: ['enemy.a', 'enemy.b'],
          },
        },
      ],
    })
    expect(Object.isFrozen(log)).toBe(true)
    expect(Object.isFrozen(log.events)).toBe(true)
    expect(Object.isFrozen(log.events[0].payload)).toBe(true)
    expect(battle).toEqual(battleSnapshot)
  })

  it('assigns continuous event ids and sequence numbers in state-change order', () => {
    let log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, createBattle())
    log = recordTurnStarted(log, 'ally.a', 20_000)
    log = recordSingleTargetSkillResolution(log, {
      virtualTime: 20_000,
      actorBattleUnitId: 'ally.a',
      targetBattleUnitId: 'enemy.a',
      skillId: 'skill.log-bite',
      calculatedDamage: 150,
      appliedDamage: 120,
      targetHpBefore: 120,
      targetHpAfter: 0,
      outcome: 'ALLY_VICTORY',
    })

    expect(log.events.map((event) => event.kind)).toEqual([
      'battle_started',
      'turn_started',
      'skill_used',
      'damage_applied',
      'unit_defeated',
      'battle_ended',
    ])
    expect(log.events.map((event) => event.sequence)).toEqual([0, 1, 2, 3, 4, 5])
    expect(log.events.map((event) => event.id)).toEqual([
      'battle-event:0',
      'battle-event:1',
      'battle-event:2',
      'battle-event:3',
      'battle-event:4',
      'battle-event:5',
    ])
    expect(log.events.map((event) => event.virtualTime)).toEqual([
      0,
      20_000,
      20_000,
      20_000,
      20_000,
      20_000,
    ])
    expect(log.nextSequence).toBe(6)
    expect(log.events[3]).toMatchObject({
      kind: 'damage_applied',
      payload: {
        calculatedDamage: 150,
        appliedDamage: 120,
        hpBefore: 120,
        hpAfter: 0,
      },
    })
  })

  it('records only skill and damage events for a non-defeating hit', () => {
    const started = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, createBattle())
    const resolved = recordSingleTargetSkillResolution(started, {
      virtualTime: 10_000,
      actorBattleUnitId: 'ally.a',
      targetBattleUnitId: 'enemy.a',
      skillId: 'skill.log-bite',
      calculatedDamage: 25,
      appliedDamage: 25,
      targetHpBefore: 120,
      targetHpAfter: 95,
    })

    expect(resolved.events.map((event) => event.kind)).toEqual([
      'battle_started',
      'skill_used',
      'damage_applied',
    ])
  })

  it('allows a self-target skill event for generalized manual commands', () => {
    const started = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, createBattle())
    const next = appendBattleEvent(started, {
      kind: 'skill_used',
      virtualTime: 10_000,
      payload: {
        actorBattleUnitId: 'ally.a',
        targetBattleUnitId: 'ally.a',
        skillId: 'skill.log-guard',
      },
    })

    expect(next.events.at(-1)).toMatchObject({
      kind: 'skill_used',
      payload: {
        actorBattleUnitId: 'ally.a',
        targetBattleUnitId: 'ally.a',
      },
    })
  })

  it('can record environmental defeat and battle end separately', () => {
    let log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, createBattle())
    log = recordUnitDefeated(log, {
      defeatedBattleUnitId: 'enemy.a',
      killerBattleUnitId: null,
      defeatedAt: 30_000,
    })
    log = recordBattleEnded(log, 'ALLY_VICTORY', 30_000)

    expect(log.events.at(-2)).toMatchObject({
      kind: 'unit_defeated',
      payload: {
        defeatedBattleUnitId: 'enemy.a',
        killerBattleUnitId: null,
      },
    })
    expect(log.events.at(-1)).toMatchObject({
      kind: 'battle_ended',
      payload: { outcome: 'ALLY_VICTORY' },
    })
  })

  it('returns identical logs for identical inputs', () => {
    const run = () => {
      let log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, createBattle())
      log = recordTurnStarted(log, 'ally.a', 20_000)
      return recordSingleTargetSkillResolution(log, {
        virtualTime: 20_000,
        actorBattleUnitId: 'ally.a',
        targetBattleUnitId: 'enemy.a',
        skillId: 'skill.log-bite',
        calculatedDamage: 25,
        appliedDamage: 25,
        targetHpBefore: 120,
        targetHpAfter: 95,
      })
    }

    expect(run()).toEqual(run())
  })

  it('does not mutate a previous log when appending', () => {
    const initial = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, createBattle())
    const next = recordTurnStarted(initial, 'ally.a', 1)

    expect(initial.events).toHaveLength(1)
    expect(initial.nextSequence).toBe(1)
    expect(next.events).toHaveLength(2)
    expect(next).not.toBe(initial)
  })

  it('rejects virtual time moving backwards', () => {
    const started = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, createBattle(), 100)

    expect(() => recordTurnStarted(started, 'ally.a', 99)).toThrow(
      'battle event virtualTime must not move backwards',
    )
  })

  it('rejects sequence gaps and ids that do not match the sequence', () => {
    const gapEvent: BattleEvent = {
      id: getBattleEventId(1),
      kind: 'turn_started',
      sequence: 1,
      virtualTime: 0,
      payload: { battleUnitId: 'ally.a' },
    }
    const badIdEvent: BattleEvent = {
      ...gapEvent,
      id: 'battle-event:wrong',
      sequence: 0,
    }

    expect(() => createBattleEventLog([gapEvent])).toThrow(
      'battle event sequences must be continuous from 0',
    )
    expect(() => createBattleEventLog([badIdEvent])).toThrow(
      'event.id must match event.sequence',
    )
  })

  it('rejects inconsistent damage and ending a battle after a non-defeating hit', () => {
    const started = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, createBattle())

    expect(() =>
      recordSingleTargetSkillResolution(started, {
        virtualTime: 1,
        actorBattleUnitId: 'ally.a',
        targetBattleUnitId: 'enemy.a',
        skillId: 'skill.log-bite',
        calculatedDamage: 25,
        appliedDamage: 25,
        targetHpBefore: 120,
        targetHpAfter: 96,
      }),
    ).toThrow('targetHpBefore - targetHpAfter must equal appliedDamage')

    expect(() =>
      recordSingleTargetSkillResolution(started, {
        virtualTime: 1,
        actorBattleUnitId: 'ally.a',
        targetBattleUnitId: 'enemy.a',
        skillId: 'skill.log-bite',
        calculatedDamage: 25,
        appliedDamage: 25,
        targetHpBefore: 120,
        targetHpAfter: 95,
        outcome: 'ALLY_VICTORY',
      }),
    ).toThrow('battle outcome can only be recorded after a defeating hit')
  })

  it('validates log nextSequence explicitly', () => {
    expect(() =>
      assertValidBattleEventLog({
        events: [],
        nextSequence: 1,
      }),
    ).toThrow('log.nextSequence must equal log.events.length')
  })

  it('supports direct typed append for a turn event', () => {
    const log = appendBattleEvent(EMPTY_BATTLE_EVENT_LOG, {
      kind: 'turn_started',
      virtualTime: 5,
      payload: { battleUnitId: 'ally.a' },
    })

    expect(log.events[0]).toEqual({
      id: 'battle-event:0',
      kind: 'turn_started',
      sequence: 0,
      virtualTime: 5,
      payload: { battleUnitId: 'ally.a' },
    })
  })
})
