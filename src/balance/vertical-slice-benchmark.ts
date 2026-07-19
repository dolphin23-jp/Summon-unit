import type { AiDecisionConfiguration } from '../ai/strategy-presets'
import type { HeadlessBattleUnitDefinition } from '../battle/headless-battle-runner'
import type { BattleUnitId } from '../battle/unit-state'

export const VERTICAL_SLICE_BALANCE_REPORT_VERSION = 1
export const VERTICAL_SLICE_BALANCE_MAX_ACTIONS = 500

export type VerticalSliceBalanceBand = 'INTRO' | 'REGION_A' | 'REGION_B'

export interface VerticalSliceBenchmarkProfile {
  readonly profileId: string
  readonly label: string
  readonly band: VerticalSliceBalanceBand
  readonly units: readonly HeadlessBattleUnitDefinition[]
  readonly aiConfigurations: Readonly<Record<BattleUnitId, AiDecisionConfiguration>>
}

export interface VerticalSliceStageBalanceMetrics {
  readonly stageId: string
  readonly band: VerticalSliceBalanceBand
  readonly samples: number
  readonly allyVictories: number
  readonly allyDefeats: number
  readonly draws: number
  readonly winRateBasisPoints: number
  readonly timeoutRateBasisPoints: number
  readonly meanVirtualTime: number
  readonly meanActions: number
  readonly skillActionRateBasisPoints: number
  readonly movementRateBasisPoints: number
  readonly overkillRateBasisPoints: number
}

export interface VerticalSliceSkillUsageMetric {
  readonly skillId: string
  readonly uses: number
  readonly selectionRateBasisPoints: number
}

export interface VerticalSliceSpeciesContributionMetric {
  readonly side: 'ALLY' | 'ENEMY'
  readonly speciesId: string
  readonly speed: number
  readonly actions: number
  readonly appliedDamage: number
  readonly healing: number
  readonly redirectedDamage: number
  readonly barrierAbsorbed: number
  readonly totalActionValue: number
  readonly actionValuePerActionPermille: number
}

export interface VerticalSliceSpeedValueMetric {
  readonly speed: number
  readonly unitsObserved: number
  readonly actions: number
  readonly totalActionValue: number
  readonly actionValuePerActionPermille: number
}

export interface VerticalSliceBalanceReport {
  readonly reportVersion: typeof VERTICAL_SLICE_BALANCE_REPORT_VERSION
  readonly deterministic: true
  readonly sampleMatrix: {
    readonly profiles: number
    readonly profilesPerStage: number
    readonly stages: number
    readonly battles: number
  }
  readonly capabilities: {
    readonly healingResolutionAvailable: false
    readonly overhealRateBasisPoints: null
    readonly note: string
  }
  readonly overall: Omit<VerticalSliceStageBalanceMetrics, 'stageId' | 'band'>
  readonly stages: readonly VerticalSliceStageBalanceMetrics[]
  readonly skills: readonly VerticalSliceSkillUsageMetric[]
  readonly speciesContributions: readonly VerticalSliceSpeciesContributionMetric[]
  readonly speedValues: readonly VerticalSliceSpeedValueMetric[]
  readonly warnings: readonly string[]
}

function makeUnit(
  battleUnitId: string,
  speciesId: string,
  row: 0 | 1 | 2,
  column: 0 | 1 | 2,
  tiePriority: number,
  equippedSkillIds: readonly string[] = [],
): HeadlessBattleUnitDefinition {
  return Object.freeze({
    battleUnitId,
    speciesId,
    position: Object.freeze({ side: 'ALLY' as const, row, column }),
    equippedSkillIds: Object.freeze([...equippedSkillIds]),
    tiePriority,
  })
}

function makeAi(
  individualStrategy: AiDecisionConfiguration['individualStrategy'],
  teamStrategy: AiDecisionConfiguration['teamStrategy'],
): AiDecisionConfiguration {
  return Object.freeze({ individualStrategy, teamStrategy, skillPolicies: Object.freeze([]) })
}

function makeProfile(input: VerticalSliceBenchmarkProfile): VerticalSliceBenchmarkProfile {
  return Object.freeze({
    ...input,
    units: Object.freeze([...input.units]),
    aiConfigurations: Object.freeze({ ...input.aiConfigurations }),
  })
}

const LIGHT = Object.freeze(['skill.slice.generic.light-strike'])
const LONG = Object.freeze(['skill.slice.generic.long-shot'])
const IMPACT = Object.freeze(['skill.slice.generic.impact'])

export const VERTICAL_SLICE_BENCHMARK_PROFILES: readonly VerticalSliceBenchmarkProfile[] =
  Object.freeze([
    makeProfile({
      profileId: 'profile.intro-balanced',
      label: 'R1標準配置',
      band: 'INTRO',
      units: [
        makeUnit('ally.intro.grassfang', 'species.slice.grassfang-rat', 0, 0, 0, LIGHT),
        makeUnit('ally.intro.ember', 'species.slice.ember-gecko', 1, 0, 1, LIGHT),
        makeUnit('ally.intro.windwing', 'species.slice.windwing-midge', 2, 1, 2, LONG),
      ],
      aiConfigurations: {
        'ally.intro.grassfang': makeAi('ASSAULT', 'FAST_KILL'),
        'ally.intro.ember': makeAi('STANDARD', 'STABLE_CLEAR'),
        'ally.intro.windwing': makeAi('FIXED_TURRET', 'STABLE_CLEAR'),
      },
    }),
    makeProfile({
      profileId: 'profile.intro-spread',
      label: 'R1分散配置',
      band: 'INTRO',
      units: [
        makeUnit('ally.intro-spread.grassfang', 'species.slice.grassfang-rat', 0, 0, 0),
        makeUnit('ally.intro-spread.ember', 'species.slice.ember-gecko', 1, 1, 1),
        makeUnit('ally.intro-spread.windwing', 'species.slice.windwing-midge', 2, 2, 2, LONG),
      ],
      aiConfigurations: {
        'ally.intro-spread.grassfang': makeAi('ASSAULT', 'FAST_KILL'),
        'ally.intro-spread.ember': makeAi('POSITIONAL', 'STABLE_CLEAR'),
        'ally.intro-spread.windwing': makeAi('POSITIONAL', 'STABLE_CLEAR'),
      },
    }),
    makeProfile({
      profileId: 'profile.intro-cover',
      label: 'R1遮蔽配置',
      band: 'INTRO',
      units: [
        makeUnit('ally.intro-cover.mudshell', 'species.slice.mudshell-beetle', 0, 1, 0, LIGHT),
        makeUnit('ally.intro-cover.grassfang', 'species.slice.grassfang-rat', 1, 0, 1),
        makeUnit('ally.intro-cover.windwing', 'species.slice.windwing-midge', 2, 1, 2, LONG),
      ],
      aiConfigurations: {
        'ally.intro-cover.mudshell': makeAi('CAUTIOUS', 'STABLE_CLEAR'),
        'ally.intro-cover.grassfang': makeAi('ASSAULT', 'FAST_KILL'),
        'ally.intro-cover.windwing': makeAi('FIXED_TURRET', 'STABLE_CLEAR'),
      },
    }),
    makeProfile({
      profileId: 'profile.region-a-mobile',
      label: '地域A機動班',
      band: 'REGION_A',
      units: [
        makeUnit('ally.a-mobile.gale', 'species.slice.gale-wolf', 0, 0, 0),
        makeUnit('ally.a-mobile.ironhorn', 'species.slice.ironhorn-beast', 1, 0, 1, IMPACT),
        makeUnit('ally.a-mobile.spark', 'species.slice.spark-bird', 2, 1, 2, LONG),
      ],
      aiConfigurations: {
        'ally.a-mobile.gale': makeAi('POSITIONAL', 'FAST_KILL'),
        'ally.a-mobile.ironhorn': makeAi('ASSAULT', 'FAST_KILL'),
        'ally.a-mobile.spark': makeAi('POSITIONAL', 'STABLE_CLEAR'),
      },
    }),
    makeProfile({
      profileId: 'profile.region-a-control',
      label: '地域A制御班',
      band: 'REGION_A',
      units: [
        makeUnit('ally.a-control.rock', 'species.slice.rock-carapace', 0, 1, 0, LIGHT),
        makeUnit('ally.a-control.venom', 'species.slice.venom-moth', 1, 0, 1, LONG),
        makeUnit('ally.a-control.spark', 'species.slice.spark-bird', 2, 2, 2, LONG),
      ],
      aiConfigurations: {
        'ally.a-control.rock': makeAi('CAUTIOUS', 'LOSS_MINIMIZATION'),
        'ally.a-control.venom': makeAi('CAUTIOUS', 'STABLE_CLEAR'),
        'ally.a-control.spark': makeAi('POSITIONAL', 'FAST_KILL'),
      },
    }),
    makeProfile({
      profileId: 'profile.region-a-r1-plus',
      label: '地域A低レア班',
      band: 'REGION_A',
      units: [
        makeUnit('ally.a-r1.grassfang', 'species.slice.grassfang-rat', 0, 0, 0),
        makeUnit('ally.a-r1.ember', 'species.slice.ember-gecko', 1, 0, 1),
        makeUnit('ally.a-r1.windwing', 'species.slice.windwing-midge', 2, 1, 2, LONG),
        makeUnit('ally.a-r1.mudshell', 'species.slice.mudshell-beetle', 0, 2, 3, LIGHT),
      ],
      aiConfigurations: {
        'ally.a-r1.grassfang': makeAi('ASSAULT', 'FAST_KILL'),
        'ally.a-r1.ember': makeAi('STANDARD', 'STABLE_CLEAR'),
        'ally.a-r1.windwing': makeAi('FIXED_TURRET', 'STABLE_CLEAR'),
        'ally.a-r1.mudshell': makeAi('CAUTIOUS', 'LOSS_MINIMIZATION'),
      },
    }),
    makeProfile({
      profileId: 'profile.region-b-assault',
      label: '地域B攻撃班',
      band: 'REGION_B',
      units: [
        makeUnit('ally.b-assault.molten', 'species.slice.molten-carapace', 0, 1, 0, IMPACT),
        makeUnit('ally.b-assault.ironhorn', 'species.slice.ironhorn-beast', 1, 0, 1, IMPACT),
        makeUnit('ally.b-assault.flame', 'species.slice.flame-automaton', 2, 1, 2, LONG),
        makeUnit('ally.b-assault.spark', 'species.slice.spark-bird', 1, 2, 3, LONG),
      ],
      aiConfigurations: {
        'ally.b-assault.molten': makeAi('CAUTIOUS', 'STABLE_CLEAR'),
        'ally.b-assault.ironhorn': makeAi('ASSAULT', 'FAST_KILL'),
        'ally.b-assault.flame': makeAi('FIXED_TURRET', 'FAST_KILL'),
        'ally.b-assault.spark': makeAi('POSITIONAL', 'FAST_KILL'),
      },
    }),
    makeProfile({
      profileId: 'profile.region-b-control',
      label: '地域B制御班',
      band: 'REGION_B',
      units: [
        makeUnit('ally.b-control.rock', 'species.slice.rock-carapace', 0, 0, 0, LIGHT),
        makeUnit('ally.b-control.gale', 'species.slice.gale-wolf', 1, 0, 1),
        makeUnit('ally.b-control.venom', 'species.slice.venom-moth', 2, 1, 2, LONG),
        makeUnit('ally.b-control.flame', 'species.slice.flame-automaton', 2, 2, 3, LONG),
      ],
      aiConfigurations: {
        'ally.b-control.rock': makeAi('CAUTIOUS', 'LOSS_MINIMIZATION'),
        'ally.b-control.gale': makeAi('POSITIONAL', 'STABLE_CLEAR'),
        'ally.b-control.venom': makeAi('CAUTIOUS', 'STABLE_CLEAR'),
        'ally.b-control.flame': makeAi('FIXED_TURRET', 'FAST_KILL'),
      },
    }),
    makeProfile({
      profileId: 'profile.region-b-midrarity',
      label: '地域B中レア班',
      band: 'REGION_B',
      units: [
        makeUnit('ally.b-mid.ironhorn', 'species.slice.ironhorn-beast', 0, 0, 0, IMPACT),
        makeUnit('ally.b-mid.gale', 'species.slice.gale-wolf', 1, 0, 1),
        makeUnit('ally.b-mid.spark', 'species.slice.spark-bird', 2, 1, 2, LONG),
        makeUnit('ally.b-mid.venom', 'species.slice.venom-moth', 1, 2, 3, LONG),
      ],
      aiConfigurations: {
        'ally.b-mid.ironhorn': makeAi('ASSAULT', 'FAST_KILL'),
        'ally.b-mid.gale': makeAi('POSITIONAL', 'FAST_KILL'),
        'ally.b-mid.spark': makeAi('POSITIONAL', 'STABLE_CLEAR'),
        'ally.b-mid.venom': makeAi('CAUTIOUS', 'STABLE_CLEAR'),
      },
    }),
  ])
