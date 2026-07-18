import { describe, expect, it } from 'vitest'
import {
  ALL_BOARD_POSITIONS,
  areAdjacent,
  fromGlobalRow,
  getAdjacentPositions,
  getBoardPositionId,
  isBehind,
  isInFrontOf,
  isPositionOnSide,
  isSameColumn,
  isSameSide,
  toGlobalRow,
  toOpposingPosition,
  type BoardPosition,
} from './board'

const allyFrontCenter: BoardPosition = { side: 'ALLY', row: 0, column: 1 }
const allyMiddleCenter: BoardPosition = { side: 'ALLY', row: 1, column: 1 }
const allyBackCenter: BoardPosition = { side: 'ALLY', row: 2, column: 1 }
const enemyFrontCenter: BoardPosition = { side: 'ENEMY', row: 0, column: 1 }
const enemyBackCenter: BoardPosition = { side: 'ENEMY', row: 2, column: 1 }

describe('board coordinates', () => {
  it('enumerates all 18 positions exactly once in global board order', () => {
    expect(ALL_BOARD_POSITIONS).toHaveLength(18)

    const ids = ALL_BOARD_POSITIONS.map(getBoardPositionId)
    expect(new Set(ids).size).toBe(18)
    expect(ids).toEqual([
      'ENEMY:2:0',
      'ENEMY:2:1',
      'ENEMY:2:2',
      'ENEMY:1:0',
      'ENEMY:1:1',
      'ENEMY:1:2',
      'ENEMY:0:0',
      'ENEMY:0:1',
      'ENEMY:0:2',
      'ALLY:0:0',
      'ALLY:0:1',
      'ALLY:0:2',
      'ALLY:1:0',
      'ALLY:1:1',
      'ALLY:1:2',
      'ALLY:2:0',
      'ALLY:2:1',
      'ALLY:2:2',
    ])
  })

  it('converts local rows to the documented six global rows', () => {
    expect(toGlobalRow(enemyBackCenter)).toBe(0)
    expect(toGlobalRow(enemyFrontCenter)).toBe(2)
    expect(toGlobalRow(allyFrontCenter)).toBe(3)
    expect(toGlobalRow(allyBackCenter)).toBe(5)

    for (const position of ALL_BOARD_POSITIONS) {
      expect(fromGlobalRow(toGlobalRow(position), position.column)).toEqual(position)
    }
  })

  it('uses the same front and back semantics for both sides', () => {
    expect(isInFrontOf(allyFrontCenter, allyBackCenter)).toBe(true)
    expect(isBehind(allyBackCenter, allyFrontCenter)).toBe(true)
    expect(isInFrontOf(enemyFrontCenter, enemyBackCenter)).toBe(true)
    expect(isBehind(enemyBackCenter, enemyFrontCenter)).toBe(true)

    expect(isInFrontOf(allyFrontCenter, enemyBackCenter)).toBe(false)
    expect(isBehind(enemyBackCenter, allyFrontCenter)).toBe(false)
  })

  it('detects side and column relationships independently', () => {
    expect(isPositionOnSide(allyFrontCenter, 'ALLY')).toBe(true)
    expect(isPositionOnSide(allyFrontCenter, 'ENEMY')).toBe(false)
    expect(isSameSide(allyFrontCenter, allyBackCenter)).toBe(true)
    expect(isSameSide(allyFrontCenter, enemyFrontCenter)).toBe(false)
    expect(isSameColumn(allyFrontCenter, enemyBackCenter)).toBe(true)
    expect(isSameColumn(allyFrontCenter, { side: 'ALLY', row: 2, column: 0 })).toBe(false)
  })

  it('returns all eight neighbors from a center position', () => {
    const adjacentIds = getAdjacentPositions(allyMiddleCenter).map(getBoardPositionId)

    expect(adjacentIds).toEqual([
      'ALLY:0:0',
      'ALLY:0:1',
      'ALLY:0:2',
      'ALLY:1:0',
      'ALLY:1:2',
      'ALLY:2:0',
      'ALLY:2:1',
      'ALLY:2:2',
    ])
  })

  it('does not return positions outside the board or across the battle line', () => {
    const corner: BoardPosition = { side: 'ALLY', row: 0, column: 0 }
    const adjacent = getAdjacentPositions(corner)

    expect(adjacent.map(getBoardPositionId)).toEqual(['ALLY:0:1', 'ALLY:1:0', 'ALLY:1:1'])
    expect(adjacent.every((position) => position.side === 'ALLY')).toBe(true)
    expect(areAdjacent(allyFrontCenter, enemyFrontCenter)).toBe(false)
  })

  it('keeps adjacency enumeration deterministic', () => {
    const first = getAdjacentPositions(enemyFrontCenter).map(getBoardPositionId)
    const second = getAdjacentPositions(enemyFrontCenter).map(getBoardPositionId)

    expect(second).toEqual(first)
  })

  it('mirrors a position to the opposing side without changing depth or column', () => {
    const opposing = toOpposingPosition({ side: 'ALLY', row: 1, column: 2 })

    expect(opposing).toEqual({ side: 'ENEMY', row: 1, column: 2 })
    expect(toOpposingPosition(opposing)).toEqual({ side: 'ALLY', row: 1, column: 2 })
  })
})
