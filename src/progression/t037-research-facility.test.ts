import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import type { PlayerData } from './player-data'
import type { ResearchNodeDefinition } from './research-model'
import {
  completeFacilityFinalResearch,
  createResearchFacilityPlayerData,
  performFacilityTrialResearch,
  unlockFacilityBloomSkill,
  upgradeResearchFacility,
  type T037ProgressionCatalog,
} from './research-facility'

function innate(id: string): SkillDefinition {
  return Object.freeze({
    id,
    slotType: 'INNATE',
    actionCost: 100,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  })
}

const SKILL_LOW = innate('skill.low')
const SKILL_HIGH = innate('skill.high')
const BLOOM_HIGH: SkillDefinition = Object.freeze({
  id: 'skill.high-bloom',
  slotType: 'BLOOM',
  actionCost: 140,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1600,
})

const LOW: MonsterSpecies = Object.freeze({
  id: 'species.low',
  rarity: 2,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'group.low',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 20, defense: 20, speed: 20 }),
  innateSkillId: SKILL_LOW.id,
})
const HIGH: MonsterSpecies = Object.freeze({
  id: 'species.high',
  rarity: 4,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'group.high',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 140, attack: 35, defense: 30, speed: 18 }),
  innateSkillId: SKILL_HIGH.id,
  bloomSkillIds: Object.freeze([BLOOM_HIGH.id]),
})

const NODE_LOW: ResearchNodeDefinition = Object.freeze({
  nodeId: 'research.low',
  targetSpeciesId: LOW.id,
  adjacentNodeIds: Object.freeze(['research.high']),
  candidateRange: Object.freeze({
    methods: Object.freeze(['LINEAGE'] as const),
    materialSpeciesIds: Object.freeze([LOW.id]),
    catalystIds: Object.freeze(['catalyst.low']),
    minimumMaterialCount: 1,
    maximumMaterialCount: 1,
    minimumCatalystCount: 1,
    maximumCatalystCount: 1,
  }),
  recipe: Object.freeze({
    method: 'LINEAGE',
    materialSpeciesIds: Object.freeze([LOW.id]),
    catalystIds: Object.freeze(['catalyst.low']),
  }),
  trialResearchDataCost: 5,
  hints: Object.freeze([]),
})
const NODE_HIGH: ResearchNodeDefinition = Object.freeze({
  nodeId: 'research.high',
  targetSpeciesId: HIGH.id,
  adjacentNodeIds: Object.freeze(['research.low']),
  candidateRange: Object.freeze({
    methods: Object.freeze(['FUSION'] as const),
    materialSpeciesIds: Object.freeze([LOW.id]),
    catalystIds: Object.freeze(['catalyst.high']),
    minimumMaterialCount: 1,
    maximumMaterialCount: 1,
    minimumCatalystCount: 1,
    maximumCatalystCount: 1,
  }),
  recipe: Object.freeze({
    method: 'FUSION',
    materialSpeciesIds: Object.freeze([LOW.id]),
    catalystIds: Object.freeze(['catalyst.high']),
  }),
  trialResearchDataCost: 10,
  hints: Object.freeze([]),
})

const CATALOG: T037ProgressionCatalog = Object.freeze({
  species: Object.freeze([HIGH, LOW]),
  skills: Object.freeze([BLOOM_HIGH, SKILL_HIGH, SKILL_LOW]),
  researchNodes: Object.freeze([NODE_HIGH, NODE_LOW]),
  finalResearchDefinitions: Object.freeze([
    Object.freeze({
      nodeId: NODE_LOW.nodeId,
      researchDataCost: 5,
      catalysts: Object.freeze([{ catalystId: 'catalyst.low', amount: 1 }]),
      specimenRequirements: Object.freeze([]),
    }),
    Object.freeze({
      nodeId: NODE_HIGH.nodeId,
      researchDataCost: 20,
      catalysts: Object.freeze([{ catalystId: 'catalyst.high', amount: 1 }]),
      specimenRequirements: Object.freeze([{ speciesId: LOW.id, amount: 1 }]),
    }),
  ]),
  bloomResearchDefinitions: Object.freeze([
    Object.freeze({
      speciesId: HIGH.id,
      skillId: BLOOM_HIGH.id,
      analysisThresholdBasisPoints: 2000,
      currencyCost: 10,
      researchDataCost: 10,
    }),
  ]),
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
      upgradeCurrencyCost: 100,
      upgradeResearchDataCost: 30,
    }),
  ]),
})

function input(): PlayerData {
  return {
    schemaVersion: 4,
    gameVersion: '0.0.0-t037',
    contentVersion: 'content.test.t037',
    economy: {
      currency: 500,
      researchData: 100,
      catalysts: [
        { catalystId: 'catalyst.high', amount: 2 },
        { catalystId: 'catalyst.low', amount: 2 },
      ],
    },
    research: {
      nodes: [
        {
          nodeId: NODE_HIGH.nodeId,
          status: 'known',
          disclosureStage: 4,
          unlockedHintIds: [],
          incorrectTrialSignatures: [],
        },
        {
          nodeId: NODE_LOW.nodeId,
          status: 'candidate',
          disclosureStage: 3,
          unlockedHintIds: [],
          incorrectTrialSignatures: [],
        },
      ],
    },
    collection: {
      speciesStates: [
        {
          speciesId: LOW.id,
          blueprintUnlocked: true,
          analysisBasisPoints: 5000,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.5',
          statistics: {},
        },
        {
          speciesId: HIGH.id,
          blueprintUnlocked: false,
          analysisBasisPoints: 2500,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.4',
          statistics: {},
        },
      ],
      unitInstances: [
        {
          instanceId: 'unit.low-specimen',
          speciesId: LOW.id,
          learnedGenericSkillIds: [],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
      ],
    },
    formations: { activeFormationId: null, formations: [] },
  }
}

describe('T037 research facility progression', () => {
  it('defaults legacy input to stage 1 and upgrades atomically', () => {
    const source = createResearchFacilityPlayerData(input(), CATALOG)
    expect(source.facilities).toEqual({ researchFacilityStage: 1 })

    const upgraded = upgradeResearchFacility(source, CATALOG)
    expect(upgraded).toMatchObject({
      beforeStage: 1,
      afterStage: 2,
      currencySpent: 100,
      researchDataSpent: 30,
      maxResearchableRarity: 4,
    })
    expect(upgraded.playerData.facilities).toEqual({ researchFacilityStage: 2 })
    expect(upgraded.playerData.economy.currency).toBe(400)
    expect(upgraded.playerData.economy.researchData).toBe(70)
    expect(source.economy.currency).toBe(500)
    expect(() => upgradeResearchFacility(upgraded.playerData, CATALOG)).toThrow(
      'research facility is already at the maximum stage',
    )
  })

  it('allows low-rarity trial research at stage 1 while blocking rarity 4 research', () => {
    const source = createResearchFacilityPlayerData(input(), CATALOG)
    const low = performFacilityTrialResearch(
      source,
      {
        nodeId: NODE_LOW.nodeId,
        method: 'LINEAGE',
        materialSpeciesIds: [LOW.id],
        catalystIds: ['catalyst.low'],
      },
      {},
      CATALOG,
    )
    expect(low.evaluation.exactMatch).toBe(true)
    expect(low.playerData.facilities).toEqual({ researchFacilityStage: 1 })
    expect(() =>
      completeFacilityFinalResearch(
        source,
        { nodeId: NODE_HIGH.nodeId, specimenInstanceIds: ['unit.low-specimen'] },
        CATALOG,
      ),
    ).toThrow('research facility stage 1 allows rarity 2 or lower')
  })

  it('allows final and bloom research after the facility upgrade and preserves the stage', () => {
    const upgraded = upgradeResearchFacility(
      createResearchFacilityPlayerData(input(), CATALOG),
      CATALOG,
    )
    const completed = completeFacilityFinalResearch(
      upgraded.playerData,
      { nodeId: NODE_HIGH.nodeId, specimenInstanceIds: ['unit.low-specimen'] },
      CATALOG,
    )
    expect(completed.playerData.facilities).toEqual({ researchFacilityStage: 2 })
    expect(
      completed.playerData.collection.speciesStates.find((state) => state.speciesId === HIGH.id)
        ?.blueprintUnlocked,
    ).toBe(true)

    const bloomed = unlockFacilityBloomSkill(
      completed.playerData,
      HIGH.id,
      BLOOM_HIGH.id,
      CATALOG,
    )
    expect(bloomed.playerData.facilities).toEqual({ researchFacilityStage: 2 })
    expect(
      bloomed.playerData.collection.speciesStates.find((state) => state.speciesId === HIGH.id)
        ?.bloomSkillIds,
    ).toEqual([BLOOM_HIGH.id])
  })

  it('rejects an unaffordable upgrade without changing the facility or economy', () => {
    const source = createResearchFacilityPlayerData(
      { ...input(), economy: { ...input().economy, currency: 99 } },
      CATALOG,
    )
    expect(() => upgradeResearchFacility(source, CATALOG)).toThrow(
      'economy transaction would make currency negative',
    )
    expect(source.facilities).toEqual({ researchFacilityStage: 1 })
    expect(source.economy.currency).toBe(99)
  })

  it('is byte-stable across 100 facility upgrades', () => {
    const source = createResearchFacilityPlayerData(input(), CATALOG)
    const expected = JSON.stringify(upgradeResearchFacility(source, CATALOG))
    for (let index = 0; index < 100; index += 1) {
      expect(JSON.stringify(upgradeResearchFacility(source, CATALOG))).toBe(expected)
    }
  })
})
