import { describe, expect, it } from 'vitest'
import { consumeBarrierLayers, createBarrierLayer } from './barrier'
import {
  EMPTY_BATTLE_EVENT_LOG,
  recordBarrierConsumption,
  recordGuardShared,
} from './event-log'
import { createGuardShare } from './guard-share'

describe('barrier and guard-share battle events', () => {
  it('records stable guard and barrier events with immutable continuous sequence', () => {
    const guardShare = createGuardShare({
      protectedBattleUnitId: 'ally.target',
      guardBattleUnitId: 'ally.guard',
      sharePermille: 500,
      applicationSequence: 1,
    })
    const barrier = createBarrierLayer({
      sourceBattleUnitId: 'ally.guard',
      targetBattleUnitId: 'ally.target',
      capacity: 30,
      applicationSequence: 2,
    })
    const consumption = consumeBarrierLayers([barrier], 20).consumptions[0]

    let log = recordGuardShared(EMPTY_BATTLE_EVENT_LOG, {
      virtualTime: 100,
      sourceBattleUnitId: 'enemy.attacker',
      skillId: 'skill.strike',
      guardShare,
      finalDamage: 41,
      retainedDamage: 20,
      redirectedDamage: 21,
    })
    log = recordBarrierConsumption(log, {
      virtualTime: 100,
      sourceBattleUnitId: 'enemy.attacker',
      targetBattleUnitId: 'ally.target',
      skillId: 'skill.strike',
      consumption,
    })

    expect(log.events.map((event) => event.kind)).toEqual([
      'guard_shared',
      'barrier_absorbed',
    ])
    expect(log.events.map((event) => event.sequence)).toEqual([0, 1])
    expect(log.events[0]).toMatchObject({
      payload: {
        protectedBattleUnitId: 'ally.target',
        guardBattleUnitId: 'ally.guard',
        finalDamage: 41,
        retainedDamage: 20,
        redirectedDamage: 21,
      },
    })
    expect(log.events[1]).toMatchObject({
      payload: {
        barrierLayerId: barrier.barrierLayerId,
        absorbedDamage: 20,
        remainingCapacityBefore: 30,
        remainingCapacityAfter: 10,
        broken: false,
      },
    })
    expect(Object.isFrozen(log)).toBe(true)
    expect(Object.isFrozen(log.events)).toBe(true)
    expect(Object.isFrozen(log.events[0].payload)).toBe(true)
  })
})
