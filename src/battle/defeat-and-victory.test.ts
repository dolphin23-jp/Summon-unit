import { describe, expect, it } from 'vitest'
import type { BoardPosition, Side } from './board'
import { getUnitTurnEventId } from './action-scheduling'
import {
  assertValidBattleState,
  createBattleState,
  evaluateBattleOutcome,
  getBoardOccupant,
  resolveBattleUnitDefeat,
} from './defeat-and-victory'
import { createTimelineQueue, type ScheduledEvent } from './timeline-queue'
import { createBattleUnitState, withBattleUnitHp } from './unit-state'
import type { MonsterSpecies } from '../content/monster-species'

const allySpecies: MonsterSpecies = Object.freeze({
  id: 'species.ally-striker',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze(['tag.beast']),
  innateSkillId: 'skill.ally-strike',
  stats: Object.freeze({ hp: 100, attack: 30, defense: 20, speed: 3 }),
})

const enemySpecies: MonsterSpecies = Object.freeze({
  id: 'species.enemy-guard',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze(['tag.beast']),
  innateSkillId: 'skill.enemy-strike',
  stats: Object.freeze({ hp: 80, attack: 25, defense: 15, speed: 2 }),
})

function position(side: Side, row: 0 | 1 | 2, column: 0 | 1 | 2): BoardPosition {
  return { side, row, column }
}

function createUnit(
  battleUnitId: string,
  side: Side,
  row: 0 | 1 | 2,
  column: 0 | 1 | 2,
) {
  const species = side === 'ALLY' ? allySpecies : enemySpecies
  return createBattleUnitState(species, {
    battleUnitId,
    position: position(side, row, column),
  })
}

function createUnitTurnEvent(battleUnitId: string, sequence: number): ScheduledEvent {
  return {
    id: getUnitTurnEventId(battleUnitId),
    time: 10_000 + sequence,
    priority: 0,
    sequence,
    kind: 'UNIT_TURN',
    payload: { battleUnitId },
  }
}

function createFourUnitBattle() {
  const units = [
    createUnit('ally.1', 'ALLY', 0, 0),
    createUnit('ally.2', 'ALLY', 0, 1),
    createUnit('enemy.1', 'ENEMY', 0, 0),
    createUnit('enemy.2', 'ENEMY', 0, 1),
  ]
  const timeline = createTimelineQueue(
    units.map((unit, index) => createUnitTurnEvent(unit.battleUnitId, index)),
  )

  return createBattleState({ units, timeline })
}

describe('battle state creation and occupancy', () => {
  it('creates one occupied board position for every living unit', () => {
    const battle = createFourUnitBattle()

    expect(battle.units).toHaveLength(4)
    expect(battle.occupancy).toHaveLength(4)
    expect(battle.outcome).toBe('ONGOING')
    expect(getBoardOccupant(battle, position('ALLY', 0, 0))?.battleUnitId).toBe('ally.1')
    expect(getBoardOccupant(battle, position('ALLY', 2, 2))).toBeNull()
    expect(() => assertValidBattleState(battle)).not.toThrow()
  })

  it('rejects duplicate battle IDs and duplicate occupied positions', () => {
    expect(() =>
      createBattleState({
        units: [
          createUnit('same-id', 'ALLY', 0, 0),
          createUnit('same-id', 'ENEMY', 0, 0),
        ],
      }),
    ).toThrow('battleUnitId must be unique: same-id')

    expect(() =>
      createBattleState({
        units: [
          createUnit('ally.1', 'ALLY', 0, 0),
          createUnit('ally.2', 'ALLY', 0, 0),
          createUnit('enemy.1', 'ENEMY', 0, 0),
        ],
      }),
    ).toThrow('board position must have at most one occupant: ALLY:0:0')
  })

  it('requires between one and nine units on each side', () => {
    expect(() =>
      createBattleState({ units: [createUnit('ally.1', 'ALLY', 0, 0)] }),
    ).toThrow('battle must contain between 1 and 9 enemy units')
  })
})

describe('defeat resolution', () => {
  it('removes board occupancy, cancels the future turn, and records the killer once', () => {
    const battle = createFourUnitBattle()
    const enemy = battle.units.find((unit) => unit.battleUnitId === 'enemy.1')
    expect(enemy).toBeDefined()

    const defeatedEnemy = withBattleUnitHp(enemy!, enemySpecies, 0)
    const resolved = resolveBattleUnitDefeat({
      battle,
      defeatedUnit: defeatedEnemy,
      killerBattleUnitId: 'ally.1',
      currentTime: 12_000,
    })

    expect(resolved.units.find((unit) => unit.battleUnitId === 'enemy.1')).toEqual(
      defeatedEnemy,
    )
    expect(resolved.occupancy.map((occupant) => occupant.battleUnitId)).not.toContain(
      'enemy.1',
    )
    expect(resolved.timeline.events.map((event) => event.id)).not.toContain(
      getUnitTurnEventId('enemy.1'),
    )
    expect(resolved.timeline.events).toHaveLength(3)
    expect(resolved.defeatRecords).toEqual([
      {
        defeatedBattleUnitId: 'enemy.1',
        killerBattleUnitId: 'ally.1',
        defeatedAt: 12_000,
      },
    ])
    expect(resolved.outcome).toBe('ONGOING')

    expect(battle.occupancy).toHaveLength(4)
    expect(battle.timeline.events).toHaveLength(4)
    expect(battle.defeatRecords).toEqual([])

    const repeated = resolveBattleUnitDefeat({
      battle: resolved,
      defeatedUnit: defeatedEnemy,
      killerBattleUnitId: 'ally.1',
      currentTime: 12_000,
    })
    expect(repeated).toBe(resolved)
  })

  it('allows an environmental defeat with no killer', () => {
    const battle = createFourUnitBattle()
    const enemy = battle.units.find((unit) => unit.battleUnitId === 'enemy.1')!
    const defeatedEnemy = withBattleUnitHp(enemy, enemySpecies, 0)

    const resolved = resolveBattleUnitDefeat({
      battle,
      defeatedUnit: defeatedEnemy,
      currentTime: 50_000,
    })

    expect(resolved.defeatRecords[0]?.killerBattleUnitId).toBeNull()
  })

  it('rejects a living unit, an unknown killer, and identity changes', () => {
    const battle = createFourUnitBattle()
    const enemy = battle.units.find((unit) => unit.battleUnitId === 'enemy.1')!

    expect(() =>
      resolveBattleUnitDefeat({ battle, defeatedUnit: enemy, currentTime: 1_000 }),
    ).toThrow('defeat resolution requires a unit with 0 HP')

    const defeatedEnemy = withBattleUnitHp(enemy, enemySpecies, 0)
    expect(() =>
      resolveBattleUnitDefeat({
        battle,
        defeatedUnit: defeatedEnemy,
        killerBattleUnitId: 'unknown',
        currentTime: 1_000,
      }),
    ).toThrow('killer must belong to the battle: unknown')

    expect(() =>
      resolveBattleUnitDefeat({
        battle,
        defeatedUnit: { ...defeatedEnemy, speciesId: 'species.changed' },
        currentTime: 1_000,
      }),
    ).toThrow('updated speciesId must not change')
  })

  it('freezes the resulting aggregate without mutating input units', () => {
    const battle = createFourUnitBattle()
    const enemy = battle.units.find((unit) => unit.battleUnitId === 'enemy.1')!
    const defeatedEnemy = withBattleUnitHp(enemy, enemySpecies, 0)
    const resolved = resolveBattleUnitDefeat({
      battle,
      defeatedUnit: defeatedEnemy,
      killerBattleUnitId: 'ally.1',
      currentTime: 20_000,
    })

    expect(Object.isFrozen(resolved)).toBe(true)
    expect(Object.isFrozen(resolved.units)).toBe(true)
    expect(Object.isFrozen(resolved.occupancy)).toBe(true)
    expect(Object.isFrozen(resolved.defeatRecords)).toBe(true)
    expect(enemy.defeated).toBe(false)
    expect(enemy.hp).toBe(80)
  })
})

describe('victory and defeat', () => {
  it('declares victory when the last enemy is defeated', () => {
    const ally = createUnit('ally.1', 'ALLY', 0, 0)
    const enemy = createUnit('enemy.1', 'ENEMY', 0, 0)
    const battle = createBattleState({
      units: [ally, enemy],
      timeline: createTimelineQueue([
        createUnitTurnEvent('ally.1', 0),
        createUnitTurnEvent('enemy.1', 1),
      ]),
    })

    const resolved = resolveBattleUnitDefeat({
      battle,
      defeatedUnit: withBattleUnitHp(enemy, enemySpecies, 0),
      killerBattleUnitId: 'ally.1',
      currentTime: 10_000,
    })

    expect(resolved.outcome).toBe('ALLY_VICTORY')
    expect(resolved.timeline.events.map((event) => event.id)).toEqual([
      getUnitTurnEventId('ally.1'),
    ])
  })

  it('declares defeat when the last ally is defeated', () => {
    const ally = createUnit('ally.1', 'ALLY', 0, 0)
    const enemy = createUnit('enemy.1', 'ENEMY', 0, 0)
    const battle = createBattleState({ units: [ally, enemy] })

    const resolved = resolveBattleUnitDefeat({
      battle,
      defeatedUnit: withBattleUnitHp(ally, allySpecies, 0),
      killerBattleUnitId: 'enemy.1',
      currentTime: 10_000,
    })

    expect(resolved.outcome).toBe('ALLY_DEFEAT')
  })

  it('keeps the battle ongoing while both sides have a living unit', () => {
    const battle = createFourUnitBattle()
    const defeatedEnemy = withBattleUnitHp(
      battle.units.find((unit) => unit.battleUnitId === 'enemy.1')!,
      enemySpecies,
      0,
    )
    const units = battle.units.map((unit) =>
      unit.battleUnitId === defeatedEnemy.battleUnitId ? defeatedEnemy : unit,
    )

    expect(evaluateBattleOutcome(units)).toBe('ONGOING')
  })
})
