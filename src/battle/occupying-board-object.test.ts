import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { createBattleState } from './defeat-and-victory'
import {
  assertBattlefieldOccupancy,
  createOccupyingBoardObjectState,
  getBattlefieldOccupantAt,
  isBattlefieldPositionOccupied,
  resolveDirectTargetWithBoardObjects,
  resolveOccupyingBoardObjectDamage,
} from './occupying-board-object'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.board-object-test',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 20, defense: 20, speed: 3 }),
  innateSkillId: 'skill.test',
})

function unit(
  battleUnitId: string,
  side: 'ALLY' | 'ENEMY',
  row: 0 | 1 | 2,
  column: 0 | 1 | 2,
) {
  return createBattleUnitState(species, {
    battleUnitId,
    position: { side, row, column },
  })
}

function createScenario() {
  const battle = createBattleState({
    units: [
      unit('ally.attacker', 'ALLY', 0, 1),
      unit('enemy.target', 'ENEMY', 1, 1),
    ],
  })
  const wall = createOccupyingBoardObjectState({
    boardObjectId: 'object.wall',
    objectTypeId: 'object-type.wall',
    sourceBattleUnitId: 'enemy.target',
    position: { side: 'ENEMY', row: 0, column: 1 },
    maxHp: 50,
  })
  return { battle, objects: Object.freeze([wall]) }
}

describe('T022 occupying board objects', () => {
  it('occupies a cell independently from unit occupancy', () => {
    const { battle, objects } = createScenario()
    const position = { side: 'ENEMY', row: 0, column: 1 } as const

    expect(() => assertBattlefieldOccupancy(battle, objects)).not.toThrow()
    expect(isBattlefieldPositionOccupied(battle, objects, position)).toBe(true)
    expect(getBattlefieldOccupantAt(battle, objects, position)).toEqual({
      kind: 'BOARD_OBJECT',
      id: 'object.wall',
      position,
    })
  })

  it('rejects an active object that overlaps a living unit', () => {
    const { battle } = createScenario()
    const overlapping = createOccupyingBoardObjectState({
      boardObjectId: 'object.invalid',
      objectTypeId: 'object-type.wall',
      position: { side: 'ENEMY', row: 1, column: 1 },
      maxHp: 10,
    })

    expect(() => assertBattlefieldOccupancy(battle, [overlapping])).toThrow(
      'active board object must not overlap a living unit: ENEMY:1:1',
    )
  })

  it('blocks DIRECT targeting before a unit behind it', () => {
    const { battle, objects } = createScenario()
    const result = resolveDirectTargetWithBoardObjects({
      battle,
      objects,
      attackerBattleUnitId: 'ally.attacker',
      intendedTargetBattleUnitId: 'enemy.target',
    })

    expect(result.blocked).toBe(true)
    expect(result.actualTarget).toMatchObject({
      kind: 'BOARD_OBJECT',
      id: 'object.wall',
      positionId: 'ENEMY:0:1',
      distance: 1,
    })
    expect(result.lineEntities.map((entity) => `${entity.kind}:${entity.id}`)).toEqual([
      'BOARD_OBJECT:object.wall',
      'UNIT:enemy.target',
    ])
  })

  it('can be damaged and stops occupying or blocking after destruction', () => {
    const { battle, objects } = createScenario()
    const damage = resolveOccupyingBoardObjectDamage({
      objects,
      boardObjectId: 'object.wall',
      damage: 80,
    })

    expect(damage.appliedDamage).toBe(50)
    expect(damage.after.hp).toBe(0)
    expect(damage.destroyed).toBe(true)
    expect(
      isBattlefieldPositionOccupied(
        battle,
        damage.objects,
        { side: 'ENEMY', row: 0, column: 1 },
      ),
    ).toBe(false)

    const targeting = resolveDirectTargetWithBoardObjects({
      battle,
      objects: damage.objects,
      attackerBattleUnitId: 'ally.attacker',
      intendedTargetBattleUnitId: 'enemy.target',
    })
    expect(targeting.blocked).toBe(false)
    expect(targeting.actualTarget).toMatchObject({
      kind: 'UNIT',
      id: 'enemy.target',
    })
    expect(objects[0]?.hp).toBe(50)
  })

  it('ignores an active object explicitly configured not to block DIRECT', () => {
    const battle = createBattleState({
      units: [
        unit('ally.attacker', 'ALLY', 0, 1),
        unit('enemy.target', 'ENEMY', 1, 1),
      ],
    })
    const marker = createOccupyingBoardObjectState({
      boardObjectId: 'object.marker',
      objectTypeId: 'object-type.marker',
      position: { side: 'ENEMY', row: 0, column: 1 },
      maxHp: 1,
      blocksDirect: false,
    })

    const result = resolveDirectTargetWithBoardObjects({
      battle,
      objects: [marker],
      attackerBattleUnitId: 'ally.attacker',
      intendedTargetBattleUnitId: 'enemy.target',
    })
    expect(result.blocked).toBe(false)
    expect(result.actualTarget).toMatchObject({ kind: 'UNIT', id: 'enemy.target' })
  })

  it('returns the same cover resolution one hundred times', () => {
    const { battle, objects } = createScenario()
    const input = {
      battle,
      objects,
      attackerBattleUnitId: 'ally.attacker',
      intendedTargetBattleUnitId: 'enemy.target',
    }
    const expected = resolveDirectTargetWithBoardObjects(input)

    for (let index = 0; index < 100; index += 1) {
      expect(resolveDirectTargetWithBoardObjects(input)).toEqual(expected)
    }
  })
})
