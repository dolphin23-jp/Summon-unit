import type { SpeciesId } from '../content/monster-species'
import type { SkillId } from '../content/skill-definition'
import { applyEconomyTransaction } from './economy'
import { createPlayerData, type PlayerData } from './player-data'
import {
  getBloomResearchDefinition,
  type T036ProgressionCatalog,
} from './t036-progression-model'

export interface UnlockBloomSkillResult {
  readonly playerData: PlayerData
  readonly speciesId: SpeciesId
  readonly skillId: SkillId
  readonly requiredAnalysisBasisPoints: number
  readonly currencySpent: number
  readonly researchDataSpent: number
}

export function unlockBloomSkill(
  playerData: PlayerData,
  speciesId: SpeciesId,
  skillId: SkillId,
  catalog: T036ProgressionCatalog,
): UnlockBloomSkillResult {
  const definition = getBloomResearchDefinition(catalog, speciesId, skillId)
  const normalized = createPlayerData(playerData, catalog)
  const speciesState = normalized.collection.speciesStates.find(
    (candidate) => candidate.speciesId === speciesId,
  )
  if (speciesState === undefined) {
    throw new Error(`bloom research species state does not exist: ${speciesId}`)
  }
  if (!speciesState.blueprintUnlocked) {
    throw new Error(`bloom research requires an unlocked blueprint: ${speciesId}`)
  }
  if (speciesState.bloomSkillIds.includes(skillId)) {
    throw new Error(`bloom skill is already unlocked: ${speciesId}/${skillId}`)
  }
  if (speciesState.analysisBasisPoints < definition.analysisThresholdBasisPoints) {
    throw new Error(
      `bloom research analysis is insufficient: ${speciesId} requires ${definition.analysisThresholdBasisPoints}`,
    )
  }

  const economy = applyEconomyTransaction(normalized.economy, {
    currencyDelta: -definition.currencyCost,
    researchDataDelta: -definition.researchDataCost,
  })
  const nextPlayerData = createPlayerData(
    {
      ...normalized,
      economy,
      collection: {
        ...normalized.collection,
        speciesStates: normalized.collection.speciesStates.map((state) =>
          state.speciesId === speciesId
            ? { ...state, bloomSkillIds: [...state.bloomSkillIds, skillId] }
            : state,
        ),
      },
    },
    catalog,
  )
  return Object.freeze({
    playerData: nextPlayerData,
    speciesId,
    skillId,
    requiredAnalysisBasisPoints: definition.analysisThresholdBasisPoints,
    currencySpent: definition.currencyCost,
    researchDataSpent: definition.researchDataCost,
  })
}
