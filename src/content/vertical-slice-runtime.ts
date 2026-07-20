import type { PlayerData } from '../progression/player-data'
import { createPlayerData } from '../progression/player-data'
import { getUnlockedStageIds } from '../progression/region-progression'
import { createStageBattleDefinition } from '../progression/stage-battle'
import { VERTICAL_SLICE_GENERIC_SKILL_COSTS } from './vertical-slice-content'
import {
  VERTICAL_SLICE_ONBOARDING_CUES,
  VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA,
  VERTICAL_SLICE_T046_WORLD_CATALOG,
  validateVerticalSliceT046,
} from './vertical-slice-t046'

export const VERTICAL_SLICE_RUNTIME_CATALOG = VERTICAL_SLICE_T046_WORLD_CATALOG
export const VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA = VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA
export const VERTICAL_SLICE_RUNTIME_GENERIC_SKILL_COSTS = VERTICAL_SLICE_GENERIC_SKILL_COSTS
export const VERTICAL_SLICE_RUNTIME_ONBOARDING_CUES = VERTICAL_SLICE_ONBOARDING_CUES
export const VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID = 'stage.slice.a-01-order'

export interface VerticalSliceRuntimeValidationSummary {
  readonly stages: number
  readonly initialUnits: number
  readonly initialFormationMembers: number
  readonly unlockedInitialStages: number
  readonly onboardingCues: number
  readonly firstBattleAllies: number
  readonly firstBattleEnemies: number
}

export function normalizeVerticalSliceRuntimePlayerData(playerData: PlayerData): PlayerData {
  return createPlayerData(playerData, VERTICAL_SLICE_RUNTIME_CATALOG)
}

export function validateVerticalSliceRuntime(): VerticalSliceRuntimeValidationSummary {
  validateVerticalSliceT046()
  const playerData = normalizeVerticalSliceRuntimePlayerData(
    VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
  )
  const activeFormationId = playerData.formations.activeFormationId
  if (activeFormationId === null) {
    throw new Error('T047 runtime requires an active initial formation')
  }
  const unlockedStageIds = getUnlockedStageIds(playerData, VERTICAL_SLICE_RUNTIME_CATALOG)
  if (!unlockedStageIds.includes(VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID)) {
    throw new Error('T047 runtime first stage must be unlocked')
  }
  const battle = createStageBattleDefinition(
    playerData,
    VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID,
    activeFormationId,
    VERTICAL_SLICE_RUNTIME_CATALOG,
    { initialActionCost: 100, maxActions: 500 },
  )
  return Object.freeze({
    stages: VERTICAL_SLICE_RUNTIME_CATALOG.stages.length,
    initialUnits: playerData.collection.unitInstances.length,
    initialFormationMembers:
      playerData.formations.formations.find(
        (formation) => formation.formationId === activeFormationId,
      )?.members.length ?? 0,
    unlockedInitialStages: unlockedStageIds.length,
    onboardingCues: VERTICAL_SLICE_RUNTIME_ONBOARDING_CUES.length,
    firstBattleAllies: battle.units.filter((unit) => unit.side === 'ALLY').length,
    firstBattleEnemies: battle.units.filter((unit) => unit.side === 'ENEMY').length,
  })
}

export const VERTICAL_SLICE_RUNTIME_VALIDATION = validateVerticalSliceRuntime()
