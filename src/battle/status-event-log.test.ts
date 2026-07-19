import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import {
  EMPTY_BATTLE_EVENT_LOG,
  appendBattleEvent,
  recordActiveEffectMutation,
  type BattleEventLog,
} from './event-log'
import {
  applyPoisonStatus,
  resolveTurnStartStatusConditions,
} from './status-conditions'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.status-log',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 50, attack: 10, defense: 999, speed: 2 }),
  innateSkillId: 'skill.status-log',
})

describe('status condition event logging', () => {
  it('records damage and duration progress with continuous immutable events', () => {
    const target = createBattleUnitState(species, {
      battleUnitId: 'enemy.target',
      position: { side: 'ENEMY', row: 0, column: 1 },
    })
    const poisoned = applyPoisonStatus({
      target,
      targetSpecies: species,
      sourceBattleUnitId: 'ally.source',
      damagePerStack: 5,
      triggerCount: 2,
      currentTime: 0,
      applicationSequence: 1,
    }).state
    const resolved = resolveTurnStartStatusConditions(poisoned, species)
    const trigger = resolved.triggers[0]
    if (trigger.durationChange === null) {
      throw new Error('expected poison duration progress')
    }

    let log: BattleEventLog = appendBattleEvent(EMPTY_BATTLE_EVENT_LOG, {
      kind: 'damage_applied',
      virtualTime: 100,
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
    log = recordActiveEffectMutation(
      log,
      Object.freeze({
        kind: 'MERGED',
        before: trigger.durationChange.before,
        after: trigger.durationChange.after,
      }),
      100,
    )

    expect(log.events.map((event) => event.kind)).toEqual([
      'damage_applied',
      'effect_merged',
    ])
    expect(log.events.map((event) => event.sequence)).toEqual([0, 1])
    expect(log.events[1]).toMatchObject({
      payload: {
        effectId: 'effect.status.poison',
        previousDurationRemaining: 2,
        durationRemaining: 1,
      },
    })
    expect(Object.isFrozen(log)).toBe(true)
    expect(Object.isFrozen(log.events)).toBe(true)
    expect(Object.isFrozen(log.events[0].payload)).toBe(true)
  })
})
