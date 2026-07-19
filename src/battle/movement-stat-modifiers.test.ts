import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { createInitialUnitActionSchedule } from './action-scheduling'
import { createBattleState } from './defeat-and-victory'
import { registerActiveEffect, type ActiveEffectState } from './effect-framework'
import { performNormalMovement } from './normal-movement'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.movement-test',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze(['tag.beast']),
  stats: Object.freeze({ hp: 100, attack: 20, defense: 20, speed: 3 }),
  innateSkillId: 'skill.movement-test',
})

function addEffect(
  effects: readonly ActiveEffectState[],
  effectId: string,
  strength: number,
  sequence: number,
): readonly ActiveEffectState[] {
  return registerActiveEffect(effects, {
    effectId,
    sourceBattleUnitId: 'ally.support',
    targetBattleUnitId: 'ally.actor',
    strength,
    duration: { unit: 'TARGET_ACTIONS', remaining: 2 },
    appliedAt: 0,
    applicationSequence: sequence,
  }).effects
}

describe('normal movement stat modifiers', () => {
  it('uses modified speed and action cost when scheduling the next turn', () => {
    let effects: readonly ActiveEffectState[] = []
    effects = addEffect(effects, 'effect.buff.speed', 500, 1)
    effects = addEffect(effects, 'effect.buff.action-cost', 200, 2)

    const actor = createBattleUnitState(species, {
      battleUnitId: 'ally.actor',
      position: { side: 'ALLY', row: 0, column: 0 },
      initialEffects: effects,
    })
    const enemy = createBattleUnitState(species, {
      battleUnitId: 'enemy.actor',
      position: { side: 'ENEMY', row: 0, column: 0 },
    })
    const battle = createBattleState({ units: [actor, enemy] })
    const actorSchedule = createInitialUnitActionSchedule(actor, species, 100, 0)

    const result = performNormalMovement({
      battle,
      actorBattleUnitId: actor.battleUnitId,
      actorSpecies: species,
      actorSchedule,
      destination: { side: 'ALLY', row: 1, column: 0 },
      currentTime: actorSchedule.nextActionTime,
    })

    expect(result.effectiveActionCost).toBe(60)
    expect(result.effectiveSpeed).toBe(5)
    expect(result.actorSchedule.nextActionTime).toBe(actorSchedule.nextActionTime + 12_000)
  })
})
