import type { AiDecisionConfiguration } from '../ai/strategy-presets'
import type { HeadlessBattleUnitDefinition } from '../battle/headless-battle-runner'
import type { BossEncounterDefinition } from '../battle/boss-phase'
import type { SpeciesId } from '../content/monster-species'
import type { SkillId } from '../content/skill-definition'
import type { AnalysisGain } from './analysis'
import type { CatalystDelta } from './economy'
import type { PlayerData, PlayerDataContentCatalog } from './player-data'

export type StageId = string
export type RegionId = string
export type StageKind = 'NORMAL' | 'ELITE' | 'BOSS' | 'HIDDEN'

export interface StageRewardBundle {
  readonly currency: number
  readonly researchData: number
  readonly catalysts: readonly CatalystDelta[]
}

export interface StageRandomRewardDefinition {
  readonly rewardId: string
  readonly chanceBasisPoints: number
  readonly bundle: StageRewardBundle
}

export interface RegionalPointRewardDefinition {
  readonly rewardId: string
  readonly requiredPoints: number
  readonly bundle: StageRewardBundle
}

export interface StageRewardDefinition {
  readonly guaranteed: StageRewardBundle
  readonly randomBonuses: readonly StageRandomRewardDefinition[]
  readonly regionalPointGain: number
  readonly regionalPointRewards: readonly RegionalPointRewardDefinition[]
  readonly analysisGains: readonly AnalysisGain[]
}

export interface StageEnemyFormationDefinition {
  readonly units: readonly HeadlessBattleUnitDefinition[]
  readonly aiConfigurations: Readonly<Record<string, AiDecisionConfiguration>>
}

export interface StageDefinition {
  readonly stageId: StageId
  readonly regionId: RegionId
  readonly kind: StageKind
  readonly theme: string
  readonly secondaryTheme: string | null
  readonly completionProgressId: string
  readonly enemyFormation: StageEnemyFormationDefinition
  readonly rewards: StageRewardDefinition
  readonly boss: BossEncounterDefinition | null
}

export interface PlayerRegionalPointState {
  readonly regionId: RegionId
  readonly points: number
  readonly claimedRewardIds: readonly string[]
}

export interface PlayerStageProgressState {
  readonly completedStageIds: readonly StageId[]
  readonly settledBattleIds: readonly string[]
  readonly regionalPoints: readonly PlayerRegionalPointState[]
}

declare module './player-data' {
  interface PlayerData {
    readonly stageProgress?: PlayerStageProgressState
  }

  interface PlayerDataContentCatalog {
    readonly stages?: readonly StageDefinition[]
  }
}

const STAGE_KINDS: readonly StageKind[] = Object.freeze(['NORMAL', 'ELITE', 'BOSS', 'HIDDEN'])

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

function normalizeUniqueIds(values: readonly string[], field: string): readonly string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of values) {
    assertNonEmptyString(value, `${field}[]`)
    if (seen.has(value)) {
      throw new Error(`${field} must not contain duplicates: ${value}`)
    }
    seen.add(value)
    normalized.push(value)
  }
  normalized.sort(compareIds)
  return Object.freeze(normalized)
}

function normalizeRewardBundle(bundle: StageRewardBundle, field: string): StageRewardBundle {
  assertSafeIntegerInRange(bundle.currency, 0, Number.MAX_SAFE_INTEGER, `${field}.currency`)
  assertSafeIntegerInRange(
    bundle.researchData,
    0,
    Number.MAX_SAFE_INTEGER,
    `${field}.researchData`,
  )
  const totals = new Map<string, number>()
  for (const catalyst of bundle.catalysts) {
    assertNonEmptyString(catalyst.catalystId, `${field}.catalysts[].catalystId`)
    assertSafeIntegerInRange(
      catalyst.amount,
      1,
      Number.MAX_SAFE_INTEGER,
      `${field}.catalysts[].amount`,
    )
    const next = (totals.get(catalyst.catalystId) ?? 0) + catalyst.amount
    if (!Number.isSafeInteger(next)) {
      throw new Error(`${field}.catalysts total must remain a safe integer`)
    }
    totals.set(catalyst.catalystId, next)
  }
  return Object.freeze({
    currency: bundle.currency,
    researchData: bundle.researchData,
    catalysts: Object.freeze(
      [...totals]
        .sort(([left], [right]) => compareIds(left, right))
        .map(([catalystId, amount]) => Object.freeze({ catalystId, amount })),
    ),
  })
}

function normalizeRewards(rewards: StageRewardDefinition, field: string): StageRewardDefinition {
  const guaranteed = normalizeRewardBundle(rewards.guaranteed, `${field}.guaranteed`)
  const randomRewardIds = new Set<string>()
  let totalChance = 0
  const randomBonuses = rewards.randomBonuses.map((reward) => {
    assertNonEmptyString(reward.rewardId, `${field}.randomBonuses[].rewardId`)
    if (randomRewardIds.has(reward.rewardId)) {
      throw new Error(`${field}.random reward id must be unique: ${reward.rewardId}`)
    }
    randomRewardIds.add(reward.rewardId)
    assertSafeIntegerInRange(
      reward.chanceBasisPoints,
      1,
      10_000,
      `${field}.randomBonuses[].chanceBasisPoints`,
    )
    totalChance += reward.chanceBasisPoints
    if (!Number.isSafeInteger(totalChance) || totalChance > 10_000) {
      throw new Error(`${field}.random bonus chances must total 10000 or less`)
    }
    return Object.freeze({
      rewardId: reward.rewardId,
      chanceBasisPoints: reward.chanceBasisPoints,
      bundle: normalizeRewardBundle(reward.bundle, `${field}.randomBonuses.${reward.rewardId}`),
    })
  })

  assertSafeIntegerInRange(
    rewards.regionalPointGain,
    0,
    Number.MAX_SAFE_INTEGER,
    `${field}.regionalPointGain`,
  )
  const regionalRewardIds = new Set<string>()
  let previousThreshold = 0
  const regionalPointRewards = rewards.regionalPointRewards.map((reward) => {
    assertNonEmptyString(reward.rewardId, `${field}.regionalPointRewards[].rewardId`)
    if (regionalRewardIds.has(reward.rewardId)) {
      throw new Error(`${field}.regional reward id must be unique: ${reward.rewardId}`)
    }
    regionalRewardIds.add(reward.rewardId)
    assertSafeIntegerInRange(
      reward.requiredPoints,
      1,
      Number.MAX_SAFE_INTEGER,
      `${field}.regionalPointRewards[].requiredPoints`,
    )
    if (reward.requiredPoints <= previousThreshold) {
      throw new Error(`${field}.regional point thresholds must be strictly increasing`)
    }
    previousThreshold = reward.requiredPoints
    return Object.freeze({
      rewardId: reward.rewardId,
      requiredPoints: reward.requiredPoints,
      bundle: normalizeRewardBundle(
        reward.bundle,
        `${field}.regionalPointRewards.${reward.rewardId}`,
      ),
    })
  })

  return Object.freeze({
    guaranteed,
    randomBonuses: Object.freeze(randomBonuses),
    regionalPointGain: rewards.regionalPointGain,
    regionalPointRewards: Object.freeze(regionalPointRewards),
    analysisGains: Object.freeze(rewards.analysisGains.map((gain) => Object.freeze({ ...gain }))),
  })
}

export function normalizeStageDefinitions(
  definitions: readonly StageDefinition[],
  catalog: Pick<PlayerDataContentCatalog, 'species' | 'skills'>,
): readonly StageDefinition[] {
  const knownSpeciesIds = new Set<SpeciesId>(catalog.species.map((species) => species.id))
  const knownSkillIds = new Set<SkillId>(catalog.skills.map((skill) => skill.id))
  const stageIds = new Set<StageId>()
  const normalized = definitions.map((definition) => {
    assertNonEmptyString(definition.stageId, 'stage.stageId')
    if (stageIds.has(definition.stageId)) {
      throw new Error(`stage id must be unique: ${definition.stageId}`)
    }
    stageIds.add(definition.stageId)
    assertNonEmptyString(definition.regionId, 'stage.regionId')
    if (!STAGE_KINDS.includes(definition.kind)) {
      throw new Error(`stage kind is invalid: ${definition.kind}`)
    }
    assertNonEmptyString(definition.theme, 'stage.theme')
    if (definition.secondaryTheme !== null) {
      assertNonEmptyString(definition.secondaryTheme, 'stage.secondaryTheme')
    }
    assertNonEmptyString(definition.completionProgressId, 'stage.completionProgressId')
    if (
      definition.enemyFormation.units.length < 1 ||
      definition.enemyFormation.units.length > 9
    ) {
      throw new Error('stage enemy formation must contain between 1 and 9 units')
    }
    const enemyIds = new Set<string>()
    const units = definition.enemyFormation.units.map((unit) => {
      assertNonEmptyString(unit.battleUnitId, 'stage.enemyFormation.battleUnitId')
      if (enemyIds.has(unit.battleUnitId)) {
        throw new Error(`stage enemy battleUnitId must be unique: ${unit.battleUnitId}`)
      }
      enemyIds.add(unit.battleUnitId)
      if (unit.position.side !== 'ENEMY') {
        throw new Error(`stage enemy unit must use ENEMY position: ${unit.battleUnitId}`)
      }
      if (!knownSpeciesIds.has(unit.speciesId)) {
        throw new Error(`stage enemy species is unknown: ${unit.speciesId}`)
      }
      for (const skillId of unit.equippedSkillIds ?? []) {
        if (!knownSkillIds.has(skillId)) {
          throw new Error(`stage enemy equipped skill is unknown: ${skillId}`)
        }
      }
      return Object.freeze({
        ...unit,
        position: Object.freeze({ ...unit.position }),
        equippedSkillIds:
          unit.equippedSkillIds === undefined
            ? undefined
            : Object.freeze([...unit.equippedSkillIds]),
      })
    })
    for (const battleUnitId of Object.keys(definition.enemyFormation.aiConfigurations)) {
      if (!enemyIds.has(battleUnitId)) {
        throw new Error(`stage AI configuration references unknown enemy: ${battleUnitId}`)
      }
    }
    if (definition.kind === 'BOSS' && definition.boss === null) {
      throw new Error(`boss stage requires a boss definition: ${definition.stageId}`)
    }
    if (definition.kind !== 'BOSS' && definition.boss !== null) {
      throw new Error(`non-boss stage must not contain a boss definition: ${definition.stageId}`)
    }
    if (definition.boss !== null && !enemyIds.has(definition.boss.bossBattleUnitId)) {
      throw new Error(`boss definition references unknown enemy: ${definition.boss.bossBattleUnitId}`)
    }
    return Object.freeze({
      ...definition,
      enemyFormation: Object.freeze({
        units: Object.freeze(units),
        aiConfigurations: Object.freeze({ ...definition.enemyFormation.aiConfigurations }),
      }),
      rewards: normalizeRewards(definition.rewards, `stage.${definition.stageId}.rewards`),
      boss: definition.boss,
    })
  })
  normalized.sort((left, right) => compareIds(left.stageId, right.stageId))
  return Object.freeze(normalized)
}

export function getStageDefinition(
  catalog: PlayerDataContentCatalog,
  stageId: StageId,
): StageDefinition {
  const stages = normalizeStageDefinitions(catalog.stages ?? [], catalog)
  const stage = stages.find((candidate) => candidate.stageId === stageId)
  if (stage === undefined) {
    throw new Error(`unknown stage id: ${stageId}`)
  }
  return stage
}

export function createPlayerStageProgressState(
  input: PlayerStageProgressState | undefined,
  definitions: readonly StageDefinition[],
  catalog: Pick<PlayerDataContentCatalog, 'species' | 'skills'>,
): PlayerStageProgressState | undefined {
  const normalizedDefinitions = normalizeStageDefinitions(definitions, catalog)
  if (normalizedDefinitions.length === 0) {
    if (input !== undefined) {
      throw new Error('player stage progress requires stage definitions')
    }
    return undefined
  }
  const stageIds = new Set(normalizedDefinitions.map((stage) => stage.stageId))
  const regionIds = new Set(normalizedDefinitions.map((stage) => stage.regionId))
  const completedStageIds = normalizeUniqueIds(input?.completedStageIds ?? [], 'completedStageIds')
  for (const stageId of completedStageIds) {
    if (!stageIds.has(stageId)) {
      throw new Error(`completed stage id is unknown: ${stageId}`)
    }
  }
  const settledBattleIds = normalizeUniqueIds(input?.settledBattleIds ?? [], 'settledBattleIds')
  const regionStateById = new Map<RegionId, PlayerRegionalPointState>()
  for (const state of input?.regionalPoints ?? []) {
    assertNonEmptyString(state.regionId, 'regionalPoints.regionId')
    if (!regionIds.has(state.regionId)) {
      throw new Error(`regional point state references unknown region: ${state.regionId}`)
    }
    if (regionStateById.has(state.regionId)) {
      throw new Error(`regional point state must be unique: ${state.regionId}`)
    }
    assertSafeIntegerInRange(
      state.points,
      0,
      Number.MAX_SAFE_INTEGER,
      `regionalPoints.${state.regionId}.points`,
    )
    const validRewardIds = new Set(
      normalizedDefinitions
        .filter((stage) => stage.regionId === state.regionId)
        .flatMap((stage) => stage.rewards.regionalPointRewards.map((reward) => reward.rewardId)),
    )
    const claimedRewardIds = normalizeUniqueIds(
      state.claimedRewardIds,
      `regionalPoints.${state.regionId}.claimedRewardIds`,
    )
    for (const rewardId of claimedRewardIds) {
      if (!validRewardIds.has(rewardId)) {
        throw new Error(`claimed regional reward is unknown: ${rewardId}`)
      }
    }
    regionStateById.set(
      state.regionId,
      Object.freeze({ regionId: state.regionId, points: state.points, claimedRewardIds }),
    )
  }
  return Object.freeze({
    completedStageIds,
    settledBattleIds,
    regionalPoints: Object.freeze(
      [...regionStateById.values()].sort((left, right) => compareIds(left.regionId, right.regionId)),
    ),
  })
}

export function preservePlayerStageProgress(
  next: PlayerData,
  previous: PlayerData,
): PlayerData {
  return Object.freeze({
    ...next,
    ...(next.stageProgress === undefined && previous.stageProgress !== undefined
      ? { stageProgress: previous.stageProgress }
      : {}),
  })
}
