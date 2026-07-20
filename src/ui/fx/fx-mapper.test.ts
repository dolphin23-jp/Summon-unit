import { describe, expect, it } from 'vitest'
import type { BattleEvent } from '../../battle/event-log'
import { STANDARD_HEADLESS_BATTLE } from '../../demo/standard-headless-battle'
import { mapBattleEventsToFxCommands } from './fx-mapper'

const positions = Object.freeze({
  'ally.alpha': 'ALLY:0:0',
  'enemy.delta': 'ENEMY:0:0',
})

function event<T extends BattleEvent>(value: T): T {
  return Object.freeze({ ...value, payload: Object.freeze({ ...value.payload }) }) as T
}

const skillId = STANDARD_HEADLESS_BATTLE.skills[0]?.id ?? 'skill.demo'

const EVENTS: readonly BattleEvent[] = Object.freeze([
  event({
    id: 'battle-event:0',
    sequence: 0,
    virtualTime: 100,
    kind: 'turn_started',
    payload: { battleUnitId: 'ally.alpha' },
  }),
  event({
    id: 'battle-event:1',
    sequence: 1,
    virtualTime: 100,
    kind: 'skill_used',
    payload: {
      actorBattleUnitId: 'ally.alpha',
      targetBattleUnitId: 'enemy.delta',
      skillId,
    },
  }),
  event({
    id: 'battle-event:2',
    sequence: 2,
    virtualTime: 100,
    kind: 'damage_applied',
    payload: {
      sourceBattleUnitId: 'ally.alpha',
      targetBattleUnitId: 'enemy.delta',
      skillId,
      calculatedDamage: 24,
      appliedDamage: 18,
      hpBefore: 80,
      hpAfter: 62,
    },
  }),
  event({
    id: 'battle-event:3',
    sequence: 3,
    virtualTime: 100,
    kind: 'barrier_absorbed',
    payload: {
      sourceBattleUnitId: 'ally.alpha',
      targetBattleUnitId: 'enemy.delta',
      skillId,
      barrierLayerId: 'barrier.test',
      barrierSourceBattleUnitId: 'enemy.delta',
      absorbedDamage: 6,
      remainingCapacityBefore: 6,
      remainingCapacityAfter: 0,
      broken: true,
    },
  }),
  event({
    id: 'battle-event:4',
    sequence: 4,
    virtualTime: 100,
    kind: 'unit_moved',
    payload: {
      battleUnitId: 'ally.alpha',
      fromPositionId: 'ALLY:0:0',
      toPositionId: 'ALLY:1:0',
    },
  }),
  event({
    id: 'battle-event:5',
    sequence: 5,
    virtualTime: 100,
    kind: 'effect_applied',
    payload: {
      activeEffectId: 'effect.active.poison',
      effectId: 'effect.status.poison',
      sourceBattleUnitId: 'ally.alpha',
      targetBattleUnitId: 'enemy.delta',
      strength: 3,
      stacks: 2,
      stackLimit: 5,
      durationUnit: 'TRIGGERS',
      durationRemaining: 3,
    },
  }),
  event({
    id: 'battle-event:6',
    sequence: 6,
    virtualTime: 100,
    kind: 'unit_defeated',
    payload: {
      defeatedBattleUnitId: 'enemy.delta',
      killerBattleUnitId: 'ally.alpha',
    },
  }),
])

function map(motionLevel: 'STANDARD' | 'REDUCED' | 'MINIMAL', skipAnimations = false) {
  return mapBattleEventsToFxCommands(EVENTS, {
    motionLevel,
    skipAnimations,
    playbackRate: 1,
    positionIdByBattleUnitId: positions,
    skills: STANDARD_HEADLESS_BATTLE.skills,
  })
}

describe('battle FX mapper', () => {
  it('maps event log entries to deterministic presentation commands', () => {
    const first = map('STANDARD')
    const second = map('STANDARD')
    expect(first.map((command) => command.kind)).toEqual(
      expect.arrayContaining([
        'ACTOR_FOCUS',
        'SKILL_PRESET',
        'FLOAT_TEXT',
        'HIT_FLASH',
        'MOVE',
        'DEFEAT',
      ]),
    )
    expect(first.find((command) => command.text?.startsWith('-18'))).toMatchObject({
      positionId: 'ENEMY:0:0',
      tone: 'DAMAGE',
    })
    expect(first.find((command) => command.text === '吸収 6')).toBeDefined()
    expect(first.find((command) => command.text === '毒')).toMatchObject({ compact: true })
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('keeps only number pops and emphasis in reduced mode', () => {
    const commands = map('REDUCED')
    expect(commands.length).toBeGreaterThan(0)
    expect(
      commands.every((command) =>
        ['FLOAT_TEXT', 'ACTOR_FOCUS', 'HIT_FLASH'].includes(command.kind),
      ),
    ).toBe(true)
    expect(commands.some((command) => command.kind === 'MOVE')).toBe(false)
    expect(commands.some((command) => command.kind === 'SKILL_PRESET')).toBe(false)
  })

  it('generates no commands for minimal motion or skipped playback', () => {
    expect(map('MINIMAL')).toEqual([])
    expect(map('STANDARD', true)).toEqual([])
  })

  it('scales durations for faster playback without changing command identity', () => {
    const normal = map('STANDARD')
    const fast = mapBattleEventsToFxCommands(EVENTS, {
      motionLevel: 'STANDARD',
      playbackRate: 4,
      positionIdByBattleUnitId: positions,
      skills: STANDARD_HEADLESS_BATTLE.skills,
    })
    expect(fast.map((command) => command.id)).toEqual(normal.map((command) => command.id))
    expect(fast.every((command, index) => command.durationMs <= normal[index].durationMs)).toBe(
      true,
    )
  })
})
