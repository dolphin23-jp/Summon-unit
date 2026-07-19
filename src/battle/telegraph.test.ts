import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { createBattleState } from './defeat-and-victory'
import { createOccupyingBoardObjectState } from './occupying-board-object'
import {
  TELEGRAPH_RESOLVE_EVENT_PRIORITY,
  createTelegraphResolveEvent,
  resolveTelegraphEvent,
  scheduleTelegraph,
} from './telegraph'
import { createTimelineQueue } from './timeline-queue'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.telegraph-test',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 20, defense: 20, speed: 3 }),
  innateSkillId: 'skill.telegraph',
})

const telegraphSkill: SkillDefinition = Object.freeze({
  id: 'skill.telegraph',
  slotType: 'INNATE',
  actionCost: 120,
  telegraphDelay: 25,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1500,
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

function createEvent() {
  return createTelegraphResolveEvent({
    telegraphId: 'telegraph.1',
    sourceBattleUnitId: 'ally.source',
    skill: telegraphSkill,
    targetPositions: [{ side: 'ENEMY', row: 0, column: 1 }],
    currentTime: 100,
    sequence: 7,
  })
}

describe('T022 telegraph scheduling and resolution', () => {
  it('schedules a TELEGRAPH_RESOLVE event after telegraphDelay', () => {
    const event = createEvent()

    expect(event).toEqual({
      id: 'telegraph-resolve:telegraph.1',
      time: 125,
      priority: TELEGRAPH_RESOLVE_EVENT_PRIORITY,
      sequence: 7,
      kind: 'TELEGRAPH_RESOLVE',
      payload: {
        telegraphId: 'telegraph.1',
        sourceBattleUnitId: 'ally.source',
        skillId: 'skill.telegraph',
        declaredAt: 100,
        targetPositions: [{ side: 'ENEMY', row: 0, column: 1 }],
      },
    })
    expect(Object.isFrozen(event)).toBe(true)
    expect(Object.isFrozen(event.payload)).toBe(true)
    expect(Object.isFrozen(event.payload.targetPositions)).toBe(true)
  })

  it('resolves before a unit turn at the same virtual time', () => {
    const queue = createTimelineQueue([
      {
        id: 'unit-turn:enemy.target',
        time: 125,
        priority: 0,
        sequence: 0,
        kind: 'UNIT_TURN',
        payload: Object.freeze({ battleUnitId: 'enemy.target' }),
      },
    ])
    const scheduled = scheduleTelegraph({
      queue,
      telegraphId: 'telegraph.1',
      sourceBattleUnitId: 'ally.source',
      skill: telegraphSkill,
      targetPositions: [{ side: 'ENEMY', row: 0, column: 1 }],
      currentTime: 100,
      sequence: 1,
    })

    expect(scheduled.queue.events.map((event) => event.kind)).toEqual([
      'TELEGRAPH_RESOLVE',
      'UNIT_TURN',
    ])
    expect(queue.events).toHaveLength(1)
  })

  it('hits the current occupant of the declared cell, not the original intended unit id', () => {
    const battle = createBattleState({
      units: [
        unit('ally.source', 'ALLY', 0, 1),
        unit('enemy.original-target', 'ENEMY', 1, 1),
        unit('enemy.replacement', 'ENEMY', 0, 1),
      ],
    })
    const result = resolveTelegraphEvent({ event: createEvent(), battle })

    expect(result.hitBattleUnitIds).toEqual(['enemy.replacement'])
    expect(result.hitBoardObjectIds).toEqual([])
    expect(result.emptyPositionIds).toEqual([])
    expect(result.impacts[0]?.occupant).toEqual({
      kind: 'UNIT',
      id: 'enemy.replacement',
      position: { side: 'ENEMY', row: 0, column: 1 },
    })
  })

  it('can hit an occupying board object at resolution time', () => {
    const battle = createBattleState({
      units: [
        unit('ally.source', 'ALLY', 0, 1),
        unit('enemy.target', 'ENEMY', 1, 1),
      ],
    })
    const wall = createOccupyingBoardObjectState({
      boardObjectId: 'object.wall',
      objectTypeId: 'object-type.wall',
      position: { side: 'ENEMY', row: 0, column: 1 },
      maxHp: 40,
    })
    const result = resolveTelegraphEvent({
      event: createEvent(),
      battle,
      objects: [wall],
    })

    expect(result.hitBattleUnitIds).toEqual([])
    expect(result.hitBoardObjectIds).toEqual(['object.wall'])
    expect(result.emptyPositionIds).toEqual([])
  })

  it('records an empty impact when the declared cell is vacant', () => {
    const battle = createBattleState({
      units: [
        unit('ally.source', 'ALLY', 0, 1),
        unit('enemy.target', 'ENEMY', 1, 1),
      ],
    })
    const result = resolveTelegraphEvent({ event: createEvent(), battle })

    expect(result.hitBattleUnitIds).toEqual([])
    expect(result.hitBoardObjectIds).toEqual([])
    expect(result.emptyPositionIds).toEqual(['ENEMY:0:1'])
  })

  it('canonicalizes target cells and rejects duplicate cells', () => {
    const event = createTelegraphResolveEvent({
      telegraphId: 'telegraph.area',
      sourceBattleUnitId: 'ally.source',
      skill: telegraphSkill,
      targetPositions: [
        { side: 'ALLY', row: 2, column: 2 },
        { side: 'ENEMY', row: 2, column: 0 },
        { side: 'ENEMY', row: 0, column: 1 },
      ],
      currentTime: 0,
      sequence: 0,
    })

    expect(event.payload.targetPositions).toEqual([
      { side: 'ENEMY', row: 2, column: 0 },
      { side: 'ENEMY', row: 0, column: 1 },
      { side: 'ALLY', row: 2, column: 2 },
    ])
    expect(() =>
      createTelegraphResolveEvent({
        telegraphId: 'telegraph.duplicate',
        sourceBattleUnitId: 'ally.source',
        skill: telegraphSkill,
        targetPositions: [
          { side: 'ENEMY', row: 0, column: 1 },
          { side: 'ENEMY', row: 0, column: 1 },
        ],
        currentTime: 0,
        sequence: 0,
      }),
    ).toThrow('targetPositions must not repeat ENEMY:0:1')
  })

  it('rejects immediate skills because they do not reserve an impact event', () => {
    const immediateSkill: SkillDefinition = Object.freeze({
      ...telegraphSkill,
      id: 'skill.immediate',
      telegraphDelay: null,
    })

    expect(() =>
      createTelegraphResolveEvent({
        telegraphId: 'telegraph.invalid',
        sourceBattleUnitId: 'ally.source',
        skill: immediateSkill,
        targetPositions: [{ side: 'ENEMY', row: 0, column: 1 }],
        currentTime: 0,
        sequence: 0,
      }),
    ).toThrow('skill must define telegraphDelay to create a telegraph event')
  })

  it('returns the same resolution one hundred times', () => {
    const battle = createBattleState({
      units: [
        unit('ally.source', 'ALLY', 0, 1),
        unit('enemy.target', 'ENEMY', 0, 1),
      ],
    })
    const input = { event: createEvent(), battle }
    const expected = resolveTelegraphEvent(input)

    for (let index = 0; index < 100; index += 1) {
      expect(resolveTelegraphEvent(input)).toEqual(expected)
    }
  })
})
