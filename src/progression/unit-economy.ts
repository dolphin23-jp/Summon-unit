import type { MonsterRarity, SpeciesId } from '../content/monster-species'
import { applyEconomyTransaction } from './economy'
import {
  UNIT_CONDITION_MAX_BASIS_POINTS,
  createPlayerData,
  type PlayerData,
  type UnitInstanceId,
} from './player-data'
import {
  assertValidT036ProgressionCatalog,
  type T036ProgressionCatalog,
} from './t036-progression-model'

export const SUMMON_BASE_CURRENCY_COST = 100
export const SUMMON_RARITY_MULTIPLIERS = Object.freeze([
  1, 2, 4, 8, 16, 32, 64, 128, 256, 512,
] as const)
export const RECYCLE_RETURN_PERMILLE = 700
export const FULL_REPAIR_COST_PERMILLE = 50

export interface SummonUnitRequest {
  readonly instanceId: UnitInstanceId
  readonly speciesId: SpeciesId
  readonly nickname?: string | null
}

export interface SummonUnitResult {
  readonly playerData: PlayerData
  readonly instanceId: UnitInstanceId
  readonly speciesId: SpeciesId
  readonly currencySpent: number
}

export interface RecycleUnitResult {
  readonly playerData: PlayerData
  readonly instanceId: UnitInstanceId
  readonly speciesId: SpeciesId
  readonly currencyReturned: number
}

export interface RepairUnitResult {
  readonly playerData: PlayerData
  readonly instanceId: UnitInstanceId
  readonly beforeConditionBasisPoints: number
  readonly afterConditionBasisPoints: number
  readonly currencySpent: number
}

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function multiplySafe(left: number, right: number, field: string): number {
  const result = left * right
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${field} must remain a safe integer`)
  }
  return result
}

export function calculateSummonCurrencyCost(rarity: MonsterRarity): number {
  const multiplier = SUMMON_RARITY_MULTIPLIERS[rarity - 1]
  if (multiplier === undefined) {
    throw new Error(`summon rarity is invalid: ${rarity}`)
  }
  return multiplySafe(SUMMON_BASE_CURRENCY_COST, multiplier, 'summon currency cost')
}

export function calculateRecycleCurrencyReturn(rarity: MonsterRarity): number {
  return Math.floor(
    multiplySafe(
      calculateSummonCurrencyCost(rarity),
      RECYCLE_RETURN_PERMILLE,
      'recycle currency return',
    ) / 1000,
  )
}

export function calculateRepairCurrencyCost(
  rarity: MonsterRarity,
  conditionBasisPoints: number,
): number {
  if (
    !Number.isSafeInteger(conditionBasisPoints) ||
    conditionBasisPoints < 0 ||
    conditionBasisPoints > UNIT_CONDITION_MAX_BASIS_POINTS
  ) {
    throw new Error(
      `repair condition must be a safe integer from 0 through ${UNIT_CONDITION_MAX_BASIS_POINTS}`,
    )
  }
  const missing = UNIT_CONDITION_MAX_BASIS_POINTS - conditionBasisPoints
  if (missing === 0) return 0
  const fullRepairCost = Math.max(
    1,
    Math.ceil(
      multiplySafe(
        calculateSummonCurrencyCost(rarity),
        FULL_REPAIR_COST_PERMILLE,
        'full repair currency cost',
      ) / 1000,
    ),
  )
  return Math.max(
    1,
    Math.ceil(multiplySafe(fullRepairCost, missing, 'repair currency cost') / 10_000),
  )
}

export function summonUnit(
  playerData: PlayerData,
  request: SummonUnitRequest,
  catalog: T036ProgressionCatalog,
): SummonUnitResult {
  assertValidT036ProgressionCatalog(catalog)
  assertNonEmptyString(request.instanceId, 'summon.instanceId')
  const normalized = createPlayerData(playerData, catalog)
  const species = catalog.species.find((candidate) => candidate.id === request.speciesId)
  if (species === undefined) {
    throw new Error(`summon species is unknown: ${request.speciesId}`)
  }
  const speciesState = normalized.collection.speciesStates.find(
    (candidate) => candidate.speciesId === request.speciesId,
  )
  if (speciesState?.blueprintUnlocked !== true) {
    throw new Error(`summon requires an unlocked blueprint: ${request.speciesId}`)
  }
  if (
    normalized.collection.unitInstances.some(
      (candidate) => candidate.instanceId === request.instanceId,
    )
  ) {
    throw new Error(`summon instance ID already exists: ${request.instanceId}`)
  }
  if (request.nickname !== undefined && request.nickname !== null) {
    assertNonEmptyString(request.nickname, 'summon.nickname')
  }

  const currencySpent = calculateSummonCurrencyCost(species.rarity)
  const economy = applyEconomyTransaction(normalized.economy, {
    currencyDelta: -currencySpent,
  })
  const nextPlayerData = createPlayerData(
    {
      ...normalized,
      economy,
      collection: {
        ...normalized.collection,
        unitInstances: [
          ...normalized.collection.unitInstances,
          {
            instanceId: request.instanceId,
            speciesId: request.speciesId,
            learnedGenericSkillIds: [],
            nickname: request.nickname ?? null,
            favorite: false,
            locked: false,
            conditionBasisPoints: UNIT_CONDITION_MAX_BASIS_POINTS,
          },
        ],
      },
    },
    catalog,
  )
  return Object.freeze({
    playerData: nextPlayerData,
    instanceId: request.instanceId,
    speciesId: request.speciesId,
    currencySpent,
  })
}

export function recycleUnit(
  playerData: PlayerData,
  instanceId: UnitInstanceId,
  catalog: T036ProgressionCatalog,
): RecycleUnitResult {
  assertValidT036ProgressionCatalog(catalog)
  const normalized = createPlayerData(playerData, catalog)
  const instance = normalized.collection.unitInstances.find(
    (candidate) => candidate.instanceId === instanceId,
  )
  if (instance === undefined) {
    throw new Error(`recycle unit instance does not exist: ${instanceId}`)
  }
  if (instance.locked) {
    throw new Error(`recycle unit instance is locked: ${instanceId}`)
  }
  if (
    normalized.formations.formations.some((formation) =>
      formation.members.some((member) => member.instanceId === instanceId),
    )
  ) {
    throw new Error(`recycle unit instance is assigned to a formation: ${instanceId}`)
  }
  const species = catalog.species.find((candidate) => candidate.id === instance.speciesId)
  if (species === undefined) {
    throw new Error(`recycle species is unknown: ${instance.speciesId}`)
  }

  const currencyReturned = calculateRecycleCurrencyReturn(species.rarity)
  const economy = applyEconomyTransaction(normalized.economy, {
    currencyDelta: currencyReturned,
  })
  const nextPlayerData = createPlayerData(
    {
      ...normalized,
      economy,
      collection: {
        ...normalized.collection,
        unitInstances: normalized.collection.unitInstances.filter(
          (candidate) => candidate.instanceId !== instanceId,
        ),
      },
    },
    catalog,
  )
  return Object.freeze({
    playerData: nextPlayerData,
    instanceId,
    speciesId: instance.speciesId,
    currencyReturned,
  })
}

export function repairUnit(
  playerData: PlayerData,
  instanceId: UnitInstanceId,
  catalog: T036ProgressionCatalog,
): RepairUnitResult {
  assertValidT036ProgressionCatalog(catalog)
  const normalized = createPlayerData(playerData, catalog)
  const instance = normalized.collection.unitInstances.find(
    (candidate) => candidate.instanceId === instanceId,
  )
  if (instance === undefined) {
    throw new Error(`repair unit instance does not exist: ${instanceId}`)
  }
  if (instance.conditionBasisPoints === UNIT_CONDITION_MAX_BASIS_POINTS) {
    throw new Error(`repair unit instance is already at full condition: ${instanceId}`)
  }
  const species = catalog.species.find((candidate) => candidate.id === instance.speciesId)
  if (species === undefined) {
    throw new Error(`repair species is unknown: ${instance.speciesId}`)
  }

  const currencySpent = calculateRepairCurrencyCost(
    species.rarity,
    instance.conditionBasisPoints,
  )
  const economy = applyEconomyTransaction(normalized.economy, {
    currencyDelta: -currencySpent,
  })
  const nextPlayerData = createPlayerData(
    {
      ...normalized,
      economy,
      collection: {
        ...normalized.collection,
        unitInstances: normalized.collection.unitInstances.map((candidate) =>
          candidate.instanceId === instanceId
            ? { ...candidate, conditionBasisPoints: UNIT_CONDITION_MAX_BASIS_POINTS }
            : candidate,
        ),
      },
    },
    catalog,
  )
  return Object.freeze({
    playerData: nextPlayerData,
    instanceId,
    beforeConditionBasisPoints: instance.conditionBasisPoints,
    afterConditionBasisPoints: UNIT_CONDITION_MAX_BASIS_POINTS,
    currencySpent,
  })
}
