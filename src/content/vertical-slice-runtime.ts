import type { PlayerData } from '../progression/player-data'
import { createPlayerData } from '../progression/player-data'
import { getUnlockedStageIds } from '../progression/region-progression'
import { createStageBattleDefinition } from '../progression/stage-battle'
import { VERTICAL_SLICE_GENERIC_SKILL_COSTS } from './vertical-slice-content'
import {
  VERTICAL_SLICE_T046_BALANCED_CATALOG,
  VERTICAL_SLICE_T046_BALANCED_INITIAL_PLAYER_DATA,
  validateVerticalSliceT046BalancedMaster,
} from './vertical-slice-t046-balanced-master'
import { VERTICAL_SLICE_ONBOARDING_CUES } from './vertical-slice-t046'

export const VERTICAL_SLICE_RELEASE_VERSION = '0.1.0-rc.2'
export const VERTICAL_SLICE_RELEASE_CONTENT_VERSION = 'slice-v0.1.0-rc.2-t053'
export const VERTICAL_SLICE_RUNTIME_CATALOG = VERTICAL_SLICE_T046_BALANCED_CATALOG
export const VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA: PlayerData = createPlayerData(
  {
    ...VERTICAL_SLICE_T046_BALANCED_INITIAL_PLAYER_DATA,
    gameVersion: VERTICAL_SLICE_RELEASE_VERSION,
    contentVersion: VERTICAL_SLICE_RELEASE_CONTENT_VERSION,
  },
  VERTICAL_SLICE_RUNTIME_CATALOG,
)
export const VERTICAL_SLICE_RUNTIME_GENERIC_SKILL_COSTS = VERTICAL_SLICE_GENERIC_SKILL_COSTS
export const VERTICAL_SLICE_RUNTIME_ONBOARDING_CUES = VERTICAL_SLICE_ONBOARDING_CUES
export const VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID = 'stage.slice.a-01-order'

export interface VerticalSliceRuntimeValidationSummary {
  readonly releaseVersion: string
  readonly contentVersion: string
  readonly stages: number
  readonly initialUnits: number
  readonly initialFormationMembers: number
  readonly unlockedInitialStages: number
  readonly onboardingCues: number
  readonly firstBattleAllies: number
  readonly firstBattleEnemies: number
  readonly tunedWyvernAttack: number
  readonly tunedWyvernInnatePower: number
}

export function normalizeVerticalSliceRuntimePlayerData(playerData: PlayerData): PlayerData {
  return createPlayerData(playerData, VERTICAL_SLICE_RUNTIME_CATALOG)
}

export function validateVerticalSliceRuntime(): VerticalSliceRuntimeValidationSummary {
  validateVerticalSliceT046BalancedMaster()
  const playerData = normalizeVerticalSliceRuntimePlayerData(
    VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
  )
  const activeFormationId = playerData.formations.activeFormationId
  if (activeFormationId === null) {
    throw new Error('T048 runtime requires an active initial formation')
  }
  const unlockedStageIds = getUnlockedStageIds(playerData, VERTICAL_SLICE_RUNTIME_CATALOG)
  if (!unlockedStageIds.includes(VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID)) {
    throw new Error('T048 runtime first stage must be unlocked')
  }
  const battle = createStageBattleDefinition(
    playerData,
    VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID,
    activeFormationId,
    VERTICAL_SLICE_RUNTIME_CATALOG,
    { initialActionCost: 100, maxActions: 500 },
  )
  const wyvern = VERTICAL_SLICE_RUNTIME_CATALOG.species.find(
    (species) => species.id === 'species.slice.disaster-flame-wyvern',
  )
  const wyvernInnate = VERTICAL_SLICE_RUNTIME_CATALOG.skills.find(
    (skill) => skill.id === 'skill.slice.disaster-assault',
  )
  if (wyvern === undefined || wyvernInnate === undefined) {
    throw new Error('T048 balanced wyvern release master is missing')
  }
  return Object.freeze({
    releaseVersion: playerData.gameVersion,
    contentVersion: playerData.contentVersion,
    stages: VERTICAL_SLICE_RUNTIME_CATALOG.stages.length,
    initialUnits: playerData.collection.unitInstances.length,
    initialFormationMembers:
      playerData.formations.formations.find(
        (formation) => formation.formationId === activeFormationId,
      )?.members.length ?? 0,
    unlockedInitialStages: unlockedStageIds.length,
    onboardingCues: VERTICAL_SLICE_RUNTIME_ONBOARDING_CUES.length,
    firstBattleAllies: battle.units.filter((unit) => unit.position.side === 'ALLY').length,
    firstBattleEnemies: battle.units.filter((unit) => unit.position.side === 'ENEMY').length,
    tunedWyvernAttack: wyvern.stats.attack,
    tunedWyvernInnatePower: wyvernInnate.damageMultiplierPermille,
  })
}

export const VERTICAL_SLICE_RUNTIME_VALIDATION = validateVerticalSliceRuntime()
