import { describe, expect, it } from 'vitest'
import {
  T039_FOREST_BOSS,
  T039_FOREST_ELITE,
  T039_FOREST_HIDDEN,
  T039_FOREST_NORMAL,
  T039_INITIAL_PLAYER_DATA,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import {
  getRegionAccessState,
  getStageAccessState,
  getUnlockedStageIds,
  normalizeRegionProgression,
} from './region-progression'

function withProgress(input: {
  completedStageIds?: readonly string[]
  forestPoints?: number
}) {
  return Object.freeze({
    ...T039_INITIAL_PLAYER_DATA,
    stageProgress: Object.freeze({
      completedStageIds: Object.freeze([...(input.completedStageIds ?? [])]),
      settledBattleIds: Object.freeze([]),
      regionalPoints:
        input.forestPoints === undefined
          ? Object.freeze([])
          : Object.freeze([
              Object.freeze({
                regionId: 'region.demo-forest',
                points: input.forestPoints,
                claimedRewardIds: Object.freeze([]),
              }),
            ]),
    }),
  })
}

describe('region progression', () => {
  it('orders regions and stages and hides the secret until its point condition is met', () => {
    const progression = normalizeRegionProgression(T039_PLAYER_CATALOG)
    expect(progression.regions.map((region) => region.regionId)).toEqual([
      'region.demo-forest',
      'region.demo-ruins',
    ])
    expect(progression.stages.slice(0, 4).map((stage) => stage.stageId)).toEqual([
      T039_FOREST_NORMAL.stageId,
      T039_FOREST_ELITE.stageId,
      T039_FOREST_BOSS.stageId,
      T039_FOREST_HIDDEN.stageId,
    ])

    expect(getStageAccessState(T039_INITIAL_PLAYER_DATA, T039_FOREST_NORMAL)).toMatchObject({
      unlocked: true,
      visible: true,
    })
    expect(getStageAccessState(T039_INITIAL_PLAYER_DATA, T039_FOREST_ELITE)).toMatchObject({
      unlocked: false,
      visible: true,
    })
    expect(getStageAccessState(T039_INITIAL_PLAYER_DATA, T039_FOREST_HIDDEN)).toMatchObject({
      unlocked: false,
      visible: false,
    })
  })

  it('unlocks elite, hidden, boss, and the second region from deterministic progress', () => {
    const afterNormal = withProgress({ completedStageIds: [T039_FOREST_NORMAL.stageId] })
    expect(getStageAccessState(afterNormal, T039_FOREST_ELITE).unlocked).toBe(true)

    const afterEliteAndPoints = withProgress({
      completedStageIds: [T039_FOREST_NORMAL.stageId, T039_FOREST_ELITE.stageId],
      forestPoints: 40,
    })
    expect(getStageAccessState(afterEliteAndPoints, T039_FOREST_BOSS).unlocked).toBe(true)
    expect(getStageAccessState(afterEliteAndPoints, T039_FOREST_HIDDEN)).toMatchObject({
      unlocked: true,
      visible: true,
    })

    const afterBoss = withProgress({
      completedStageIds: [
        T039_FOREST_NORMAL.stageId,
        T039_FOREST_ELITE.stageId,
        T039_FOREST_BOSS.stageId,
      ],
      forestPoints: 80,
    })
    const ruins = normalizeRegionProgression(T039_PLAYER_CATALOG).regions.find(
      (region) => region.regionId === 'region.demo-ruins',
    )
    expect(ruins).toBeDefined()
    if (ruins === undefined) throw new Error('ruins region is missing')
    expect(getRegionAccessState(afterBoss, ruins).unlocked).toBe(true)
    expect(getUnlockedStageIds(afterBoss, T039_PLAYER_CATALOG)).toContain(
      'stage.demo-ruins-01',
    )
  })
})
