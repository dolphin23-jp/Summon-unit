import type { AiDecisionConfiguration } from '../ai/strategy-presets'
import {
  runHeadlessBattle,
  type HeadlessBattleDefinition,
  type HeadlessBattleRunResult,
  type HeadlessBattleUnitDefinition,
} from '../battle/headless-battle-runner'
import type { BattleUnitId } from '../battle/unit-state'
import type { MonsterSpecies } from '../content/monster-species'
import {
  VERTICAL_SLICE_STAGE_RECORDS,
  VERTICAL_SLICE_WORLD_CATALOG,
  type VerticalSliceStageRecord,
} from '../content/vertical-slice-world'

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

interface Sample {
  readonly outcome: HeadlessBattleRunResult['summary']['outcome']
  readonly termination: HeadlessBattleRunResult['summary']['termination']
  readonly virtualTime: number
  readonly actions: number
  readonly skillUses: number
  readonly moves: number
  readonly calculatedDamage: number
  readonly overkillDamage: number
}

interface MutableContribution {
  readonly side: 'ALLY' | 'ENEMY'
  readonly speciesId: string
  readonly speed: number
  actions: number
  appliedDamage: number
  redirectedDamage: number
  barrierAbsorbed: number
}

function basisPoints(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator * 10_000) / denominator)
}

function mean(total: number, count: number): number {
  return count === 0 ? 0 : Math.round(total / count)
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
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

function stageBand(record: VerticalSliceStageRecord): VerticalSliceBalanceBand {
  if (record.definition.regionId === 'region.slice-b') return 'REGION_B'
  return (record.definition.access?.order ?? 1) <= 3 ? 'INTRO' : 'REGION_A'
}

function profilesFor(record: VerticalSliceStageRecord): readonly VerticalSliceBenchmarkProfile[] {
  const band = stageBand(record)
  return VERTICAL_SLICE_BENCHMARK_PROFILES.filter((profile) => profile.band === band)
}

function battleDefinition(
  record: VerticalSliceStageRecord,
  profile: VerticalSliceBenchmarkProfile,
): HeadlessBattleDefinition {
  return Object.freeze({
    species: VERTICAL_SLICE_WORLD_CATALOG.species,
    skills: VERTICAL_SLICE_WORLD_CATALOG.skills,
    units: Object.freeze([...profile.units, ...record.definition.enemyFormation.units]),
    aiConfigurations: Object.freeze({
      ...record.definition.enemyFormation.aiConfigurations,
      ...profile.aiConfigurations,
    }),
    boss: record.definition.boss ?? undefined,
    initialActionCost: 100,
    maxActions: VERTICAL_SLICE_BALANCE_MAX_ACTIONS,
  })
}

function speciesByUnit(definition: HeadlessBattleDefinition): ReadonlyMap<string, MonsterSpecies> {
  const byId = new Map(definition.species.map((species) => [species.id, species]))
  const entries: Array<readonly [string, MonsterSpecies]> = definition.units.map((unit) => {
    const species = byId.get(unit.speciesId)
    if (species === undefined) throw new Error(`benchmark species is missing: ${unit.speciesId}`)
    return [unit.battleUnitId, species] as const
  })
  return new Map(entries)
}

function getContribution(
  contributions: Map<string, MutableContribution>,
  side: 'ALLY' | 'ENEMY',
  species: MonsterSpecies,
): MutableContribution {
  const key = `${side}\u0000${species.id}`
  const existing = contributions.get(key)
  if (existing !== undefined) return existing
  const created: MutableContribution = {
    side,
    speciesId: species.id,
    speed: species.stats.speed,
    actions: 0,
    appliedDamage: 0,
    redirectedDamage: 0,
    barrierAbsorbed: 0,
  }
  contributions.set(key, created)
  return created
}

function collectSample(
  definition: HeadlessBattleDefinition,
  result: HeadlessBattleRunResult,
  skillUses: Map<string, number>,
  contributions: Map<string, MutableContribution>,
): Sample {
  const speciesMap = speciesByUnit(definition)
  const sideMap = new Map(definition.units.map((unit) => [unit.battleUnitId, unit.position.side]))
  let usedSkills = 0
  let moves = 0
  let calculatedDamage = 0
  let overkillDamage = 0

  for (const event of result.log.events) {
    if (event.kind === 'skill_used') {
      usedSkills += 1
      skillUses.set(event.payload.skillId, (skillUses.get(event.payload.skillId) ?? 0) + 1)
    } else if (event.kind === 'unit_moved') {
      moves += 1
    } else if (event.kind === 'damage_applied') {
      calculatedDamage += event.payload.calculatedDamage
      overkillDamage += Math.max(0, event.payload.calculatedDamage - event.payload.appliedDamage)
      const sourceId = event.payload.sourceBattleUnitId
      const species = sourceId === null ? undefined : speciesMap.get(sourceId)
      const side = sourceId === null ? undefined : sideMap.get(sourceId)
      if (species !== undefined && side !== undefined) {
        getContribution(contributions, side, species).appliedDamage += event.payload.appliedDamage
      }
    } else if (event.kind === 'guard_shared') {
      const species = speciesMap.get(event.payload.guardBattleUnitId)
      const side = sideMap.get(event.payload.guardBattleUnitId)
      if (species !== undefined && side !== undefined) {
        getContribution(contributions, side, species).redirectedDamage += event.payload.redirectedDamage
      }
    } else if (event.kind === 'barrier_absorbed') {
      const species = speciesMap.get(event.payload.targetBattleUnitId)
      const side = sideMap.get(event.payload.targetBattleUnitId)
      if (species !== undefined && side !== undefined) {
        getContribution(contributions, side, species).barrierAbsorbed += event.payload.absorbedDamage
      }
    }
  }

  for (const summary of result.summary.units) {
    const species = speciesMap.get(summary.battleUnitId)
    if (species !== undefined) {
      getContribution(contributions, summary.side, species).actions += summary.actionCount
    }
  }

  return Object.freeze({
    outcome: result.summary.outcome,
    termination: result.summary.termination,
    virtualTime: result.summary.finalVirtualTime,
    actions: result.summary.totalActions,
    skillUses: usedSkills,
    moves,
    calculatedDamage,
    overkillDamage,
  })
}

function metrics(samples: readonly Sample[]): Omit<VerticalSliceStageBalanceMetrics, 'stageId' | 'band'> {
  const allyVictories = samples.filter((sample) => sample.outcome === 'ALLY_VICTORY').length
  const allyDefeats = samples.filter((sample) => sample.outcome === 'ALLY_DEFEAT').length
  const draws = samples.length - allyVictories - allyDefeats
  const actions = samples.reduce((total, sample) => total + sample.actions, 0)
  const skills = samples.reduce((total, sample) => total + sample.skillUses, 0)
  const moves = samples.reduce((total, sample) => total + sample.moves, 0)
  const calculatedDamage = samples.reduce((total, sample) => total + sample.calculatedDamage, 0)
  const overkillDamage = samples.reduce((total, sample) => total + sample.overkillDamage, 0)
  return Object.freeze({
    samples: samples.length,
    allyVictories,
    allyDefeats,
    draws,
    winRateBasisPoints: basisPoints(allyVictories, samples.length),
    timeoutRateBasisPoints: basisPoints(
      samples.filter((sample) => sample.termination === 'ACTION_LIMIT_REACHED').length,
      samples.length,
    ),
    meanVirtualTime: mean(
      samples.reduce((total, sample) => total + sample.virtualTime, 0),
      samples.length,
    ),
    meanActions: mean(actions, samples.length),
    skillActionRateBasisPoints: basisPoints(skills, actions),
    movementRateBasisPoints: basisPoints(moves, actions),
    overkillRateBasisPoints: basisPoints(overkillDamage, calculatedDamage),
  })
}

function freezeContributions(
  mutable: ReadonlyMap<string, MutableContribution>,
): readonly VerticalSliceSpeciesContributionMetric[] {
  return Object.freeze(
    [...mutable.values()]
      .map((value) => {
        const totalActionValue = value.appliedDamage + value.redirectedDamage + value.barrierAbsorbed
        return Object.freeze({
          ...value,
          healing: 0,
          totalActionValue,
          actionValuePerActionPermille:
            value.actions === 0 ? 0 : Math.round((totalActionValue * 1000) / value.actions),
        })
      })
      .sort((left, right) => {
        const bySide = compareIds(left.side, right.side)
        return bySide !== 0 ? bySide : compareIds(left.speciesId, right.speciesId)
      }),
  )
}

function collectSpeedValues(
  contributions: readonly VerticalSliceSpeciesContributionMetric[],
): readonly VerticalSliceSpeedValueMetric[] {
  const totals = new Map<number, { unitsObserved: number; actions: number; totalActionValue: number }>()
  for (const contribution of contributions) {
    const current = totals.get(contribution.speed) ?? {
      unitsObserved: 0,
      actions: 0,
      totalActionValue: 0,
    }
    current.unitsObserved += 1
    current.actions += contribution.actions
    current.totalActionValue += contribution.totalActionValue
    totals.set(contribution.speed, current)
  }
  return Object.freeze(
    [...totals.entries()]
      .sort(([left], [right]) => left - right)
      .map(([speed, value]) =>
        Object.freeze({
          speed,
          ...value,
          actionValuePerActionPermille:
            value.actions === 0 ? 0 : Math.round((value.totalActionValue * 1000) / value.actions),
        }),
      ),
  )
}

function collectWarnings(stages: readonly VerticalSliceStageBalanceMetrics[]): readonly string[] {
  const warnings: string[] = []
  for (const stage of stages) {
    if (stage.timeoutRateBasisPoints > 0) {
      warnings.push(`${stage.stageId}: action-limit timeout observed`)
    }
    if (stage.band === 'INTRO' && stage.winRateBasisPoints < 6700) {
      warnings.push(`${stage.stageId}: intro win rate is below 67%`)
    }
    if (stage.band !== 'INTRO' && stage.winRateBasisPoints === 0) {
      warnings.push(`${stage.stageId}: no benchmark profile won`)
    }
  }
  return Object.freeze(warnings.sort(compareIds))
}

export function runVerticalSliceBalanceBenchmark(): VerticalSliceBalanceReport {
  const samplesByStage = new Map<string, Sample[]>()
  const allSamples: Sample[] = []
  const skillUses = new Map<string, number>()
  const mutableContributions = new Map<string, MutableContribution>()

  for (const record of VERTICAL_SLICE_STAGE_RECORDS) {
    const stageSamples: Sample[] = []
    for (const profile of profilesFor(record)) {
      const definition = battleDefinition(record, profile)
      const sample = collectSample(
        definition,
        runHeadlessBattle(definition),
        skillUses,
        mutableContributions,
      )
      stageSamples.push(sample)
      allSamples.push(sample)
    }
    samplesByStage.set(record.definition.stageId, stageSamples)
  }

  const stages = Object.freeze(
    VERTICAL_SLICE_STAGE_RECORDS.map((record) =>
      Object.freeze({
        stageId: record.definition.stageId,
        band: stageBand(record),
        ...metrics(samplesByStage.get(record.definition.stageId) ?? []),
      }),
    ),
  )
  const totalSkillUses = [...skillUses.values()].reduce((total, uses) => total + uses, 0)
  const speciesContributions = freezeContributions(mutableContributions)

  return Object.freeze({
    reportVersion: VERTICAL_SLICE_BALANCE_REPORT_VERSION,
    deterministic: true,
    sampleMatrix: Object.freeze({
      profiles: VERTICAL_SLICE_BENCHMARK_PROFILES.length,
      profilesPerStage: 3,
      stages: VERTICAL_SLICE_STAGE_RECORDS.length,
      battles: allSamples.length,
    }),
    capabilities: Object.freeze({
      healingResolutionAvailable: false,
      overhealRateBasisPoints: null,
      note: 'The current headless runner executes SINGLE_ENEMY skills only; healing and overheal are unavailable rather than reported as zero effectiveness.',
    }),
    overall: metrics(allSamples),
    stages,
    skills: Object.freeze(
      [...skillUses.entries()]
        .sort(([left], [right]) => compareIds(left, right))
        .map(([skillId, uses]) =>
          Object.freeze({
            skillId,
            uses,
            selectionRateBasisPoints: basisPoints(uses, totalSkillUses),
          }),
        ),
    ),
    speciesContributions,
    speedValues: collectSpeedValues(speciesContributions),
    warnings: collectWarnings(stages),
  })
}

export function serializeVerticalSliceBalanceBenchmark(): string {
  return JSON.stringify(runVerticalSliceBalanceBenchmark(), null, 2)
}
