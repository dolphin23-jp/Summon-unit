import { describe, expect, it } from 'vitest'
import {
  T039_GENERIC_SKILL_COSTS,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import {
  validateContentCatalog,
  type ContentValidationCatalog,
} from './content-validation'
import { ACTIVE_CONTENT_VALIDATION } from './runtime-content-validation'
import {
  VERTICAL_SLICE_RUNTIME_CATALOG,
  VERTICAL_SLICE_RUNTIME_GENERIC_SKILL_COSTS,
} from './vertical-slice-runtime'

const OPTIONS = Object.freeze({ genericSkillCosts: T039_GENERIC_SKILL_COSTS })
const ACTIVE_OPTIONS = Object.freeze({
  genericSkillCosts: VERTICAL_SLICE_RUNTIME_GENERIC_SKILL_COSTS,
})

function validate(catalog: ContentValidationCatalog = T039_PLAYER_CATALOG) {
  return validateContentCatalog(catalog, OPTIONS)
}

function validateActive() {
  return validateContentCatalog(VERTICAL_SLICE_RUNTIME_CATALOG, ACTIVE_OPTIONS)
}

describe('content validation pipeline', () => {
  it('validates the active content catalog and returns a stable summary', () => {
    expect(validateActive()).toEqual({
      species: 16,
      skills: 42,
      genericSkillCosts: 10,
      researchNodes: 10,
      finalResearchDefinitions: 10,
      bloomResearchDefinitions: 16,
      researchFacilityStages: 3,
      regions: 2,
      stages: 17,
      bossStages: 2,
    })
    expect(ACTIVE_CONTENT_VALIDATION).toEqual(validateActive())
  })

  it('rejects a species whose innate skill reference is missing', () => {
    const catalog: ContentValidationCatalog = {
      ...T039_PLAYER_CATALOG,
      species: T039_PLAYER_CATALOG.species.map((species, index) =>
        index === 0 ? { ...species, innateSkillId: 'skill.missing' } : species,
      ),
    }

    expect(() => validate(catalog)).toThrow(
      'content validation failed in species: species innate skill must exist in the INNATE slot',
    )
  })

  it('rejects an unknown species reference in a research recipe', () => {
    const firstNode = T039_PLAYER_CATALOG.researchNodes[0]
    const catalog: ContentValidationCatalog = {
      ...T039_PLAYER_CATALOG,
      researchNodes: [
        {
          ...firstNode,
          candidateRange: {
            ...firstNode.candidateRange,
            materialSpeciesIds: ['species.missing'],
          },
          recipe: {
            ...firstNode.recipe,
            materialSpeciesIds: ['species.missing'],
          },
        },
        ...T039_PLAYER_CATALOG.researchNodes.slice(1),
      ],
    }

    expect(() => validate(catalog)).toThrow(
      'content validation failed in research: research node material species is unknown: species.missing',
    )
  })

  it('rejects an unknown stage reference in an unlock requirement', () => {
    const firstStage = T039_PLAYER_CATALOG.stages[0]
    const catalog: ContentValidationCatalog = {
      ...T039_PLAYER_CATALOG,
      stages: [
        {
          ...firstStage,
          access: {
            ...firstStage.access!,
            requirement: { type: 'STAGE_COMPLETED', stageId: 'stage.missing' },
          },
        },
        ...T039_PLAYER_CATALOG.stages.slice(1),
      ],
    }

    expect(() => validate(catalog)).toThrow(
      'content validation failed in regions and stages: stage.stage.demo-forest-01.access.requirement references unknown stage: stage.missing',
    )
  })

  it('rejects a boss phase skill that is not in the boss loadout', () => {
    const bossIndex = T039_PLAYER_CATALOG.stages.findIndex((stage) => stage.boss !== null)
    const bossStage = T039_PLAYER_CATALOG.stages[bossIndex]
    const boss = bossStage.boss!
    const catalog: ContentValidationCatalog = {
      ...T039_PLAYER_CATALOG,
      stages: T039_PLAYER_CATALOG.stages.map((stage, index) =>
        index === bossIndex
          ? {
              ...bossStage,
              boss: {
                ...boss,
                phases: boss.phases.map((phase, phaseIndex) =>
                  phaseIndex === 1
                    ? { ...phase, actionSkillIds: ['skill.demo-generic-focus'] }
                    : phase,
                ),
              },
            }
          : stage,
      ),
    }

    expect(() => validate(catalog)).toThrow(
      'content validation failed in regions and stages: boss phase skill is not equipped by the boss',
    )
  })

  it('produces byte-identical output across repeated validation', () => {
    const baseline = JSON.stringify(validateActive())
    for (let run = 0; run < 100; run += 1) {
      expect(JSON.stringify(validateActive())).toBe(baseline)
    }
  })
})
