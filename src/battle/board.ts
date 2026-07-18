export const SIDES = ['ALLY', 'ENEMY'] as const
export type Side = (typeof SIDES)[number]

export const LOCAL_ROWS = [0, 1, 2] as const
export type LocalRow = (typeof LOCAL_ROWS)[number]

export const COLUMNS = [0, 1, 2] as const
export type Column = (typeof COLUMNS)[number]

export type GlobalRow = 0 | 1 | 2 | 3 | 4 | 5

export interface BoardPosition {
  readonly side: Side
  readonly row: LocalRow
  readonly column: Column
}

export type BoardPositionId = `${Side}:${LocalRow}:${Column}`

export const BOARD_POSITIONS: readonly BoardPosition[] = SIDES.flatMap((side) =>
  LOCAL_ROWS.flatMap((row) => COLUMNS.map((column) => ({ side, row, column }))),
)

export function createBoardPosition(
  side: Side,
  row: LocalRow,
  column: Column,
): BoardPosition {
  return { side, row, column }
}

export function toBoardPositionId(position: BoardPosition): BoardPositionId {
  return `${position.side}:${position.row}:${position.column}`
}

export function oppositeSide(side: Side): Side {
  return side === 'ALLY' ? 'ENEMY' : 'ALLY'
}

export function toOpposingPosition(position: BoardPosition): BoardPosition {
  return {
    side: oppositeSide(position.side),
    row: position.row,
    column: position.column,
  }
}

export function isPositionOnSide(position: BoardPosition, side: Side): boolean {
  return position.side === side
}

export function isSamePosition(left: BoardPosition, right: BoardPosition): boolean {
  return left.side === right.side && left.row === right.row && left.column === right.column
}

export function isSameColumn(left: BoardPosition, right: BoardPosition): boolean {
  return left.column === right.column
}

export function getPositionInFront(position: BoardPosition): BoardPosition | null {
  if (position.row === 0) {
    return null
  }

  return createBoardPosition(position.side, (position.row - 1) as LocalRow, position.column)
}

export function getPositionBehind(position: BoardPosition): BoardPosition | null {
  if (position.row === 2) {
    return null
  }

  return createBoardPosition(position.side, (position.row + 1) as LocalRow, position.column)
}

export function isInFrontOf(candidate: BoardPosition, reference: BoardPosition): boolean {
  return (
    candidate.side === reference.side &&
    candidate.column === reference.column &&
    candidate.row < reference.row
  )
}

export function isBehind(candidate: BoardPosition, reference: BoardPosition): boolean {
  return isInFrontOf(reference, candidate)
}

export function areAdjacent(left: BoardPosition, right: BoardPosition): boolean {
  if (left.side !== right.side || isSamePosition(left, right)) {
    return false
  }

  return Math.abs(left.row - right.row) <= 1 && Math.abs(left.column - right.column) <= 1
}

export function getAdjacentPositions(position: BoardPosition): readonly BoardPosition[] {
  return BOARD_POSITIONS.filter((candidate) => areAdjacent(position, candidate))
}

export function toGlobalRow(position: BoardPosition): GlobalRow {
  if (position.side === 'ENEMY') {
    return (2 - position.row) as GlobalRow
  }

  return (3 + position.row) as GlobalRow
}
