import type { MonsterSpecies, SpeciesId } from '../content/monster-species'
import type { SkillDefinition, SkillId } from '../content/skill-definition'
import type { CatalystId } from './economy'
import type { PlayerDataContentCatalog } from './player-data'
import type { ResearchNodeDefinition, ResearchNodeId } from './research-model'

export interface RequiredCatalystAmount {
  readonly catalystId: CatalystId
  readonly amount: number
}

export interface SpecimenRequirement {
  readonly speciesId: SpeciesId
  readonly amount: number
}

export interface FinalResearchDefinition {
  readonly nodeId: ResearchNodeId
  readonly researchDataCost: number
  readonly catalysts: readonly RequiredCatalystAmount[]
  readonly specimenRequirements: readonly SpecimenRequirement[]
}

export interface BloomResearchDefinition {
  readonly speciesId: SpeciesId
  readonly skillId: SkillId
  readonly analysisThresholdBasisPoints: number
  readonly currencyCost: number
  readonly researchDataCost: number
}

export interface T036ProgressionCatalog extends PlayerDataContentCatalog {
  readonly finalResearchDefinitions: readonly FinalResearchDefinition[]
  readonly bloomResearchDefinitions: readonly BloomResearchDefinition[]
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be a safe integer from ${minimum} through ${maximum}`)
  }
}

function assertUniquePositiveAmounts<T extends { readonly amount: number }>(
  values: readonly T[],
  getId: (value: T) => string,
  field: string,
): void {
  const seen = new Set<string>()
  for (const value of values) {
    const id = getId(value)
    assertNonEmptyString(id, `${field} ID`)
    if (seen.has(id)) {
      throw new Error(`${field} must not contain duplicate IDs: ${id}`)
    }
    seen.add(id)
    assertSafeIntegerInRange(value.amount, 1, Number.MAX_SAFE_INTEGER, `${field} amount`)
  }
}

export function assertValidT036ProgressionCatalog(catalog: T036ProgressionCatalog): void {
  const speciesById = new Map<SpeciesId, MonsterSpecies>(
    catalog.species.map((species) => [species.id, species]),
  )
  const skillById = new Map<SkillId, SkillDefinition>(
    catalog.skills.map((skill) => [skill.id, skill]),
  )
  const researchNodeById = new Map<ResearchNodeId, ResearchNodeDefinition>(
    (catalog.researchNodes ?? []).map((node) => [node.nodeId, node]),
  )

  const finalNodeIds = new Set<ResearchNodeId>()
  for (const definition of catalog.finalResearchDefinitions) {
    assertNonEmptyString(definition.nodeId, 'finalResearch.nodeId')
    if (finalNodeIds.has(definition.nodeId)) {
      throw new Error(`final research node must be unique: ${definition.nodeId}`)
    }
    finalNodeIds.add(definition.nodeId)
    const researchNode = researchNodeById.get(definition.nodeId)
    if (researchNode === undefined) {
      throw new Error(`final research references unknown node: ${definition.nodeId}`)
    }
    const targetSpecies = speciesById.get(researchNode.targetSpeciesId)
    if (targetSpecies === undefined) {
      throw new Error(`final research target species is unknown: ${researchNode.targetSpeciesId}`)
    }
    assertSafeIntegerInRange(
      definition.researchDataCost,
      1,
      Number.MAX_SAFE_INTEGER,
      'finalResearch.researchDataCost',
    )
    assertUniquePositiveAmounts(
      definition.catalysts,
      (requirement) => requirement.catalystId,
      'finalResearch.catalysts',
    )
    assertUniquePositiveAmounts(
      definition.specimenRequirements,
      (requirement) => requirement.speciesId,
      'finalResearch.specimenRequirements',
    )
    for (const requirement of definition.specimenRequirements) {
      if (!speciesById.has(requirement.speciesId)) {
        throw new Error(`final research specimen species is unknown: ${requirement.speciesId}`)
      }
    }
    if (targetSpecies.rarity >= 4 && definition.specimenRequirements.length === 0) {
      throw new Error(`rarity 4+ final research requires at least one specimen: ${definition.nodeId}`)
    }
    if (targetSpecies.rarity < 4 && definition.specimenRequirements.length > 0) {
      throw new Error(`rarity 1-3 final research must not require specimens: ${definition.nodeId}`)
    }
  }

  const bloomKeys = new Set<string>()
  for (const definition of catalog.bloomResearchDefinitions) {
    assertNonEmptyString(definition.speciesId, 'bloomResearch.speciesId')
    assertNonEmptyString(definition.skillId, 'bloomResearch.skillId')
    const key = `${definition.speciesId}\u0000${definition.skillId}`
    if (bloomKeys.has(key)) {
      throw new Error(
        `bloom research definition must be unique: ${definition.speciesId}/${definition.skillId}`,
      )
    }
    bloomKeys.add(key)
    const species = speciesById.get(definition.speciesId)
    if (species === undefined) {
      throw new Error(`bloom research species is unknown: ${definition.speciesId}`)
    }
    const skill = skillById.get(definition.skillId)
    if (skill === undefined || skill.slotType !== 'BLOOM') {
      throw new Error(`bloom research skill must exist in the BLOOM slot: ${definition.skillId}`)
    }
    if (!(species.bloomSkillIds ?? []).includes(definition.skillId)) {
      throw new Error(
        `bloom research skill does not belong to species: ${definition.speciesId}/${definition.skillId}`,
      )
    }
    assertSafeIntegerInRange(
      definition.analysisThresholdBasisPoints,
      0,
      10_000,
      'bloomResearch.analysisThresholdBasisPoints',
    )
    assertSafeIntegerInRange(
      definition.currencyCost,
      0,
      Number.MAX_SAFE_INTEGER,
      'bloomResearch.currencyCost',
    )
    assertSafeIntegerInRange(
      definition.researchDataCost,
      0,
      Number.MAX_SAFE_INTEGER,
      'bloomResearch.researchDataCost',
    )
  }
}

export function getFinalResearchDefinition(
  catalog: T036ProgressionCatalog,
  nodeId: ResearchNodeId,
): FinalResearchDefinition {
  assertValidT036ProgressionCatalog(catalog)
  const definition = catalog.finalResearchDefinitions.find((candidate) => candidate.nodeId === nodeId)
  if (definition === undefined) {
    throw new Error(`final research definition does not exist: ${nodeId}`)
  }
  return Object.freeze({
    ...definition,
    catalysts: Object.freeze(
      [...definition.catalysts]
        .sort((left, right) => compareIds(left.catalystId, right.catalystId))
        .map((requirement) => Object.freeze({ ...requirement })),
    ),
    specimenRequirements: Object.freeze(
      [...definition.specimenRequirements]
        .sort((left, right) => compareIds(left.speciesId, right.speciesId))
        .map((requirement) => Object.freeze({ ...requirement })),
    ),
  })
}

export function getBloomResearchDefinition(
  catalog: T036ProgressionCatalog,
  speciesId: SpeciesId,
  skillId: SkillId,
): BloomResearchDefinition {
  assertValidT036ProgressionCatalog(catalog)
  const definition = catalog.bloomResearchDefinitions.find(
    (candidate) => candidate.speciesId === speciesId && candidate.skillId === skillId,
  )
  if (definition === undefined) {
    throw new Error(`bloom research definition does not exist: ${speciesId}/${skillId}`)
  }
  return Object.freeze({ ...definition })
}
