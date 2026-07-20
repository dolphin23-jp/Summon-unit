import type { RegionDefinition } from '../progression/region-progression'
import type { StageDefinition } from '../progression/stage-model'
import { createStagePlayerData } from '../progression/stage-reward'
import {
  T038_BOSS_STAGE,
  T038_GENERIC_SKILL_COSTS,
  T038_INITIAL_PLAYER_DATA,
  T038_PLAYER_CATALOG,
  T038_STAGE,
} from './stage-reward-demo'
import { STANDARD_ENEMY_UNITS } from './standard-headless-battle'

const FOREST_POINT_REWARDS = T038_STAGE.rewards.regionalPointRewards

const RUINS_POINT_REWARDS = Object.freeze([
  Object.freeze({
    rewardId: 'regional.demo-ruins.data-30',
    requiredPoints: 30,
    bundle: Object.freeze({
      currency: 60,
      researchData: 30,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 1 }]),
    }),
  }),
])

export const T039_REGIONS: readonly RegionDefinition[] = Object.freeze([
  Object.freeze({
    regionId: 'region.demo-forest',
    name: '翠風の観測林',
    summary: '遮蔽、射線、優先撃破を学ぶ導入地域です。',
    themeColor: '#55b889',
    order: 1,
    requirement: Object.freeze({ type: 'ALWAYS' as const }),
    hideUntilUnlocked: false,
  }),
  Object.freeze({
    regionId: 'region.demo-ruins',
    name: '灰燼機構跡',
    summary: '地域ボス撃破後に開く、次地域の先行観測区画です。',
    themeColor: '#a97962',
    order: 2,
    requirement: Object.freeze({
      type: 'STAGE_COMPLETED' as const,
      stageId: 'stage.demo-forest-boss',
    }),
    hideUntilUnlocked: false,
  }),
])

export const T039_FOREST_NORMAL: StageDefinition = Object.freeze({
  ...T038_STAGE,
  access: Object.freeze({
    order: 1,
    requirement: Object.freeze({ type: 'ALWAYS' as const }),
    hideUntilUnlocked: false,
  }),
})

export const T039_FOREST_ELITE: StageDefinition = Object.freeze({
  stageId: 'stage.demo-forest-elite',
  regionId: 'region.demo-forest',
  kind: 'ELITE',
  theme: '高速個体による集中攻撃',
  secondaryTheme: '守備役を維持しながら危険個体を先に落とす',
  completionProgressId: 'progress.demo-forest-elite',
  access: Object.freeze({
    order: 2,
    requirement: Object.freeze({
      type: 'STAGE_COMPLETED' as const,
      stageId: T039_FOREST_NORMAL.stageId,
    }),
    hideUntilUnlocked: false,
  }),
  enemyFormation: Object.freeze({
    units: Object.freeze(
      STANDARD_ENEMY_UNITS.map((unit, index) =>
        Object.freeze({
          ...unit,
          battleUnitId: `enemy.elite-${index + 1}`,
          equippedSkillIds: index === 0 ? Object.freeze(['skill.demo-generic-rush']) : undefined,
        }),
      ),
    ),
    aiConfigurations: Object.freeze({
      'enemy.elite-1': Object.freeze({
        individualStrategy: 'ASSAULT',
        teamStrategy: 'FAST_KILL',
      }),
      'enemy.elite-2': Object.freeze({
        individualStrategy: 'POSITIONAL',
        teamStrategy: 'FAST_KILL',
      }),
      'enemy.elite-3': Object.freeze({
        individualStrategy: 'CAUTIOUS',
        teamStrategy: 'STABLE_CLEAR',
      }),
    }),
  }),
  rewards: Object.freeze({
    guaranteed: Object.freeze({
      currency: 170,
      researchData: 50,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-forest', amount: 1 }]),
    }),
    randomBonuses: Object.freeze([
      Object.freeze({
        rewardId: 'random.demo-forest-elite.core',
        chanceBasisPoints: 3500,
        bundle: Object.freeze({
          currency: 30,
          researchData: 0,
          catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 1 }]),
        }),
      }),
    ]),
    regionalPointGain: 20,
    regionalPointRewards: FOREST_POINT_REWARDS,
    analysisGains: Object.freeze([
      Object.freeze({
        speciesId: 'species.demo-alpha',
        source: 'ENEMY_ENCOUNTER',
        amount: 120,
      }),
      Object.freeze({
        speciesId: 'species.demo-delta',
        source: 'ENEMY_ENCOUNTER',
        amount: 160,
      }),
    ]),
  }),
  boss: null,
})

export const T039_FOREST_BOSS: StageDefinition = Object.freeze({
  ...T038_BOSS_STAGE,
  access: Object.freeze({
    order: 3,
    requirement: Object.freeze({
      type: 'STAGE_COMPLETED' as const,
      stageId: T039_FOREST_ELITE.stageId,
    }),
    hideUntilUnlocked: false,
  }),
})

export const T039_FOREST_HIDDEN: StageDefinition = Object.freeze({
  stageId: 'stage.demo-forest-hidden',
  regionId: 'region.demo-forest',
  kind: 'HIDDEN',
  theme: '観測記録にない迂回路',
  secondaryTheme: '地域ポイントを積み、隠れた強敵の兆候を発見する',
  completionProgressId: 'progress.demo-forest-hidden',
  access: Object.freeze({
    order: 4,
    requirement: Object.freeze({
      type: 'REGION_POINTS' as const,
      regionId: 'region.demo-forest',
      points: 40,
    }),
    hideUntilUnlocked: true,
  }),
  enemyFormation: Object.freeze({
    units: Object.freeze([
      Object.freeze({
        ...STANDARD_ENEMY_UNITS[1],
        battleUnitId: 'enemy.hidden-alpha',
        equippedSkillIds: Object.freeze(['skill.demo-generic-focus']),
      }),
      Object.freeze({
        ...STANDARD_ENEMY_UNITS[0],
        battleUnitId: 'enemy.hidden-delta',
      }),
    ]),
    aiConfigurations: Object.freeze({
      'enemy.hidden-alpha': Object.freeze({
        individualStrategy: 'FIXED_TURRET',
        teamStrategy: 'FAST_KILL',
      }),
      'enemy.hidden-delta': Object.freeze({
        individualStrategy: 'CAUTIOUS',
        teamStrategy: 'LOSS_MINIMIZATION',
      }),
    }),
  }),
  rewards: Object.freeze({
    guaranteed: Object.freeze({
      currency: 210,
      researchData: 75,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 1 }]),
    }),
    randomBonuses: Object.freeze([]),
    regionalPointGain: 25,
    regionalPointRewards: FOREST_POINT_REWARDS,
    analysisGains: Object.freeze([
      Object.freeze({
        speciesId: 'species.demo-alpha',
        source: 'SKILL_OBSERVATION',
        amount: 180,
      }),
      Object.freeze({
        speciesId: 'species.demo-delta',
        source: 'ENEMY_ENCOUNTER',
        amount: 180,
      }),
    ]),
  }),
  boss: null,
})

export const T039_RUINS_NORMAL: StageDefinition = Object.freeze({
  stageId: 'stage.demo-ruins-01',
  regionId: 'region.demo-ruins',
  kind: 'NORMAL',
  theme: '次地域の先行観測',
  secondaryTheme: '地域解放条件と複数地域の選択を確認する',
  completionProgressId: 'progress.demo-ruins-entry',
  access: Object.freeze({
    order: 1,
    requirement: Object.freeze({ type: 'ALWAYS' as const }),
    hideUntilUnlocked: false,
  }),
  enemyFormation: Object.freeze({
    units: Object.freeze([
      Object.freeze({
        ...STANDARD_ENEMY_UNITS[2],
        battleUnitId: 'enemy.ruins-beta',
      }),
      Object.freeze({
        ...STANDARD_ENEMY_UNITS[1],
        battleUnitId: 'enemy.ruins-alpha',
      }),
    ]),
    aiConfigurations: Object.freeze({
      'enemy.ruins-beta': Object.freeze({
        individualStrategy: 'CAUTIOUS',
        teamStrategy: 'STABLE_CLEAR',
      }),
      'enemy.ruins-alpha': Object.freeze({
        individualStrategy: 'ASSAULT',
        teamStrategy: 'FAST_KILL',
      }),
    }),
  }),
  rewards: Object.freeze({
    guaranteed: Object.freeze({
      currency: 190,
      researchData: 65,
      catalysts: Object.freeze([{ catalystId: 'catalyst.demo-core', amount: 1 }]),
    }),
    randomBonuses: Object.freeze([]),
    regionalPointGain: 30,
    regionalPointRewards: RUINS_POINT_REWARDS,
    analysisGains: Object.freeze([
      Object.freeze({
        speciesId: 'species.demo-alpha',
        source: 'ENEMY_ENCOUNTER',
        amount: 100,
      }),
      Object.freeze({
        speciesId: 'species.demo-beta',
        source: 'ENEMY_ENCOUNTER',
        amount: 140,
      }),
    ]),
  }),
  boss: null,
})

export const T039_STAGES: readonly StageDefinition[] = Object.freeze([
  T039_FOREST_NORMAL,
  T039_FOREST_ELITE,
  T039_FOREST_BOSS,
  T039_FOREST_HIDDEN,
  T039_RUINS_NORMAL,
])

export const T039_PLAYER_CATALOG = Object.freeze({
  ...T038_PLAYER_CATALOG,
  regions: T039_REGIONS,
  stages: T039_STAGES,
})

export const T039_GENERIC_SKILL_COSTS = T038_GENERIC_SKILL_COSTS

export const T039_INITIAL_PLAYER_DATA = createStagePlayerData(
  {
    ...T038_INITIAL_PLAYER_DATA,
    schemaVersion: 6,
    gameVersion: '0.0.0-t039',
    contentVersion: 'demo-t039',
    stageProgress: {
      completedStageIds: [],
      settledBattleIds: [],
      regionalPoints: [],
    },
  },
  T039_PLAYER_CATALOG,
)
