export type Side = 'ALLY' | 'ENEMY'
export type LocalRow = 0 | 1 | 2
export type Column = 0 | 1 | 2
export type GlobalRow = 0 | 1 | 2 | 3 | 4 | 5

export interface BoardPosition {
  readonly side: Side
  readonly row: LocalRow
  readonly column: Column
}

export const LOCAL_ROWS = [0, 1, 2] as const satisfies readonly LocalRow[]
export const COLUMNS = [0, 1, 2] as const satisfies readonly Column[]
export const GLOBAL_ROWS = [0, 1, 2, 3, 4, 5] as const satisfies readonly GlobalRow[]

export function toGlobalRow(position: BoardPosition): GlobalRow {
  if (position.side === 'ENEMY') {
    return (2 - position.row) as GlobalRow
  }

  return (3 + position.row) as GlobalRow
}

export function fromGlobalRow(row: GlobalRow, column: Column): BoardPosition {
  if (row <= 2) {
    return {
      side: 'ENEMY',
      row: (2 - row) as LocalRow,
      column,
    }
  }

  return {
    side: 'ALLY',
    row: (row - 3) as LocalRow,
    column,
  }
}

export const ALL_BOARD_POSITIONS: readonly BoardPosition[] = Object.freeze(
  GLOBAL_ROWS.flatMap((row) => COLUMNS.map((column) => Object.freeze(fromGlobalRow(row, column)))),
)

export function getBoardPositionId(position: BoardPosition): string {
  return `${position.side}:${position.row}:${position.column}`
}

export function isSamePosition(left: BoardPosition, right: BoardPosition): boolean {
  return left.side === right.side && left.row === right.row && left.column === right.column
}

export function isPositionOnSide(position: BoardPosition, side: Side): boolean {
  return position.side === side
}

export function isSameSide(left: BoardPosition, right: BoardPosition): boolean {
  return left.side === right.side
}

export function isSameColumn(left: BoardPosition, right: BoardPosition): boolean {
  return left.column === right.column
}

export function isInFrontOf(candidate: BoardPosition, reference: BoardPosition): boolean {
  return isSameSide(candidate, reference) && candidate.row < reference.row
}

export function isBehind(candidate: BoardPosition, reference: BoardPosition): boolean {
  return isSameSide(candidate, reference) && candidate.row > reference.row
}

export function areAdjacent(left: BoardPosition, right: BoardPosition): boolean {
  if (!isSameSide(left, right) || isSamePosition(left, right)) {
    return false
  }

  const rowDistance = Math.abs(left.row - right.row)
  const columnDistance = Math.abs(left.column - right.column)

  return rowDistance <= 1 && columnDistance <= 1
}

export function getAdjacentPositions(position: BoardPosition): readonly BoardPosition[] {
  return LOCAL_ROWS.flatMap((row) =>
    COLUMNS.map((column) => ({ side: position.side, row, column }) satisfies BoardPosition),
  ).filter((candidate) => areAdjacent(position, candidate))
}

export function getOppositeSide(side: Side): Side {
  return side === 'ALLY' ? 'ENEMY' : 'ALLY'
}

export function toOpposingPosition(position: BoardPosition): BoardPosition {
  return {
    side: getOppositeSide(position.side),
    row: position.row,
    column: position.column,
  }
}
