import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { createBattleState, type BattleState } from './defeat-and-victory'
import { EMPTY_BATTLE_EVENT_LOG, recordUnitMoved } from './event-log'
import { resolveForcedMovement } from './forced-movement'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.forced-movement',
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

function createPushScenario(blockDestination = false): BattleState {
  return createBattleState({
    units: [
      unit('ally.source', 'ALLY', 0, 1),
      unit('enemy.target', 'ENEMY', 0, 1),
      ...(blockDestination
        ? [unit('enemy.blocker', 'ENEMY', 1, 1)]
        : []),
    ],
  })
}

describe('T021 forced movement', () => {
  it('pushes one cell away from the source and updates occupancy atomically', () => {
    const battle = createPushScenario()
    const result = resolveForcedMovement({
      battle,
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'PUSH',
    })

    expect(result.success).toBe(true)
    expect(result.failureReason).toBeNull()
    expect(result.from).toEqual({ side: 'ENEMY', row: 0, column: 1 })
    expect(result.to).toEqual({ side: 'ENEMY', row: 1, column: 1 })
    expect(
      result.battle.units.find((unitState) => unitState.battleUnitId === 'enemy.target')
        ?.position,
    ).toEqual({ side: 'ENEMY', row: 1, column: 1 })
    expect(
      result.battle.occupancy.find(
        (occupant) => occupant.battleUnitId === 'enemy.target',
      )?.position,
    ).toEqual({ side: 'ENEMY', row: 1, column: 1 })
    expect(
      battle.units.find((unitState) => unitState.battleUnitId === 'enemy.target')
        ?.position,
    ).toEqual({ side: 'ENEMY', row: 0, column: 1 })
  })

  it('pulls one cell toward the source without crossing the side boundary', () => {
    const battle = createBattleState({
      units: [
        unit('ally.source', 'ALLY', 0, 1),
        unit('enemy.target', 'ENEMY', 2, 1),
      ],
    })
    const result = resolveForcedMovement({
      battle,
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'PULL',
    })

    expect(result.success).toBe(true)
    expect(result.to).toEqual({ side: 'ENEMY', row: 1, column: 1 })
  })

  it('moves laterally left and right in fixed board coordinates', () => {
    const leftBattle = createBattleState({
      units: [
        unit('ally.source', 'ALLY', 0, 1),
        unit('enemy.target', 'ENEMY', 1, 1),
      ],
    })
    const left = resolveForcedMovement({
      battle: leftBattle,
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'LATERAL_LEFT',
    })
    const right = resolveForcedMovement({
      battle: leftBattle,
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'LATERAL_RIGHT',
    })

    expect(left.to).toEqual({ side: 'ENEMY', row: 1, column: 0 })
    expect(right.to).toEqual({ side: 'ENEMY', row: 1, column: 2 })
  })

  it('fails without mutation when the destination is occupied', () => {
    const battle = createPushScenario(true)
    const result = resolveForcedMovement({
      battle,
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'PUSH',
    })

    expect(result.success).toBe(false)
    expect(result.failureReason).toBe('OCCUPIED')
    expect(result.battle).toBe(battle)
    expect(result.attemptedDestination).toEqual({
      side: 'ENEMY',
      row: 1,
      column: 1,
    })
  })

  it('fails at board and side boundaries instead of chaining or swapping units', () => {
    const outOfBoundsBattle = createBattleState({
      units: [
        unit('ally.anchor', 'ALLY', 0, 0),
        unit('enemy.source', 'ENEMY', 1, 1),
        unit('enemy.target', 'ENEMY', 2, 1),
      ],
    })
    const outOfBounds = resolveForcedMovement({
      battle: outOfBoundsBattle,
      sourceBattleUnitId: 'enemy.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'PUSH',
    })
    const crossSideBattle = createPushScenario()
    const crossSide = resolveForcedMovement({
      battle: crossSideBattle,
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'PULL',
    })

    expect(outOfBounds.success).toBe(false)
    expect(outOfBounds.failureReason).toBe('OUT_OF_BOUNDS')
    expect(crossSide.success).toBe(false)
    expect(crossSide.failureReason).toBe('CROSS_SIDE')
    expect(crossSide.attemptedDestination).toEqual({
      side: 'ALLY',
      row: 0,
      column: 1,
    })
  })

  it('rejects diagonal push and pull directions', () => {
    const battle = createBattleState({
      units: [
        unit('ally.source', 'ALLY', 0, 0),
        unit('enemy.target', 'ENEMY', 0, 1),
      ],
    })
    const result = resolveForcedMovement({
      battle,
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'PUSH',
    })

    expect(result.success).toBe(false)
    expect(result.failureReason).toBe('INVALID_ALIGNMENT')
  })

  it('records successful forced movement through the continuous movement event', () => {
    const result = resolveForcedMovement({
      battle: createPushScenario(),
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'PUSH',
    })
    if (!result.success || result.to === null) {
      throw new Error('push must succeed in the event-log scenario')
    }
    const log = recordUnitMoved(EMPTY_BATTLE_EVENT_LOG, {
      virtualTime: 25,
      battleUnitId: result.targetBattleUnitId,
      from: result.from,
      to: result.to,
    })

    expect(log.events).toHaveLength(1)
    expect(log.events[0]).toMatchObject({
      kind: 'unit_moved',
      sequence: 0,
      virtualTime: 25,
      payload: {
        battleUnitId: 'enemy.target',
        fromPositionId: 'ENEMY:0:1',
        toPositionId: 'ENEMY:1:1',
      },
    })
  })

  it('returns the same result for the same state one hundred times', () => {
    const battle = createPushScenario()
    const input = {
      battle,
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'PUSH' as const,
    }
    const expected = resolveForcedMovement(input)

    for (let index = 0; index < 100; index += 1) {
      expect(resolveForcedMovement(input)).toEqual(expected)
    }
  })
})
