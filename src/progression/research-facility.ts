import type { MonsterSpecies } from '../content/monster-species'
import { unlockBloomSkill, type UnlockBloomSkillResult } from './bloom-research'
import { applyEconomyTransaction } from './economy'
import {
  completeFinalResearch,
  type CompleteFinalResearchRequest,
  type CompleteFinalResearchResult,
} from './final-research'
import { createPlayerData, type PlayerData, type PlayerDataContentCatalog } from './player-data'
import {
  performTrialResearch,
  type ResearchDisclosureContext,
  type TrialResearchResult,
  type TrialResearchSubmission,
} from './research'
import type { ResearchNodeDefinition } from './research-model'
import type { ResearchNodeDefinition } from './research-model'
import type { ResearchNodeDefinition } from './research-model'
import type { ResearchNodeDefinition } from './research-model'
import type { T036ProgressionCatalog } from './t036-progression-model'
import {
  assertResearchFacilityAllowsRarity,
  createPlayerFacilityState,
  getResearchFacilityStageDefinition,
  normalizeResearchFacilityStages,
  type PlayerFacilityState,
  type ResearchFacilityStageDefinition,
} from './research-facility-model'

declare module './player-data' {
  interface PlayerData {
    readonly facilities?: PlayerFacilityState
  }

  interface PlayerDataContentCatalog {
    readonly researchFacilityStages?: readonly ResearchFacilityStageDefinition[]
  }
}

export interface T037ProgressionCatalog extends T036ProgressionCatalog {
  readonly researchNodes: readonly ResearchNodeDefinition[]
  readonly researchFacilityStages: readonly ResearchFacilityStageDefinition[]
}

export interface UpgradeResearchFacilityResult {
  readonly playerData: PlayerData
  readonly beforeStage: number
  readonly afterStage: number
  readonly currencySpent: number
  readonly researchDataSpent: number
  readonly maxResearchableRarity: number
}

export function createResearchFacilityPlayerData(
  input: PlayerData,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(input, catalog)
  const facilities = createPlayerFacilityState(
    input.facilities,
    catalog.researchFacilityStages ?? [],
  )
  return Object.freeze({
    ...normalized,
    ...(facilities === undefined ? {} : { facilities }),
  })
}

export function preserveResearchFacilityState(
  next: PlayerData,
  previous: PlayerData,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  return createResearchFacilityPlayerData(
    {
      ...next,
      facilities: next.facilities ?? previous.facilities,
    },
    catalog,
  )
}

function getResearchTargetSpecies(
  catalog: PlayerDataContentCatalog,
  nodeId: string,
): MonsterSpecies {
  const node = (catalog.researchNodes ?? []).find((candidate) => candidate.nodeId === nodeId)
  if (node === undefined) throw new Error(`unknown research node: ${nodeId}`)
  const species = catalog.species.find((candidate) => candidate.id === node.targetSpeciesId)
  if (species === undefined) throw new Error(`research target species is unknown: ${node.targetSpeciesId}`)
  return species
}

export function assertResearchNodeAllowedByFacility(
  playerData: PlayerData,
  nodeId: string,
  catalog: PlayerDataContentCatalog,
): void {
  const normalized = createResearchFacilityPlayerData(playerData, catalog)
  const target = getResearchTargetSpecies(catalog, nodeId)
  assertResearchFacilityAllowsRarity(
    normalized.facilities,
    catalog.researchFacilityStages ?? [],
    target.rarity,
  )
}

export function performFacilityTrialResearch(
  playerData: PlayerData,
  submission: TrialResearchSubmission,
  context: ResearchDisclosureContext,
  catalog: T037ProgressionCatalog,
): TrialResearchResult {
  const normalized = createResearchFacilityPlayerData(playerData, catalog)
  assertResearchNodeAllowedByFacility(normalized, submission.nodeId, catalog)
  const result = performTrialResearch(normalized, submission, context, catalog)
  return Object.freeze({
    ...result,
    playerData: preserveResearchFacilityState(result.playerData, normalized, catalog),
  })
}

export function completeFacilityFinalResearch(
  playerData: PlayerData,
  request: CompleteFinalResearchRequest,
  catalog: T037ProgressionCatalog,
): CompleteFinalResearchResult {
  const normalized = createResearchFacilityPlayerData(playerData, catalog)
  assertResearchNodeAllowedByFacility(normalized, request.nodeId, catalog)
  const result = completeFinalResearch(normalized, request, catalog)
  return Object.freeze({
    ...result,
    playerData: preserveResearchFacilityState(result.playerData, normalized, catalog),
  })
}

export function unlockFacilityBloomSkill(
  playerData: PlayerData,
  speciesId: string,
  skillId: string,
  catalog: T037ProgressionCatalog,
): UnlockBloomSkillResult {
  const normalized = createResearchFacilityPlayerData(playerData, catalog)
  const species = catalog.species.find((candidate) => candidate.id === speciesId)
  if (species === undefined) throw new Error(`bloom research species is unknown: ${speciesId}`)
  assertResearchFacilityAllowsRarity(
    normalized.facilities,
    catalog.researchFacilityStages,
    species.rarity,
  )
  const result = unlockBloomSkill(normalized, speciesId, skillId, catalog)
  return Object.freeze({
    ...result,
    playerData: preserveResearchFacilityState(result.playerData, normalized, catalog),
  })
}

export function upgradeResearchFacility(
  playerData: PlayerData,
  catalog: T037ProgressionCatalog,
): UpgradeResearchFacilityResult {
  const stages = normalizeResearchFacilityStages(catalog.researchFacilityStages)
  const normalized = createResearchFacilityPlayerData(playerData, catalog)
  const current = getResearchFacilityStageDefinition(normalized.facilities, stages)
  if (current === null) throw new Error('research facility stages are not configured')
  const next = stages.find((candidate) => candidate.stage === current.stage + 1)
  if (next === undefined) throw new Error('research facility is already at the maximum stage')

  const economy = applyEconomyTransaction(normalized.economy, {
    currencyDelta: -next.upgradeCurrencyCost,
    researchDataDelta: -next.upgradeResearchDataCost,
  })
  const nextPlayerData = createResearchFacilityPlayerData(
    {
      ...normalized,
      economy,
      facilities: { researchFacilityStage: next.stage },
    },
    catalog,
  )
  return Object.freeze({
    playerData: nextPlayerData,
    beforeStage: current.stage,
    afterStage: next.stage,
    currencySpent: next.upgradeCurrencyCost,
    researchDataSpent: next.upgradeResearchDataCost,
    maxResearchableRarity: next.maxResearchableRarity,
  })
}
