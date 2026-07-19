import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { createPlayerData, type PlayerData, type PlayerDataContentCatalog } from './player-data'
import {
  applyResearchHintTriggers,
  createTrialResearchSignature,
  performTrialResearch,
} from './research'
import type { ResearchNodeDefinition } from './research-model'

const INNATE_A: SkillDefinition = Object.freeze({
  id: 'skill.innate.a',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})
const INNATE_B: SkillDefinition = Object.freeze({
  id: 'skill.innate.b',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})
const INNATE_C: SkillDefinition = Object.freeze({
  id: 'skill.innate.c',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})

function species(id: string, innateSkillId: string): MonsterSpecies {
  return Object.freeze({
    id,
    rarity: 1,
    attributeId: 'attribute.none',
    primarySpeciesId: id,
    tagIds: Object.freeze([]),
    stats: Object.freeze({ hp: 100, attack: 20, defense: 20, speed: 20 }),
    innateSkillId,
    bloomSkillIds: Object.freeze([]),
  })
}

const SPECIES_A = species('species.a', INNATE_A.id)
const SPECIES_B = species('species.b', INNATE_B.id)
const SPECIES_C = species('species.c', INNATE_C.id)

const NODE_A: ResearchNodeDefinition = Object.freeze({
  nodeId: 'research.a',
  targetSpeciesId: SPECIES_A.id,
  adjacentNodeIds: Object.freeze(['research.c']),
  candidateRange: Object.freeze({
    methods: Object.freeze(['LINEAGE'] as const),
    materialSpeciesIds: Object.freeze([SPECIES_A.id]),
    catalystIds: Object.freeze([]),
    minimumMaterialCount: 1,
    maximumMaterialCount: 1,
    minimumCatalystCount: 0,
    maximumCatalystCount: 0,
  }),
  recipe: Object.freeze({
    method: 'LINEAGE',
    materialSpeciesIds: Object.freeze([SPECIES_A.id]),
    catalystIds: Object.freeze([]),
  }),
  trialResearchDataCost: 1,
  hints: Object.freeze([]),
})

const NODE_C: ResearchNodeDefinition = Object.freeze({
  nodeId: 'research.c',
  targetSpeciesId: SPECIES_C.id,
  adjacentNodeIds: Object.freeze(['research.a']),
  candidateRange: Object.freeze({
    methods: Object.freeze(['FUSION', 'LINEAGE'] as const),
    materialSpeciesIds: Object.freeze([SPECIES_A.id, SPECIES_B.id]),
    catalystIds: Object.freeze(['catalyst.core', 'catalyst.forest']),
    minimumMaterialCount: 1,
    maximumMaterialCount: 2,
    minimumCatalystCount: 0,
    maximumCatalystCount: 1,
  }),
  recipe: Object.freeze({
    method: 'FUSION',
    materialSpeciesIds: Object.freeze([SPECIES_A.id, SPECIES_B.id]),
    catalystIds: Object.freeze(['catalyst.core']),
  }),
  trialResearchDataCost: 5,
  hints: Object.freeze([
    Object.freeze({
      hintId: 'hint.analysis',
      disclosureStage: 1,
      trigger: Object.freeze({
        type: 'ANALYSIS',
        speciesId: SPECIES_A.id,
        minimumBasisPoints: 1000,
      }),
    }),
    Object.freeze({
      hintId: 'hint.catalyst',
      disclosureStage: 2,
      trigger: Object.freeze({ type: 'CATALYST', catalystId: 'catalyst.core' }),
    }),
    Object.freeze({
      hintId: 'hint.progress',
      disclosureStage: 2,
      trigger: Object.freeze({ type: 'PROGRESS', progressId: 'progress.region-a-boss' }),
    }),
    Object.freeze({
      hintId: 'hint.adjacent',
      disclosureStage: 3,
      trigger: Object.freeze({
        type: 'ADJACENT',
        nodeId: NODE_A.nodeId,
        minimumStatus: 'completed',
      }),
    }),
    Object.freeze({
      hintId: 'hint.trial',
      disclosureStage: 3,
      trigger: Object.freeze({ type: 'TRIAL', minimumIncorrectTrials: 1 }),
    }),
  ]),
})

const CATALOG: PlayerDataContentCatalog = Object.freeze({
  species: Object.freeze([SPECIES_C, SPECIES_A, SPECIES_B]),
  skills: Object.freeze([INNATE_C, INNATE_A, INNATE_B]),
  researchNodes: Object.freeze([NODE_C, NODE_A]),
})

function createInput(options: {
  researchData?: number
  completedNodeA?: boolean
  nodeCStage?: 0 | 1 | 2 | 3 | 4 | 5
} = {}): PlayerData {
  const nodeCStage = options.nodeCStage ?? 0
  const statusByStage = ['hidden', 'hinted', 'candidate', 'candidate', 'known', 'completed'] as const
  return {
    schemaVersion: 3,
    gameVersion: '0.0.0-t035',
    contentVersion: 'content.test.t035',
    economy: {
      currency: 100,
      researchData: options.researchData ?? 20,
      catalysts: [{ catalystId: 'catalyst.core', amount: 1 }],
    },
    research: {
      nodes: [
        {
          nodeId: NODE_A.nodeId,
          status: options.completedNodeA === false ? 'known' : 'completed',
          disclosureStage: options.completedNodeA === false ? 4 : 5,
          unlockedHintIds: [],
          incorrectTrialSignatures: [],
        },
        {
          nodeId: NODE_C.nodeId,
          status: statusByStage[nodeCStage],
          disclosureStage: nodeCStage,
          unlockedHintIds:
            nodeCStage >= 2
              ? ['hint.analysis', 'hint.catalyst']
              : nodeCStage === 1
                ? ['hint.analysis']
                : [],
          incorrectTrialSignatures: [],
        },
      ],
    },
    collection: {
      speciesStates: [
        {
          speciesId: SPECIES_A.id,
          blueprintUnlocked: true,
          analysisBasisPoints: 1500,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.5',
          statistics: {},
        },
        {
          speciesId: SPECIES_B.id,
          blueprintUnlocked: true,
          analysisBasisPoints: 200,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.2',
          statistics: {},
        },
        {
          speciesId: SPECIES_C.id,
          blueprintUnlocked: false,
          analysisBasisPoints: 0,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia-stage.0',
          statistics: {},
        },
      ],
      unitInstances: [],
    },
    formations: { activeFormationId: null, formations: [] },
  }
}

function candidatePlayerData(researchData = 20): PlayerData {
  const input = createInput({ researchData, nodeCStage: 2, completedNodeA: false })
  return createPlayerData(input, CATALOG)
}

const WRONG_SUBMISSION = Object.freeze({
  nodeId: NODE_C.nodeId,
  method: 'LINEAGE' as const,
  materialSpeciesIds: Object.freeze([SPECIES_A.id]),
  catalystIds: Object.freeze([]),
})

const CORRECT_SUBMISSION = Object.freeze({
  nodeId: NODE_C.nodeId,
  method: 'FUSION' as const,
  materialSpeciesIds: Object.freeze([SPECIES_B.id, SPECIES_A.id]),
  catalystIds: Object.freeze(['catalyst.core']),
})

describe('research network and disclosure', () => {
  it('normalizes nodes by fixed ID and fills missing definitions as hidden', () => {
    const source = createInput()
    const input: PlayerData = {
      ...source,
      research: {
        nodes: [
          source.research?.nodes[0] as NonNullable<PlayerData['research']>['nodes'][number],
        ],
      },
    }
    const normalized = createPlayerData(input, CATALOG)

    expect(normalized.research?.nodes.map((node) => node.nodeId)).toEqual([
      NODE_A.nodeId,
      NODE_C.nodeId,
    ])
    expect(normalized.research?.nodes[1]).toEqual({
      nodeId: NODE_C.nodeId,
      status: 'hidden',
      disclosureStage: 0,
      unlockedHintIds: [],
      incorrectTrialSignatures: [],
    })
    expect(Object.isFrozen(normalized.research?.nodes)).toBe(true)
  })

  it('applies analysis, catalyst, progress, and adjacent hints in fixed order', () => {
    const result = applyResearchHintTriggers(
      createPlayerData(createInput(), CATALOG),
      { completedProgressIds: ['progress.region-a-boss'] },
      CATALOG,
    )
    const node = result.playerData.research?.nodes.find((state) => state.nodeId === NODE_C.nodeId)

    expect(node).toEqual({
      nodeId: NODE_C.nodeId,
      status: 'candidate',
      disclosureStage: 3,
      unlockedHintIds: ['hint.adjacent', 'hint.analysis', 'hint.catalyst', 'hint.progress'],
      incorrectTrialSignatures: [],
    })
    expect(result.changes).toEqual([
      {
        nodeId: NODE_C.nodeId,
        beforeStage: 0,
        afterStage: 3,
        unlockedHintIds: ['hint.adjacent', 'hint.analysis', 'hint.catalyst', 'hint.progress'],
      },
    ])
    expect(
      result.playerData.collection.speciesStates.find((state) => state.speciesId === SPECIES_C.id)
        ?.encyclopediaStageId,
    ).toBe('encyclopedia-stage.3')
  })
})

describe('trial research', () => {
  it('charges only research data, returns element results, saves a canonical wrong signature, and reveals a trial hint', () => {
    const source = candidatePlayerData()
    const result = performTrialResearch(source, WRONG_SUBMISSION, {}, CATALOG)
    const node = result.playerData.research?.nodes.find((state) => state.nodeId === NODE_C.nodeId)

    expect(result.researchDataSpent).toBe(5)
    expect(result.playerData.economy.researchData).toBe(15)
    expect(result.playerData.economy.catalysts).toEqual(source.economy.catalysts)
    expect(result.playerData.collection.unitInstances).toEqual([])
    expect(result.evaluation).toEqual({
      methodMatched: false,
      materialSpecies: [{ elementId: SPECIES_A.id, matched: true }],
      catalysts: [],
      materialCountMatched: false,
      catalystCountMatched: false,
      exactMatch: false,
    })
    expect(result.incorrectSignature).toBe(createTrialResearchSignature(WRONG_SUBMISSION))
    expect(node).toEqual({
      nodeId: NODE_C.nodeId,
      status: 'candidate',
      disclosureStage: 3,
      unlockedHintIds: ['hint.analysis', 'hint.catalyst', 'hint.trial'],
      incorrectTrialSignatures: [createTrialResearchSignature(WRONG_SUBMISSION)],
    })
    expect(source.economy.researchData).toBe(20)
    expect(
      source.research?.nodes.find((state) => state.nodeId === NODE_C.nodeId)
        ?.incorrectTrialSignatures,
    ).toEqual([])
  })

  it('moves an exact candidate recipe to known stage 4 without consuming catalysts', () => {
    const source = candidatePlayerData()
    const result = performTrialResearch(source, CORRECT_SUBMISSION, {}, CATALOG)
    const node = result.playerData.research?.nodes.find((state) => state.nodeId === NODE_C.nodeId)

    expect(result.evaluation.exactMatch).toBe(true)
    expect(result.incorrectSignature).toBeNull()
    expect(node?.status).toBe('known')
    expect(node?.disclosureStage).toBe(4)
    expect(result.playerData.economy.researchData).toBe(15)
    expect(result.playerData.economy.catalysts).toEqual(source.economy.catalysts)
    expect(
      result.playerData.collection.speciesStates.find((state) => state.speciesId === SPECIES_C.id)
        ?.encyclopediaStageId,
    ).toBe('encyclopedia-stage.4')
  })

  it('rejects candidate-range violations, duplicate wrong signatures, and insufficient research data atomically', () => {
    const source = candidatePlayerData()
    expect(() =>
      performTrialResearch(
        source,
        { ...WRONG_SUBMISSION, materialSpeciesIds: ['species.outside'] },
        {},
        CATALOG,
      ),
    ).toThrow('trial research species is outside the candidate range: species.outside')

    const wrong = performTrialResearch(source, WRONG_SUBMISSION, {}, CATALOG)
    expect(() => performTrialResearch(wrong.playerData, WRONG_SUBMISSION, {}, CATALOG)).toThrow(
      'trial research signature was already attempted',
    )

    const insufficient = candidatePlayerData(4)
    expect(() => performTrialResearch(insufficient, WRONG_SUBMISSION, {}, CATALOG)).toThrow(
      'economy transaction would make research data negative',
    )
    expect(insufficient.economy.researchData).toBe(4)
    expect(
      insufficient.research?.nodes.find((state) => state.nodeId === NODE_C.nodeId)
        ?.incorrectTrialSignatures,
    ).toEqual([])
  })

  it('is byte-stable across 100 reruns', () => {
    const source = candidatePlayerData()
    const expected = JSON.stringify(performTrialResearch(source, WRONG_SUBMISSION, {}, CATALOG))
    for (let index = 0; index < 100; index += 1) {
      expect(JSON.stringify(performTrialResearch(source, WRONG_SUBMISSION, {}, CATALOG))).toBe(
        expected,
      )
    }
  })
})
