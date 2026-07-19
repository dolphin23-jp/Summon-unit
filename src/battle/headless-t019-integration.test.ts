import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import type { ActiveEffectState } from './effect-framework'
import {
  runHeadlessBattle,
  type HeadlessBattleDefinition,
} from './headless-battle-runner'

const species: MonsterSpecies = Object.freeze({
  id: 'species.t019-headless',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 1000, attack: 1, defense: 100, speed: 1 }),
  innateSkillId: 'skill.t019-headless',
})

function movementLock(targetBattleUnitId: string, sequence: number): ActiveEffectState {
  return Object.freeze({
    activeEffectId: `active-effect:${targetBattleUnitId}:movement-lock:${sequence}`,
    effectId: 'effect.status.movement-lock',
    sourceBattleUnitId: null,
    targetBattleUnitId,
    strength: 1,
    stacks: 1,
    stackLimit: 1,
    duration: Object.freeze({ unit: 'BATTLE', remaining: null }),
    duplicateScope: 'TARGET',
    appliedAt: 0,
    applicationSequence: sequence,
  })
}

function createDefinition(
  skill: SkillDefinition,
  aligned: boolean,
  maxActions: number,
): HeadlessBattleDefinition {
  return Object.freeze({
    species: Object.freeze([species]),
    skills: Object.freeze([skill]),
    maxActions,
    units: Object.freeze([
      Object.freeze({
        battleUnitId: 'ally.t019',
        speciesId: species.id,
        position: Object.freeze({ side: 'ALLY' as const, row: 0 as const, column: 0 as const }),
        initialEffects: Object.freeze([movementLock('ally.t019', 0)]),
        tiePriority: 0,
      }),
      Object.freeze({
        battleUnitId: 'enemy.t019',
        speciesId: species.id,
        position: Object.freeze({
          side: 'ENEMY' as const,
          row: 0 as const,
          column: aligned ? (0 as const) : (2 as const),
        }),
        initialEffects: Object.freeze([movementLock('enemy.t019', 1)]),
        tiePriority: 1,
      }),
    ]),
  })
}

describe('T019 headless action state integration', () => {
  it('uses escalating formal wait costs when no skill or movement is available', () => {
    const skill: SkillDefinition = Object.freeze({
      id: species.innateSkillId,
      slotType: 'INNATE',
      actionCost: 100,
      targetType: 'SINGLE_ENEMY',
      damageMultiplierPermille: 1000,
    })
    const result = runHeadlessBattle(createDefinition(skill, false, 5))

    expect(result.summary).toMatchObject({
      termination: 'ACTION_LIMIT_REACHED',
      totalActions: 5,
      finalVirtualTime: 215_000,
    })
    expect(result.log.events.some((event) => event.kind === 'skill_used')).toBe(false)
    expect(result.log.events.some((event) => event.kind === 'unit_moved')).toBe(false)
  })

  it('advances cooldowns on wait and enforces the usage limit in the battle loop', () => {
    const skill: SkillDefinition = Object.freeze({
      id: species.innateSkillId,
      slotType: 'INNATE',
      actionCost: 100,
      targetType: 'SINGLE_ENEMY',
      damageMultiplierPermille: 1000,
      cooldownActions: 2,
      usageLimit: 2,
    })
    const result = runHeadlessBattle(createDefinition(skill, true, 14))
    const skillEvents = result.log.events.filter((event) => event.kind === 'skill_used')

    expect(result.summary).toMatchObject({
      termination: 'ACTION_LIMIT_REACHED',
      totalActions: 14,
    })
    expect(skillEvents).toHaveLength(4)
    expect(
      skillEvents.reduce<Record<string, number>>((counts, event) => {
        counts[event.payload.actorBattleUnitId] =
          (counts[event.payload.actorBattleUnitId] ?? 0) + 1
        return counts
      }, {}),
    ).toEqual({ 'ally.t019': 2, 'enemy.t019': 2 })
  })

  it('remains byte-identical across repeated executions', () => {
    const skill: SkillDefinition = Object.freeze({
      id: species.innateSkillId,
      slotType: 'INNATE',
      actionCost: 100,
      targetType: 'SINGLE_ENEMY',
      damageMultiplierPermille: 1000,
      cooldownActions: 1,
      usageLimit: 3,
    })
    const definition = createDefinition(skill, true, 12)
    const expected = JSON.stringify(runHeadlessBattle(definition))
    for (let index = 0; index < 20; index += 1) {
      expect(JSON.stringify(runHeadlessBattle(definition))).toBe(expected)
    }
  })
})
