import type { SpeciesId } from '../content/monster-species'
import {
  applyEconomyTransaction,
  type EconomyTransaction,
} from './economy'
import {
  ANALYSIS_MAX_BASIS_POINTS,
  createPlayerData,
  type PlayerData,
  type PlayerDataContentCatalog,
} from './player-data'

export const ANALYSIS_GAIN_SOURCES = [
  'ALLY_USE',
  'ENEMY_ENCOUNTER',
  'SKILL_OBSERVATION',
  'DATA_INVESTMENT',
  'SPECIMEN_CONSUMPTION',
] as const

export type AnalysisGainSource = (typeof ANALYSIS_GAIN_SOURCES)[number]

export interface AnalysisGain {
  readonly speciesId: SpeciesId
  readonly source: AnalysisGainSource
  readonly amount: number
}

export interface AppliedAnalysisGain {
  readonly speciesId: SpeciesId
  readonly source: AnalysisGainSource
  readonly requestedAmount: number
  readonly appliedAmount: number
  readonly before: number
  readonly after: number
}

export interface AnalysisGainResult {
  readonly playerData: PlayerData
  readonly changes: readonly AppliedAnalysisGain[]
}

export interface PlayerProgressionTransaction {
  readonly economy?: EconomyTransaction
  readonly analysisGains?: readonly AnalysisGain[]
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function sourceIndex(source: AnalysisGainSource): number {
  return ANALYSIS_GAIN_SOURCES.indexOf(source)
}

function assertPositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive safe integer`)
  }
}

function addSafe(left: number, right: number, field: string): number {
  const result = left + right
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${field} must remain a safe integer`)
  }
  return result
}

function normalizeGains(
  gains: readonly AnalysisGain[],
  playerData: PlayerData,
): readonly AnalysisGain[] {
  const knownSpecies = new Set(
    playerData.collection.speciesStates.map((state) => state.speciesId),
  )
  const totals = new Map<string, AnalysisGain>()

  for (const gain of gains) {
    if (!knownSpecies.has(gain.speciesId)) {
      throw new Error(`analysis gain references unknown species state: ${gain.speciesId}`)
    }
    if (!ANALYSIS_GAIN_SOURCES.includes(gain.source)) {
      throw new Error(`analysis gain source is invalid: ${gain.source}`)
    }
    assertPositiveSafeInteger(gain.amount, 'analysis gain amount')
    const key = `${gain.speciesId}\u0000${gain.source}`
    const current = totals.get(key)
    totals.set(
      key,
      Object.freeze({
        speciesId: gain.speciesId,
        source: gain.source,
        amount: addSafe(
          current?.amount ?? 0,
          gain.amount,
          `analysis gain total: ${gain.speciesId}/${gain.source}`,
        ),
      }),
    )
  }

  return Object.freeze(
    [...totals.values()].sort((left, right) => {
      const bySpecies = compareIds(left.speciesId, right.speciesId)
      return bySpecies !== 0 ? bySpecies : sourceIndex(left.source) - sourceIndex(right.source)
    }),
  )
}

export function applyAnalysisGains(
  playerData: PlayerData,
  gains: readonly AnalysisGain[],
  catalog: PlayerDataContentCatalog,
): AnalysisGainResult {
  const normalized = createPlayerData(playerData, catalog)
  const normalizedGains = normalizeGains(gains, normalized)
  const nextBySpecies = new Map(
    normalized.collection.speciesStates.map((state) => [
      state.speciesId,
      state.analysisBasisPoints,
    ]),
  )
  const changes: AppliedAnalysisGain[] = []

  for (const gain of normalizedGains) {
    const before = nextBySpecies.get(gain.speciesId)
    if (before === undefined) {
      throw new Error(`analysis species state disappeared: ${gain.speciesId}`)
    }
    const appliedAmount = Math.min(
      gain.amount,
      ANALYSIS_MAX_BASIS_POINTS - before,
    )
    const after = before + appliedAmount
    nextBySpecies.set(gain.speciesId, after)
    changes.push(
      Object.freeze({
        speciesId: gain.speciesId,
        source: gain.source,
        requestedAmount: gain.amount,
        appliedAmount,
        before,
        after,
      }),
    )
  }

  const nextPlayerData = createPlayerData(
    {
      ...normalized,
      collection: {
        ...normalized.collection,
        speciesStates: normalized.collection.speciesStates.map((state) => ({
          ...state,
          analysisBasisPoints: nextBySpecies.get(state.speciesId) ?? state.analysisBasisPoints,
        })),
      },
    },
    catalog,
  )

  return Object.freeze({
    playerData: nextPlayerData,
    changes: Object.freeze(changes),
  })
}

export function applyPlayerProgressionTransaction(
  playerData: PlayerData,
  transaction: PlayerProgressionTransaction,
  catalog: PlayerDataContentCatalog,
): AnalysisGainResult {
  const normalized = createPlayerData(playerData, catalog)
  const economy =
    transaction.economy === undefined
      ? normalized.economy
      : applyEconomyTransaction(normalized.economy, transaction.economy)
  const withEconomy = createPlayerData({ ...normalized, economy }, catalog)
  return applyAnalysisGains(withEconomy, transaction.analysisGains ?? [], catalog)
}
