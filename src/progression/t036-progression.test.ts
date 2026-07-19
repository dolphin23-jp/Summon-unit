import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { unlockBloomSkill } from './bloom-research'
import { completeFinalResearch } from './final-research'
import { createPlayerData, type PlayerData } from './player-data'
import type { ResearchNodeDefinition } from './research-model'
import type { T036ProgressionCatalog } from './t036-progression-model'
import {
  calculateRecycleCurrencyReturn,
  calculateRepairCurrencyCost,
  calculateSummonCurrencyCost,
  recycleUnit,
  repairUnit,
  summonUnit,
} from './unit-economy'

function innate(id: string): SkillDefinition {
  return Object.freeze({
    id,
    slotType: 'INNATE',
    actionCost: 100,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  })
}

const INNATE_A = innate('skill.innate.a')
const INNATE_B = innate('skill.innate.b')
const INNATE_C = innate('skill.innate.c')
const INNATE_D = innate('skill.innate.d')
const BLOOM_C: SkillDefinition = Object.freeze({
  id: 'skill.bloom.c',
  slotType: 'BLOOM',
  actionCost: 140,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1800,
})

function species(
  id: string,
  rarity: MonsterSpecies['rarity'],
  innateSkillId: string,
  bloomSkillIds: readonly string[] = [],
): MonsterSpecies {
  return Object.freeze({
    id,
    rarity,
    attributeId: 'attribute.neutral',
    primarySpeciesId: id,
    tagIds: Object.freeze([]),
    stats: Object.freeze({ hp: 100, attack: 25, defense: 20, speed: 20 }),
    innateSkillId,
    bloomSkillIds: Object.freeze(bloomSkillIds),
  })
}

const SPECIES_A = species('species.a', 1, INNATE_A.id)
const SPECIES_B = species('species.b', 2, INNATE_B.id)
const SPECIES_C = species('species.c', 4, INNATE_C.id, [BLOOM_C.id])
const SPECIES_D = species('species.d', 1, INNATE_D.id)

const NODE_C: ResearchNodeDefinition = Object.freeze({
  nodeId: 'research.c',
  targetSpeciesId: SPECIES_C.id,
  adjacentNodeIds: Object.freeze([]),
  candidateRange: Object.freeze({
    methods: Object.freeze(['FUSION'] as const),
    materialSpeciesIds: Object.freeze([SPECIES_A.id, SPECIES_B.id]),
    catalystIds: Object.freeze(['catalyst.core']),
    minimumMaterialCount: 2,
    maximumMaterialCount: 2,
    minimumCatalystCount: 1,
    maximumCatalystCount: 1,
  }),
  recipe: Object.freeze({
    method: 'FUSION',
    materialSpeciesIds: Object.freeze([SPECIES_A.id, SPECIES_B.id]),
    catalystIds: Object.freeze(['catalyst.core']),
  }),
  trialResearchDataCost: 5,
  hints: Object.freeze([]),
})

const NODE_D: ResearchNodeDefinition = Object.freeze({
  nodeId: 'research.d',
  targetSpeciesId: SPECIES_D.id,
  adjacentNodeIds: Object.freeze([]),
  candidateRange: Object.freeze({
    methods: Object.freeze(['LINEAGE'] as const),
    materialSpeciesIds: Object.freeze([SPECIES_A.id]),
    catalystIds: Object.freeze(['catalyst.forest']),
    minimumMaterialCount: 1,
    maximumMaterialCount: 1,
    minimumCatalystCount: 1,
    maximumCatalystCount: 1,
  }),
  recipe: Object.freeze({
    method: 'LINEAGE',
    materialSpeciesIds: Object.freeze([SPECIES_A.id]),
    catalystIds: Object.freeze(['catalyst.forest']),
  }),
  trialResearchDataCost: 2,
  hints: Object.freeze([]),
})

const CATALOG: T036ProgressionCatalog = Object.freeze({
  species: Object.freeze([SPECIES_D, SPECIES_C, SPECIES_B, SPECIES_A]),
  skills: Object.freeze([BLOOM_C, INNATE_D, INNATE_C, INNATE_B, INNATE_A]),
  researchNodes: Object.freeze([NODE_D, NODE_C]),
  finalResearchDefinitions: Object.freeze([
    Object.freeze({
      nodeId: NODE_C.nodeId,
      researchDataCost: 40,
      catalysts: Object.freeze([
        Object.freeze({ catalystId: 'catalyst.core', amount: 2 }),
      ]),
      specimenRequirements: Object.freeze([
        Object.freeze({ speciesId: SPECIES_B.id, amount: 1 }),
        Object.freeze({ speciesId: SPECIES_A.id, amount: 1 }),
      ]),
    }),
    Object.freeze({
      nodeId: NODE_D.nodeId,
      researchDataCost: 10,
      catalysts: Object.freeze([
        Object.freeze({ catalystId: 'catalyst.forest', amount: 1 }),
      ]),
      specimenRequirements: Object.freeze([]),
    }),
  ]),
  bloomResearchDefinitions: Object.freeze([
    Object.freeze({
      speciesId: SPECIES_C.id,
      skillId: BLOOM_C.id,
      analysisThresholdBasisPoints: 3000,
      currencyCost: 50,
      researchDataCost: 20,
    }),
  ]),
})

function createInput(overrides: Partial<PlayerData> = {}): PlayerData {
  const base: PlayerData = {
    schemaVersion: 3,
    gameVersion: '0.0.0-t036',
    contentVersion: 'content.test.t036',
    economy: {
      currency: 2000,
      researchData: 200,
      catalysts: [
        { catalystId: 'catalyst.forest', amount: 2 },
        { catalystId: 'catalyst.core', amount: 3 },
      ],
    },
    research: {
      nodes: [
        {
          nodeId: NODE_D.nodeId,
          status: 'known',
          disclosureStage: 4,
          unlockedHintIds: [],
          incorrectTrialSignatures: [],
        },
        {
          nodeId: NODE_C.nodeId,
          status: 'known',
          disclosureStage: 4,
          unlockedHintIds: [],
          incorrectTrialSignatures: [],
        },
      ],
    },
    collection: {
      speciesStates: [
        {
          speciesId: SPECIES_A.id,
          blueprintUnlocked: true,
          analysisBasisPoints: 5000,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.5',
          statistics: {},
        },
        {
          speciesId: SPECIES_B.id,
          blueprintUnlocked: true,
          analysisBasisPoints: 4000,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.5',
          statistics: {},
        },
        {
          speciesId: SPECIES_C.id,
          blueprintUnlocked: false,
          analysisBasisPoints: 3500,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.4',
          statistics: {},
        },
      ],
      unitInstances: [
        {
          instanceId: 'unit.a-specimen',
          speciesId: SPECIES_A.id,
          learnedGenericSkillIds: [],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
        {
          instanceId: 'unit.b-specimen',
          speciesId: SPECIES_B.id,
          learnedGenericSkillIds: [],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
        {
          instanceId: 'unit.a-locked',
          speciesId: SPECIES_A.id,
          learnedGenericSkillIds: [],
          nickname: null,
          favorite: false,
          locked: true,
          conditionBasisPoints: 10_000,
        },
        {
          instanceId: 'unit.a-formed',
          speciesId: SPECIES_A.id,
          learnedGenericSkillIds: [],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
        {
          instanceId: 'unit.b-damaged',
          speciesId: SPECIES_B.id,
          learnedGenericSkillIds: [],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 5000,
        },
      ],
    },
    formations: {
      activeFormationId: 'formation.main',
      formations: [
        {
          formationId: 'formation.main',
          name: 'Main',
          members: [
            {
              instanceId: 'unit.a-formed',
              position: { row: 0, column: 0 },
              loadout: { genericSkillId: null, bloomSkillId: null },
              tiePriority: 0,
              ai: {
                individualStrategy: 'STANDARD',
                teamStrategy: 'STABLE_CLEAR',
                skillPolicies: [],
              },
            },
          ],
        },
      ],
    },
  }
  return { ...base, ...overrides }
}

function normalizedInput(overrides: Partial<PlayerData> = {}): PlayerData {
  return createPlayerData(createInput(overrides), CATALOG)
}

describe('T036 final research', () => {
  it('atomically consumes research resources and R4+ specimens, completes the node, and permanently unlocks the blueprint', () => {
    const source = normalizedInput()
    const result = completeFinalResearch(
      source,
      {
        nodeId: NODE_C.nodeId,
        specimenInstanceIds: ['unit.b-specimen', 'unit.a-specimen'],
      },
      CATALOG,
    )

    expect(result.researchDataSpent).toBe(40)
    expect(result.catalystsSpent).toEqual([{ catalystId: 'catalyst.core', amount: 2 }])
    expect(result.consumedSpecimenInstanceIds).toEqual([
      'unit.a-specimen',
      'unit.b-specimen',
    ])
    expect(result.playerData.economy.researchData).toBe(160)
    expect(result.playerData.economy.catalysts).toEqual([
      { catalystId: 'catalyst.core', amount: 1 },
      { catalystId: 'catalyst.forest', amount: 2 },
    ])
    expect(
      result.playerData.research?.nodes.find((node) => node.nodeId === NODE_C.nodeId),
    ).toMatchObject({ status: 'completed', disclosureStage: 5 })
    expect(
      result.playerData.collection.speciesStates.find(
        (state) => state.speciesId === SPECIES_C.id,
      ),
    ).toMatchObject({ blueprintUnlocked: true, encyclopediaStageId: 'encyclopedia-stage.5' })
    expect(
      result.playerData.collection.unitInstances.map((instance) => instance.instanceId),
    ).not.toContain('unit.a-specimen')
    expect(source.economy.researchData).toBe(200)
  })

  it('creates the target species state for low-rarity research without consuming a specimen', () => {
    const source = normalizedInput()
    const result = completeFinalResearch(
      source,
      { nodeId: NODE_D.nodeId, specimenInstanceIds: [] },
      CATALOG,
    )

    expect(
      result.playerData.collection.speciesStates.find(
        (state) => state.speciesId === SPECIES_D.id,
      ),
    ).toEqual({
      speciesId: SPECIES_D.id,
      blueprintUnlocked: true,
      analysisBasisPoints: 0,
      bloomSkillIds: [],
      encyclopediaStageId: 'encyclopedia-stage.5',
      statistics: {},
    })
    expect(result.playerData.collection.unitInstances).toHaveLength(
      source.collection.unitInstances.length,
    )
  })

  it('rejects locked, assigned, mismatched, and unaffordable specimens without mutating the input', () => {
    const source = normalizedInput()
    expect(() =>
      completeFinalResearch(
        source,
        {
          nodeId: NODE_C.nodeId,
          specimenInstanceIds: ['unit.a-locked', 'unit.b-specimen'],
        },
        CATALOG,
      ),
    ).toThrow('final research specimen is locked: unit.a-locked')
    expect(() =>
      completeFinalResearch(
        source,
        {
          nodeId: NODE_C.nodeId,
          specimenInstanceIds: ['unit.a-formed', 'unit.b-specimen'],
        },
        CATALOG,
      ),
    ).toThrow('final research specimen is assigned to a formation: unit.a-formed')
    expect(() =>
      completeFinalResearch(
        source,
        {
          nodeId: NODE_C.nodeId,
          specimenInstanceIds: ['unit.a-specimen', 'unit.a-locked'],
        },
        CATALOG,
      ),
    ).toThrow()

    const poor = createPlayerData(
      {
        ...source,
        economy: { ...source.economy, researchData: 39 },
      },
      CATALOG,
    )
    expect(() =>
      completeFinalResearch(
        poor,
        {
          nodeId: NODE_C.nodeId,
          specimenInstanceIds: ['unit.a-specimen', 'unit.b-specimen'],
        },
        CATALOG,
      ),
    ).toThrow('economy transaction would make research data negative')
    expect(poor.economy.researchData).toBe(39)
    expect(poor.collection.unitInstances).toHaveLength(source.collection.unitInstances.length)
  })

  it('is byte-stable across 100 reruns', () => {
    const source = normalizedInput()
    const request = {
      nodeId: NODE_C.nodeId,
      specimenInstanceIds: ['unit.b-specimen', 'unit.a-specimen'],
    }
    const expected = JSON.stringify(completeFinalResearch(source, request, CATALOG))
    for (let index = 0; index < 100; index += 1) {
      expect(JSON.stringify(completeFinalResearch(source, request, CATALOG))).toBe(expected)
    }
  })
})

describe('T036 summoning, recycling, and repair', () => {
  it('uses fixed rarity multipliers and summons immediately from an unlocked blueprint', () => {
    expect(calculateSummonCurrencyCost(1)).toBe(100)
    expect(calculateSummonCurrencyCost(4)).toBe(800)
    expect(calculateSummonCurrencyCost(10)).toBe(51_200)
    expect(calculateRecycleCurrencyReturn(4)).toBe(560)

    const completed = completeFinalResearch(
      normalizedInput(),
      {
        nodeId: NODE_C.nodeId,
        specimenInstanceIds: ['unit.a-specimen', 'unit.b-specimen'],
      },
      CATALOG,
    )
    const summoned = summonUnit(
      completed.playerData,
      { instanceId: 'unit.c-01', speciesId: SPECIES_C.id, nickname: 'C-01' },
      CATALOG,
    )

    expect(summoned.currencySpent).toBe(800)
    expect(summoned.playerData.economy.currency).toBe(1200)
    expect(
      summoned.playerData.collection.unitInstances.find(
        (instance) => instance.instanceId === 'unit.c-01',
      ),
    ).toEqual({
      instanceId: 'unit.c-01',
      speciesId: SPECIES_C.id,
      learnedGenericSkillIds: [],
      nickname: 'C-01',
      favorite: false,
      locked: false,
      conditionBasisPoints: 10_000,
    })
    expect(() =>
      summonUnit(
        summoned.playerData,
        { instanceId: 'unit.c-01', speciesId: SPECIES_C.id },
        CATALOG,
      ),
    ).toThrow('summon instance ID already exists: unit.c-01')
    expect(() =>
      summonUnit(
        normalizedInput(),
        { instanceId: 'unit.c-locked', speciesId: SPECIES_C.id },
        CATALOG,
      ),
    ).toThrow(`summon requires an unlocked blueprint: ${SPECIES_C.id}`)
  })

  it('returns 70% on recycling and protects locked or formation-assigned units', () => {
    const source = normalizedInput()
    const recycled = recycleUnit(source, 'unit.b-damaged', CATALOG)

    expect(recycled.currencyReturned).toBe(140)
    expect(recycled.playerData.economy.currency).toBe(2140)
    expect(
      recycled.playerData.collection.unitInstances.some(
        (instance) => instance.instanceId === 'unit.b-damaged',
      ),
    ).toBe(false)
    expect(() => recycleUnit(source, 'unit.a-locked', CATALOG)).toThrow(
      'recycle unit instance is locked: unit.a-locked',
    )
    expect(() => recycleUnit(source, 'unit.a-formed', CATALOG)).toThrow(
      'recycle unit instance is assigned to a formation: unit.a-formed',
    )
  })

  it('charges a small condition-proportional repair fee and restores full condition', () => {
    expect(calculateRepairCurrencyCost(2, 5000)).toBe(5)
    const source = normalizedInput()
    const repaired = repairUnit(source, 'unit.b-damaged', CATALOG)

    expect(repaired.currencySpent).toBe(5)
    expect(repaired.beforeConditionBasisPoints).toBe(5000)
    expect(repaired.afterConditionBasisPoints).toBe(10_000)
    expect(repaired.playerData.economy.currency).toBe(1995)
    expect(
      repaired.playerData.collection.unitInstances.find(
        (instance) => instance.instanceId === 'unit.b-damaged',
      )?.conditionBasisPoints,
    ).toBe(10_000)
    expect(() => repairUnit(source, 'unit.a-specimen', CATALOG)).toThrow(
      'repair unit instance is already at full condition: unit.a-specimen',
    )
  })
})

describe('T036 bloom research', () => {
  it('unlocks a bloom skill species-wide after the analysis threshold and permits one equipped bloom slot', () => {
    const completed = completeFinalResearch(
      normalizedInput(),
      {
        nodeId: NODE_C.nodeId,
        specimenInstanceIds: ['unit.a-specimen', 'unit.b-specimen'],
      },
      CATALOG,
    )
    const summoned = summonUnit(
      completed.playerData,
      { instanceId: 'unit.c-01', speciesId: SPECIES_C.id },
      CATALOG,
    )
    const unlocked = unlockBloomSkill(
      summoned.playerData,
      SPECIES_C.id,
      BLOOM_C.id,
      CATALOG,
    )

    expect(unlocked.currencySpent).toBe(50)
    expect(unlocked.researchDataSpent).toBe(20)
    expect(unlocked.playerData.economy.currency).toBe(1150)
    expect(unlocked.playerData.economy.researchData).toBe(140)
    expect(
      unlocked.playerData.collection.speciesStates.find(
        (state) => state.speciesId === SPECIES_C.id,
      )?.bloomSkillIds,
    ).toEqual([BLOOM_C.id])

    const equipped = createPlayerData(
      {
        ...unlocked.playerData,
        formations: {
          activeFormationId: 'formation.c',
          formations: [
            {
              formationId: 'formation.c',
              name: 'Bloom',
              members: [
                {
                  instanceId: 'unit.c-01',
                  position: { row: 0, column: 0 },
                  loadout: { genericSkillId: null, bloomSkillId: BLOOM_C.id },
                  tiePriority: 0,
                  ai: {
                    individualStrategy: 'STANDARD',
                    teamStrategy: 'STABLE_CLEAR',
                    skillPolicies: [{ skillId: BLOOM_C.id, policy: 'STANDARD' }],
                  },
                },
              ],
            },
          ],
        },
      },
      CATALOG,
    )
    expect(equipped.formations.formations[0]?.members[0]?.loadout.bloomSkillId).toBe(
      BLOOM_C.id,
    )
    expect(() =>
      unlockBloomSkill(unlocked.playerData, SPECIES_C.id, BLOOM_C.id, CATALOG),
    ).toThrow(`bloom skill is already unlocked: ${SPECIES_C.id}/${BLOOM_C.id}`)
  })

  it('rejects insufficient analysis and insufficient resources atomically', () => {
    const source = normalizedInput()
    const lowAnalysis = createPlayerData(
      {
        ...source,
        collection: {
          ...source.collection,
          speciesStates: source.collection.speciesStates.map((state) =>
            state.speciesId === SPECIES_C.id
              ? { ...state, blueprintUnlocked: true, analysisBasisPoints: 2999 }
              : state,
          ),
        },
      },
      CATALOG,
    )
    expect(() => unlockBloomSkill(lowAnalysis, SPECIES_C.id, BLOOM_C.id, CATALOG)).toThrow(
      `bloom research analysis is insufficient: ${SPECIES_C.id} requires 3000`,
    )

    const poor = createPlayerData(
      {
        ...source,
        economy: { ...source.economy, currency: 49 },
        collection: {
          ...source.collection,
          speciesStates: source.collection.speciesStates.map((state) =>
            state.speciesId === SPECIES_C.id ? { ...state, blueprintUnlocked: true } : state,
          ),
        },
      },
      CATALOG,
    )
    expect(() => unlockBloomSkill(poor, SPECIES_C.id, BLOOM_C.id, CATALOG)).toThrow(
      'economy transaction would make currency negative',
    )
    expect(
      poor.collection.speciesStates.find((state) => state.speciesId === SPECIES_C.id)
        ?.bloomSkillIds,
    ).toEqual([])
  })
})
