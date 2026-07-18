import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import {
  createInitialUnitActionSchedule,
  type UnitActionSchedule,
} from './action-scheduling'
import { getBoardPositionId, type BoardPosition } from './board'
import {
  createBattleState,
  getBoardOccupant,
  resolveBattleUnitDefeat,
  type BattleState,
} from './defeat-and-victory'
import {
  EMPTY_BATTLE_EVENT_LOG,
  recordBattleStarted,
  recordTurnStarted,
  recordUnitMoved,
} from './event-log'
import {
  NORMAL_MOVEMENT_ACTION_COST,
  getNormalMovementCandidates,
  performNormalMovement,
  type PerformNormalMovementInput,
} from './normal-movement'
import { createBattleUnitState, withBattleUnitHp } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.movement-runner',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.runner',
  tagIds: Object.freeze(['tag.runner']),
  innateSkillId: 'skill.movement-test',
  stats: Object.freeze({ hp: 100, attack: 20, defense: 10, speed: 4 }),
})

interface MovementFixture {
  readonly battle: BattleState
  readonly schedule: UnitActionSchedule
  readonly currentTime: number
}

function createUnit(battleUnitId: string, position: BoardPosition) {
  return createBattleUnitState(species, {
    battleUnitId,
    position,
  })
}

function createFixture(
  actorPosition: BoardPosition = { side: 'ALLY', row: 1, column: 1 },
  blockerPositions: readonly BoardPosition[] = [
    { side: 'ALLY', row: 0, column: 0 },
    { side: 'ALLY', row: 1, column: 2 },
  ],
): MovementFixture {
  const actor = createUnit('unit.ally.runner', actorPosition)
  const blockers = blockerPositions.map((position, index) =>
    createUnit(`unit.ally.blocker.${index}`, position),
  )
  const enemy = createUnit('unit.enemy.guard', { side: 'ENEMY', row: 0, column: 1 })
  const schedule = createInitialUnitActionSchedule(actor, species, 100, 0)

  return {
    battle: createBattleState({ units: [actor, ...blockers, enemy] }),
    schedule,
    currentTime: schedule.nextActionTime,
  }
}

function createMovementInput(
  fixture: MovementFixture,
  destination: BoardPosition,
): PerformNormalMovementInput {
  return {
    battle: fixture.battle,
    actorBattleUnitId: 'unit.ally.runner',
    actorSpecies: species,
    actorSchedule: fixture.schedule,
    destination,
    currentTime: fixture.currentTime,
  }
}

function movementCandidateIds(battle: BattleState): readonly string[] {
  return getNormalMovementCandidates(battle, 'unit.ally.runner').map(getBoardPositionId)
}

describe('normal movement candidates', () => {
  it('lists adjacent empty positions in stable row-major order, including diagonals', () => {
    const fixture = createFixture()
    const candidates = getNormalMovementCandidates(fixture.battle, 'unit.ally.runner')

    expect(candidates.map(getBoardPositionId)).toEqual([
      'ALLY:0:1',
      'ALLY:0:2',
      'ALLY:1:0',
      'ALLY:2:0',
      'ALLY:2:1',
      'ALLY:2:2',
    ])
    expect(Object.isFrozen(candidates)).toBe(true)
    expect(candidates.every(Object.isFrozen)).toBe(true)
  })

  it('returns only the three in-board neighbors for a corner unit', () => {
    const fixture = createFixture({ side: 'ALLY', row: 0, column: 0 }, [])

    expect(movementCandidateIds(fixture.battle)).toEqual([
      'ALLY:0:1',
      'ALLY:1:0',
      'ALLY:1:1',
    ])
  })

  it('returns no candidates for a defeated unit', () => {
    const actor = createUnit('unit.ally.runner', { side: 'ALLY', row: 1, column: 1 })
    const ally = createUnit('unit.ally.survivor', { side: 'ALLY', row: 0, column: 0 })
    const enemy = createUnit('unit.enemy.guard', { side: 'ENEMY', row: 0, column: 0 })
    const initial = createBattleState({ units: [actor, ally, enemy] })
    const defeatedActor = withBattleUnitHp(actor, species, 0)
    const battle = resolveBattleUnitDefeat({
      battle: initial,
      defeatedUnit: defeatedActor,
      currentTime: 1,
      killerBattleUnitId: enemy.battleUnitId,
    })

    expect(getNormalMovementCandidates(battle, actor.battleUnitId)).toEqual([])
  })
})

describe('normal movement execution', () => {
  it('moves diagonally, frees the old cell, occupies the destination, and reschedules at cost 75', () => {
    const fixture = createFixture()
    const input = createMovementInput(fixture, { side: 'ALLY', row: 0, column: 2 })
    const battleBefore = structuredClone(fixture.battle)
    const scheduleBefore = structuredClone(fixture.schedule)
    const result = performNormalMovement(input)

    expect(NORMAL_MOVEMENT_ACTION_COST).toBe(75)
    expect(result.from).toEqual({ side: 'ALLY', row: 1, column: 1 })
    expect(result.to).toEqual({ side: 'ALLY', row: 0, column: 2 })
    expect(
      result.battle.units.find((unit) => unit.battleUnitId === 'unit.ally.runner')?.position,
    ).toEqual(result.to)
    expect(getBoardOccupant(result.battle, result.from)).toBeNull()
    expect(getBoardOccupant(result.battle, result.to)?.battleUnitId).toBe('unit.ally.runner')

    expect(result.actorSchedule.tie.actionCount).toBe(1)
    expect(result.actorSchedule.tie.lastActionTime).toBe(fixture.currentTime)
    expect(result.actorSchedule.nextActionTime).toBe(fixture.currentTime + 18_750)

    expect(fixture.battle).toEqual(battleBefore)
    expect(fixture.schedule).toEqual(scheduleBefore)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.battle)).toBe(true)
    expect(Object.isFrozen(result.battle.units)).toBe(true)
    expect(Object.isFrozen(result.battle.occupancy)).toBe(true)
  })

  it('records a deterministic unit_moved event with fixed position ids', () => {
    const fixture = createFixture()
    const result = performNormalMovement(
      createMovementInput(fixture, { side: 'ALLY', row: 0, column: 2 }),
    )
    let log = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, fixture.battle)
    log = recordTurnStarted(log, result.battleUnitId, fixture.currentTime)
    log = recordUnitMoved(log, {
      virtualTime: fixture.currentTime,
      battleUnitId: result.battleUnitId,
      from: result.from,
      to: result.to,
    })

    expect(log.events.at(-1)).toEqual({
      id: 'battle-event:2',
      kind: 'unit_moved',
      sequence: 2,
      virtualTime: fixture.currentTime,
      payload: {
        battleUnitId: 'unit.ally.runner',
        fromPositionId: 'ALLY:1:1',
        toPositionId: 'ALLY:0:2',
      },
    })
    expect(
      recordUnitMoved(
        recordTurnStarted(
          recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, fixture.battle),
          result.battleUnitId,
          fixture.currentTime,
        ),
        {
          virtualTime: fixture.currentTime,
          battleUnitId: result.battleUnitId,
          from: result.from,
          to: result.to,
        },
      ),
    ).toEqual(log)
  })

  it('rejects occupied, enemy-side, non-adjacent, and out-of-board destinations', () => {
    const fixture = createFixture()

    expect(() =>
      performNormalMovement(
        createMovementInput(fixture, { side: 'ALLY', row: 1, column: 2 }),
      ),
    ).toThrow('normal movement destination must be empty')
    expect(() =>
      performNormalMovement(
        createMovementInput(fixture, { side: 'ENEMY', row: 1, column: 1 }),
      ),
    ).toThrow('normal movement must stay within the actor side')

    const cornerFixture = createFixture({ side: 'ALLY', row: 0, column: 0 }, [])
    expect(() =>
      performNormalMovement(
        createMovementInput(cornerFixture, { side: 'ALLY', row: 2, column: 2 }),
      ),
    ).toThrow('normal movement destination must be an adjacent position')

    expect(() =>
      performNormalMovement(
        createMovementInput(fixture, {
          side: 'ALLY',
          row: 3,
          column: 1,
        } as unknown as BoardPosition),
      ),
    ).toThrow('destination.row must be 0, 1, or 2')
  })

  it('rejects a defeated actor and action-time or schedule mismatches', () => {
    const actor = createUnit('unit.ally.runner', { side: 'ALLY', row: 1, column: 1 })
    const ally = createUnit('unit.ally.survivor', { side: 'ALLY', row: 0, column: 0 })
    const enemy = createUnit('unit.enemy.guard', { side: 'ENEMY', row: 0, column: 0 })
    const schedule = createInitialUnitActionSchedule(actor, species, 100, 0)
    const initial = createBattleState({ units: [actor, ally, enemy] })
    const battle = resolveBattleUnitDefeat({
      battle: initial,
      defeatedUnit: withBattleUnitHp(actor, species, 0),
      currentTime: 1,
      killerBattleUnitId: enemy.battleUnitId,
    })

    expect(() =>
      performNormalMovement({
        battle,
        actorBattleUnitId: actor.battleUnitId,
        actorSpecies: species,
        actorSchedule: schedule,
        destination: { side: 'ALLY', row: 1, column: 0 },
        currentTime: schedule.nextActionTime,
      }),
    ).toThrow('defeated unit cannot move')

    const fixture = createFixture()
    expect(() =>
      performNormalMovement({
        ...createMovementInput(fixture, { side: 'ALLY', row: 0, column: 2 }),
        currentTime: fixture.currentTime - 1,
      }),
    ).toThrow('currentTime must match actorSchedule.nextActionTime')
    expect(() =>
      performNormalMovement({
        ...createMovementInput(fixture, { side: 'ALLY', row: 0, column: 2 }),
        actorBattleUnitId: 'unit.ally.blocker.0',
      }),
    ).toThrow('actorSchedule.battleUnitId must match actorBattleUnitId')
  })
})
