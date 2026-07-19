import {
  runHeadlessBattle,
  type HeadlessBattleDefinition,
  type HeadlessBattleRunResult,
} from '../battle/headless-battle-runner'
import { createFormationBattleDefinition } from './formation-editor'
import type { FormationId, PlayerData } from './player-data'
import {
  getRegionAccessState,
  getStageAccessState,
  normalizeRegionProgression,
  type T039ProgressionCatalog,
} from './region-progression'
import { settleStageBattle, type StageBattleSettlement } from './stage-reward'

export interface InstantStageSimulationInput {
  readonly stageId: string
  readonly formationId: FormationId
  readonly settlementId: string
  readonly bonusRollBasisPoints: number
}

export interface InstantStageSimulationResult {
  readonly definition: HeadlessBattleDefinition
  readonly battleResult: HeadlessBattleRunResult
  readonly settlement: StageBattleSettlement
}

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

export function createStageBattleDefinition(
  playerData: PlayerData,
  stageId: string,
  formationId: FormationId,
  catalog: T039ProgressionCatalog,
  battleDefaults: Pick<HeadlessBattleDefinition, 'initialActionCost' | 'maxActions'> = {},
): HeadlessBattleDefinition {
  const progression = normalizeRegionProgression(catalog)
  const stage = progression.stages.find((candidate) => candidate.stageId === stageId)
  if (stage === undefined) throw new Error(`stage does not exist: ${stageId}`)
  const region = progression.regions.find((candidate) => candidate.regionId === stage.regionId)
  if (region === undefined) throw new Error(`stage region does not exist: ${stage.regionId}`)
  const regionAccess = getRegionAccessState(playerData, region)
  if (!regionAccess.unlocked) {
    throw new Error(regionAccess.reason ?? `region is locked: ${region.regionId}`)
  }
  const stageAccess = getStageAccessState(playerData, stage)
  if (!stageAccess.unlocked) {
    throw new Error(stageAccess.reason ?? `stage is locked: ${stage.stageId}`)
  }
  return createFormationBattleDefinition(
    playerData,
    formationId,
    catalog,
    Object.freeze({
      species: catalog.species,
      skills: catalog.skills,
      units: stage.enemyFormation.units,
      aiConfigurations: stage.enemyFormation.aiConfigurations,
      initialActionCost: battleDefaults.initialActionCost,
      maxActions: battleDefaults.maxActions,
    }),
  )
}

export function canInstantSimulateStage(playerData: PlayerData, stageId: string): boolean {
  return playerData.stageProgress?.completedStageIds.includes(stageId) ?? false
}

export function runInstantStageSimulation(
  playerData: PlayerData,
  catalog: T039ProgressionCatalog,
  input: InstantStageSimulationInput,
  battleDefaults: Pick<HeadlessBattleDefinition, 'initialActionCost' | 'maxActions'> = {},
): InstantStageSimulationResult {
  assertNonEmptyString(input.settlementId, 'simulation.settlementId')
  if (!canInstantSimulateStage(playerData, input.stageId)) {
    throw new Error(`instant simulation requires a cleared stage: ${input.stageId}`)
  }
  const definition = createStageBattleDefinition(
    playerData,
    input.stageId,
    input.formationId,
    catalog,
    battleDefaults,
  )
  const battleResult = runHeadlessBattle(definition)
  const settlement = settleStageBattle(playerData, battleResult, catalog, {
    settlementId: input.settlementId,
    stageId: input.stageId,
    bonusRollBasisPoints: input.bonusRollBasisPoints,
  })
  return Object.freeze({ definition, battleResult, settlement })
}
