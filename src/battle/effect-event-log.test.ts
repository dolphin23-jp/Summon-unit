import { describe, expect, it } from 'vitest'
import { registerActiveEffect, removeActiveEffect } from './effect-framework'
import {
  EMPTY_BATTLE_EVENT_LOG,
  recordActiveEffectMutation,
  type BattleEventLog,
} from './event-log'

function requireMutation<T extends { readonly mutation: unknown }>(
  update: T,
): Exclude<T['mutation'], null> {
  if (update.mutation === null) {
    throw new Error('expected an active effect mutation')
  }
  return update.mutation as Exclude<T['mutation'], null>
}

describe('active effect battle events', () => {
  it('records apply, merge, and removal with continuous immutable sequences', () => {
    const applied = registerActiveEffect([], {
      effectId: 'effect.poison',
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      strength: 10,
      stacks: 1,
      stackLimit: 5,
      duration: { unit: 'TRIGGERS', remaining: 3 },
      appliedAt: 100,
      applicationSequence: 1,
    })

    let log: BattleEventLog = recordActiveEffectMutation(
      EMPTY_BATTLE_EVENT_LOG,
      requireMutation(applied),
      100,
    )

    const merged = registerActiveEffect(applied.effects, {
      effectId: 'effect.poison',
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      strength: 15,
      stacks: 5,
      stackLimit: 5,
      duration: { unit: 'TRIGGERS', remaining: 4 },
      appliedAt: 120,
      applicationSequence: 2,
    })
    log = recordActiveEffectMutation(log, requireMutation(merged), 120)

    const removed = removeActiveEffect(
      merged.effects,
      merged.effects[0].activeEffectId,
      'DISPELLED',
    )
    log = recordActiveEffectMutation(log, requireMutation(removed), 130)

    expect(log.events.map((event) => event.kind)).toEqual([
      'effect_applied',
      'effect_merged',
      'effect_removed',
    ])
    expect(log.events.map((event) => event.sequence)).toEqual([0, 1, 2])
    expect(log.events.map((event) => event.virtualTime)).toEqual([100, 120, 130])
    expect(log.events[0]).toMatchObject({
      payload: {
        effectId: 'effect.poison',
        strength: 10,
        stacks: 1,
        durationUnit: 'TRIGGERS',
        durationRemaining: 3,
      },
    })
    expect(log.events[1]).toMatchObject({
      payload: {
        previousStrength: 10,
        strength: 15,
        previousStacks: 1,
        stacks: 5,
        previousDurationRemaining: 3,
        durationRemaining: 4,
      },
    })
    expect(log.events[2]).toMatchObject({
      payload: {
        effectId: 'effect.poison',
        reason: 'DISPELLED',
      },
    })
    expect(Object.isFrozen(log)).toBe(true)
    expect(Object.isFrozen(log.events)).toBe(true)
    expect(Object.isFrozen(log.events[0].payload)).toBe(true)
  })
})
