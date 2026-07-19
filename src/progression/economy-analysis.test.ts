import { describe, expect, it } from 'vitest'
import {
  T033_INITIAL_PLAYER_DATA,
  T033_PLAYER_CATALOG,
} from '../demo/player-collection-demo'
import {
  ANALYSIS_GAIN_SOURCES,
  applyAnalysisGains,
  applyPlayerProgressionTransaction,
  type AnalysisGain,
} from './analysis'
import {
  applyEconomyTransaction,
  createEconomyState,
  getCatalystAmount,
} from './economy'

describe('T034 economy transactions', () => {
  it('normalizes catalyst IDs and applies currency, research data, and catalysts atomically', () => {
    const state = createEconomyState({
      currency: 300,
      researchData: 80,
      catalysts: [
        { catalystId: 'catalyst.z', amount: 2 },
        { catalystId: 'catalyst.a', amount: 1 },
      ],
    })
    const next = applyEconomyTransaction(state, {
      currencyDelta: -120,
      researchDataDelta: 25,
      catalystDeltas: [
        { catalystId: 'catalyst.z', amount: -1 },
        { catalystId: 'catalyst.a', amount: 2 },
        { catalystId: 'catalyst.new', amount: 4 },
        { catalystId: 'catalyst.new', amount: -1 },
      ],
    })

    expect(next).toEqual({
      currency: 180,
      researchData: 105,
      catalysts: [
        { catalystId: 'catalyst.a', amount: 3 },
        { catalystId: 'catalyst.new', amount: 3 },
        { catalystId: 'catalyst.z', amount: 1 },
      ],
    })
    expect(getCatalystAmount(next, 'catalyst.new')).toBe(3)
    expect(state.currency).toBe(300)
    expect(Object.isFrozen(next)).toBe(true)
    expect(Object.isFrozen(next.catalysts)).toBe(true)
  })

  it('rejects any transaction that would make one balance negative without partial mutation', () => {
    const state = createEconomyState({
      currency: 100,
      researchData: 50,
      catalysts: [{ catalystId: 'catalyst.a', amount: 1 }],
    })

    expect(() =>
      applyEconomyTransaction(state, {
        currencyDelta: 500,
        researchDataDelta: -51,
        catalystDeltas: [{ catalystId: 'catalyst.a', amount: 4 }],
      }),
    ).toThrow('research data negative')
    expect(state).toEqual({
      currency: 100,
      researchData: 50,
      catalysts: [{ catalystId: 'catalyst.a', amount: 1 }],
    })

    expect(() =>
      applyEconomyTransaction(state, {
        catalystDeltas: [{ catalystId: 'catalyst.a', amount: -2 }],
      }),
    ).toThrow('catalyst negative: catalyst.a')
  })
})

describe('T034 analysis gains', () => {
  it('supports all five sources, aggregates duplicates, and clamps at 10000 basis points', () => {
    expect(ANALYSIS_GAIN_SOURCES).toEqual([
      'ALLY_USE',
      'ENEMY_ENCOUNTER',
      'SKILL_OBSERVATION',
      'DATA_INVESTMENT',
      'SPECIMEN_CONSUMPTION',
    ])

    const gains: AnalysisGain[] = [
      { speciesId: 'species.demo-delta', source: 'SKILL_OBSERVATION', amount: 400 },
      { speciesId: 'species.demo-alpha', source: 'ALLY_USE', amount: 1000 },
      { speciesId: 'species.demo-delta', source: 'ENEMY_ENCOUNTER', amount: 300 },
      { speciesId: 'species.demo-alpha', source: 'DATA_INVESTMENT', amount: 2000 },
      { speciesId: 'species.demo-alpha', source: 'ALLY_USE', amount: 900 },
      { speciesId: 'species.demo-alpha', source: 'SPECIMEN_CONSUMPTION', amount: 1000 },
    ]
    const result = applyAnalysisGains(
      T033_INITIAL_PLAYER_DATA,
      gains,
      T033_PLAYER_CATALOG,
    )

    expect(result.changes.map((change) => [
      change.speciesId,
      change.source,
      change.requestedAmount,
      change.appliedAmount,
      change.after,
    ])).toEqual([
      ['species.demo-alpha', 'ALLY_USE', 1900, 1900, 8100],
      ['species.demo-alpha', 'DATA_INVESTMENT', 2000, 1900, 10000],
      ['species.demo-alpha', 'SPECIMEN_CONSUMPTION', 1000, 0, 10000],
      ['species.demo-delta', 'ENEMY_ENCOUNTER', 300, 300, 1200],
      ['species.demo-delta', 'SKILL_OBSERVATION', 400, 400, 1600],
    ])
    expect(
      result.playerData.collection.speciesStates.find(
        (state) => state.speciesId === 'species.demo-alpha',
      )?.analysisBasisPoints,
    ).toBe(10000)
    expect(T033_INITIAL_PLAYER_DATA.collection.speciesStates[0]?.analysisBasisPoints).toBe(6200)
  })

  it('commits economy costs and analysis gains together and is byte-stable across reruns', () => {
    const transaction = {
      economy: {
        researchDataDelta: -20,
        catalystDeltas: [{ catalystId: 'catalyst.demo-forest', amount: -1 }],
      },
      analysisGains: [
        { speciesId: 'species.demo-beta', source: 'DATA_INVESTMENT' as const, amount: 250 },
      ],
    }
    const reference = JSON.stringify(
      applyPlayerProgressionTransaction(
        T033_INITIAL_PLAYER_DATA,
        transaction,
        T033_PLAYER_CATALOG,
      ),
    )

    for (let index = 0; index < 100; index += 1) {
      expect(
        JSON.stringify(
          applyPlayerProgressionTransaction(
            T033_INITIAL_PLAYER_DATA,
            transaction,
            T033_PLAYER_CATALOG,
          ),
        ),
      ).toBe(reference)
    }

    const result = applyPlayerProgressionTransaction(
      T033_INITIAL_PLAYER_DATA,
      transaction,
      T033_PLAYER_CATALOG,
    )
    expect(result.playerData.economy.researchData).toBe(160)
    expect(getCatalystAmount(result.playerData.economy, 'catalyst.demo-forest')).toBe(2)
    expect(
      result.playerData.collection.speciesStates.find(
        (state) => state.speciesId === 'species.demo-beta',
      )?.analysisBasisPoints,
    ).toBe(4350)
  })

  it('rejects invalid analysis inputs before exposing any transaction result', () => {
    expect(() =>
      applyPlayerProgressionTransaction(
        T033_INITIAL_PLAYER_DATA,
        {
          economy: { currencyDelta: 100 },
          analysisGains: [
            { speciesId: 'species.missing', source: 'ALLY_USE', amount: 100 },
          ],
        },
        T033_PLAYER_CATALOG,
      ),
    ).toThrow('unknown species state')
    expect(T033_INITIAL_PLAYER_DATA.economy.currency).toBe(520)
  })
})
