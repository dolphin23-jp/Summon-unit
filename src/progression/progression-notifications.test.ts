import { describe, expect, it } from 'vitest'
import {
  T039_FOREST_NORMAL,
  T039_INITIAL_PLAYER_DATA,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import {
  createCurrentProgressionNotifications,
  deriveProgressionNotifications,
} from './progression-notifications'

describe('progression notifications', () => {
  it('surfaces currently actionable bloom research', () => {
    const notifications = createCurrentProgressionNotifications(
      T039_INITIAL_PLAYER_DATA,
      T039_PLAYER_CATALOG,
    )
    expect(notifications).toContainEqual(
      expect.objectContaining({
        kind: 'BLOOM_AVAILABLE',
        id: 'bloom-available:species.demo-beta:skill.demo-bloom',
        target: 'RESEARCH',
      }),
    )
  })

  it('derives stage, hidden stage, hint, blueprint, bloom, and regional reward updates', () => {
    const after = Object.freeze({
      ...T039_INITIAL_PLAYER_DATA,
      stageProgress: Object.freeze({
        completedStageIds: Object.freeze([T039_FOREST_NORMAL.stageId]),
        settledBattleIds: Object.freeze(['notification-test']),
        regionalPoints: Object.freeze([
          Object.freeze({
            regionId: 'region.demo-forest',
            points: 40,
            claimedRewardIds: Object.freeze(['regional.demo-forest.core-40']),
          }),
        ]),
      }),
      research: Object.freeze({
        nodes: Object.freeze(
          (T039_INITIAL_PLAYER_DATA.research?.nodes ?? []).map((node) =>
            node.nodeId === 'research.demo-zeta'
              ? Object.freeze({
                  ...node,
                  status: 'hinted' as const,
                  disclosureStage: 1 as const,
                  unlockedHintIds: Object.freeze(['hint.demo-zeta-rumor']),
                })
              : node,
          ),
        ),
      }),
      collection: Object.freeze({
        ...T039_INITIAL_PLAYER_DATA.collection,
        speciesStates: Object.freeze(
          T039_INITIAL_PLAYER_DATA.collection.speciesStates.map((state) =>
            state.speciesId === 'species.demo-delta'
              ? Object.freeze({
                  ...state,
                  blueprintUnlocked: true,
                  analysisBasisPoints: 2_000,
                })
              : state,
          ),
        ),
      }),
    })

    const notifications = deriveProgressionNotifications(
      T039_INITIAL_PLAYER_DATA,
      after,
      T039_PLAYER_CATALOG,
    )
    const kinds = notifications.map((notification) => notification.kind)
    expect(kinds).toContain('STAGE_UNLOCKED')
    expect(kinds).toContain('HIDDEN_STAGE_FOUND')
    expect(kinds).toContain('RESEARCH_HINT')
    expect(kinds).toContain('BLUEPRINT_UNLOCKED')
    expect(kinds).toContain('BLOOM_AVAILABLE')
    expect(kinds).toContain('REGIONAL_REWARD')
    expect(new Set(notifications.map((notification) => notification.id)).size).toBe(
      notifications.length,
    )
  })
})
