import {
  resolveAiStrategyWeights,
  validateAiSkillPolicies,
} from '../ai/strategy-presets'
import { normalizeBossEncounterDefinition } from '../battle/boss-phase'
import { ANALYSIS_GAIN_SOURCES } from '../progression/analysis'
import type { PlayerDataContentCatalog } from '../progression/player-data'
import {
  normalizeRegionProgression,
  type RegionDefinition,
} from '../progression/region-progression'
import {
  normalizeResearchFacilityStages,
  type ResearchFacilityStageDefinition,
} from '../progression/research-facility-model'
import {
  assertValidResearchNetwork,
  type ResearchNodeDefinition,
} from '../progression/research-model'
import type { StageDefinition } from '../progression/stage-model'
import {
  assertValidT036ProgressionCatalog,
  type BloomResearchDefinition,
  type FinalResearchDefinition,
  type T036ProgressionCatalog,
} from '../progression/t036-progression-model'
import {
  assertValidMonsterSpecies,
  type MonsterSpecies,
  type SpeciesId,
} from './monster-species'
import {
  assertValidSkillDefinition,
  type SkillDefinition,
  type SkillId,
} from './skill-definition'

export interface ContentValidationCatalog extends PlayerDataContentCatalog {
  readonly researchNodes?: readonly ResearchNodeDefinition[]
  readonly finalResearchDefinitions?: readonly FinalResearchDefinition[]
  readonly bloomResearchDefinitions?: readonly BloomResearchDefinition[]
  readonly researchFacilityStages?: readonly ResearchFacilityStageDefinition[]
  readonly regions?: readonly RegionDefinition[]
  readonly stages?: readonly StageDefinition[]
}

export interface ContentValidationOptions {
  readonly genericSkillCosts?: Readonly<Record<SkillId, number>>
}

export interface ContentValidationSummary {
  readonly species: number
  readonly skills: number
  readonly genericSkillCosts: number
  readonly researchNodes: number
  readonly finalResearchDefinitions: number
  readonly bloomResearchDefinitions: number
  readonly researchFacilityStages: number
  readonly regions: number
  readonly stages: number
  readonly bossStages: number
}

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertPositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive safe integer`)
  }
}

function validateSection(name: string, validate: () => void): void {
  try {
    validate()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`content validation failed in ${name}: ${message}`)
  }
}

function createUniqueSkillMap(skills: readonly SkillDefinition[]): ReadonlyMap<SkillId, SkillDefinition> {
  const skillById = new Map<SkillId, SkillDefinition>()
  for (const skill of skills) {
    assertValidSkillDefinition(skill)
    if (skillById.has(skill.id)) {
      throw new Error(`skill id must be unique: ${skill.id}`)
    }
    skillById.set(skill.id, skill)
  }
  return skillById
}

function createUniqueSpeciesMap(
  speciesDefinitions: readonly MonsterSpecies[],
  skillById: ReadonlyMap<SkillId, SkillDefinition>,
): ReadonlyMap<SpeciesId, MonsterSpecies> {
  const speciesById = new Map<SpeciesId, MonsterSpecies>()
  for (const species of speciesDefinitions) {
    assertValidMonsterSpecies(species)
    if (speciesById.has(species.id)) {
      throw new Error(`species id must be unique: ${species.id}`)
    }
    speciesById.set(species.id, species)

    const innateSkill = skillById.get(species.innateSkillId)
    if (innateSkill === undefined || innateSkill.slotType !== 'INNATE') {
      throw new Error(`species innate skill must exist in the INNATE slot: ${species.id}`)
    }
    for (const bloomSkillId of species.bloomSkillIds ?? []) {
      const bloomSkill = skillById.get(bloomSkillId)
      if (bloomSkill === undefined || bloomSkill.slotType !== 'BLOOM') {
        throw new Error(`species bloom skill must exist in the BLOOM slot: ${bloomSkillId}`)
      }
    }
  }
  return speciesById
}

function validateResearchDefinitions(
  catalog: ContentValidationCatalog,
  speciesById: ReadonlyMap<SpeciesId, MonsterSpecies>,
): void {
  const researchNodes = catalog.researchNodes ?? []
  const finalResearchDefinitions = catalog.finalResearchDefinitions ?? []
  const bloomResearchDefinitions = catalog.bloomResearchDefinitions ?? []

  assertValidResearchNetwork(researchNodes, new Set(speciesById.keys()))
  assertValidT036ProgressionCatalog({
    ...catalog,
    finalResearchDefinitions,
    bloomResearchDefinitions,
  } as T036ProgressionCatalog)

  const finalNodeIds = new Set(finalResearchDefinitions.map((definition) => definition.nodeId))
  for (const node of researchNodes) {
    if (!finalNodeIds.has(node.nodeId)) {
      throw new Error(`research node is missing a final research definition: ${node.nodeId}`)
    }
  }

  const bloomKeys = new Set(
    bloomResearchDefinitions.map((definition) => `${definition.speciesId}\u0000${definition.skillId}`),
  )
  for (const species of speciesById.values()) {
    for (const skillId of species.bloomSkillIds ?? []) {
      if (!bloomKeys.has(`${species.id}\u0000${skillId}`)) {
        throw new Error(`species bloom skill is missing a bloom research definition: ${species.id}/${skillId}`)
      }
    }
  }
}

function validateGenericSkillCosts(
  skillById: ReadonlyMap<SkillId, SkillDefinition>,
  costs: Readonly<Record<SkillId, number>> | undefined,
): void {
  if (costs === undefined) return

  for (const [skillId, cost] of Object.entries(costs)) {
    assertNonEmptyString(skillId, 'genericSkillCosts skill id')
    assertPositiveSafeInteger(cost, `genericSkillCosts.${skillId}`)
    const skill = skillById.get(skillId)
    if (skill === undefined || skill.slotType !== 'GENERIC') {
      throw new Error(`generic skill cost must reference a GENERIC skill: ${skillId}`)
    }
  }

  for (const skill of skillById.values()) {
    if (skill.slotType === 'GENERIC' && costs[skill.id] === undefined) {
      throw new Error(`generic skill is missing a learning cost: ${skill.id}`)
    }
  }
}

function validateStageAi(
  stage: StageDefinition,
  speciesById: ReadonlyMap<SpeciesId, MonsterSpecies>,
): void {
  for (const unit of stage.enemyFormation.units) {
    const species = speciesById.get(unit.speciesId)
    if (species === undefined) {
      throw new Error(`stage enemy species is unknown: ${unit.speciesId}`)
    }
    const availableSkillIds = new Set<SkillId>([
      species.innateSkillId,
      ...(unit.equippedSkillIds ?? []),
    ])
    const configuration = stage.enemyFormation.aiConfigurations[unit.battleUnitId]
    if (configuration === undefined) continue

    resolveAiStrategyWeights(configuration)
    validateAiSkillPolicies(availableSkillIds, configuration.skillPolicies)
    for (const setting of configuration.skillPolicies ?? []) {
      if (
        setting.conditionSatisfied !== undefined &&
        typeof setting.conditionSatisfied !== 'boolean'
      ) {
        throw new Error(
          `stage AI skill policy condition must be boolean: ${stage.stageId}/${unit.battleUnitId}/${setting.skillId}`,
        )
      }
    }
  }
}

function validateStageRewards(
  stage: StageDefinition,
  speciesById: ReadonlyMap<SpeciesId, MonsterSpecies>,
): void {
  for (const gain of stage.rewards.analysisGains) {
    if (!speciesById.has(gain.speciesId)) {
      throw new Error(`stage analysis reward species is unknown: ${stage.stageId}/${gain.speciesId}`)
    }
    if (!ANALYSIS_GAIN_SOURCES.includes(gain.source)) {
      throw new Error(`stage analysis reward source is invalid: ${stage.stageId}/${gain.source}`)
    }
    assertPositiveSafeInteger(gain.amount, `stage.${stage.stageId}.analysisGains.amount`)
  }
}

function validateBossStage(
  stage: StageDefinition,
  speciesById: ReadonlyMap<SpeciesId, MonsterSpecies>,
  knownSkillIds: ReadonlySet<SkillId>,
): void {
  if (stage.boss === null) return

  const boss = normalizeBossEncounterDefinition(stage.boss, knownSkillIds)
  const bossUnit = stage.enemyFormation.units.find(
    (unit) => unit.battleUnitId === boss.bossBattleUnitId,
  )
  if (bossUnit === undefined) {
    throw new Error(`boss unit is missing from stage formation: ${stage.stageId}`)
  }
  const species = speciesById.get(bossUnit.speciesId)
  if (species === undefined) {
    throw new Error(`boss species is unknown: ${stage.stageId}/${bossUnit.speciesId}`)
  }
  const bossLoadout = new Set<SkillId>([
    species.innateSkillId,
    ...(bossUnit.equippedSkillIds ?? []),
  ])
  for (const phase of boss.phases) {
    for (const skillId of phase.actionSkillIds) {
      if (!bossLoadout.has(skillId)) {
        throw new Error(
          `boss phase skill is not equipped by the boss: ${stage.stageId}/${phase.phaseId}/${skillId}`,
        )
      }
    }
  }
}

function validateProgressionDefinitions(
  catalog: ContentValidationCatalog,
  speciesById: ReadonlyMap<SpeciesId, MonsterSpecies>,
  knownSkillIds: ReadonlySet<SkillId>,
): void {
  normalizeResearchFacilityStages(catalog.researchFacilityStages ?? [])
  const progression = normalizeRegionProgression(catalog)
  const completionProgressIds = new Set<string>()

  for (const stage of progression.stages) {
    if (completionProgressIds.has(stage.completionProgressId)) {
      throw new Error(`stage completion progress id must be unique: ${stage.completionProgressId}`)
    }
    completionProgressIds.add(stage.completionProgressId)
    validateStageAi(stage, speciesById)
    validateStageRewards(stage, speciesById)
    validateBossStage(stage, speciesById, knownSkillIds)
  }
}

export function validateContentCatalog(
  catalog: ContentValidationCatalog,
  options: ContentValidationOptions = {},
): ContentValidationSummary {
  let skillById: ReadonlyMap<SkillId, SkillDefinition> = new Map()
  let speciesById: ReadonlyMap<SpeciesId, MonsterSpecies> = new Map()

  validateSection('skills', () => {
    skillById = createUniqueSkillMap(catalog.skills)
  })
  validateSection('species', () => {
    speciesById = createUniqueSpeciesMap(catalog.species, skillById)
  })
  validateSection('generic skill costs', () => {
    validateGenericSkillCosts(skillById, options.genericSkillCosts)
  })
  validateSection('research', () => {
    validateResearchDefinitions(catalog, speciesById)
  })
  validateSection('regions and stages', () => {
    validateProgressionDefinitions(catalog, speciesById, new Set(skillById.keys()))
  })

  const stages = catalog.stages ?? []
  return Object.freeze({
    species: catalog.species.length,
    skills: catalog.skills.length,
    genericSkillCosts: Object.keys(options.genericSkillCosts ?? {}).length,
    researchNodes: (catalog.researchNodes ?? []).length,
    finalResearchDefinitions: (catalog.finalResearchDefinitions ?? []).length,
    bloomResearchDefinitions: (catalog.bloomResearchDefinitions ?? []).length,
    researchFacilityStages: (catalog.researchFacilityStages ?? []).length,
    regions: (catalog.regions ?? []).length,
    stages: stages.length,
    bossStages: stages.filter((stage) => stage.boss !== null).length,
  })
}
