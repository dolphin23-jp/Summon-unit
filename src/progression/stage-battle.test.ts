import { describe, expect, it } from 'vitest'
import {
  T039_FOREST_NORMAL,
  T039_INITIAL_PLAYER_DATA,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import { runInstantStageSimulation } from './stage-battle'

const CLEARED_PLAYER = Object.freeze({
  ...T039_INITIAL_PLAYER_DATA,
  stageProgress: Object.freeze({
    completedStageIds: Object.freeze([T039_FOREST_NORMAL.stageId]),
    settledBattleIds: Object.freeze([]),
    regionalPoints: Object.freeze([
      Object.freeze({
        regionId: 'region.demo-forest',
        points: 20,
        claimedRewardIds: Object.freeze([]),
      }),
    ]),
  }),
})

describe('instant stage simulation', () => {
  it('rejects stages that have not been cleared', () => {
    expect(() =>
      runInstantStageSimulation(T039_INITIAL_PLAYER_DATA, T039_PLAYER_CATALOG, {
        stageId: T039_FOREST_NORMAL.stageId,
        formationId: 'formation.main',
        settlementId: 'simulation.locked',
        bonusRollBasisPoints: 0,
      }),
    ).toThrow('instant simulation requires a cleared stage')
  })

  it('reuses the headless runner and produces byte-identical deterministic results', () => {
    const run = () =>
      runInstantStageSimulation(CLEARED_PLAYER, T039_PLAYER_CATALOG, {
        stageId: T039_FOREST_NORMAL.stageId,
        formationId: 'formation.main',
        settlementId: 'simulation.demo-1',
        bonusRollBasisPoints: 1_234,
      }, {
        initialActionCost: 100,
        maxActions: 300,
      })

    const first = run()
    const firstJson = JSON.stringify(first)
    expect(first.definition.units.filter((unit) => unit.position.side === 'ENEMY')).toEqual(
      T039_FOREST_NORMAL.enemyFormation.units,
    )
    expect(first.settlement.settlementId).toBe('simulation.demo-1')
    expect(first.settlement.playerData.stageProgress?.settledBattleIds).toContain(
      'simulation.demo-1',
    )

    for (let index = 0; index < 20; index += 1) {
      expect(JSON.stringify(run())).toBe(firstJson)
    }
  })
})
