import type { StageDefinition } from '../progression/stage-model'
import { createStagePlayerData } from '../progression/stage-reward'
import {
  T037_GENERIC_SKILL_COSTS,
  T037_INITIAL_PLAYER_DATA,
  T037_PLAYER_CATALOG,
} from './research-ui-demo'
import { STANDARD_ENEMY_UNITS } from './standard-headless-battle'

const REGION_POINT_REWARDS = Object.freeze([
  Object.freeze({
    rewardId: 'regional.demo-forest.core-40',
    requiredPoints: 40,
    bundle: Object.freeze({
      currency: 0,
      researchData: 20,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 1 }]),
    }),
  }),
  Object.freeze({
    rewardId: 'regional.demo-forest.core-100',
    requiredPoints: 100,
    bundle: Object.freeze({
      currency: 80,
      researchData: 40,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 2 }]),
    }),
  }),
])

export const T038_STAGE: StageDefinition = Object.freeze({
  stageId: 'stage.demo-forest-01',
  regionId: 'region.demo-forest',
  kind: 'NORMAL',
  theme: '遮蔽された後衛',
  secondaryTheme: '危険な前列を崩して射線を通す',
  completionProgressId: 'progress.demo-rumor',
  enemyFormation: Object.freeze({
    units: STANDARD_ENEMY_UNITS,
    aiConfigurations: Object.freeze({
      'enemy.delta': Object.freeze({
        individualStrategy: 'STANDARD',
        teamStrategy: 'FOCUS_FIRE',
      }),
      'enemy.alpha': Object.freeze({
        individualStrategy: 'STANDARD',
        teamStrategy: 'STABLE_CLEAR',
      }),
      'enemy.beta': Object.freeze({
        individualStrategy: 'STANDARD',
        teamStrategy: 'STABLE_CLEAR',
      }),
    }),
  }),
  rewards: Object.freeze({
    guaranteed: Object.freeze({
      currency: 120,
      researchData: 35,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-forest', amount: 1 }]),
    }),
    randomBonuses: Object.freeze([
      Object.freeze({
        rewardId: 'random.demo-forest.core',
        chanceBasisPoints: 2500,
        bundle: Object.freeze({
          currency: 0,
          researchData: 0,
          catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 1 }]),
        }),
      }),
    ]),
    regionalPointGain: 20,
    regionalPointRewards: REGION_POINT_REWARDS,
    analysisGains: Object.freeze([
      Object.freeze({
        speciesId: 'species.demo-alpha',
        source: 'ENEMY_ENCOUNTER',
        amount: 80,
      }),
      Object.freeze({
        speciesId: 'species.demo-beta',
        source: 'ENEMY_ENCOUNTER',
        amount: 80,
      }),
      Object.freeze({
        speciesId: 'species.demo-delta',
        source: 'ENEMY_ENCOUNTER',
        amount: 120,
      }),
    ]),
  }),
  boss: null,
})

export const T038_BOSS_STAGE: StageDefinition = Object.freeze({
  stageId: 'stage.demo-forest-boss',
  regionId: 'region.demo-forest',
  kind: 'BOSS',
  theme: 'HP半減時のフェーズ移行',
  secondaryTheme: '障壁展開後に行動表が変化する',
  completionProgressId: 'progress.demo-forest-boss',
  enemyFormation: Object.freeze({
    units: Object.freeze([
      Object.freeze({
        ...STANDARD_ENEMY_UNITS[0],
        battleUnitId: 'enemy.forest-boss',
        equippedSkillIds: Object.freeze(['skill.demo-generic']),
      }),
    ]),
    aiConfigurations: Object.freeze({
      'enemy.forest-boss': Object.freeze({
        individualStrategy: 'STANDARD',
        teamStrategy: 'FOCUS_FIRE',
      }),
    }),
  }),
  rewards: Object.freeze({
    guaranteed: Object.freeze({
      currency: 260,
      researchData: 90,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 1 }]),
    }),
    randomBonuses: Object.freeze([]),
    regionalPointGain: 40,
    regionalPointRewards: REGION_POINT_REWARDS,
    analysisGains: Object.freeze([
      Object.freeze({
        speciesId: 'species.demo-delta',
        source: 'ENEMY_ENCOUNTER',
        amount: 240,
      }),
    ]),
  }),
  boss: Object.freeze({
    bossBattleUnitId: 'enemy.forest-boss',
    phases: Object.freeze([
      Object.freeze({
        phaseId: 'forest-boss.phase-1',
        enterAtOrBelowHpBasisPoints: 10_000,
        actionSkillIds: Object.freeze(['skill.demo-delta']),
        gimmick: Object.freeze({ type: 'NONE' as const }),
      }),
      Object.freeze({
        phaseId: 'forest-boss.phase-2',
        enterAtOrBelowHpBasisPoints: 5_000,
        actionSkillIds: Object.freeze(['skill.demo-delta', 'skill.demo-generic']),
        gimmick: Object.freeze({ type: 'BARRIER' as const, capacity: 60 }),
      }),
    ]),
  }),
})

export const T038_PLAYER_CATALOG = Object.freeze({
  ...T037_PLAYER_CATALOG,
  stages: Object.freeze([T038_STAGE, T038_BOSS_STAGE]),
})

export const T038_GENERIC_SKILL_COSTS = T037_GENERIC_SKILL_COSTS

export const T038_INITIAL_PLAYER_DATA = createStagePlayerData(
  {
    ...T037_INITIAL_PLAYER_DATA,
    schemaVersion: 5,
    gameVersion: '0.0.0-t038',
    contentVersion: 'demo-t038',
    stageProgress: {
      completedStageIds: [],
      settledBattleIds: [],
      regionalPoints: [],
    },
    research: {
      nodes: (T037_INITIAL_PLAYER_DATA.research?.nodes ?? []).map((node) =>
        node.nodeId === 'research.demo-zeta'
          ? {
              ...node,
              status: 'hidden' as const,
              disclosureStage: 0 as const,
              unlockedHintIds: [],
            }
          : node,
      ),
    },
  },
  T038_PLAYER_CATALOG,
)
