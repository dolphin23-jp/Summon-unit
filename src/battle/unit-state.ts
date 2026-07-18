import type { BoardPosition, Side } from './board'
import {
  assertValidMonsterSpecies,
  type MonsterSpecies,
  type SpeciesId,
} from '../content/monster-species'

export type BattleUnitId = string
export type UnitInstanceId = string

export interface BattleUnitState {
  readonly battleUnitId: BattleUnitId
  readonly sourceInstanceId: UnitInstanceId | null
  readonly speciesId: SpeciesId
  readonly side: Side
  readonly position: BoardPosition
  readonly hp: number
  readonly defeated: boolean
}

export interface CreateBattleUnitStateInput {
  readonly battleUnitId: BattleUnitId
  readonly sourceInstanceId?: UnitInstanceId | null
  readonly position: BoardPosition
  readonly initialHp?: number
}

function assertNonEmptyId(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
}

function assertValidHp(hp: number, maxHp: number): void {
  if (!Number.isInteger(hp) || hp < 0 || hp > maxHp) {
    throw new Error(`hp must be an integer between 0 and ${maxHp}`)
  }
}

export function assertValidBattleUnitState(
  state: BattleUnitState,
  species: MonsterSpecies,
): void {
  assertValidMonsterSpecies(species)
  assertNonEmptyId(state.battleUnitId, 'battleUnitId')

  if (state.sourceInstanceId !== null) {
    assertNonEmptyId(state.sourceInstanceId, 'sourceInstanceId')
  }

  if (state.speciesId !== species.id) {
    throw new Error('state.speciesId must match species.id')
  }

  if (state.side !== state.position.side) {
    throw new Error('state.side must match state.position.side')
  }

  assertValidHp(state.hp, species.stats.hp)

  if (state.defeated !== (state.hp === 0)) {
    throw new Error('state.defeated must be true exactly when state.hp is 0')
  }
}

export function createBattleUnitState(
  species: MonsterSpecies,
  input: CreateBattleUnitStateInput,
): BattleUnitState {
  assertValidMonsterSpecies(species)
  assertNonEmptyId(input.battleUnitId, 'battleUnitId')

  const sourceInstanceId = input.sourceInstanceId ?? null
  if (sourceInstanceId !== null) {
    assertNonEmptyId(sourceInstanceId, 'sourceInstanceId')
  }

  const hp = input.initialHp ?? species.stats.hp
  assertValidHp(hp, species.stats.hp)

  const state: BattleUnitState = {
    battleUnitId: input.battleUnitId,
    sourceInstanceId,
    speciesId: species.id,
    side: input.position.side,
    position: { ...input.position },
    hp,
    defeated: hp === 0,
  }

  assertValidBattleUnitState(state, species)
  return state
}

export function withBattleUnitHp(
  state: BattleUnitState,
  species: MonsterSpecies,
  hp: number,
): BattleUnitState {
  assertValidBattleUnitState(state, species)
  assertValidHp(hp, species.stats.hp)

  const nextState: BattleUnitState = {
    ...state,
    hp,
    defeated: hp === 0,
  }

  assertValidBattleUnitState(nextState, species)
  return nextState
}
