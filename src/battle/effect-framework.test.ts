import { describe, expect, it } from 'vitest'
import {
  EFFECT_DURATION_UNITS,
  EFFECT_RESOLUTION_STAGES,
  assertValidActiveEffectState,
  registerActiveEffect,
  removeActiveEffect,
  runEffectResolutionPipeline,
  type EffectDuration,
  type RegisterActiveEffectInput,
} from './effect-framework'

function createInput(
  overrides: Partial<RegisterActiveEffectInput> = {},
): RegisterActiveEffectInput {
  return {
    effectId: 'effect.attack-up',
    sourceBattleUnitId: 'ally.source',
    targetBattleUnitId: 'ally.target',
    strength: 20,
    stackLimit: 1,
    duration: { unit: 'TARGET_ACTIONS', remaining: 3 },
    appliedAt: 100,
    applicationSequence: 1,
    ...overrides,
  }
}

describe('effect framework', () => {
  it('represents and freezes all five duration units', () => {
    const durations: readonly EffectDuration[] = [
      { unit: 'TARGET_ACTIONS', remaining: 2 },
      { unit: 'SOURCE_ACTIONS', remaining: 2 },
      { unit: 'VIRTUAL_TIME', remaining: 500 },
      { unit: 'TRIGGERS', remaining: 3 },
      { unit: 'BATTLE', remaining: null },
    ]

    expect(durations.map((duration) => duration.unit)).toEqual(EFFECT_DURATION_UNITS)

    for (const [index, duration] of durations.entries()) {
      const sourceDuration = duration.unit === 'SOURCE_ACTIONS'
      const result = registerActiveEffect(
        [],
        createInput({
          effectId: `effect.duration.${index}`,
          duration,
          duplicateScope: sourceDuration ? 'SOURCE' : 'TARGET',
          applicationSequence: index,
        }),
      )
      const effect = result.effects[0]

      expect(result.mutation?.kind).toBe('APPLIED')
      expect(effect.duration).toEqual(duration)
      expect(Object.isFrozen(effect)).toBe(true)
      expect(Object.isFrozen(effect.duration)).toBe(true)
      expect(Object.isFrozen(result.effects)).toBe(true)
      expect(() => assertValidActiveEffectState(effect)).not.toThrow()
    }
  })

  it('keeps the stronger and longer same-name effect while respecting the stack cap', () => {
    const first = registerActiveEffect(
      [],
      createInput({
        strength: 20,
        stacks: 2,
        stackLimit: 5,
        duration: { unit: 'TARGET_ACTIONS', remaining: 2 },
      }),
    )
    const beforeSnapshot = structuredClone(first.effects)
    const merged = registerActiveEffect(
      first.effects,
      createInput({
        sourceBattleUnitId: 'ally.stronger-source',
        strength: 35,
        stacks: 4,
        stackLimit: 5,
        duration: { unit: 'TARGET_ACTIONS', remaining: 4 },
        appliedAt: 200,
        applicationSequence: 2,
      }),
    )

    expect(first.effects).toEqual(beforeSnapshot)
    expect(merged.effects).toHaveLength(1)
    expect(merged.effects[0]).toMatchObject({
      activeEffectId: first.effects[0].activeEffectId,
      sourceBattleUnitId: 'ally.stronger-source',
      strength: 35,
      stacks: 5,
      duration: { unit: 'TARGET_ACTIONS', remaining: 4 },
    })
    expect(merged.mutation).toMatchObject({
      kind: 'MERGED',
      before: { strength: 20, stacks: 2 },
      after: { strength: 35, stacks: 5 },
    })
  })

  it('keeps source-scoped effects from different users separate', () => {
    const first = registerActiveEffect(
      [],
      createInput({
        effectId: 'effect.command-aura',
        duplicateScope: 'SOURCE',
        duration: { unit: 'SOURCE_ACTIONS', remaining: 2 },
      }),
    )
    const second = registerActiveEffect(
      first.effects,
      createInput({
        effectId: 'effect.command-aura',
        sourceBattleUnitId: 'ally.other-source',
        duplicateScope: 'SOURCE',
        duration: { unit: 'SOURCE_ACTIONS', remaining: 2 },
        applicationSequence: 2,
      }),
    )

    expect(second.effects).toHaveLength(2)
    expect(second.effects.map((effect) => effect.sourceBattleUnitId)).toEqual([
      'ally.source',
      'ally.other-source',
    ])
  })

  it('rejects incompatible same-name registrations and invalid source action durations', () => {
    const first = registerActiveEffect([], createInput())

    expect(() =>
      registerActiveEffect(
        first.effects,
        createInput({
          duration: { unit: 'TRIGGERS', remaining: 2 },
          applicationSequence: 2,
        }),
      ),
    ).toThrow('same-name effects must keep the same duration unit')

    expect(() =>
      registerActiveEffect(
        first.effects,
        createInput({ stackLimit: 3, applicationSequence: 2 }),
      ),
    ).toThrow('same-name effects must keep the same stack limit')

    expect(() =>
      registerActiveEffect(
        [],
        createInput({
          sourceBattleUnitId: null,
          duplicateScope: 'SOURCE',
          duration: { unit: 'SOURCE_ACTIONS', remaining: 2 },
        }),
      ),
    ).toThrow('source action duration requires sourceBattleUnitId')
  })

  it('removes an effect immutably and reports the reason', () => {
    const registered = registerActiveEffect([], createInput())
    const removed = removeActiveEffect(
      registered.effects,
      registered.effects[0].activeEffectId,
      'DISPELLED',
    )
    const missing = removeActiveEffect(removed.effects, 'active-effect.missing')

    expect(registered.effects).toHaveLength(1)
    expect(removed.effects).toEqual([])
    expect(removed.mutation).toMatchObject({
      kind: 'REMOVED',
      before: registered.effects[0],
      after: null,
      reason: 'DISPELLED',
    })
    expect(missing.mutation).toBeNull()
    expect(missing.effects).toEqual([])
  })

  it('runs every stage in doc07 order and sorts same-stage hooks by priority then id', () => {
    const result = runEffectResolutionPipeline<string[]>([], [
      {
        id: 'hook.status',
        stage: 'STATUS_CHANGES',
        priority: 0,
        apply: (context) => [...context, 'status'],
      },
      {
        id: 'hook.damage.b',
        stage: 'DAMAGE_HEALING_MODIFIERS',
        priority: 10,
        apply: (context) => [...context, 'damage-b'],
      },
      {
        id: 'hook.damage.a',
        stage: 'DAMAGE_HEALING_MODIFIERS',
        priority: 10,
        apply: (context) => [...context, 'damage-a'],
      },
      {
        id: 'hook.damage.first',
        stage: 'DAMAGE_HEALING_MODIFIERS',
        priority: 0,
        apply: (context) => [...context, 'damage-first'],
      },
      {
        id: 'hook.log',
        stage: 'LOG_AND_PRESENTATION',
        priority: 0,
        apply: (context) => [...context, 'log'],
      },
    ])

    expect(result.context).toEqual([
      'damage-first',
      'damage-a',
      'damage-b',
      'status',
      'log',
    ])
    expect(result.trace.map((entry) => entry.stage)).toEqual(EFFECT_RESOLUTION_STAGES)
    expect(result.trace).toHaveLength(10)
    expect(result.trace[1].hookIds).toEqual([
      'hook.damage.first',
      'hook.damage.a',
      'hook.damage.b',
    ])
    expect(Object.isFrozen(result.trace)).toBe(true)
  })

  it('rejects duplicate hook ids instead of relying on input order', () => {
    const duplicateHooks = [
      {
        id: 'hook.duplicate',
        stage: 'HP_APPLICATION' as const,
        priority: 0,
        apply: (value: number) => value + 1,
      },
      {
        id: 'hook.duplicate',
        stage: 'DEFEAT_CHECK' as const,
        priority: 0,
        apply: (value: number) => value + 1,
      },
    ]

    expect(() => runEffectResolutionPipeline(0, duplicateHooks)).toThrow(
      'effect resolution hook id must be unique: hook.duplicate',
    )
  })
})
