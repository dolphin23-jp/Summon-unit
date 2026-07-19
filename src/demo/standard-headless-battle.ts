import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  runHeadlessBattle,
  type HeadlessBattleDefinition,
  type HeadlessBattleRunResult,
} from '../battle/headless-battle-runner'

export const STANDARD_HEADLESS_SPECIES: readonly MonsterSpecies[] = Object.freeze([
  Object.freeze({
    id: 'species.demo-alpha', rarity: 2, attributeId: 'attribute.wind',
    primarySpeciesId: 'species-group.alpha', tagIds: Object.freeze(['tag.fast']),
    innateSkillId: 'skill.demo-alpha',
    stats: Object.freeze({ hp: 92, attack: 34, defense: 12, speed: 5 }),
  }),
  Object.freeze({
    id: 'species.demo-beta', rarity: 2, attributeId: 'attribute.earth',
    primarySpeciesId: 'species-group.beta', tagIds: Object.freeze(['tag.guardian']),
    innateSkillId: 'skill.demo-beta',
    stats: Object.freeze({ hp: 148, attack: 24, defense: 38, speed: 2 }),
  }),
  Object.freeze({
    id: 'species.demo-gamma', rarity: 2, attributeId: 'attribute.wind',
    primarySpeciesId: 'species-group.gamma', tagIds: Object.freeze(['tag.fast']),
    innateSkillId: 'skill.demo-gamma',
    stats: Object.freeze({ hp: 82, attack: 39, defense: 9, speed: 6 }),
  }),
  Object.freeze({
    id: 'species.demo-delta', rarity: 2, attributeId: 'attribute.earth',
    primarySpeciesId: 'species-group.delta', tagIds: Object.freeze(['tag-bruiser']),
    innateSkillId: 'skill.demo-delta',
    stats: Object.freeze({ hp: 122, attack: 31, defense: 24, speed: 3 }),
  }),
])

export const STANDARD_HEADLESS_SKILLS: readonly SkillDefinition[] = Object.freeze([
  Object.freeze({ id: 'skill.demo-alpha', slotType: 'INNATE', actionCost: 80, targetType: 'SINGLE_ENEMY', damageMultiplierPermille: 1000 }),
  Object.freeze({ id: 'skill.demo-beta', slotType: 'INNATE', actionCost: 105, targetType: 'SINGLE_ENEMY', damageMultiplierPermille: 1050 }),
  Object.freeze({ id: 'skill.demo-gamma', slotType: 'INNATE', actionCost: 95, targetType: 'SINGLE_ENEMY', damageMultiplierPermille: 1200 }),
  Object.freeze({ id: 'skill.demo-delta', slotType: 'INNATE', actionCost: 110, targetType: 'SINGLE_ENEMY', damageMultiplierPermille: 1150 }),
])

export const STANDARD_HEADLESS_BATTLE: HeadlessBattleDefinition = Object.freeze({
  species: STANDARD_HEADLESS_SPECIES,
  skills: STANDARD_HEADLESS_SKILLS,
  initialActionCost: 100,
  maxActions: 300,
  units: Object.freeze([
    Object.freeze({ battleUnitId: 'ally.alpha', speciesId: 'species.demo-alpha', position: Object.freeze({ side: 'ALLY' as const, row: 0 as const, column: 0 as const }), tiePriority: 0 }),
    Object.freeze({ battleUnitId: 'ally.beta', speciesId: 'species.demo-beta', position: Object.freeze({ side: 'ALLY' as const, row: 1 as const, column: 0 as const }), tiePriority: 1 }),
    Object.freeze({ battleUnitId: 'ally.gamma', speciesId: 'species.demo-gamma', position: Object.freeze({ side: 'ALLY' as const, row: 2 as const, column: 1 as const }), tiePriority: 2 }),
    Object.freeze({ battleUnitId: 'enemy.delta', speciesId: 'species.demo-delta', position: Object.freeze({ side: 'ENEMY' as const, row: 0 as const, column: 1 as const }), tiePriority: 3 }),
    Object.freeze({ battleUnitId: 'enemy.alpha', speciesId: 'species.demo-alpha', position: Object.freeze({ side: 'ENEMY' as const, row: 1 as const, column: 2 as const }), tiePriority: 4 }),
    Object.freeze({ battleUnitId: 'enemy.beta', speciesId: 'species.demo-beta', position: Object.freeze({ side: 'ENEMY' as const, row: 2 as const, column: 2 as const }), tiePriority: 5 }),
  ]),
})

export function runStandardHeadlessBattle(): HeadlessBattleRunResult {
  return runHeadlessBattle(STANDARD_HEADLESS_BATTLE)
}

export function formatHeadlessBattleResult(result: HeadlessBattleRunResult): string {
  return JSON.stringify({ summary: result.summary, events: result.log.events }, null, 2)
}
