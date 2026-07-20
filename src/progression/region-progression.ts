import { resolveRegionName, resolveStageName } from '../content/display-masters'
import type { PlayerData, PlayerDataContentCatalog } from './player-data'
import type { T037ProgressionCatalog } from './research-facility'
import {
  normalizeStageDefinitions,
  type RegionId,
  type StageDefinition,
  type StageId,
} from './stage-model'

export type ProgressRequirement =
  | { readonly type: 'ALWAYS' }
  | { readonly type: 'STAGE_COMPLETED'; readonly stageId: StageId }
  | { readonly type: 'ALL_STAGES_COMPLETED'; readonly stageIds: readonly StageId[] }
  | { readonly type: 'REGION_POINTS'; readonly regionId: RegionId; readonly points: number }

export interface StageAccessDefinition {
  readonly order: number
  readonly requirement: ProgressRequirement
  readonly hideUntilUnlocked: boolean
  readonly regionRequirement?: ProgressRequirement
  readonly regionHideUntilUnlocked?: boolean
}

export interface RegionDefinition {
  readonly regionId: RegionId
  readonly name: string
  readonly summary: string
  readonly themeColor: string
  readonly order: number
  readonly requirement: ProgressRequirement
  readonly hideUntilUnlocked: boolean
}

export interface T039ProgressionCatalog extends T037ProgressionCatalog {
  readonly stages: readonly StageDefinition[]
  readonly regions: readonly RegionDefinition[]
}

export interface ProgressAccessState {
  readonly unlocked: boolean
  readonly visible: boolean
  readonly reason: string | null
}

export interface NormalizedRegionProgression {
  readonly regions: readonly RegionDefinition[]
  readonly stages: readonly StageDefinition[]
}

declare module './stage-model' {
  interface StageDefinition {
    readonly access?: StageAccessDefinition
  }
}

declare module './player-data' {
  interface PlayerDataContentCatalog {
    readonly regions?: readonly RegionDefinition[]
  }
}

const DEFAULT_STAGE_ACCESS: StageAccessDefinition = Object.freeze({
  order: 1,
  requirement: Object.freeze({ type: 'ALWAYS' as const }),
  hideUntilUnlocked: false,
})

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertThemeColor(value: string, field: string): void {
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${field} must be a six-digit hexadecimal color`)
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

function normalizeRequirement(
  requirement: ProgressRequirement,
  knownStageIds: ReadonlySet<StageId>,
  knownRegionIds: ReadonlySet<RegionId>,
  field: string,
  selfStageId?: StageId,
): ProgressRequirement {
  switch (requirement.type) {
    case 'ALWAYS':
      return Object.freeze({ type: 'ALWAYS' })
    case 'STAGE_COMPLETED':
      assertNonEmptyString(requirement.stageId, `${field}.stageId`)
      if (!knownStageIds.has(requirement.stageId)) {
        throw new Error(`${field} references unknown stage: ${requirement.stageId}`)
      }
      if (requirement.stageId === selfStageId) {
        throw new Error(`${field} must not require the same stage it unlocks`)
      }
      return Object.freeze({ type: 'STAGE_COMPLETED', stageId: requirement.stageId })
    case 'ALL_STAGES_COMPLETED': {
      if (requirement.stageIds.length === 0) {
        throw new Error(`${field}.stageIds must contain at least one stage`)
      }
      const seen = new Set<StageId>()
      const stageIds = requirement.stageIds.map((stageId) => {
        assertNonEmptyString(stageId, `${field}.stageIds[]`)
        if (!knownStageIds.has(stageId)) {
          throw new Error(`${field} references unknown stage: ${stageId}`)
        }
        if (stageId === selfStageId) {
          throw new Error(`${field} must not require the same stage it unlocks`)
        }
        if (seen.has(stageId)) {
          throw new Error(`${field}.stageIds must not contain duplicates: ${stageId}`)
        }
        seen.add(stageId)
        return stageId
      })
      stageIds.sort(compareIds)
      return Object.freeze({ type: 'ALL_STAGES_COMPLETED', stageIds: Object.freeze(stageIds) })
    }
    case 'REGION_POINTS':
      assertNonEmptyString(requirement.regionId, `${field}.regionId`)
      if (!knownRegionIds.has(requirement.regionId)) {
        throw new Error(`${field} references unknown region: ${requirement.regionId}`)
      }
      assertSafeIntegerInRange(requirement.points, 1, Number.MAX_SAFE_INTEGER, `${field}.points`)
      return Object.freeze({
        type: 'REGION_POINTS',
        regionId: requirement.regionId,
        points: requirement.points,
      })
  }
}

export function normalizeRegionProgression(
  catalog: Pick<PlayerDataContentCatalog, 'species' | 'skills' | 'stages' | 'regions'>,
): NormalizedRegionProgression {
  const stages = normalizeStageDefinitions(catalog.stages ?? [], catalog)
  if (stages.length === 0) {
    if ((catalog.regions ?? []).length > 0) {
      throw new Error('region definitions require at least one stage')
    }
    return Object.freeze({ regions: Object.freeze([]), stages: Object.freeze([]) })
  }
  const knownStageIds = new Set(stages.map((stage) => stage.stageId))
  const stageRegionIds = new Set(stages.map((stage) => stage.regionId))
  const regionIds = new Set<RegionId>()
  const regionOrders = new Set<number>()
  const rawRegions = catalog.regions ?? []
  if (rawRegions.length === 0) {
    throw new Error('stage progression requires region definitions')
  }
  for (const region of rawRegions) {
    assertNonEmptyString(region.regionId, 'region.regionId')
    if (regionIds.has(region.regionId)) {
      throw new Error(`region id must be unique: ${region.regionId}`)
    }
    regionIds.add(region.regionId)
  }
  for (const regionId of stageRegionIds) {
    if (!regionIds.has(regionId)) {
      throw new Error(`stage region is not defined: ${regionId}`)
    }
  }

  const regions = rawRegions.map((region) => {
    assertNonEmptyString(region.name, `region.${region.regionId}.name`)
    assertNonEmptyString(region.summary, `region.${region.regionId}.summary`)
    assertThemeColor(region.themeColor, `region.${region.regionId}.themeColor`)
    assertSafeIntegerInRange(region.order, 1, Number.MAX_SAFE_INTEGER, 'region.order')
    if (regionOrders.has(region.order)) {
      throw new Error(`region order must be unique: ${region.order}`)
    }
    regionOrders.add(region.order)
    return Object.freeze({
      ...region,
      requirement: normalizeRequirement(
        region.requirement,
        knownStageIds,
        regionIds,
        `region.${region.regionId}.requirement`,
      ),
    })
  })
  regions.sort(
    (left, right) => left.order - right.order || compareIds(left.regionId, right.regionId),
  )

  const regionById = new Map(regions.map((region) => [region.regionId, region]))
  const stageOrdersByRegion = new Map<RegionId, Set<number>>()
  const normalizedStages = stages.map((stage) => {
    const rawAccess = stage.access ?? DEFAULT_STAGE_ACCESS
    const region = regionById.get(stage.regionId)
    if (region === undefined) throw new Error(`stage region is not defined: ${stage.regionId}`)
    assertSafeIntegerInRange(
      rawAccess.order,
      1,
      Number.MAX_SAFE_INTEGER,
      `stage.${stage.stageId}.access.order`,
    )
    const orders = stageOrdersByRegion.get(stage.regionId) ?? new Set<number>()
    if (orders.has(rawAccess.order)) {
      throw new Error(`stage order must be unique within ${stage.regionId}: ${rawAccess.order}`)
    }
    orders.add(rawAccess.order)
    stageOrdersByRegion.set(stage.regionId, orders)
    return Object.freeze({
      ...stage,
      access: Object.freeze({
        order: rawAccess.order,
        requirement: normalizeRequirement(
          rawAccess.requirement,
          knownStageIds,
          regionIds,
          `stage.${stage.stageId}.access.requirement`,
          stage.stageId,
        ),
        hideUntilUnlocked: rawAccess.hideUntilUnlocked,
        regionRequirement: region.requirement,
        regionHideUntilUnlocked: region.hideUntilUnlocked,
      }),
    })
  })
  normalizedStages.sort((left, right) => {
    const leftRegion = regions.find((region) => region.regionId === left.regionId)
    const rightRegion = regions.find((region) => region.regionId === right.regionId)
    const regionOrder = (leftRegion?.order ?? 0) - (rightRegion?.order ?? 0)
    if (regionOrder !== 0) return regionOrder
    const stageOrder = (left.access?.order ?? 1) - (right.access?.order ?? 1)
    return stageOrder !== 0 ? stageOrder : compareIds(left.stageId, right.stageId)
  })
  return Object.freeze({
    regions: Object.freeze(regions),
    stages: Object.freeze(normalizedStages),
  })
}

export function getRegionPoints(playerData: PlayerData, regionId: RegionId): number {
  return (
    playerData.stageProgress?.regionalPoints.find((state) => state.regionId === regionId)?.points ??
    0
  )
}

export function isProgressRequirementMet(
  playerData: PlayerData,
  requirement: ProgressRequirement,
): boolean {
  const completed = new Set(playerData.stageProgress?.completedStageIds ?? [])
  switch (requirement.type) {
    case 'ALWAYS':
      return true
    case 'STAGE_COMPLETED':
      return completed.has(requirement.stageId)
    case 'ALL_STAGES_COMPLETED':
      return requirement.stageIds.every((stageId) => completed.has(stageId))
    case 'REGION_POINTS':
      return getRegionPoints(playerData, requirement.regionId) >= requirement.points
  }
}

export function describeProgressRequirement(requirement: ProgressRequirement): string | null {
  switch (requirement.type) {
    case 'ALWAYS':
      return null
    case 'STAGE_COMPLETED':
      return `${resolveStageName(requirement.stageId)} のクリアが必要です。`
    case 'ALL_STAGES_COMPLETED':
      return `${requirement.stageIds.map(resolveStageName).join('、')} の全クリアが必要です。`
    case 'REGION_POINTS':
      return `${resolveRegionName(requirement.regionId)} の地域ポイント ${requirement.points} が必要です。`
  }
}

export function getRegionAccessState(
  playerData: PlayerData,
  region: RegionDefinition,
): ProgressAccessState {
  const unlocked = isProgressRequirementMet(playerData, region.requirement)
  return Object.freeze({
    unlocked,
    visible: unlocked || !region.hideUntilUnlocked,
    reason: unlocked ? null : describeProgressRequirement(region.requirement),
  })
}

export function getStageAccessState(
  playerData: PlayerData,
  stage: StageDefinition,
): ProgressAccessState {
  const access = stage.access ?? DEFAULT_STAGE_ACCESS
  const regionUnlocked =
    access.regionRequirement === undefined ||
    isProgressRequirementMet(playerData, access.regionRequirement)
  const stageUnlocked = isProgressRequirementMet(playerData, access.requirement)
  const unlocked = regionUnlocked && stageUnlocked
  const visible =
    (regionUnlocked || access.regionHideUntilUnlocked !== true) &&
    (stageUnlocked || !access.hideUntilUnlocked)
  const reason = !regionUnlocked
    ? describeProgressRequirement(access.regionRequirement ?? { type: 'ALWAYS' })
    : !stageUnlocked
      ? describeProgressRequirement(access.requirement)
      : null
  return Object.freeze({ unlocked, visible, reason })
}

export function getUnlockedStageIds(
  playerData: PlayerData,
  catalog: Pick<PlayerDataContentCatalog, 'species' | 'skills' | 'stages' | 'regions'>,
): readonly StageId[] {
  const normalized = normalizeRegionProgression(catalog)
  return Object.freeze(
    normalized.stages
      .filter((stage) => getStageAccessState(playerData, stage).unlocked)
      .map((stage) => stage.stageId),
  )
}

export function getNextUnlockedStageId(
  playerData: PlayerData,
  catalog: Pick<PlayerDataContentCatalog, 'species' | 'skills' | 'stages' | 'regions'>,
  currentStageId: StageId,
): StageId | null {
  const normalized = normalizeRegionProgression(catalog)
  const unlocked = new Set(getUnlockedStageIds(playerData, catalog))
  const currentIndex = normalized.stages.findIndex((stage) => stage.stageId === currentStageId)
  if (currentIndex < 0) throw new Error(`current stage does not exist: ${currentStageId}`)
  return (
    normalized.stages.slice(currentIndex + 1).find((stage) => unlocked.has(stage.stageId))
      ?.stageId ?? null
  )
}
