import type { HeadlessBattleRunResult } from '../battle/headless-battle-runner'
import type { SpeciesId } from '../content/monster-species'
import { applyPlayerProgressionTransaction, type AppliedAnalysisGain } from './analysis'
import type { CatalystDelta } from './economy'
import {
  createPlayerData,
  type PlayerData,
  type PlayerDataContentCatalog,
  type PlayerUnitInstance,
} from './player-data'
import { createResearchFacilityPlayerData } from './research-facility'
import { applyResearchHintTriggers, type ResearchDisclosureChange } from './research'
import {
  createPlayerStageProgressState,
  getStageDefinition,
  normalizeStageDefinitions,
  type PlayerRegionalPointState,
  type PlayerStageProgressState,
  type RegionalPointRewardDefinition,
  type StageDefinition,
  type StageRewardBundle,
} from './stage-model'

export interface StageConditionChange {
  readonly instanceId: string
  readonly beforeBasisPoints: number
  readonly afterBasisPoints: number
}

export interface StageBattleRewardReceipt {
  readonly guaranteed: StageRewardBundle
  readonly randomRewardId: string | null
  readonly random: StageRewardBundle
  readonly regionalRewardIds: readonly string[]
  readonly regional: StageRewardBundle
  readonly total: StageRewardBundle
}

export interface StageBattleSettlement {
  readonly playerData: PlayerData
  readonly settlementId: string
  readonly stageId: string
  readonly alreadySettled: boolean
  readonly victory: boolean
  readonly rewards: StageBattleRewardReceipt
  readonly regionalPointsBefore: number
  readonly regionalPointsAfter: number
  readonly analysisChanges: readonly AppliedAnalysisGain[]
  readonly researchChanges: readonly ResearchDisclosureChange[]
  readonly conditionChanges: readonly StageConditionChange[]
  readonly notifications: readonly string[]
}

export interface SettleStageBattleInput {
  readonly settlementId: string
  readonly stageId: string
  readonly bonusRollBasisPoints: number
}

const EMPTY_REWARD_BUNDLE: StageRewardBundle = Object.freeze({
  currency: 0,
  researchData: 0,
  catalysts: Object.freeze([]),
})

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

function addSafe(left: number, right: number, field: string): number {
  const result = left + right
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${field} must remain a safe integer`)
  }
  return result
}

function addRewardBundles(...bundles: readonly StageRewardBundle[]): StageRewardBundle {
  let currency = 0
  let researchData = 0
  const catalystTotals = new Map<string, number>()
  for (const bundle of bundles) {
    currency = addSafe(currency, bundle.currency, 'stage reward currency')
    researchData = addSafe(researchData, bundle.researchData, 'stage reward researchData')
    for (const catalyst of bundle.catalysts) {
      catalystTotals.set(
        catalyst.catalystId,
        addSafe(
          catalystTotals.get(catalyst.catalystId) ?? 0,
          catalyst.amount,
          `stage reward catalyst ${catalyst.catalystId}`,
        ),
      )
    }
  }
  return Object.freeze({
    currency,
    researchData,
    catalysts: Object.freeze(
      [...catalystTotals]
        .sort(([left], [right]) => compareIds(left, right))
        .map(([catalystId, amount]) => Object.freeze({ catalystId, amount })),
    ),
  })
}

function rewardBundleToCatalystDeltas(bundle: StageRewardBundle): readonly CatalystDelta[] {
  return Object.freeze(
    bundle.catalysts.map((catalyst) =>
      Object.freeze({ catalystId: catalyst.catalystId, amount: catalyst.amount }),
    ),
  )
}

function normalizeStagePlayerData(
  input: PlayerData,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const withFacility = createResearchFacilityPlayerData(input, catalog)
  const stageProgress = createPlayerStageProgressState(
    input.stageProgress,
    catalog.stages ?? [],
    catalog,
  )
  return Object.freeze({
    ...withFacility,
    ...(stageProgress === undefined ? {} : { stageProgress }),
  })
}

function getRegionalPointState(
  progress: PlayerStageProgressState,
  regionId: string,
): PlayerRegionalPointState {
  return (
    progress.regionalPoints.find((state) => state.regionId === regionId) ??
    Object.freeze({ regionId, points: 0, claimedRewardIds: Object.freeze([]) })
  )
}

function getRegionalRewardDefinitions(
  stages: readonly StageDefinition[],
  regionId: string,
): readonly RegionalPointRewardDefinition[] {
  const byId = new Map<string, RegionalPointRewardDefinition>()
  for (const stage of stages.filter((candidate) => candidate.regionId === regionId)) {
    for (const reward of stage.rewards.regionalPointRewards) {
      const existing = byId.get(reward.rewardId)
      if (existing !== undefined) {
        if (JSON.stringify(existing) !== JSON.stringify(reward)) {
          throw new Error(`regional reward definition disagrees across stages: ${reward.rewardId}`)
        }
        continue
      }
      byId.set(reward.rewardId, reward)
    }
  }
  return Object.freeze(
    [...byId.values()].sort((left, right) => {
      const byPoints = left.requiredPoints - right.requiredPoints
      return byPoints !== 0 ? byPoints : compareIds(left.rewardId, right.rewardId)
    }),
  )
}

function selectRandomReward(
  stage: StageDefinition,
  bonusRollBasisPoints: number,
): { readonly rewardId: string | null; readonly bundle: StageRewardBundle } {
  let cursor = 0
  for (const reward of stage.rewards.randomBonuses) {
    cursor += reward.chanceBasisPoints
    if (bonusRollBasisPoints < cursor) {
      return Object.freeze({ rewardId: reward.rewardId, bundle: reward.bundle })
    }
  }
  return Object.freeze({ rewardId: null, bundle: EMPTY_REWARD_BUNDLE })
}

function conditionBasisPointsForUnit(
  hp: number,
  speciesId: SpeciesId,
  catalog: PlayerDataContentCatalog,
): number {
  const species = catalog.species.find((candidate) => candidate.id === speciesId)
  if (species === undefined) {
    throw new Error(`battle result references unknown species: ${speciesId}`)
  }
  return Math.floor((hp * 10_000) / species.stats.hp)
}

function applyBattleConditionChanges(
  playerData: PlayerData,
  result: HeadlessBattleRunResult,
  catalog: PlayerDataContentCatalog,
): { readonly playerData: PlayerData; readonly changes: readonly StageConditionChange[] } {
  const resultByInstanceId = new Map<string, number>()
  for (const unit of result.summary.units.filter((candidate) => candidate.side === 'ALLY')) {
    const definitionUnit = result.battle.units.find(
      (candidate) => candidate.battleUnitId === unit.battleUnitId,
    )
    const instanceId =
      definitionUnit?.sourceInstanceId ??
      (unit.battleUnitId.startsWith('ally:') ? unit.battleUnitId.slice('ally:'.length) : null)
    if (instanceId === null || instanceId.length === 0) continue
    const projected = conditionBasisPointsForUnit(unit.hp, unit.speciesId, catalog)
    resultByInstanceId.set(instanceId, projected)
  }

  const changes: StageConditionChange[] = []
  const unitInstances: PlayerUnitInstance[] = playerData.collection.unitInstances.map((instance) => {
    const projected = resultByInstanceId.get(instance.instanceId)
    if (projected === undefined) return instance
    const afterBasisPoints = Math.min(instance.conditionBasisPoints, projected)
    if (afterBasisPoints !== instance.conditionBasisPoints) {
      changes.push(
        Object.freeze({
          instanceId: instance.instanceId,
          beforeBasisPoints: instance.conditionBasisPoints,
          afterBasisPoints,
        }),
      )
    }
    return Object.freeze({ ...instance, conditionBasisPoints: afterBasisPoints })
  })
  const next = normalizeStagePlayerData(
    {
      ...playerData,
      collection: { ...playerData.collection, unitInstances },
    },
    catalog,
  )
  changes.sort((left, right) => compareIds(left.instanceId, right.instanceId))
  return Object.freeze({ playerData: next, changes: Object.freeze(changes) })
}

function createEmptyReceipt(): StageBattleRewardReceipt {
  return Object.freeze({
    guaranteed: EMPTY_REWARD_BUNDLE,
    randomRewardId: null,
    random: EMPTY_REWARD_BUNDLE,
    regionalRewardIds: Object.freeze([]),
    regional: EMPTY_REWARD_BUNDLE,
    total: EMPTY_REWARD_BUNDLE,
  })
}

function createAlreadySettledResult(
  playerData: PlayerData,
  input: SettleStageBattleInput,
  stage: StageDefinition,
): StageBattleSettlement {
  const progress = playerData.stageProgress
  if (progress === undefined) throw new Error('stage progress state is missing')
  const regional = getRegionalPointState(progress, stage.regionId)
  return Object.freeze({
    playerData,
    settlementId: input.settlementId,
    stageId: input.stageId,
    alreadySettled: true,
    victory: false,
    rewards: createEmptyReceipt(),
    regionalPointsBefore: regional.points,
    regionalPointsAfter: regional.points,
    analysisChanges: Object.freeze([]),
    researchChanges: Object.freeze([]),
    conditionChanges: Object.freeze([]),
    notifications: Object.freeze(['この戦闘結果は既に精算済みです。']),
  })
}

export function settleStageBattle(
  playerData: PlayerData,
  result: HeadlessBattleRunResult,
  catalog: PlayerDataContentCatalog,
  input: SettleStageBattleInput,
): StageBattleSettlement {
  assertNonEmptyString(input.settlementId, 'settlementId')
  assertNonEmptyString(input.stageId, 'stageId')
  assertSafeIntegerInRange(
    input.bonusRollBasisPoints,
    0,
    9_999,
    'bonusRollBasisPoints',
  )
  const stages = normalizeStageDefinitions(catalog.stages ?? [], catalog)
  const stage = getStageDefinition(catalog, input.stageId)
  let normalized = normalizeStagePlayerData(playerData, catalog)
  const progress = normalized.stageProgress
  if (progress === undefined) throw new Error('stage progress state is missing')
  if (progress.settledBattleIds.includes(input.settlementId)) {
    return createAlreadySettledResult(normalized, input, stage)
  }

  const condition = applyBattleConditionChanges(normalized, result, catalog)
  normalized = condition.playerData
  const victory = result.summary.outcome === 'ALLY_VICTORY'
  const regionalBefore = getRegionalPointState(progress, stage.regionId)
  const regionalPointsAfter = victory
    ? addSafe(regionalBefore.points, stage.rewards.regionalPointGain, 'regional points')
    : regionalBefore.points
  const regionalDefinitions = getRegionalRewardDefinitions(stages, stage.regionId)
  const newlyReachedRegionalRewards = victory
    ? regionalDefinitions.filter(
        (reward) =>
          reward.requiredPoints <= regionalPointsAfter &&
          !regionalBefore.claimedRewardIds.includes(reward.rewardId),
      )
    : []
  const randomSelection = victory
    ? selectRandomReward(stage, input.bonusRollBasisPoints)
    : Object.freeze({ rewardId: null, bundle: EMPTY_REWARD_BUNDLE })
  const guaranteed = victory ? stage.rewards.guaranteed : EMPTY_REWARD_BUNDLE
  const regionalBundle = addRewardBundles(
    ...newlyReachedRegionalRewards.map((reward) => reward.bundle),
  )
  const total = addRewardBundles(guaranteed, randomSelection.bundle, regionalBundle)
  const rewards: StageBattleRewardReceipt = Object.freeze({
    guaranteed,
    randomRewardId: randomSelection.rewardId,
    random: randomSelection.bundle,
    regionalRewardIds: Object.freeze(
      newlyReachedRegionalRewards.map((reward) => reward.rewardId).sort(compareIds),
    ),
    regional: regionalBundle,
    total,
  })

  const completedStageIds = victory
    ? [...new Set([...progress.completedStageIds, stage.stageId])].sort(compareIds)
    : [...progress.completedStageIds]
  const nextRegionalState: PlayerRegionalPointState = Object.freeze({
    regionId: stage.regionId,
    points: regionalPointsAfter,
    claimedRewardIds: Object.freeze(
      [
        ...new Set([
          ...regionalBefore.claimedRewardIds,
          ...newlyReachedRegionalRewards.map((reward) => reward.rewardId),
        ]),
      ].sort(compareIds),
    ),
  })
  const regionalPoints = [
    ...progress.regionalPoints.filter((state) => state.regionId !== stage.regionId),
    nextRegionalState,
  ].sort((left, right) => compareIds(left.regionId, right.regionId))
  const nextProgress: PlayerStageProgressState = Object.freeze({
    completedStageIds: Object.freeze(completedStageIds),
    settledBattleIds: Object.freeze(
      [...progress.settledBattleIds, input.settlementId].sort(compareIds),
    ),
    regionalPoints: Object.freeze(regionalPoints),
  })

  const withProgress = normalizeStagePlayerData(
    { ...normalized, stageProgress: nextProgress },
    catalog,
  )
  const progression = applyPlayerProgressionTransaction(
    withProgress,
    {
      economy: {
        currencyDelta: total.currency,
        researchDataDelta: total.researchData,
        catalystDeltas: rewardBundleToCatalystDeltas(total),
      },
      analysisGains: victory ? stage.rewards.analysisGains : [],
    },
    catalog,
  )
  let progressed = normalizeStagePlayerData(
    {
      ...progression.playerData,
      facilities: withProgress.facilities,
      stageProgress: nextProgress,
    },
    catalog,
  )
  const completedProgressIds = stages
    .filter((candidate) => completedStageIds.includes(candidate.stageId))
    .map((candidate) => candidate.completionProgressId)
  const research = applyResearchHintTriggers(
    progressed,
    { completedProgressIds },
    catalog,
  )
  progressed = normalizeStagePlayerData(
    {
      ...research.playerData,
      facilities: progressed.facilities,
      stageProgress: nextProgress,
    },
    catalog,
  )

  const notifications: string[] = []
  if (victory) {
    notifications.push(`${stage.stageId} をクリアしました。`)
    if (randomSelection.rewardId !== null) {
      notifications.push(`追加報酬 ${randomSelection.rewardId} を獲得しました。`)
    }
    for (const rewardId of rewards.regionalRewardIds) {
      notifications.push(`地域ポイント報酬 ${rewardId} を獲得しました。`)
    }
    for (const change of research.changes) {
      notifications.push(`研究ノード ${change.nodeId} の開示段階が ${change.afterStage} になりました。`)
    }
  } else {
    notifications.push('勝利報酬はありません。戦闘記録と個体コンディションのみ反映しました。')
  }

  return Object.freeze({
    playerData: progressed,
    settlementId: input.settlementId,
    stageId: input.stageId,
    alreadySettled: false,
    victory,
    rewards,
    regionalPointsBefore: regionalBefore.points,
    regionalPointsAfter,
    analysisChanges: progression.changes,
    researchChanges: research.changes,
    conditionChanges: condition.changes,
    notifications: Object.freeze(notifications),
  })
}

export function createStagePlayerData(
  input: PlayerData,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(input, catalog)
  return normalizeStagePlayerData(
    {
      ...normalized,
      facilities: input.facilities,
      stageProgress: input.stageProgress,
    },
    catalog,
  )
}
