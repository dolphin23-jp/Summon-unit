import { describe, expect, it } from 'vitest'
import {
  createPassiveTraitPipelineContext,
  runPassiveTraitPipeline,
  type PassiveTraitDefinition,
} from './passive-traits'

const trait: PassiveTraitDefinition = Object.freeze({
  id: 'trait.steadfast-shell',
  abilities: Object.freeze([
    Object.freeze({
      kind: 'CONSTANT_STAT_MODIFIER',
      effectId: 'effect.buff.defense',
      strength: 200,
    }),
    Object.freeze({
      kind: 'ON_HIT_REACTION',
      effectId: 'effect.buff.attack',
      strength: 100,
      targetActionDuration: 1,
    }),
    Object.freeze({
      kind: 'STATUS_PARAMETER_OVERRIDE',
      statusId: 'poison',
      strengthMultiplierPermille: 500,
      durationDelta: 1,
    }),
  ]),
})

describe('passive trait pipeline', () => {
  it('connects constant stat modifiers to the damage and healing modifier stage', () => {
    const result = runPassiveTraitPipeline(
      createPassiveTraitPipelineContext({
        phase: 'INITIALIZE',
        ownerBattleUnitId: 'unit.trait',
        currentTime: 0,
      }),
      [trait],
    )

    expect(result.context.pendingEffects).toHaveLength(1)
    expect(result.context.pendingEffects[0]).toMatchObject({
      effectId: 'effect.buff.defense',
      targetBattleUnitId: 'unit.trait',
      strength: 200,
      duration: { unit: 'BATTLE', remaining: null },
    })
    expect(
      result.trace.find((stage) => stage.stage === 'DAMAGE_HEALING_MODIFIERS')?.hookIds,
    ).toEqual(['passive-trait:trait.steadfast-shell:0:CONSTANT_STAT_MODIFIER'])
  })

  it('connects on-hit reactions to the post-hit reaction stage', () => {
    const result = runPassiveTraitPipeline(
      createPassiveTraitPipelineContext({
        phase: 'ON_HIT',
        ownerBattleUnitId: 'unit.trait',
        currentTime: 10,
        applicationSequence: 7,
      }),
      [trait],
    )

    expect(result.context.pendingEffects).toHaveLength(1)
    expect(result.context.pendingEffects[0]).toMatchObject({
      effectId: 'effect.buff.attack',
      applicationSequence: 7,
      duration: { unit: 'TARGET_ACTIONS', remaining: 1 },
    })
    expect(
      result.trace.find((stage) => stage.stage === 'POST_HIT_HEAL_REACTIONS')?.hookIds,
    ).toEqual(['passive-trait:trait.steadfast-shell:1:ON_HIT_REACTION'])
  })

  it('overrides status strength and duration at the status stage', () => {
    const result = runPassiveTraitPipeline(
      createPassiveTraitPipelineContext({
        phase: 'STATUS_APPLICATION',
        ownerBattleUnitId: 'unit.trait',
        currentTime: 10,
        statusId: 'poison',
        statusStrength: 20,
        statusDuration: 3,
      }),
      [trait],
    )

    expect(result.context.statusStrength).toBe(10)
    expect(result.context.statusDuration).toBe(4)
    expect(
      result.trace.find((stage) => stage.stage === 'STATUS_CHANGES')?.hookIds,
    ).toEqual(['passive-trait:trait.steadfast-shell:2:STATUS_PARAMETER_OVERRIDE'])
  })

  it('returns byte-identical results for identical inputs', () => {
    const context = createPassiveTraitPipelineContext({
      phase: 'ON_HIT',
      ownerBattleUnitId: 'unit.trait',
      currentTime: 10,
    })
    expect(runPassiveTraitPipeline(context, [trait])).toEqual(
      runPassiveTraitPipeline(context, [trait]),
    )
  })
})
