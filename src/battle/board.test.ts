import { describe, expect, it } from 'vitest'
import {
  BOARD_POSITIONS,
  areAdjacent,
  createBoardPosition,
  getAdjacentPositions,
  getPositionBehind,
  getPositionInFront,
  isBehind,
  isInFrontOf,
  isPositionOnSide,
  isSameColumn,
  isSamePosition,
  oppositeSide,
  toBoardPositionId,
  toGlobalRow,
  toOpposingPosition,
} from './board'

describe('board positions', () => {
  it('enumerates all 18 positions with stable unique IDs', () => {
    const ids = BOARD_POSITIONS.map(toBoardPositionId)

    expect(BOARD_POSITIONS).toHaveLength(18)
    expect(new Set(ids).size).toBe(18)
    expect(ids).toEqual([
      'ALLY:0:0',
      'ALLY:0:1',
      'ALLY:0:2',
      'ALLY:1:0',
      'ALLY:1:1',
      'ALLY:1:2',
      'ALLY:2:0',
      'ALLY:2:1',
      'ALLY:2:2',
      'ENEMY:0:0',
      'ENEMY:0:1',
      'ENEMY:0:2',
      'ENEMY:1:0',
      'ENEMY:1:1',
      'ENEMY:1:2',
      'ENEMY:2:0',
      'ENEMY:2:1',
      'ENEMY:2:2',
    ])
  })

  it('maps local front, middle, and back rows to the six global rows', () => {
    expect(toGlobalRow(createBoardPosition('ENEMY', 2, 0))).toBe(0)
    expect(toGlobalRow(createBoardPosition('ENEMY', 1, 0))).toBe(1)
    expect(toGlobalRow(createBoardPosition('ENEMY', 0, 0))).toBe(2)
    expect(toGlobalRow(createBoardPosition('ALLY', 0, 0))).toBe(3)
    expect(toGlobalRow(createBoardPosition('ALLY', 1, 0))).toBe(4)
    expect(toGlobalRow(createBoardPosition('ALLY', 2, 0))).toBe(5)
  })

  it('moves one local row forward or backward without crossing a boundary', () => {
    expect(getPositionInFront(createBoardPosition('ALLY', 0, 1))).toBeNull()
    expect(getPositionInFront(createBoardPosition('ALLY', 1, 1))).toEqual(
      createBoardPosition('ALLY', 0, 1),
    )
    expect(getPositionInFront(createBoardPosition('ENEMY', 2, 1))).toEqual(
      createBoardPosition('ENEMY', 1, 1),
    )

    expect(getPositionBehind(createBoardPosition('ENEMY', 2, 1))).toBeNull()
    expect(getPositionBehind(createBoardPosition('ENEMY', 1, 1))).toEqual(
      createBoardPosition('ENEMY', 2, 1),
    )
    expect(getPositionBehind(createBoardPosition('ALLY', 0, 1))).toEqual(
      createBoardPosition('ALLY', 1, 1),
    )
  })

  it('compares front and back only within the same side and column', () => {
    const front = createBoardPosition('ALLY', 0, 1)
    const middle = createBoardPosition('ALLY', 1, 1)
    const otherColumn = createBoardPosition('ALLY', 2, 2)
    const enemyBack = createBoardPosition('ENEMY', 2, 1)

    expect(isInFrontOf(front, middle)).toBe(true)
    expect(isBehind(middle, front)).toBe(true)
    expect(isInFrontOf(front, otherColumn)).toBe(false)
    expect(isInFrontOf(front, enemyBack)).toBe(false)
  })
})

describe('adjacency', () => {
  it('returns all eight neighbors for a center position in stable order', () => {
    const center = createBoardPosition('ALLY', 1, 1)

    expect(getAdjacentPositions(center).map(toBoardPositionId)).toEqual([
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

  it('does not return out-of-board or opposing-side positions at an edge', () => {
    const corner = createBoardPosition('ENEMY', 0, 0)
    const neighbors = getAdjacentPositions(corner)

    expect(neighbors.map(toBoardPositionId)).toEqual(['ENEMY:0:1', 'ENEMY:1:0', 'ENEMY:1:1'])
    expect(neighbors.every((position) => isPositionOnSide(position, 'ENEMY'))).toBe(true)
  })

  it('recognizes orthogonal and diagonal neighbors but not self or distant cells', () => {
    const origin = createBoardPosition('ALLY', 1, 1)

    expect(areAdjacent(origin, createBoardPosition('ALLY', 1, 2))).toBe(true)
    expect(areAdjacent(origin, createBoardPosition('ALLY', 2, 2))).toBe(true)
    expect(areAdjacent(origin, origin)).toBe(false)
    expect(areAdjacent(origin, createBoardPosition('ALLY', 2, 0))).toBe(true)
    expect(areAdjacent(createBoardPosition('ALLY', 0, 0), createBoardPosition('ALLY', 2, 2))).toBe(
      false,
    )
    expect(areAdjacent(origin, createBoardPosition('ENEMY', 1, 1))).toBe(false)
  })
})

describe('side and column transformations', () => {
  it('returns the opposing side deterministically', () => {
    expect(oppositeSide('ALLY')).toBe('ENEMY')
    expect(oppositeSide('ENEMY')).toBe('ALLY')
  })

  it('mirrors a position to the opposing formation while preserving local row and column', () => {
    const allyFront = createBoardPosition('ALLY', 0, 2)
    const enemyFront = toOpposingPosition(allyFront)

    expect(enemyFront).toEqual(createBoardPosition('ENEMY', 0, 2))
    expect(toOpposingPosition(enemyFront)).toEqual(allyFront)
  })

  it('compares fixed positions and columns independently', () => {
    const ally = createBoardPosition('ALLY', 1, 2)
    const same = createBoardPosition('ALLY', 1, 2)
    const enemy = createBoardPosition('ENEMY', 0, 2)

    expect(isSamePosition(ally, same)).toBe(true)
    expect(isSamePosition(ally, enemy)).toBe(false)
    expect(isSameColumn(ally, enemy)).toBe(true)
    expect(isPositionOnSide(ally, 'ALLY')).toBe(true)
    expect(isPositionOnSide(ally, 'ENEMY')).toBe(false)
  })
})
