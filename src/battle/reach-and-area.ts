import {
  assertValidSkillDefinition,
  resolveSkillAreaMask,
  resolveSkillChainTargetCount,
  resolveSkillReachMethod,
  resolveSkillTargetSelector,
  type SkillAreaMask,
  type SkillDefinition,
  type SkillReachMethod,
  type SkillTargetSide,
} from '../content/skill-definition'
import {
  ALL_BOARD_POSITIONS,
  COLUMNS,
  GLOBAL_ROWS,
  LOCAL_ROWS,
  fromGlobalRow,
  getBoardPositionId,
  getOppositeSide,
  isSamePosition,
  toGlobalRow,
  type BoardPosition,
  type Column,
  type GlobalRow,
  type Side,
} from './board'
import {
  assertValidBattleState,
  getBoardOccupant,
  type BattleState,
} from './defeat-and-victory'
import {
  getSameColumnEnemyCandidates,
  resolveDirectTarget,
} from './direct-targeting'
import type { BattleUnitId, BattleUnitState } from './unit-state'

export interface ResolveSkillReachInput {
  readonly battle: BattleState
  readonly actorBattleUnitId: BattleUnitId
  readonly skill: SkillDefinition
  readonly selectedTargetBattleUnitId?: BattleUnitId
  readonly selectedTargetPosition?: BoardPosition
}

export interface SkillReachResolution {
  readonly actorBattleUnitId: BattleUnitId
  readonly reachMethod: SkillReachMethod
  readonly selectedTargetBattleUnitId: BattleUnitId | null
  readonly actualTargetBattleUnitId: BattleUnitId | null
  readonly impactPosition: BoardPosition | null
  readonly blockedByBattleUnitId: BattleUnitId | null
  readonly reachablePositions: readonly BoardPosition[]
  readonly traversedBattleUnitIds: readonly BattleUnitId[]
}

export interface ResolveSkillAreaInput {
  readonly battle: BattleState
  readonly actorBattleUnitId: BattleUnitId
  readonly skill: SkillDefinition
  readonly reach: SkillReachResolution
}

export interface SkillAreaResolution {
  readonly areaMask: SkillAreaMask
  readonly positions: readonly BoardPosition[]
  readonly targets: readonly BattleUnitState[]
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function comparePositions(left: BoardPosition, right: BoardPosition): number {
  const rowDifference = toGlobalRow(left) - toGlobalRow(right)
  return rowDifference !== 0 ? rowDifference : left.column - right.column
}

function freezePosition(position: BoardPosition): BoardPosition {
  return Object.freeze({ ...position })
}

function freezePositions(positions: readonly BoardPosition[]): readonly BoardPosition[] {
  const unique = new Map<string, BoardPosition>()
  for (const position of positions) {
    unique.set(getBoardPositionId(position), freezePosition(position))
  }
  return Object.freeze([...unique.values()].sort(comparePositions))
}

function getRequiredUnit(
  battle: BattleState,
  battleUnitId: BattleUnitId,
  field: string,
): BattleUnitState {
  if (battleUnitId.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`${field} must reference a battle unit: ${battleUnitId}`)
  }
  return unit
}

function getLivingActor(
  battle: BattleState,
  actorBattleUnitId: BattleUnitId,
): BattleUnitState {
  const actor = getRequiredUnit(battle, actorBattleUnitId, 'actorBattleUnitId')
  if (actor.defeated) {
    throw new Error('defeated actor cannot resolve skill reach')
  }
  return actor
}

function getSelectorBoardSide(actor: BattleUnitState, selectorSide: SkillTargetSide): Side {
  return selectorSide === 'ENEMY' ? getOppositeSide(actor.side) : actor.side
}

function isLivingSelectorTarget(
  unit: BattleUnitState,
  actor: BattleUnitState,
  selectorSide: SkillTargetSide,
): boolean {
  return !unit.defeated && unit.side === getSelectorBoardSide(actor, selectorSide)
}

function assertValidSelectedPosition(position: BoardPosition): void {
  if (
    !ALL_BOARD_POSITIONS.some((candidate) =>
      isSamePosition(candidate, position),
    )
  ) {
    throw new Error('selectedTargetPosition must be a valid board position')
  }
}

function getSidePositions(side: Side): readonly BoardPosition[] {
  return freezePositions(
    LOCAL_ROWS.flatMap((row) =>
      COLUMNS.map((column) => ({ side, row, column }) satisfies BoardPosition),
    ),
  )
}

export function getSkillReachablePositions(
  battle: BattleState,
  actorBattleUnitId: BattleUnitId,
  skill: SkillDefinition,
): readonly BoardPosition[] {
  assertValidBattleState(battle)
  assertValidSkillDefinition(skill)
  const actor = getLivingActor(battle, actorBattleUnitId)
  const selector = resolveSkillTargetSelector(skill)
  const reachMethod = resolveSkillReachMethod(skill)
  const targetSide = getSelectorBoardSide(actor, selector.side)

  switch (reachMethod) {
    case 'CONTACT':
      return actor.position.row === 0
        ? freezePositions([
            { side: targetSide, row: 0, column: actor.position.column },
          ])
        : Object.freeze([])
    case 'DIRECT':
    case 'PIERCE':
      return freezePositions(
        LOCAL_ROWS.map((row) => ({
          side: targetSide,
          row,
          column: actor.position.column,
        })),
      )
    case 'ARC':
    case 'GLOBAL':
      return getSidePositions(targetSide)
    case 'SNIPE':
      return freezePositions(
        battle.units
          .filter((unit) => isLivingSelectorTarget(unit, actor, selector.side))
          .sort((left, right) => compareIds(left.battleUnitId, right.battleUnitId))
          .map((unit) => unit.position),
      )
    case 'SELF':
      return freezePositions([actor.position])
  }
}

export function getSkillReachTargetCandidates(
  battle: BattleState,
  actorBattleUnitId: BattleUnitId,
  skill: SkillDefinition,
): readonly BattleUnitState[] {
  assertValidBattleState(battle)
  assertValidSkillDefinition(skill)
  const actor = getLivingActor(battle, actorBattleUnitId)
  const selector = resolveSkillTargetSelector(skill)
  const reachMethod = resolveSkillReachMethod(skill)

  switch (reachMethod) {
    case 'CONTACT': {
      const position = getSkillReachablePositions(battle, actorBattleUnitId, skill)[0]
      if (position === undefined) {
        return Object.freeze([])
      }
      const occupant = getBoardOccupant(battle, position)
      if (occupant === null) {
        return Object.freeze([])
      }
      const unit = getRequiredUnit(battle, occupant.battleUnitId, 'contactTarget')
      return isLivingSelectorTarget(unit, actor, selector.side)
        ? Object.freeze([unit])
        : Object.freeze([])
    }
    case 'DIRECT':
    case 'PIERCE':
      return getSameColumnEnemyCandidates(battle, actorBattleUnitId)
    case 'ARC':
    case 'SNIPE':
    case 'GLOBAL':
      return Object.freeze(
        battle.units
          .filter((unit) => isLivingSelectorTarget(unit, actor, selector.side))
          .sort((left, right) => compareIds(left.battleUnitId, right.battleUnitId)),
      )
    case 'SELF':
      return Object.freeze([actor])
  }
}

function assertSelectedUnitMatchesPosition(
  selected: BattleUnitState,
  selectedTargetPosition: BoardPosition | undefined,
): void {
  if (
    selectedTargetPosition !== undefined &&
    !isSamePosition(selected.position, selectedTargetPosition)
  ) {
    throw new Error('selected target unit must occupy selectedTargetPosition')
  }
}

function freezeReachResolution(
  resolution: Omit<SkillReachResolution, 'reachablePositions' | 'traversedBattleUnitIds'> & {
    readonly reachablePositions: readonly BoardPosition[]
    readonly traversedBattleUnitIds: readonly BattleUnitId[]
  },
): SkillReachResolution {
  return Object.freeze({
    ...resolution,
    impactPosition:
      resolution.impactPosition === null
        ? null
        : freezePosition(resolution.impactPosition),
    reachablePositions: freezePositions(resolution.reachablePositions),
    traversedBattleUnitIds: Object.freeze([...resolution.traversedBattleUnitIds]),
  })
}

export function resolveSkillReach(input: ResolveSkillReachInput): SkillReachResolution {
  assertValidBattleState(input.battle)
  assertValidSkillDefinition(input.skill)
  const actor = getLivingActor(input.battle, input.actorBattleUnitId)
  const selector = resolveSkillTargetSelector(input.skill)
  const reachMethod = resolveSkillReachMethod(input.skill)
  const reachablePositions = getSkillReachablePositions(
    input.battle,
    actor.battleUnitId,
    input.skill,
  )

  if (input.selectedTargetPosition !== undefined) {
    assertValidSelectedPosition(input.selectedTargetPosition)
  }

  switch (reachMethod) {
    case 'CONTACT': {
      const target = getSkillReachTargetCandidates(
        input.battle,
        actor.battleUnitId,
        input.skill,
      )[0]
      if (target === undefined) {
        throw new Error('CONTACT reach requires a living enemy in the opposing front cell')
      }
      if (
        input.selectedTargetBattleUnitId !== undefined &&
        input.selectedTargetBattleUnitId !== target.battleUnitId
      ) {
        throw new Error('CONTACT selected target must occupy the opposing front cell')
      }
      assertSelectedUnitMatchesPosition(target, input.selectedTargetPosition)
      return freezeReachResolution({
        actorBattleUnitId: actor.battleUnitId,
        reachMethod,
        selectedTargetBattleUnitId: target.battleUnitId,
        actualTargetBattleUnitId: target.battleUnitId,
        impactPosition: target.position,
        blockedByBattleUnitId: null,
        reachablePositions,
        traversedBattleUnitIds: [target.battleUnitId],
      })
    }
    case 'DIRECT': {
      if (input.selectedTargetBattleUnitId === undefined) {
        throw new Error('DIRECT reach requires selectedTargetBattleUnitId')
      }
      const selected = getRequiredUnit(
        input.battle,
        input.selectedTargetBattleUnitId,
        'selectedTargetBattleUnitId',
      )
      assertSelectedUnitMatchesPosition(selected, input.selectedTargetPosition)
      const direct = resolveDirectTarget({
        battle: input.battle,
        attackerBattleUnitId: actor.battleUnitId,
        intendedTargetBattleUnitId: selected.battleUnitId,
      })
      const actual = getRequiredUnit(
        input.battle,
        direct.actualTargetBattleUnitId,
        'actualTargetBattleUnitId',
      )
      return freezeReachResolution({
        actorBattleUnitId: actor.battleUnitId,
        reachMethod,
        selectedTargetBattleUnitId: selected.battleUnitId,
        actualTargetBattleUnitId: actual.battleUnitId,
        impactPosition: actual.position,
        blockedByBattleUnitId: direct.blockingBattleUnitId,
        reachablePositions,
        traversedBattleUnitIds: [actual.battleUnitId],
      })
    }
    case 'PIERCE': {
      if (input.selectedTargetBattleUnitId === undefined) {
        throw new Error('PIERCE reach requires selectedTargetBattleUnitId')
      }
      const candidates = getSameColumnEnemyCandidates(input.battle, actor.battleUnitId)
      const selected = candidates.find(
        (candidate) => candidate.battleUnitId === input.selectedTargetBattleUnitId,
      )
      if (selected === undefined) {
        throw new Error('PIERCE selected target must be a living enemy in the actor column')
      }
      assertSelectedUnitMatchesPosition(selected, input.selectedTargetPosition)
      return freezeReachResolution({
        actorBattleUnitId: actor.battleUnitId,
        reachMethod,
        selectedTargetBattleUnitId: selected.battleUnitId,
        actualTargetBattleUnitId: selected.battleUnitId,
        impactPosition: selected.position,
        blockedByBattleUnitId: null,
        reachablePositions,
        traversedBattleUnitIds: candidates.map((candidate) => candidate.battleUnitId),
      })
    }
    case 'ARC': {
      if (input.selectedTargetPosition === undefined) {
        throw new Error('ARC reach requires selectedTargetPosition')
      }
      const targetSide = getSelectorBoardSide(actor, selector.side)
      if (input.selectedTargetPosition.side !== targetSide) {
        throw new Error('ARC selectedTargetPosition must be on the target side')
      }
      const occupant = getBoardOccupant(input.battle, input.selectedTargetPosition)
      const actual =
        occupant === null
          ? null
          : getRequiredUnit(input.battle, occupant.battleUnitId, 'arcTarget')
      if (input.selectedTargetBattleUnitId !== undefined) {
        const selected = getRequiredUnit(
          input.battle,
          input.selectedTargetBattleUnitId,
          'selectedTargetBattleUnitId',
        )
        if (!isLivingSelectorTarget(selected, actor, selector.side)) {
          throw new Error('ARC selected target must match the target selector')
        }
        assertSelectedUnitMatchesPosition(selected, input.selectedTargetPosition)
      }
      if (
        input.selectedTargetBattleUnitId !== undefined &&
        actual?.battleUnitId !== input.selectedTargetBattleUnitId
      ) {
        throw new Error('ARC selected target must occupy selectedTargetPosition')
      }
      return freezeReachResolution({
        actorBattleUnitId: actor.battleUnitId,
        reachMethod,
        selectedTargetBattleUnitId:
          input.selectedTargetBattleUnitId ?? actual?.battleUnitId ?? null,
        actualTargetBattleUnitId: actual?.battleUnitId ?? null,
        impactPosition: input.selectedTargetPosition,
        blockedByBattleUnitId: null,
        reachablePositions,
        traversedBattleUnitIds:
          actual === null ? [] : [actual.battleUnitId],
      })
    }
    case 'SNIPE': {
      if (input.selectedTargetBattleUnitId === undefined) {
        throw new Error('SNIPE reach requires selectedTargetBattleUnitId')
      }
      const selected = getRequiredUnit(
        input.battle,
        input.selectedTargetBattleUnitId,
        'selectedTargetBattleUnitId',
      )
      if (!isLivingSelectorTarget(selected, actor, selector.side)) {
        throw new Error('SNIPE selected target must match the target selector')
      }
      assertSelectedUnitMatchesPosition(selected, input.selectedTargetPosition)
      return freezeReachResolution({
        actorBattleUnitId: actor.battleUnitId,
        reachMethod,
        selectedTargetBattleUnitId: selected.battleUnitId,
        actualTargetBattleUnitId: selected.battleUnitId,
        impactPosition: selected.position,
        blockedByBattleUnitId: null,
        reachablePositions,
        traversedBattleUnitIds: [selected.battleUnitId],
      })
    }
    case 'SELF': {
      if (
        input.selectedTargetBattleUnitId !== undefined &&
        input.selectedTargetBattleUnitId !== actor.battleUnitId
      ) {
        throw new Error('SELF reach must select the actor')
      }
      assertSelectedUnitMatchesPosition(actor, input.selectedTargetPosition)
      return freezeReachResolution({
        actorBattleUnitId: actor.battleUnitId,
        reachMethod,
        selectedTargetBattleUnitId: actor.battleUnitId,
        actualTargetBattleUnitId: actor.battleUnitId,
        impactPosition: actor.position,
        blockedByBattleUnitId: null,
        reachablePositions,
        traversedBattleUnitIds: [actor.battleUnitId],
      })
    }
    case 'GLOBAL':
      if (
        input.selectedTargetBattleUnitId !== undefined ||
        input.selectedTargetPosition !== undefined
      ) {
        throw new Error('GLOBAL reach does not select a primary target or position')
      }
      return freezeReachResolution({
        actorBattleUnitId: actor.battleUnitId,
        reachMethod,
        selectedTargetBattleUnitId: null,
        actualTargetBattleUnitId: null,
        impactPosition: null,
        blockedByBattleUnitId: null,
        reachablePositions,
        traversedBattleUnitIds: [],
      })
  }
}

function getPositionIfValid(globalRow: number, column: number): BoardPosition | null {
  if (!GLOBAL_ROWS.includes(globalRow as GlobalRow) || !COLUMNS.includes(column as Column)) {
    return null
  }
  return fromGlobalRow(globalRow as GlobalRow, column as Column)
}

export function getAreaMaskPositions(
  areaMask: Exclude<SkillAreaMask, 'CHAIN' | 'SIDE_ALL'>,
  impactPosition: BoardPosition,
): readonly BoardPosition[] {
  assertValidSelectedPosition(impactPosition)
  const globalRow = toGlobalRow(impactPosition)
  const positions: BoardPosition[] = []

  switch (areaMask) {
    case 'SINGLE':
      positions.push(impactPosition)
      break
    case 'HORIZONTAL_ROW':
      positions.push(
        ...COLUMNS.map((column) => ({
          side: impactPosition.side,
          row: impactPosition.row,
          column,
        })),
      )
      break
    case 'VERTICAL_COLUMN':
      positions.push(
        ...GLOBAL_ROWS.map((row) => fromGlobalRow(row, impactPosition.column)),
      )
      break
    case 'TARGET_AND_SIDES':
      positions.push(impactPosition)
      for (const column of [impactPosition.column - 1, impactPosition.column + 1]) {
        if (COLUMNS.includes(column as Column)) {
          positions.push({ ...impactPosition, column: column as Column })
        }
      }
      break
    case 'TARGET_AND_BEHIND':
      positions.push(impactPosition)
      if (impactPosition.row < 2) {
        positions.push({ ...impactPosition, row: (impactPosition.row + 1) as 1 | 2 })
      }
      break
    case 'CROSS':
      positions.push(impactPosition)
      for (const [rowOffset, columnOffset] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const position = getPositionIfValid(
          globalRow + rowOffset,
          impactPosition.column + columnOffset,
        )
        if (position !== null) {
          positions.push(position)
        }
      }
      break
    case 'SURROUNDING_EIGHT':
      for (const rowOffset of [-1, 0, 1] as const) {
        for (const columnOffset of [-1, 0, 1] as const) {
          if (rowOffset === 0 && columnOffset === 0) {
            continue
          }
          const position = getPositionIfValid(
            globalRow + rowOffset,
            impactPosition.column + columnOffset,
          )
          if (position !== null) {
            positions.push(position)
          }
        }
      }
      break
  }

  return freezePositions(positions)
}

function getBoardDistance(left: BoardPosition, right: BoardPosition): number {
  return (
    Math.abs(toGlobalRow(left) - toGlobalRow(right)) +
    Math.abs(left.column - right.column)
  )
}

function compareUnitsByPosition(left: BattleUnitState, right: BattleUnitState): number {
  const positionDifference = comparePositions(left.position, right.position)
  return positionDifference !== 0
    ? positionDifference
    : compareIds(left.battleUnitId, right.battleUnitId)
}

function resolveChainTargets(
  battle: BattleState,
  actor: BattleUnitState,
  selectorSide: SkillTargetSide,
  primaryBattleUnitId: BattleUnitId,
  maximumTargets: number,
): readonly BattleUnitState[] {
  const primary = getRequiredUnit(battle, primaryBattleUnitId, 'chainPrimaryTarget')
  if (!isLivingSelectorTarget(primary, actor, selectorSide)) {
    throw new Error('CHAIN primary target must match the target selector')
  }

  const chain: BattleUnitState[] = [primary]
  const remaining = battle.units.filter(
    (unit) =>
      unit.battleUnitId !== primary.battleUnitId &&
      isLivingSelectorTarget(unit, actor, selectorSide),
  )

  while (chain.length < maximumTargets && remaining.length > 0) {
    const current = chain[chain.length - 1]
    remaining.sort((left, right) => {
      const distanceDifference =
        getBoardDistance(current.position, left.position) -
        getBoardDistance(current.position, right.position)
      return distanceDifference !== 0
        ? distanceDifference
        : compareIds(left.battleUnitId, right.battleUnitId)
    })
    const next = remaining.shift()
    if (next === undefined) {
      break
    }
    chain.push(next)
  }

  return Object.freeze([...chain])
}

export function resolveSkillAreaTargets(input: ResolveSkillAreaInput): SkillAreaResolution {
  assertValidBattleState(input.battle)
  assertValidSkillDefinition(input.skill)
  const actor = getLivingActor(input.battle, input.actorBattleUnitId)
  const selector = resolveSkillTargetSelector(input.skill)
  const reachMethod = resolveSkillReachMethod(input.skill)
  const areaMask = resolveSkillAreaMask(input.skill)

  if (input.reach.actorBattleUnitId !== actor.battleUnitId) {
    throw new Error('reach actor must match actorBattleUnitId')
  }
  if (input.reach.reachMethod !== reachMethod) {
    throw new Error('reach method must match the skill reachMethod')
  }

  if (areaMask === 'SIDE_ALL') {
    const targets = input.battle.units
      .filter((unit) => isLivingSelectorTarget(unit, actor, selector.side))
      .sort(compareUnitsByPosition)
    return Object.freeze({
      areaMask,
      positions: getSidePositions(getSelectorBoardSide(actor, selector.side)),
      targets: Object.freeze([...targets]),
    })
  }

  if (areaMask === 'CHAIN') {
    const primaryBattleUnitId =
      input.reach.actualTargetBattleUnitId ??
      input.reach.selectedTargetBattleUnitId
    if (primaryBattleUnitId === null) {
      throw new Error('CHAIN areaMask requires a primary target')
    }
    const targets = resolveChainTargets(
      input.battle,
      actor,
      selector.side,
      primaryBattleUnitId,
      resolveSkillChainTargetCount(input.skill),
    )
    return Object.freeze({
      areaMask,
      positions: freezePositions(targets.map((target) => target.position)),
      targets,
    })
  }

  if (input.reach.impactPosition === null) {
    throw new Error(`${areaMask} areaMask requires an impact position`)
  }
  const positions = getAreaMaskPositions(areaMask, input.reach.impactPosition)
  const positionIds = new Set(positions.map(getBoardPositionId))
  const primaryBattleUnitId = input.reach.actualTargetBattleUnitId
  const targets = input.battle.units
    .filter(
      (unit) =>
        isLivingSelectorTarget(unit, actor, selector.side) &&
        positionIds.has(getBoardPositionId(unit.position)),
    )
    .sort((left, right) => {
      if (left.battleUnitId === primaryBattleUnitId) {
        return -1
      }
      if (right.battleUnitId === primaryBattleUnitId) {
        return 1
      }
      return compareUnitsByPosition(left, right)
    })

  return Object.freeze({
    areaMask,
    positions,
    targets: Object.freeze([...targets]),
  })
}
