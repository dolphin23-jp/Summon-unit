import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { createBattleState } from './defeat-and-victory'
import {
  EMPTY_BATTLE_EVENT_LOG,
  appendBattleEvent,
  recordBattleStarted,
} from './event-log'
import { resolveBattleTimeout } from './timeout-resolution'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.timeout',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.timeout',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 2 }),
  innateSkillId: 'skill.timeout',
})

function unit(
  battleUnitId: string,
  side: 'ALLY' | 'ENEMY',
  row: 0 | 1 | 2,
  column: 0 | 1 | 2,
  initialHp = 100,
) {
  return createBattleUnitState(species, {
    battleUnitId,
    position: { side, row, column },
    initialHp,
  })
}

function maxHpMap(ids: readonly string[]): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries(ids.map((id) => [id, 100])))
}

describe('T024 timeout resolution', () => {
  it('uses living unit count before all other metrics', () => {
    const battle = createBattleState({
      units: [
        unit('ally.a', 'ALLY', 0, 0, 1),
        unit('ally.b', 'ALLY', 0, 1, 1),
        unit('enemy.a', 'ENEMY', 0, 0, 100),
      ],
    })
    const log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, battle)
    const result = resolveBattleTimeout({
      battle,
      log,
      maxHpByBattleUnitId: maxHpMap(battle.units.map((candidate) => candidate.battleUnitId)),
    })

    expect(result.outcome).toBe('ALLY_VICTORY')
    expect(result.decisiveCriterion).toBe('LIVING_UNIT_COUNT')
  })

  it('uses summed remaining HP ratios when living counts tie', () => {
    const battle = createBattleState({
      units: [
        unit('ally.a', 'ALLY', 0, 0, 75),
        unit('enemy.a', 'ENEMY', 0, 0, 50),
      ],
    })
    const log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, battle)
    const result = resolveBattleTimeout({
      battle,
      log,
      maxHpByBattleUnitId: maxHpMap(['ally.a', 'enemy.a']),
    })

    expect(result.outcome).toBe('ALLY_VICTORY')
    expect(result.decisiveCriterion).toBe('REMAINING_HP_RATIO')
    expect(result.ally.remainingHpRatioMicros).toBe(750_000)
    expect(result.enemy.remainingHpRatioMicros).toBe(500_000)
  })

  it('uses applied damage when living count and HP ratio are equal', () => {
    const battle = createBattleState({
      units: [
        unit('ally.a', 'ALLY', 0, 0, 50),
        unit('enemy.a', 'ENEMY', 0, 0, 50),
      ],
    })
    let log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, battle)
    log = appendBattleEvent(log, {
      kind: 'damage_applied',
      virtualTime: 10,
      payload: {
        sourceBattleUnitId: 'ally.a',
        targetBattleUnitId: 'enemy.a',
        skillId: 'skill.timeout',
        calculatedDamage: 50,
        appliedDamage: 50,
        hpBefore: 100,
        hpAfter: 50,
      },
    })
    log = appendBattleEvent(log, {
      kind: 'damage_applied',
      virtualTime: 20,
      payload: {
        sourceBattleUnitId: 'enemy.a',
        targetBattleUnitId: 'ally.a',
        skillId: 'skill.timeout',
        calculatedDamage: 40,
        appliedDamage: 40,
        hpBefore: 90,
        hpAfter: 50,
      },
    })
    const result = resolveBattleTimeout({
      battle,
      log,
      maxHpByBattleUnitId: maxHpMap(['ally.a', 'enemy.a']),
    })

    expect(result.outcome).toBe('ALLY_VICTORY')
    expect(result.decisiveCriterion).toBe('DAMAGE_DEALT')
    expect(result.ally.damageDealt).toBe(50)
    expect(result.enemy.damageDealt).toBe(40)
  })

  it('returns DRAW by default and supports the defeat-on-tie mode', () => {
    const battle = createBattleState({
      units: [unit('ally.a', 'ALLY', 0, 0), unit('enemy.a', 'ENEMY', 0, 0)],
    })
    const log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, battle)
    const input = {
      battle,
      log,
      maxHpByBattleUnitId: maxHpMap(['ally.a', 'enemy.a']),
    }

    expect(resolveBattleTimeout(input)).toMatchObject({
      outcome: 'DRAW',
      decisiveCriterion: 'EXACT_TIE',
    })
    expect(resolveBattleTimeout({ ...input, tiePolicy: 'ALLY_DEFEAT' })).toMatchObject({
      outcome: 'ALLY_DEFEAT',
      decisiveCriterion: 'EXACT_TIE',
    })
  })

  it('returns the same resolution one hundred times', () => {
    const battle = createBattleState({
      units: [
        unit('ally.a', 'ALLY', 0, 0, 60),
        unit('enemy.a', 'ENEMY', 0, 0, 40),
      ],
    })
    const input = {
      battle,
      log: recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, battle),
      maxHpByBattleUnitId: maxHpMap(['ally.a', 'enemy.a']),
    }
    const expected = resolveBattleTimeout(input)

    for (let index = 0; index < 100; index += 1) {
      expect(resolveBattleTimeout(input)).toEqual(expected)
    }
  })
})
