import { describe, expect, it } from 'vitest'
import {
  STANDARD_HEADLESS_BATTLE,
  runStandardHeadlessBattle,
} from '../demo/standard-headless-battle'
import {
  createBattleReplay,
  formatBattleEventForDisplay,
  getBattleReplayBoardCells,
} from './battle-replay'

describe('minimal battle UI replay model', () => {
  it('creates a fixed 6 by 3 board with the initial six units', () => {
    const replay = createBattleReplay(STANDARD_HEADLESS_BATTLE, runStandardHeadlessBattle())
    const initialFrame = replay.frames[0]
    const cells = getBattleReplayBoardCells(initialFrame)

    expect(cells).toHaveLength(18)
    expect(cells.filter((cell) => cell.unit !== null)).toHaveLength(6)
    expect(cells.map((cell) => cell.positionId)).toEqual([
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

  it('applies movement and damage events to intermediate frames', () => {
    const result = runStandardHeadlessBattle()
    const replay = createBattleReplay(STANDARD_HEADLESS_BATTLE, result)
    const movementIndex = result.log.events.findIndex((event) => event.kind === 'unit_moved')
    const damageIndex = result.log.events.findIndex((event) => event.kind === 'damage_applied')

    expect(movementIndex).toBeGreaterThanOrEqual(0)
    expect(damageIndex).toBeGreaterThanOrEqual(0)

    const movementEvent = result.log.events[movementIndex]
    const movementFrame = replay.frames[movementIndex + 1]
    if (movementEvent.kind !== 'unit_moved') {
      throw new Error('expected a unit_moved event')
    }
    expect(
      movementFrame.units.find(
        (unit) => unit.battleUnitId === movementEvent.payload.battleUnitId,
      )?.positionId,
    ).toBe(movementEvent.payload.toPositionId)

    const damageEvent = result.log.events[damageIndex]
    const damageFrame = replay.frames[damageIndex + 1]
    if (damageEvent.kind !== 'damage_applied') {
      throw new Error('expected a damage_applied event')
    }
    expect(
      damageFrame.units.find(
        (unit) => unit.battleUnitId === damageEvent.payload.targetBattleUnitId,
      )?.hp,
    ).toBe(damageEvent.payload.hpAfter)
  })

  it('ends with exactly the same unit state, time, and outcome as the headless runner', () => {
    const result = runStandardHeadlessBattle()
    const replay = createBattleReplay(STANDARD_HEADLESS_BATTLE, result)
    const finalFrame = replay.frames.at(-1)

    expect(finalFrame).toBeDefined()
    expect(finalFrame?.virtualTime).toBe(result.summary.finalVirtualTime)
    expect(finalFrame?.outcome).toBe(result.summary.outcome)
    expect(
      finalFrame?.units.map((unit) => ({
        battleUnitId: unit.battleUnitId,
        hp: unit.hp,
        defeated: unit.defeated,
        positionId: unit.positionId,
      })),
    ).toEqual(
      result.summary.units.map((unit) => ({
        battleUnitId: unit.battleUnitId,
        hp: unit.hp,
        defeated: unit.defeated,
        positionId: unit.positionId,
      })),
    )
  })

  it('produces identical replay frames across repeated fresh runs', () => {
    const expected = createBattleReplay(
      STANDARD_HEADLESS_BATTLE,
      runStandardHeadlessBattle(),
    )

    for (let runIndex = 0; runIndex < 50; runIndex += 1) {
      expect(
        createBattleReplay(STANDARD_HEADLESS_BATTLE, runStandardHeadlessBattle()),
      ).toEqual(expected)
    }
  }, 10_000)

  it('formats every event kind as a non-empty one-line log entry', () => {
    const result = runStandardHeadlessBattle()

    for (const event of result.log.events) {
      const line = formatBattleEventForDisplay(event)
      expect(line.trim().length).toBeGreaterThan(0)
      expect(line).not.toContain('\n')
    }
  })
})
