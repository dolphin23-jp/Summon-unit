import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  runHeadlessBattle,
  type HeadlessBattleDefinition,
  type HeadlessBattleRunResult,
} from '../battle/headless-battle-runner'

const DEMO_BLOOM_SKILL_IDS = Object.freeze(['skill.demo-bloom'])

export const STANDARD_HEADLESS_SPECIES: readonly MonsterSpecies[] = Object.freeze([
  Object.freeze({
    id: 'species.demo-alpha',
    rarity: 2,
    attributeId: 'attribute.wind',
    primarySpeciesId: 'species-group.alpha',
    tagIds: Object.freeze(['tag.fast']),
    innateSkillId: 'skill.demo-alpha',
    bloomSkillIds: DEMO_BLOOM_SKILL_IDS,
    stats: Object.freeze({ hp: 92, attack: 34, defense: 12, speed: 5 }),
  }),
  Object.freeze({
    id: 'species.demo-beta',
    rarity: 2,
    attributeId: 'attribute.earth',
    primarySpeciesId: 'species-group.beta',
    tagIds: Object.freeze(['tag.guardian']),
    innateSkillId: 'skill.demo-beta',
    bloomSkillIds: DEMO_BLOOM_SKILL_IDS,
    stats: Object.freeze({ hp: 148, attack: 24, defense: 38, speed: 2 }),
  }),
  Object.freeze({
    id: 'species.demo-gamma',
    rarity: 2,
    attributeId: 'attribute.wind',
    primarySpeciesId: 'species-group.gamma',
    tagIds: Object.freeze(['tag.fast']),
    innateSkillId: 'skill.demo-gamma',
    bloomSkillIds: DEMO_BLOOM_SKILL_IDS,
    stats: Object.freeze({ hp: 82, attack: 39, defense: 9, speed: 6 }),
  }),
  Object.freeze({
    id: 'species.demo-delta',
    rarity: 2,
    attributeId: 'attribute.earth',
    primarySpeciesId: 'species-group.delta',
    tagIds: Object.freeze(['tag-bruiser']),
    innateSkillId: 'skill.demo-delta',
    bloomSkillIds: DEMO_BLOOM_SKILL_IDS,
    stats: Object.freeze({ hp: 122, attack: 31, defense: 24, speed: 3 }),
  }),
])

export const STANDARD_HEADLESS_SKILLS: readonly SkillDefinition[] = Object.freeze([
  Object.freeze({
    id: 'skill.demo-alpha',
    slotType: 'INNATE',
    actionCost: 80,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  }),
  Object.freeze({
    id: 'skill.demo-beta',
    slotType: 'INNATE',
    actionCost: 105,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1050,
  }),
  Object.freeze({
    id: 'skill.demo-gamma',
    slotType: 'INNATE',
    actionCost: 95,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1200,
  }),
  Object.freeze({
    id: 'skill.demo-delta',
    slotType: 'INNATE',
    actionCost: 110,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1150,
  }),
])

export const STANDARD_INTERACTIVE_SKILLS: readonly SkillDefinition[] = Object.freeze([
  ...STANDARD_HEADLESS_SKILLS,
  Object.freeze({
    id: 'skill.demo-generic',
    slotType: 'GENERIC',
    actionCost: 90,
    targetType: 'SINGLE_ENEMY',
    reachMethod: 'SNIPE',
    damageMultiplierPermille: 850,
  }),
  Object.freeze({
    id: 'skill.demo-generic-focus',
    slotType: 'GENERIC',
    actionCost: 105,
    targetType: 'SINGLE_ENEMY',
    reachMethod: 'SNIPE',
    damageMultiplierPermille: 1000,
  }),
  Object.freeze({
    id: 'skill.demo-generic-rush',
    slotType: 'GENERIC',
    actionCost: 70,
    targetType: 'SINGLE_ENEMY',
    reachMethod: 'DIRECT',
    damageMultiplierPermille: 700,
  }),
  Object.freeze({
    id: 'skill.demo-bloom',
    slotType: 'BLOOM',
    actionCost: 135,
    targetType: 'SINGLE_ENEMY',
    reachMethod: 'SNIPE',
    damageMultiplierPermille: 1800,
  }),
])

const STANDARD_UNITS = Object.freeze([
  Object.freeze({
    battleUnitId: 'ally.alpha',
    speciesId: 'species.demo-alpha',
    position: Object.freeze({ side: 'ALLY' as const, row: 0 as const, column: 0 as const }),
    tiePriority: 0,
  }),
  Object.freeze({
    battleUnitId: 'ally.beta',
    speciesId: 'species.demo-beta',
    position: Object.freeze({ side: 'ALLY' as const, row: 1 as const, column: 0 as const }),
    tiePriority: 1,
  }),
  Object.freeze({
    battleUnitId: 'ally.gamma',
    speciesId: 'species.demo-gamma',
    position: Object.freeze({ side: 'ALLY' as const, row: 2 as const, column: 1 as const }),
    tiePriority: 2,
  }),
  Object.freeze({
    battleUnitId: 'enemy.delta',
    speciesId: 'species.demo-delta',
    position: Object.freeze({ side: 'ENEMY' as const, row: 0 as const, column: 1 as const }),
    tiePriority: 3,
  }),
  Object.freeze({
    battleUnitId: 'enemy.alpha',
    speciesId: 'species.demo-alpha',
    position: Object.freeze({ side: 'ENEMY' as const, row: 1 as const, column: 2 as const }),
    tiePriority: 4,
  }),
  Object.freeze({
    battleUnitId: 'enemy.beta',
    speciesId: 'species.demo-beta',
    position: Object.freeze({ side: 'ENEMY' as const, row: 2 as const, column: 2 as const }),
    tiePriority: 5,
  }),
])

export const STANDARD_ENEMY_UNITS = Object.freeze(
  STANDARD_UNITS.filter((unit) => unit.position.side === 'ENEMY'),
)

export const STANDARD_HEADLESS_BATTLE: HeadlessBattleDefinition = Object.freeze({
  species: STANDARD_HEADLESS_SPECIES,
  skills: STANDARD_HEADLESS_SKILLS,
  initialActionCost: 100,
  maxActions: 300,
  units: STANDARD_UNITS,
})

const MANUAL_ONLY_SKILL_POLICIES = Object.freeze([
  Object.freeze({ skillId: 'skill.demo-generic', policy: 'AUTO_DISABLED' as const }),
  Object.freeze({ skillId: 'skill.demo-bloom', policy: 'AUTO_DISABLED' as const }),
])
const MANUAL_LOADOUT = Object.freeze(['skill.demo-generic', 'skill.demo-bloom'])

export const STANDARD_INTERACTIVE_BATTLE: HeadlessBattleDefinition = Object.freeze({
  ...STANDARD_HEADLESS_BATTLE,
  skills: STANDARD_INTERACTIVE_SKILLS,
  aiConfigurations: Object.freeze({
    'ally.alpha': Object.freeze({
      individualStrategy: 'STANDARD' as const,
      teamStrategy: 'STABLE_CLEAR' as const,
      skillPolicies: MANUAL_ONLY_SKILL_POLICIES,
    }),
    'ally.beta': Object.freeze({
      individualStrategy: 'STANDARD' as const,
      teamStrategy: 'STABLE_CLEAR' as const,
      skillPolicies: MANUAL_ONLY_SKILL_POLICIES,
    }),
    'ally.gamma': Object.freeze({
      individualStrategy: 'STANDARD' as const,
      teamStrategy: 'STABLE_CLEAR' as const,
      skillPolicies: MANUAL_ONLY_SKILL_POLICIES,
    }),
  }),
  units: Object.freeze(
    STANDARD_UNITS.map((unit) =>
      unit.battleUnitId.startsWith('ally.')
        ? Object.freeze({ ...unit, equippedSkillIds: MANUAL_LOADOUT })
        : unit,
    ),
  ),
})

export function runStandardHeadlessBattle(): HeadlessBattleRunResult {
  return runHeadlessBattle(STANDARD_HEADLESS_BATTLE)
}

export function formatHeadlessBattleResult(result: HeadlessBattleRunResult): string {
  return JSON.stringify({ summary: result.summary, events: result.log.events }, null, 2)
}
