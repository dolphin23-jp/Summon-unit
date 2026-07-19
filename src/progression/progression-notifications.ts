import type { PlayerData } from './player-data'
import {
  getRegionAccessState,
  getStageAccessState,
  normalizeRegionProgression,
  type T039ProgressionCatalog,
} from './region-progression'

export type ProgressionNotificationKind =
  | 'REGION_UNLOCKED'
  | 'STAGE_UNLOCKED'
  | 'HIDDEN_STAGE_FOUND'
  | 'RESEARCH_HINT'
  | 'BLUEPRINT_UNLOCKED'
  | 'BLOOM_AVAILABLE'
  | 'REGIONAL_REWARD'

export type ProgressionNotificationTarget = 'REGION' | 'RESEARCH' | 'COLLECTION'

export interface ProgressionNotification {
  readonly id: string
  readonly kind: ProgressionNotificationKind
  readonly title: string
  readonly detail: string
  readonly target: ProgressionNotificationTarget
}

function compareNotifications(
  left: ProgressionNotification,
  right: ProgressionNotification,
): number {
  return left.id.localeCompare(right.id, 'en')
}

function displayName(id: string): string {
  const tail = id.split('.').at(-1) ?? id
  return tail
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function unlockedRegionIds(playerData: PlayerData, catalog: T039ProgressionCatalog): Set<string> {
  const progression = normalizeRegionProgression(catalog)
  return new Set(
    progression.regions
      .filter((region) => getRegionAccessState(playerData, region).unlocked)
      .map((region) => region.regionId),
  )
}

function unlockedStageIds(playerData: PlayerData, catalog: T039ProgressionCatalog): Set<string> {
  const progression = normalizeRegionProgression(catalog)
  const regions = unlockedRegionIds(playerData, catalog)
  return new Set(
    progression.stages
      .filter(
        (stage) =>
          regions.has(stage.regionId) && getStageAccessState(playerData, stage).unlocked,
      )
      .map((stage) => stage.stageId),
  )
}

function bloomOpportunityKeys(
  playerData: PlayerData,
  catalog: T039ProgressionCatalog,
): Set<string> {
  const stateBySpecies = new Map(
    playerData.collection.speciesStates.map((state) => [state.speciesId, state]),
  )
  return new Set(
    catalog.bloomResearchDefinitions
      .filter((definition) => {
        const state = stateBySpecies.get(definition.speciesId)
        return (
          state !== undefined &&
          state.blueprintUnlocked &&
          !state.bloomSkillIds.includes(definition.skillId) &&
          state.analysisBasisPoints >= definition.analysisThresholdBasisPoints &&
          playerData.economy.currency >= definition.currencyCost &&
          playerData.economy.researchData >= definition.researchDataCost
        )
      })
      .map((definition) => `${definition.speciesId}\u0000${definition.skillId}`),
  )
}

function createBloomNotification(key: string): ProgressionNotification {
  const [speciesId, skillId] = key.split('\u0000')
  return Object.freeze({
    id: `bloom-available:${speciesId}:${skillId}`,
    kind: 'BLOOM_AVAILABLE',
    title: '開花研究が可能です',
    detail: `${displayName(speciesId)}の${displayName(skillId)}を解放できます。`,
    target: 'RESEARCH',
  })
}

export function createCurrentProgressionNotifications(
  playerData: PlayerData,
  catalog: T039ProgressionCatalog,
): readonly ProgressionNotification[] {
  return Object.freeze(
    [...bloomOpportunityKeys(playerData, catalog)]
      .map(createBloomNotification)
      .sort(compareNotifications),
  )
}

export function deriveProgressionNotifications(
  before: PlayerData,
  after: PlayerData,
  catalog: T039ProgressionCatalog,
): readonly ProgressionNotification[] {
  const notifications: ProgressionNotification[] = []
  const progression = normalizeRegionProgression(catalog)

  const regionsBefore = unlockedRegionIds(before, catalog)
  const regionsAfter = unlockedRegionIds(after, catalog)
  for (const region of progression.regions) {
    if (!regionsBefore.has(region.regionId) && regionsAfter.has(region.regionId)) {
      notifications.push(
        Object.freeze({
          id: `region-unlocked:${region.regionId}`,
          kind: 'REGION_UNLOCKED',
          title: '新しい地域を解放しました',
          detail: `${region.name}へ出撃できます。`,
          target: 'REGION',
        }),
      )
    }
  }

  const stagesBefore = unlockedStageIds(before, catalog)
  const stagesAfter = unlockedStageIds(after, catalog)
  for (const stage of progression.stages) {
    if (!stagesBefore.has(stage.stageId) && stagesAfter.has(stage.stageId)) {
      notifications.push(
        Object.freeze({
          id: `stage-unlocked:${stage.stageId}`,
          kind: stage.kind === 'HIDDEN' ? 'HIDDEN_STAGE_FOUND' : 'STAGE_UNLOCKED',
          title: stage.kind === 'HIDDEN' ? '隠しステージを発見しました' : '新しいステージを解放しました',
          detail: `${displayName(stage.stageId)} — ${stage.theme}`,
          target: 'REGION',
        }),
      )
    }
  }

  const researchBefore = new Map((before.research?.nodes ?? []).map((node) => [node.nodeId, node]))
  for (const node of after.research?.nodes ?? []) {
    const previous = researchBefore.get(node.nodeId)
    const previousStage = previous?.disclosureStage ?? 0
    const newHintIds = node.unlockedHintIds.filter(
      (hintId) => !(previous?.unlockedHintIds ?? []).includes(hintId),
    )
    if (node.disclosureStage > previousStage || newHintIds.length > 0) {
      notifications.push(
        Object.freeze({
          id: `research-hint:${node.nodeId}:${node.disclosureStage}:${newHintIds.join(',')}`,
          kind: 'RESEARCH_HINT',
          title: '研究情報が更新されました',
          detail: `${displayName(node.nodeId)}の開示段階が${node.disclosureStage}/5になりました。`,
          target: 'RESEARCH',
        }),
      )
    }
  }

  const speciesBefore = new Map(
    before.collection.speciesStates.map((state) => [state.speciesId, state]),
  )
  for (const state of after.collection.speciesStates) {
    const previous = speciesBefore.get(state.speciesId)
    if (state.blueprintUnlocked && previous?.blueprintUnlocked !== true) {
      notifications.push(
        Object.freeze({
          id: `blueprint-unlocked:${state.speciesId}`,
          kind: 'BLUEPRINT_UNLOCKED',
          title: '新しい設計図を解放しました',
          detail: `${displayName(state.speciesId)}を召喚できます。`,
          target: 'COLLECTION',
        }),
      )
    }
  }

  const bloomBefore = bloomOpportunityKeys(before, catalog)
  for (const key of bloomOpportunityKeys(after, catalog)) {
    if (!bloomBefore.has(key)) notifications.push(createBloomNotification(key))
  }

  const regionsByIdBefore = new Map(
    (before.stageProgress?.regionalPoints ?? []).map((state) => [state.regionId, state]),
  )
  for (const state of after.stageProgress?.regionalPoints ?? []) {
    const previousClaimed = new Set(
      regionsByIdBefore.get(state.regionId)?.claimedRewardIds ?? [],
    )
    for (const rewardId of state.claimedRewardIds) {
      if (!previousClaimed.has(rewardId)) {
        notifications.push(
          Object.freeze({
            id: `regional-reward:${state.regionId}:${rewardId}`,
            kind: 'REGIONAL_REWARD',
            title: '地域ポイント報酬を獲得しました',
            detail: `${displayName(rewardId)}を受け取りました。`,
            target: 'REGION',
          }),
        )
      }
    }
  }

  const unique = new Map(notifications.map((notification) => [notification.id, notification]))
  return Object.freeze([...unique.values()].sort(compareNotifications))
}
