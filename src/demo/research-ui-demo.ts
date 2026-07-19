import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { createResearchFacilityPlayerData, type T037ProgressionCatalog } from '../progression/research-facility'
import type { ResearchNodeDefinition } from '../progression/research-model'
import {
  T033_GENERIC_SKILL_COSTS,
  T033_INITIAL_PLAYER_DATA,
  T033_PLAYER_CATALOG,
} from './player-collection-demo'

const EPSILON_SKILL: SkillDefinition = Object.freeze({
  id: 'skill.demo-epsilon',
  slotType: 'INNATE',
  actionCost: 125,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'ARC',
  damageMultiplierPermille: 1450,
})
const ZETA_SKILL: SkillDefinition = Object.freeze({
  id: 'skill.demo-zeta',
  slotType: 'INNATE',
  actionCost: 150,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'SNIPE',
  damageMultiplierPermille: 1850,
})

const EPSILON_SPECIES: MonsterSpecies = Object.freeze({
  id: 'species.demo-epsilon',
  rarity: 4,
  attributeId: 'attribute.fire',
  primarySpeciesId: 'species-group.epsilon',
  tagIds: Object.freeze(['tag.guardian']),
  stats: Object.freeze({ hp: 176, attack: 43, defense: 42, speed: 3 }),
  innateSkillId: EPSILON_SKILL.id,
  bloomSkillIds: Object.freeze(['skill.demo-bloom']),
})
const ZETA_SPECIES: MonsterSpecies = Object.freeze({
  id: 'species.demo-zeta',
  rarity: 5,
  attributeId: 'attribute.fire',
  primarySpeciesId: 'species-group.zeta',
  tagIds: Object.freeze(['tag.fast']),
  stats: Object.freeze({ hp: 155, attack: 61, defense: 31, speed: 6 }),
  innateSkillId: ZETA_SKILL.id,
  bloomSkillIds: Object.freeze(['skill.demo-bloom']),
})

const RESEARCH_NODES: readonly ResearchNodeDefinition[] = Object.freeze([
  Object.freeze({
    nodeId: 'research.demo-alpha',
    targetSpeciesId: 'species.demo-alpha',
    adjacentNodeIds: Object.freeze(['research.demo-delta']),
    candidateRange: Object.freeze({
      methods: Object.freeze(['LINEAGE'] as const),
      materialSpeciesIds: Object.freeze(['species.demo-alpha']),
      catalystIds: Object.freeze(['catalyst.demo-forest']),
      minimumMaterialCount: 1,
      maximumMaterialCount: 1,
      minimumCatalystCount: 1,
      maximumCatalystCount: 1,
    }),
    recipe: Object.freeze({
      method: 'LINEAGE',
      materialSpeciesIds: Object.freeze(['species.demo-alpha']),
      catalystIds: Object.freeze(['catalyst.demo-forest']),
    }),
    trialResearchDataCost: 4,
    hints: Object.freeze([]),
  }),
  Object.freeze({
    nodeId: 'research.demo-delta',
    targetSpeciesId: 'species.demo-delta',
    adjacentNodeIds: Object.freeze(['research.demo-alpha', 'research.demo-epsilon']),
    candidateRange: Object.freeze({
      methods: Object.freeze(['LINEAGE', 'FUSION'] as const),
      materialSpeciesIds: Object.freeze(['species.demo-alpha', 'species.demo-beta']),
      catalystIds: Object.freeze(['catalyst.demo-forest', 'catalyst.demo-core']),
      minimumMaterialCount: 1,
      maximumMaterialCount: 2,
      minimumCatalystCount: 1,
      maximumCatalystCount: 1,
    }),
    recipe: Object.freeze({
      method: 'LINEAGE',
      materialSpeciesIds: Object.freeze(['species.demo-alpha']),
      catalystIds: Object.freeze(['catalyst.demo-forest']),
    }),
    trialResearchDataCost: 8,
    hints: Object.freeze([]),
  }),
  Object.freeze({
    nodeId: 'research.demo-epsilon',
    targetSpeciesId: EPSILON_SPECIES.id,
    adjacentNodeIds: Object.freeze(['research.demo-delta', 'research.demo-zeta']),
    candidateRange: Object.freeze({
      methods: Object.freeze(['FUSION'] as const),
      materialSpeciesIds: Object.freeze(['species.demo-beta', 'species.demo-gamma']),
      catalystIds: Object.freeze(['catalyst.demo-core']),
      minimumMaterialCount: 2,
      maximumMaterialCount: 2,
      minimumCatalystCount: 1,
      maximumCatalystCount: 1,
    }),
    recipe: Object.freeze({
      method: 'FUSION',
      materialSpeciesIds: Object.freeze(['species.demo-beta', 'species.demo-gamma']),
      catalystIds: Object.freeze(['catalyst.demo-core']),
    }),
    trialResearchDataCost: 14,
    hints: Object.freeze([]),
  }),
  Object.freeze({
    nodeId: 'research.demo-zeta',
    targetSpeciesId: ZETA_SPECIES.id,
    adjacentNodeIds: Object.freeze(['research.demo-epsilon']),
    candidateRange: Object.freeze({
      methods: Object.freeze(['TRANSCENDENCE'] as const),
      materialSpeciesIds: Object.freeze([EPSILON_SPECIES.id]),
      catalystIds: Object.freeze(['catalyst.demo-core']),
      minimumMaterialCount: 1,
      maximumMaterialCount: 1,
      minimumCatalystCount: 1,
      maximumCatalystCount: 1,
    }),
    recipe: Object.freeze({
      method: 'TRANSCENDENCE',
      materialSpeciesIds: Object.freeze([EPSILON_SPECIES.id]),
      catalystIds: Object.freeze(['catalyst.demo-core']),
    }),
    trialResearchDataCost: 24,
    hints: Object.freeze([
      Object.freeze({
        hintId: 'hint.demo-zeta-rumor',
        disclosureStage: 1,
        trigger: Object.freeze({ type: 'PROGRESS' as const, progressId: 'progress.demo-rumor' }),
      }),
    ]),
  }),
])

export const T037_PLAYER_CATALOG: T037ProgressionCatalog = Object.freeze({
  species: Object.freeze([...T033_PLAYER_CATALOG.species, EPSILON_SPECIES, ZETA_SPECIES]),
  skills: Object.freeze([...T033_PLAYER_CATALOG.skills, EPSILON_SKILL, ZETA_SKILL]),
  researchNodes: RESEARCH_NODES,
  finalResearchDefinitions: Object.freeze([
    Object.freeze({
      nodeId: 'research.demo-alpha',
      researchDataCost: 6,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-forest', amount: 1 }]),
      specimenRequirements: Object.freeze([]),
    }),
    Object.freeze({
      nodeId: 'research.demo-delta',
      researchDataCost: 12,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-forest', amount: 1 }]),
      specimenRequirements: Object.freeze([]),
    }),
    Object.freeze({
      nodeId: 'research.demo-epsilon',
      researchDataCost: 60,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 1 }]),
      specimenRequirements: Object.freeze([
        { speciesId: 'species.demo-beta', amount: 1 },
        { speciesId: 'species.demo-gamma', amount: 1 },
      ]),
    }),
    Object.freeze({
      nodeId: 'research.demo-zeta',
      researchDataCost: 120,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 2 }]),
      specimenRequirements: Object.freeze([{ speciesId: EPSILON_SPECIES.id, amount: 1 }]),
    }),
  ]),
  bloomResearchDefinitions: Object.freeze(
    [...T033_PLAYER_CATALOG.species, EPSILON_SPECIES, ZETA_SPECIES].map((species) =>
      Object.freeze({
        speciesId: species.id,
        skillId: 'skill.demo-bloom',
        analysisThresholdBasisPoints: species.rarity <= 3 ? 1500 : species.rarity <= 6 ? 2000 : 2500,
        currencyCost: 30 * species.rarity,
        researchDataCost: 10 * species.rarity,
      }),
    ),
  ),
  researchFacilityStages: Object.freeze([
    Object.freeze({
      stage: 1,
      maxResearchableRarity: 2,
      upgradeCurrencyCost: 0,
      upgradeResearchDataCost: 0,
    }),
    Object.freeze({
      stage: 2,
      maxResearchableRarity: 4,
      upgradeCurrencyCost: 160,
      upgradeResearchDataCost: 60,
    }),
    Object.freeze({
      stage: 3,
      maxResearchableRarity: 5,
      upgradeCurrencyCost: 300,
      upgradeResearchDataCost: 120,
    }),
  ]),
})

export const T037_GENERIC_SKILL_COSTS = T033_GENERIC_SKILL_COSTS

export const T037_INITIAL_PLAYER_DATA = createResearchFacilityPlayerData(
  {
    ...T033_INITIAL_PLAYER_DATA,
    schemaVersion: 4,
    gameVersion: '0.0.0-t037',
    contentVersion: 'demo-t037',
    facilities: { researchFacilityStage: 1 },
    research: {
      nodes: [
        {
          nodeId: 'research.demo-alpha',
          status: 'completed',
          disclosureStage: 5,
          unlockedHintIds: [],
          incorrectTrialSignatures: [],
        },
        {
          nodeId: 'research.demo-delta',
          status: 'candidate',
          disclosureStage: 3,
          unlockedHintIds: [],
          incorrectTrialSignatures: [],
        },
        {
          nodeId: 'research.demo-epsilon',
          status: 'known',
          disclosureStage: 4,
          unlockedHintIds: [],
          incorrectTrialSignatures: [],
        },
        {
          nodeId: 'research.demo-zeta',
          status: 'hinted',
          disclosureStage: 1,
          unlockedHintIds: ['hint.demo-zeta-rumor'],
          incorrectTrialSignatures: [],
        },
      ],
    },
    collection: {
      speciesStates: [
        ...T033_INITIAL_PLAYER_DATA.collection.speciesStates,
        {
          speciesId: EPSILON_SPECIES.id,
          blueprintUnlocked: false,
          analysisBasisPoints: 2500,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.4',
          statistics: { encounters: 2 },
        },
        {
          speciesId: ZETA_SPECIES.id,
          blueprintUnlocked: false,
          analysisBasisPoints: 500,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.1',
          statistics: { rumors: 1 },
        },
      ],
      unitInstances: [
        ...T033_INITIAL_PLAYER_DATA.collection.unitInstances,
        {
          instanceId: 'unit.beta-specimen',
          speciesId: 'species.demo-beta',
          learnedGenericSkillIds: [],
          nickname: '標本B',
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
        {
          instanceId: 'unit.gamma-specimen',
          speciesId: 'species.demo-gamma',
          learnedGenericSkillIds: [],
          nickname: '標本G',
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
      ],
    },
  },
  T037_PLAYER_CATALOG,
)
