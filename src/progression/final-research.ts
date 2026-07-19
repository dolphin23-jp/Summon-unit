import type { SpeciesId } from '../content/monster-species'
import { applyEconomyTransaction } from './economy'
import {
  createPlayerData,
  type PlayerData,
  type PlayerSpeciesState,
  type UnitInstanceId,
} from './player-data'
import type { ResearchNodeId } from './research-model'
import {
  getFinalResearchDefinition,
  type RequiredCatalystAmount,
  type SpecimenRequirement,
  type T036ProgressionCatalog,
} from './t036-progression-model'

export interface CompleteFinalResearchRequest {
  readonly nodeId: ResearchNodeId
  readonly specimenInstanceIds: readonly UnitInstanceId[]
}

export interface CompleteFinalResearchResult {
  readonly playerData: PlayerData
  readonly nodeId: ResearchNodeId
  readonly targetSpeciesId: SpeciesId
  readonly researchDataSpent: number
  readonly catalystsSpent: readonly RequiredCatalystAmount[]
  readonly consumedSpecimenInstanceIds: readonly UnitInstanceId[]
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function normalizeUniqueIds(values: readonly string[], field: string): readonly string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of values) {
    if (value.trim().length === 0) {
      throw new Error(`${field} must contain non-empty IDs`)
    }
    if (seen.has(value)) {
      throw new Error(`${field} must not contain duplicates: ${value}`)
    }
    seen.add(value)
    normalized.push(value)
  }
  normalized.sort(compareIds)
  return Object.freeze(normalized)
}

function countRequirements(
  requirements: readonly SpecimenRequirement[],
): ReadonlyMap<SpeciesId, number> {
  return new Map(requirements.map((requirement) => [requirement.speciesId, requirement.amount]))
}

function createUnlockedTargetSpeciesState(speciesId: SpeciesId): PlayerSpeciesState {
  return Object.freeze({
    speciesId,
    blueprintUnlocked: true,
    analysisBasisPoints: 0,
    bloomSkillIds: Object.freeze([]),
    encyclopediaStageId: 'encyclopedia-stage.5',
    statistics: Object.freeze({}),
  })
}

export function completeFinalResearch(
  playerData: PlayerData,
  request: CompleteFinalResearchRequest,
  catalog: T036ProgressionCatalog,
): CompleteFinalResearchResult {
  const normalized = createPlayerData(playerData, catalog)
  const finalDefinition = getFinalResearchDefinition(catalog, request.nodeId)
  const researchNodeDefinition = (catalog.researchNodes ?? []).find(
    (candidate) => candidate.nodeId === request.nodeId,
  )
  if (researchNodeDefinition === undefined) {
    throw new Error(`research node does not exist: ${request.nodeId}`)
  }
  const nodeState = normalized.research?.nodes.find(
    (candidate) => candidate.nodeId === request.nodeId,
  )
  if (nodeState === undefined) {
    throw new Error(`research node state does not exist: ${request.nodeId}`)
  }
  if (nodeState.status !== 'known') {
    throw new Error(`final research requires known status: ${request.nodeId}`)
  }

  const targetSpeciesId = researchNodeDefinition.targetSpeciesId
  const existingTargetState = normalized.collection.speciesStates.find(
    (candidate) => candidate.speciesId === targetSpeciesId,
  )
  if (existingTargetState?.blueprintUnlocked === true) {
    throw new Error(`target blueprint is already unlocked: ${targetSpeciesId}`)
  }

  const specimenInstanceIds = normalizeUniqueIds(
    request.specimenInstanceIds,
    'finalResearch.specimenInstanceIds',
  )
  const expectedSpecimenCount = finalDefinition.specimenRequirements.reduce(
    (total, requirement) => total + requirement.amount,
    0,
  )
  if (specimenInstanceIds.length !== expectedSpecimenCount) {
    throw new Error(
      `final research requires exactly ${expectedSpecimenCount} specimen instances: ${request.nodeId}`,
    )
  }

  const assignedInstanceIds = new Set(
    normalized.formations.formations.flatMap((formation) =>
      formation.members.map((member) => member.instanceId),
    ),
  )
  const actualCountBySpecies = new Map<SpeciesId, number>()
  for (const instanceId of specimenInstanceIds) {
    const instance = normalized.collection.unitInstances.find(
      (candidate) => candidate.instanceId === instanceId,
    )
    if (instance === undefined) {
      throw new Error(`final research specimen is not owned: ${instanceId}`)
    }
    if (instance.locked) {
      throw new Error(`final research specimen is locked: ${instanceId}`)
    }
    if (assignedInstanceIds.has(instanceId)) {
      throw new Error(`final research specimen is assigned to a formation: ${instanceId}`)
    }
    actualCountBySpecies.set(
      instance.speciesId,
      (actualCountBySpecies.get(instance.speciesId) ?? 0) + 1,
    )
  }

  const expectedCountBySpecies = countRequirements(finalDefinition.specimenRequirements)
  for (const [speciesId, expected] of expectedCountBySpecies) {
    const actual = actualCountBySpecies.get(speciesId) ?? 0
    if (actual !== expected) {
      throw new Error(
        `final research specimen count mismatch for ${speciesId}: expected ${expected}, received ${actual}`,
      )
    }
  }
  for (const speciesId of actualCountBySpecies.keys()) {
    if (!expectedCountBySpecies.has(speciesId)) {
      throw new Error(`final research received an unexpected specimen species: ${speciesId}`)
    }
  }

  const economy = applyEconomyTransaction(normalized.economy, {
    researchDataDelta: -finalDefinition.researchDataCost,
    catalystDeltas: finalDefinition.catalysts.map((requirement) => ({
      catalystId: requirement.catalystId,
      amount: -requirement.amount,
    })),
  })
  const consumedIds = new Set(specimenInstanceIds)
  const speciesStates = existingTargetState === undefined
    ? [...normalized.collection.speciesStates, createUnlockedTargetSpeciesState(targetSpeciesId)]
    : normalized.collection.speciesStates.map((state) =>
        state.speciesId === targetSpeciesId
          ? {
              ...state,
              blueprintUnlocked: true,
              encyclopediaStageId: 'encyclopedia-stage.5',
            }
          : state,
      )
  const nextPlayerData = createPlayerData(
    {
      ...normalized,
      economy,
      research: {
        nodes: (normalized.research?.nodes ?? []).map((state) =>
          state.nodeId === request.nodeId
            ? { ...state, status: 'completed', disclosureStage: 5 }
            : state,
        ),
      },
      collection: {
        speciesStates,
        unitInstances: normalized.collection.unitInstances.filter(
          (instance) => !consumedIds.has(instance.instanceId),
        ),
      },
    },
    catalog,
  )

  return Object.freeze({
    playerData: nextPlayerData,
    nodeId: request.nodeId,
    targetSpeciesId,
    researchDataSpent: finalDefinition.researchDataCost,
    catalystsSpent: Object.freeze(
      finalDefinition.catalysts.map((requirement) => Object.freeze({ ...requirement })),
    ),
    consumedSpecimenInstanceIds: specimenInstanceIds,
  })
}
