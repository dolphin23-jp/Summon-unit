import { describe, expect, it } from 'vitest'
import { runHeadlessBattle, type HeadlessBattleDefinition } from '../battle/headless-battle-runner'
import {
  T038_INITIAL_PLAYER_DATA,
  T038_PLAYER_CATALOG,
  T038_STAGE,
} from '../demo/stage-reward-demo'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import { getCatalystAmount } from './economy'
import { settleStageBattle } from './stage-reward'
import { createBattleResultView } from '../ui/battle-result-view'

function createWinningBattle(): HeadlessBattleDefinition {
  const allyInstanceIds = new Map([
    ['ally.alpha', 'unit.alpha-01'],
    ['ally.beta', 'unit.beta-01'],
    ['ally.gamma', 'unit.gamma-01'],
  ])
  return Object.freeze({
    ...STANDARD_HEADLESS_BATTLE,
    species: T038_PLAYER_CATALOG.species,
    skills: T038_PLAYER_CATALOG.skills,
    maxActions: 100,
    units: Object.freeze(
      STANDARD_HEADLESS_BATTLE.units.map((unit) => {
        const instanceId = allyInstanceIds.get(unit.battleUnitId)
        if (instanceId !== undefined) {
          return Object.freeze({ ...unit, battleUnitId: `ally:${instanceId}` })
        }
        return Object.freeze({ ...unit, initialHp: 1 })
      }),
    ),
  })
}

describe('stage battle settlement', () => {
  it('atomically applies guaranteed, random, analysis, progress, and result view data', () => {
    const definition = createWinningBattle()
    const result = runHeadlessBattle(definition)
    expect(result.summary.outcome).toBe('ALLY_VICTORY')

    const before = T038_INITIAL_PLAYER_DATA
    const settlement = settleStageBattle(before, result, T038_PLAYER_CATALOG, {
      settlementId: 'battle.test.1',
      stageId: T038_STAGE.stageId,
      bonusRollBasisPoints: 0,
    })

    expect(settlement.alreadySettled).toBe(false)
    expect(settlement.rewards.randomRewardId).toBe('random.demo-forest.core')
    expect(settlement.rewards.total.currency).toBe(120)
    expect(settlement.rewards.total.researchData).toBe(35)
    expect(settlement.playerData.economy.currency).toBe(before.economy.currency + 120)
    expect(settlement.playerData.economy.researchData).toBe(
      before.economy.researchData + 35,
    )
    expect(
      getCatalystAmount(settlement.playerData.economy, 'catalyst.demo-forest'),
    ).toBe(getCatalystAmount(before.economy, 'catalyst.demo-forest') + 1)
    expect(getCatalystAmount(settlement.playerData.economy, 'catalyst.demo-core')).toBe(
      getCatalystAmount(before.economy, 'catalyst.demo-core') + 1,
    )
    expect(settlement.playerData.stageProgress?.completedStageIds).toContain(
      T038_STAGE.stageId,
    )
    expect(settlement.regionalPointsAfter).toBe(20)
    expect(settlement.analysisChanges.map((change) => change.speciesId)).toEqual([
      'species.demo-alpha',
      'species.demo-beta',
      'species.demo-delta',
    ])
    expect(
      settlement.playerData.research?.nodes.find(
        (node) => node.nodeId === 'research.demo-zeta',
      ),
    ).toMatchObject({ status: 'hinted', disclosureStage: 1 })
    expect(settlement.conditionChanges.length).toBeGreaterThan(0)

    const view = createBattleResultView(definition, result, settlement)
    expect(view.rewards.stub).toBe(false)
    expect(view.rewards.currency).toBe(120)
    expect(view.regionalPoints).toEqual({ before: 0, after: 20 })
  })

  it('grants the regional ceiling reward and rejects duplicate settlement IDs', () => {
    const definition = createWinningBattle()
    const result = runHeadlessBattle(definition)
    const first = settleStageBattle(T038_INITIAL_PLAYER_DATA, result, T038_PLAYER_CATALOG, {
      settlementId: 'battle.test.2a',
      stageId: T038_STAGE.stageId,
      bonusRollBasisPoints: 9_999,
    })
    const second = settleStageBattle(first.playerData, result, T038_PLAYER_CATALOG, {
      settlementId: 'battle.test.2b',
      stageId: T038_STAGE.stageId,
      bonusRollBasisPoints: 9_999,
    })

    expect(first.rewards.randomRewardId).toBeNull()
    expect(second.regionalPointsAfter).toBe(40)
    expect(second.rewards.regionalRewardIds).toEqual(['regional.demo-forest.core-40'])
    expect(second.rewards.total.researchData).toBe(55)
    expect(second.rewards.total.catalysts).toEqual([
      { catalystId: 'catalyst.demo-core', amount: 1 },
      { catalystId: 'catalyst.demo-forest', amount: 1 },
    ])

    const duplicate = settleStageBattle(second.playerData, result, T038_PLAYER_CATALOG, {
      settlementId: 'battle.test.2b',
      stageId: T038_STAGE.stageId,
      bonusRollBasisPoints: 0,
    })
    expect(duplicate.alreadySettled).toBe(true)
    expect(duplicate.playerData.economy).toEqual(second.playerData.economy)
    expect(duplicate.rewards.total).toEqual({
      currency: 0,
      researchData: 0,
      catalysts: [],
    })
  })
})
