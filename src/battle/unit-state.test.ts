import { describe, expect, it } from 'vitest'
import type { BoardPosition } from './board'
import {
  assertValidBattleUnitState,
  createBattleUnitState,
  withBattleUnitHp,
  type BattleUnitState,
} from './unit-state'
import type { MonsterSpecies } from '../content/monster-species'

const species: MonsterSpecies = Object.freeze({
  id: 'species.grass-fang-rat',
  rarity: 1,
  attributeId: 'attribute.wind',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze(['tag.beast']),
  stats: Object.freeze({
    hp: 120,
    attack: 30,
    defense: 20,
    speed: 3,
  }),
})

const allyFrontCenter: BoardPosition = Object.freeze({ side: 'ALLY', row: 0, column: 1 })

describe('battle unit state', () => {
  it('creates a full-health state without retaining the input position object', () => {
    const state = createBattleUnitState(species, {
      battleUnitId: 'battle-unit.ally.001',
      sourceInstanceId: 'instance.001',
      position: allyFrontCenter,
    })

    expect(state).toEqual({
      battleUnitId: 'battle-unit.ally.001',
      sourceInstanceId: 'instance.001',
      speciesId: species.id,
      side: 'ALLY',
      position: allyFrontCenter,
      hp: 120,
      defeated: false,
    })
    expect(state.position).not.toBe(allyFrontCenter)
  })

  it('keeps multiple units of the same species separate through explicit fixed IDs', () => {
    const first = createBattleUnitState(species, {
      battleUnitId: 'battle-unit.ally.001',
      sourceInstanceId: 'instance.001',
      position: { side: 'ALLY', row: 0, column: 0 },
    })
    const second = createBattleUnitState(species, {
      battleUnitId: 'battle-unit.ally.002',
      sourceInstanceId: 'instance.002',
      position: { side: 'ALLY', row: 0, column: 2 },
    })

    expect(first.speciesId).toBe(second.speciesId)
    expect(first.battleUnitId).not.toBe(second.battleUnitId)
    expect(first.sourceInstanceId).not.toBe(second.sourceInstanceId)
  })

  it('updates HP immutably without changing the master species or prior state', () => {
    const masterBefore = JSON.stringify(species)
    const initial = createBattleUnitState(species, {
      battleUnitId: 'battle-unit.ally.001',
      position: allyFrontCenter,
    })
    const damaged = withBattleUnitHp(initial, species, 45)

    expect(damaged).toEqual({ ...initial, hp: 45 })
    expect(damaged).not.toBe(initial)
    expect(initial.hp).toBe(120)
    expect(JSON.stringify(species)).toBe(masterBefore)
  })

  it('keeps defeated exactly synchronized with zero HP', () => {
    const initial = createBattleUnitState(species, {
      battleUnitId: 'battle-unit.enemy.001',
      position: { side: 'ENEMY', row: 0, column: 1 },
    })
    const defeated = withBattleUnitHp(initial, species, 0)
    const restored = withBattleUnitHp(defeated, species, 1)

    expect(defeated.hp).toBe(0)
    expect(defeated.defeated).toBe(true)
    expect(restored.hp).toBe(1)
    expect(restored.defeated).toBe(false)
  })

  it.each([-1, 121, 1.5, Number.NaN])('rejects invalid initial HP: %s', (initialHp) => {
    expect(() =>
      createBattleUnitState(species, {
        battleUnitId: 'battle-unit.ally.001',
        position: allyFrontCenter,
        initialHp,
      }),
    ).toThrow('hp must be an integer between 0 and 120')
  })

  it.each([-1, 121, 1.5, Number.POSITIVE_INFINITY])(
    'rejects invalid HP updates: %s',
    (hp) => {
      const state = createBattleUnitState(species, {
        battleUnitId: 'battle-unit.ally.001',
        position: allyFrontCenter,
      })

      expect(() => withBattleUnitHp(state, species, hp)).toThrow(
        'hp must be an integer between 0 and 120',
      )
    },
  )

  it('rejects inconsistent derived state fields', () => {
    const valid = createBattleUnitState(species, {
      battleUnitId: 'battle-unit.ally.001',
      position: allyFrontCenter,
    })
    const defeatedMismatch: BattleUnitState = { ...valid, hp: 0, defeated: false }
    const sideMismatch: BattleUnitState = { ...valid, side: 'ENEMY' }
    const speciesMismatch: BattleUnitState = { ...valid, speciesId: 'species.other' }

    expect(() => assertValidBattleUnitState(defeatedMismatch, species)).toThrow(
      'state.defeated must be true exactly when state.hp is 0',
    )
    expect(() => assertValidBattleUnitState(sideMismatch, species)).toThrow(
      'state.side must match state.position.side',
    )
    expect(() => assertValidBattleUnitState(speciesMismatch, species)).toThrow(
      'state.speciesId must match species.id',
    )
  })

  it('rejects empty persistent IDs and invalid master HP', () => {
    expect(() =>
      createBattleUnitState(species, {
        battleUnitId: '  ',
        position: allyFrontCenter,
      }),
    ).toThrow('battleUnitId must be a non-empty string')

    const invalidSpecies = {
      ...species,
      stats: { ...species.stats, hp: 0 },
    } as MonsterSpecies

    expect(() =>
      createBattleUnitState(invalidSpecies, {
        battleUnitId: 'battle-unit.ally.001',
        position: allyFrontCenter,
      }),
    ).toThrow('species.stats.hp must be an integer greater than or equal to 1')
  })
})
