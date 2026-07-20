import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  createInteractiveBattleRunner,
  runHeadlessBattle,
  type HeadlessBattleDefinition,
} from './interactive-battle-runner'

const healer: MonsterSpecies = Object.freeze({
  id: 'species.runner-healer', rarity: 1, attributeId: 'attribute.earth',
  primarySpeciesId: 'species-group.plant', tagIds: Object.freeze([]),
  innateSkillId: 'skill.runner-heal',
  stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 8 }),
})
const ally: MonsterSpecies = Object.freeze({
  id: 'species.runner-ally', rarity: 1, attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.beast', tagIds: Object.freeze([]),
  innateSkillId: 'skill.runner-attack',
  stats: Object.freeze({ hp: 100, attack: 20, defense: 10, speed: 3 }),
})
const enemy: MonsterSpecies = Object.freeze({
  id: 'species.runner-enemy', rarity: 1, attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.beast', tagIds: Object.freeze([]),
  innateSkillId: 'skill.runner-attack',
  stats: Object.freeze({ hp: 100, attack: 20, defense: 10, speed: 2 }),
})
const healSkill: SkillDefinition = Object.freeze({
  id: 'skill.runner-heal', slotType: 'INNATE', attributeId: 'attribute.earth',
  actionCost: 90, targetType: 'SINGLE_ALLY', reachMethod: 'SNIPE',
  damageMultiplierPermille: 1, healingPower: 40,
})
const attackSkill: SkillDefinition = Object.freeze({
  id: 'skill.runner-attack', slotType: 'INNATE', attributeId: 'attribute.neutral',
  actionCost: 100, targetType: 'SINGLE_ENEMY', reachMethod: 'DIRECT',
  damageMultiplierPermille: 900,
})

function definition(): HeadlessBattleDefinition {
  return Object.freeze({
    species: Object.freeze([healer, ally, enemy]),
    skills: Object.freeze([healSkill, attackSkill]),
    units: Object.freeze([
      Object.freeze({ battleUnitId: 'ally.healer', speciesId: healer.id,
        position: Object.freeze({ side: 'ALLY' as const, row: 0 as const, column: 0 as const }), tiePriority: 0 }),
      Object.freeze({ battleUnitId: 'ally.injured', speciesId: ally.id,
        position: Object.freeze({ side: 'ALLY' as const, row: 1 as const, column: 0 as const }), initialHp: 50, tiePriority: 1 }),
      Object.freeze({ battleUnitId: 'enemy.target', speciesId: enemy.id,
        position: Object.freeze({ side: 'ENEMY' as const, row: 0 as const, column: 0 as const }), tiePriority: 2 }),
    ]),
    initialActionCost: 100,
    maxActions: 2,
  })
}

describe('interactive healing resolution', () => {
  it('selects useful healing in AUTO and logs applied healing and overheal', () => {
    const result = runHeadlessBattle(definition())
    const healing = result.log.events.find((event) => event.kind === 'healing_applied')
    expect(healing).toMatchObject({ kind: 'healing_applied', payload: {
      sourceBattleUnitId: 'ally.healer', targetBattleUnitId: 'ally.injured',
      appliedHealing: 40, overheal: 0, hpBefore: 50, hpAfter: 90,
    } })
  })

  it('offers the same healing action for manual selection and executes it', () => {
    const runner = createInteractiveBattleRunner(definition())
    runner.requestManualAllyAction()
    const pending = runner.step()
    expect(pending.status).toBe('AWAITING_MANUAL_ACTION')
    const healingOption = pending.pendingManualAction?.options.find(
      (option) => option.skillId === 'skill.runner-heal',
    )
    expect(healingOption).toBeDefined()
    const resolved = runner.submitManualAction(healingOption!.candidateId)
    expect(resolved.log.events.some((event) => event.kind === 'healing_applied')).toBe(true)
  })
})
