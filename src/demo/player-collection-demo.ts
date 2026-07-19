import type { PlayerDataContentCatalog } from '../progression/player-data'
import { createPlayerData } from '../progression/player-data'
import {
  STANDARD_HEADLESS_SPECIES,
  STANDARD_INTERACTIVE_SKILLS,
} from './standard-headless-battle'

export const T033_PLAYER_CATALOG: PlayerDataContentCatalog = Object.freeze({
  species: STANDARD_HEADLESS_SPECIES,
  skills: STANDARD_INTERACTIVE_SKILLS,
  researchNodes: Object.freeze([]),
})

export const T033_GENERIC_SKILL_COSTS: Readonly<Record<string, number>> = Object.freeze({
  'skill.demo-generic': 60,
  'skill.demo-generic-focus': 100,
  'skill.demo-generic-rush': 80,
})

export const T033_INITIAL_PLAYER_DATA = createPlayerData(
  {
    schemaVersion: 3,
    gameVersion: '0.0.0-t035',
    contentVersion: 'demo-t035',
    economy: {
      currency: 520,
      researchData: 180,
      catalysts: [
        { catalystId: 'catalyst.demo-forest', amount: 3 },
        { catalystId: 'catalyst.demo-core', amount: 1 },
      ],
    },
    research: { nodes: [] },
    collection: {
      speciesStates: [
        {
          speciesId: 'species.demo-alpha',
          blueprintUnlocked: true,
          analysisBasisPoints: 6200,
          bloomSkillIds: ['skill.demo-bloom'],
          encyclopediaStageId: 'encyclopedia-stage.5',
          statistics: { battles: 12, victories: 8, observedSkills: 4 },
        },
        {
          speciesId: 'species.demo-beta',
          blueprintUnlocked: true,
          analysisBasisPoints: 4100,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.4',
          statistics: { battles: 9, victories: 5, observedSkills: 3 },
        },
        {
          speciesId: 'species.demo-gamma',
          blueprintUnlocked: true,
          analysisBasisPoints: 2600,
          bloomSkillIds: ['skill.demo-bloom'],
          encyclopediaStageId: 'encyclopedia-stage.3',
          statistics: { battles: 6, victories: 4, observedSkills: 2 },
        },
        {
          speciesId: 'species.demo-delta',
          blueprintUnlocked: false,
          analysisBasisPoints: 900,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.2',
          statistics: { encounters: 3, defeats: 1 },
        },
      ],
      unitInstances: [
        {
          instanceId: 'unit.alpha-01',
          speciesId: 'species.demo-alpha',
          learnedGenericSkillIds: ['skill.demo-generic'],
          nickname: 'アルファ1号',
          favorite: true,
          locked: true,
          conditionBasisPoints: 10_000,
        },
        {
          instanceId: 'unit.beta-01',
          speciesId: 'species.demo-beta',
          learnedGenericSkillIds: ['skill.demo-generic-rush'],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 9200,
        },
        {
          instanceId: 'unit.gamma-01',
          speciesId: 'species.demo-gamma',
          learnedGenericSkillIds: ['skill.demo-generic-focus'],
          nickname: '観測個体G',
          favorite: false,
          locked: false,
          conditionBasisPoints: 8600,
        },
        {
          instanceId: 'unit.delta-01',
          speciesId: 'species.demo-delta',
          learnedGenericSkillIds: [],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
      ],
    },
    formations: {
      activeFormationId: 'formation.main',
      formations: [
        {
          formationId: 'formation.main',
          name: '標準観測班',
          members: [
            {
              instanceId: 'unit.alpha-01',
              position: { row: 0, column: 0 },
              loadout: {
                genericSkillId: 'skill.demo-generic',
                bloomSkillId: 'skill.demo-bloom',
              },
              tiePriority: 0,
              ai: {
                individualStrategy: 'STANDARD',
                teamStrategy: 'STABLE_CLEAR',
                skillPolicies: [
                  { skillId: 'skill.demo-generic', policy: 'STANDARD' },
                  { skillId: 'skill.demo-bloom', policy: 'CONSERVE' },
                ],
              },
            },
            {
              instanceId: 'unit.beta-01',
              position: { row: 1, column: 0 },
              loadout: {
                genericSkillId: 'skill.demo-generic-rush',
                bloomSkillId: null,
              },
              tiePriority: 1,
              ai: {
                individualStrategy: 'CAUTIOUS',
                teamStrategy: 'STABLE_CLEAR',
                skillPolicies: [],
              },
            },
            {
              instanceId: 'unit.gamma-01',
              position: { row: 2, column: 1 },
              loadout: {
                genericSkillId: 'skill.demo-generic-focus',
                bloomSkillId: 'skill.demo-bloom',
              },
              tiePriority: 2,
              ai: {
                individualStrategy: 'ASSAULT',
                teamStrategy: 'FAST_KILL',
                skillPolicies: [
                  { skillId: 'skill.demo-bloom', policy: 'AGGRESSIVE_USE' },
                ],
              },
            },
          ],
        },
        {
          formationId: 'formation.reserve',
          name: '予備観測班',
          members: [
            {
              instanceId: 'unit.alpha-01',
              position: { row: 1, column: 1 },
              loadout: { genericSkillId: null, bloomSkillId: 'skill.demo-bloom' },
              tiePriority: 0,
              ai: {
                individualStrategy: 'BLOOM_CONSERVE',
                teamStrategy: 'LOSS_MINIMIZATION',
                skillPolicies: [
                  { skillId: 'skill.demo-bloom', policy: 'CONSERVE' },
                ],
              },
            },
            {
              instanceId: 'unit.delta-01',
              position: { row: 0, column: 2 },
              loadout: { genericSkillId: null, bloomSkillId: null },
              tiePriority: 1,
              ai: {
                individualStrategy: 'POSITIONAL',
                teamStrategy: 'INDIVIDUAL_PRIORITY',
                skillPolicies: [],
              },
            },
          ],
        },
      ],
    },
  },
  T033_PLAYER_CATALOG,
)
