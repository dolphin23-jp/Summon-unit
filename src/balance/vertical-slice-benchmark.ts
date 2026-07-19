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
export const VERTICAL_SLICE_BALANCE_INITIAL_ACTION_COST = 100
export const VERTICAL_SLICE_BALANCE_MAX_ACTIONS = 500

export type VerticalSliceBalanceBand = 'INTRO' | 'REGION_A' | 'REGION_B'

export interface VerticalSliceBenchmarkProfile {
  readonly profileId: string
  readonly label: string
  readonly band: VerticalSliceBalanceBand
  readonly units: readonly HeadlessBattleUnitDefinition[]
  readonly aiConfigurations: Readonly<Record<BattleUnitId, AiDecisionConfiguration>>
}

export interface VerticalSliceBattleSampleMetrics {
  readonly stageId: string
  readonly profileId: string
  readonly outcome: HeadlessBattleRunResult['summary']['outcome']
  readonly termination: HeadlessBattleRunResult['summary']['termination']
  readonly finalVirtualTime: number
  readonly totalActions: number
  readonly skillUses: number
  readonly moves: number
  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly overkillDamage: number
  readonly redirectedDamage: number
  readonly barrierAbsorbed: number
}

export interface VerticalSliceStageBalanceMetrics {
  readonly stageId: string
  readonly band: VerticalSliceBalanceBand
  readonly samples: number
  readonly allyVictories: number
  readonly enemyVictories: number
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
    readonly stages: number
    readonly battles: number
  }
  readonly capabilities: {
    readonly healingResolutionAvailable: false
    readonly overhealRateBasisPoints: null
    readonly note: string
  }
  readonly overall: {
    readonly samples: number
    readonly allyVictories: number
    readonly enemyVictories: number
    readonly draws: number
    readonly winRateBasisPoints: number
    readonly timeoutRateBasisPoints: number
    readonly meanVirtualTime: number
    readonly meanActions: number
    readonly skillActionRateBasisPoints: number
    readonly movementRateBasisPoints: number
    readonly overkillRateBasisPoints: number
  }
  readonly stages: readonly VerticalSliceStageBalanceMetrics[]
  readonly skills: readonly VerticalSliceSkillUsageMetric[]
  readonly speciesContributions: readonly VerticalSliceSpeciesContributionMetric[]
  readonly speedValues: readonly VerticalSliceSpeedValueMetric[]
  readonly warnings: readonly string[]
}

interface MutableContribution {
  side: 'ALLY' | 'ENEMY'
  speciesId: string
  speed: number
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

function unit(
  id: string,
  speciesId: string,
  row: 0 | 1 | 2,
  column: 0 | 1 | 2,
  tiePriority: number,
  equippedSkillIds: readonly string[] = [],
): HeadlessBattleUnitDefinition {
  return Object.freeze({
    battleUnitId: id,
    speciesId,
    position: Object.freeze({ side: 'ALLY' as const, row, column }),
    equippedSkillIds: Object.freeze([...equippedSkillIds]),
    tiePriority,
  })
}

function ai(
  individualStrategy: AiDecisionConfiguration['individualStrategy'],
  teamStrategy: AiDecisionConfiguration['teamStrategy'],
): AiDecisionConfiguration {
  return Object.freeze({ individualStrategy, teamStrategy, skillPolicies: Object.freeze([]) })
}

function profile(input: VerticalSliceBenchmarkProfile): VerticalSliceBenchmarkProfile {
  return Object.freeze({
    ...input,
    units: Object.freeze([...input.units]),
    aiConfigurations: Object.freeze({ ...input.aiConfigurations }),
  })
}

const LIGHT_STRIKE = Object.freeze(['skill.slice.generic.light-strike'])
const LONG_SHOT = Object.freeze(['skill.slice.generic.long-shot'])
const IMPACT = Object.freeze(['skill.slice.generic.impact'])

export const VERTICAL_SLICE_BENCHMARK_PROFILES: readonly VerticalSliceBenchmarkProfile[] =
  Object.freeze([
    profile({
      profileId: 'profile.intro-balanced',
      label: 'R1標準配置',
      band: 'INTRO',
      units: [
        unit('ally.intro.grassfang', 'species.slice.grassfang-rat', 0, 0, 0, LIGHT_STRIKE),
        unit('ally.intro.ember', 'species.slice.ember-gecko', 1, 0, 1, LIGHT_STRIKE),
        unit('ally.intro.windwing', 'species.slice.windwing-midge', 2, 1, 2, LONG_SHOT),
      ],
      aiConfigurations: {
        'ally.intro.grassfang': ai('ASSAULT', 'FAST_KILL'),
        'ally.intro.ember': ai('STANDARD', 'STABLE_CLEAR'),
        'ally.intro.windwing': ai('FIXED_TURRET', 'STABLE_CLEAR'),
      },
    }),
    profile({
      profileId: 'profile.intro-spread',
      label: 'R1分散配置',
      band: 'INTRO',
      units: [
        unit('ally.intro-spread.grassfang', 'species.slice.grassfang-rat', 0, 0, 0),
        unit('ally.intro-spread.ember', 'species.slice.ember-gecko', 1, 1, 1),
        unit('ally.intro-spread.windwing', 'species.slice.windwing-midge', 2, 2, 2, LONG_SHOT),
      ],
      aiConfigurations: {
        'ally.intro-spread.grassfang': ai('ASSAULT', 'FAST_KILL'),
        'ally.intro-spread.ember': ai('POSITIONAL', 'STABLE_CLEAR'),
        'ally.intro-spread.windwing': ai('POSITIONAL', 'STABLE_CLEAR'),
      },
    }),
    profile({
      profileId: 'profile.intro-cover',
      label: 'R1遮蔽配置',
      band: 'INTRO',
      units: [
        unit('ally.intro-cover.mudshell', 'species.slice.mudshell-beetle', 0, 1, 0, LIGHT_STRIKE),
        unit('ally.intro-cover.grassfang', 'species.slice.grassfang-rat', 1, 0, 1),
        unit('ally.intro-cover.windwing', 'species.slice.windwing-midge', 2, 1, 2, LONG_SHOT),
      ],
      aiConfigurations: {
        'ally.intro-cover.mudshell': ai('CAUTIOUS', 'STABLE_CLEAR'),
        'ally.intro-cover.grassfang': ai('ASSAULT', 'FAST_KILL'),
        'ally.intro-cover.windwing': ai('FIXED_TURRET', 'STABLE_CLEAR'),
      },
    }),
    profile({
      profileId: 'profile.region-a-mobile',
      label: '地域A機動班',
      band: 'REGION_A',
      units: [
        unit('ally.a-mobile.gale', 'species.slice.gale-wolf', 0, 0, 0),
        unit('ally.a-mobile.ironhorn', 'species.slice.ironhorn-beast', 1, 0, 1, IMPACT),
        unit('ally.a-mobile.spark', 'species.slice.spark-bird', 2, 1, 2, LONG_SHOT),
      ],
      aiConfigurations: {
        'ally.a-mobile.gale': ai('POSITIONAL', 'FAST_KILL'),
        'ally.a-mobile.ironhorn': ai('ASSAULT', 'FAST_KILL'),
        'ally.a-mobile.spark': ai('POSITIONAL', 'STABLE_CLEAR'),
      },
    }),
    profile({
      profileId: 'profile.region-a-control',
      label: '地域A制御班',
      band: 'REGION_A',
      units: [
        unit('ally.a-control.rock', 'species.slice.rock-carapace', 0, 1, 0, LIGHT_STRIKE),
        unit('ally.a-control.venom', 'species.slice.venom-moth', 1, 0, 1, LONG_SHOT),
        unit('ally.a-control.spark', 'species.slice.spark-bird', 2, 2, 2, LONG_SHOT),
      ],
      aiConfigurations: {
        'ally.a-control.rock': ai('CAUTIOUS', 'LOSS_MINIMIZATION'),
        'ally.a-control.venom': ai('CAUTIOUS', 'STABLE_CLEAR'),
        'ally.a-control.spark': ai('POSITIONAL', 'FAST_KILL'),
      },
    }),
    profile({
      profileId: 'profile.region-a-r1-plus',
      label: '地域A低レア班',
      band: 'REGION_A',
      units: [
        unit('ally.a-r1.grassfang', 'species.slice.grassfang-rat', 0, 0, 0),
        unit('ally.a-r1.ember', 'species.slice.ember-gecko', 1, 0, 1),
        unit('ally.a-r1.windwing', 'species.slice.windwing-midge', 2, 1, 2, LONG_SHOT),
        unit('ally.a-r1.mudshell', 'species.slice.mudshell-beetle', 0, 2, 3, LIGHT_STRIKE),
      ],
      aiConfigurations: {
        'ally.a-r1.grassfang': ai('ASSAULT', 'FAST_KILL'),
        'ally.a-r1.ember': ai('STANDARD', 'STABLE_CLEAR'),
        'ally.a-r1.windwing': ai('FIXED_TURRET', 'STABLE_CLEAR'),
        'ally.a-r1.mudshell': ai('CAUTIOUS', 'LOSS_MINIMIZATION'),
      },
    }),
    profile({
      profileId: 'profile.region-b-assault',
      label: '地域B攻撃班',
      band: 'REGION_B',
      units: [
        unit('ally.b-assault.molten', 'species.slice.molten-carapace', 0, 1, 0, IMPACT),
        unit('ally.b-assault.ironhorn', 'species.slice.ironhorn-beast', 1, 0, 1, IMPACT),
        unit('ally.b-assault.flame', 'species.slice.flame-automaton', 2, 1, 2, LONG_SHOT),
        unit('ally.b-assault.spark', 'species.slice.spark-bird', 1, 2, 3, LONG_SHOT),
      ],
      aiConfigurations: {
        'ally.b-assault.molten': ai('CAUTIOUS', 'STABLE_CLEAR'),
        'ally.b-assault.ironhorn': ai('ASSAULT', 'FAST_KILL'),
        'ally.b-assault.flame': ai('FIXED_TURRET', 'FAST_KILL'),
        'ally.b-assault.spark': ai('POSITIONAL', 'FAST_KILL'),
      },
    }),
    profile({
      profileId: 'profile.region-b-control',
      label: '地域B制御班',
      band: 'REGION_B',
      units: [
        unit('ally.b-control.rock', 'species.slice.rock-carapace', 0, 0, 0, LIGHT_STRIKE),
        unit('ally.b-control.gale', 'species.slice.gale-wolf', 1, 0, 1),
        unit('ally.b-control.venom', 'species.slice.venom-moth', 2, 1, 2, LONG_SHOT),
        unit('ally.b-control.flame', 'species.slice.flame-automaton', 2, 2, 3, LONG_SHOT),
      ],
      aiConfigurations: {
        'ally.b-control.rock': ai('CAUTIOUS', 'LOSS_MINIMIZATION'),
        'ally.b-control.gale': ai('POSITIONAL', 'STABLE_CLEAR'),
        'ally.b-control.venom': ai('CAUTIOUS', 'STABLE_CLEAR'),
        'ally.b-control.flame': ai('FIXED_TURRET', 'FAST_KILL'),
      },
    }),
    profile({
      profileId: 'profile.region-b-midrarity',
      label: '地域B中レア班',
      band: 'REGION_B',
      units: [
        unit('ally.b-mid.ironhorn', 'species.slice.ironhorn-beast', 0, 0, 0, IMPACT),
        unit('ally.b-mid.gale', 'species.slice.gale-wolf', 1, 0, 1),
        unit('ally.b-mid.spark', 'species.slice.spark-bird', 2, 1, 2, LONG_SHOT),
        unit('ally.b-mid.venom', 'species.slice.venom-moth', 1, 2, 3, LONG_SHOT),
      ],
      aiConfigurations: {
        'ally.b-mid.ironhorn': ai('ASSAULT', 'FAST_KILL'),
        'ally.b-mid.gale': ai('POSITIONAL', 'FAST_KILL'),
        'ally.b-mid.spark': ai('POSITIONAL', 'STABLE_CLEAR'),
        'ally.b-mid.venom': ai('CAUTIOUS', 'STABLE_CLEAR'),
      },
    }),
  ])

function stageBand(record: VerticalSliceStageRecord): VerticalSliceBalanceBand {
  if (record.definition.regionId === 'region.slice-b') return 'REGION_B'
  return (record.definition.access?.order ?? 1) <= 3 ? 'INTRO' : 'REGION_A'
}

function createBattleDefinition(
  record: VerticalSliceStageRecord,
  benchmarkProfile: VerticalSliceBenchmarkProfile,
): HeadlessBattleDefinition {
  return Object.freeze({
    species: VERTICAL_SLICE_WORLD_CATALOG.species,
    skills: VERTICAL_SLICE_WORLD_CATALOG.skills,
    units: Object.freeze([...benchmarkProfile.units, ...record.definition.enemyFormation.units]),
    aiConfigurations: Object.freeze({
      ...record.definition.enemyFormation.aiConfigurations,
      ...benchmarkProfile.aiConfigurations,
    }),
    boss: record.definition.boss ?? undefined,
    initialActionCost: VERTICAL_SLICE_BALANCE_INITIAL_ACTION_COST,
    maxActions: VERTICAL_SLICE_BALANCE_MAX_ACTIONS,
  })
}

function getSpeciesByBattleUnitId(
  definition: HeadlessBattleDefinition,
): ReadonlyMap<string, MonsterSpecies> {
  const speciesById = new Map(definition.species.map((species) => [species.id, species]))
  return new Map(
    definition.units.map((battleUnit) => {
      const species = speciesById.get(battleUnit.speciesId)
      if (species === undefined) throw new Error(`balance benchmark species is missing: ${battleUnit.speciesId}`)
      return [battleUnit.battleUnitId, species]
    }),
  )
}

function collectSample(
  stageId: string,
  profileId: string,
  definition: HeadlessBattleDefinition,
  result: HeadlessBattleRunResult,
  skillTotals: Map<string, number>,
  contributions: Map<string, MutableContribution>,
): VerticalSliceBattleSampleMetrics {
  const speciesByUnitId = getSpeciesByBattleUnitId(definition)
  const sideByUnitId = new Map(definition.units.map((battleUnit) => [battleUnit.battleUnitId, battleUnit.position.side]))
  let skillUses = 0
  let moves = 0
  let calculatedDamage = 0
  let appliedDamage = 0
  let overkillDamage = 0
  let redirectedDamage = 0
  let barrierAbsorbed = 0

  for (const event of result.log.events) {
    switch (event.kind) {
      case 'skill_used':
        skillUses += 1
        skillTotals.set(event.payload.skillId, (skillTotals.get(event.payload.skillId) ?? 0) + 1)
        break
      case 'unit_moved':
        moves += 1
        break
      case 'damage_applied': {
        calculatedDamage += event.payload.calculatedDamage
        appliedDamage += event.payload.appliedDamage
        overkillDamage += Math.max(0, event.payload.calculatedDamage - event.payload.appliedDamage)
        const sourceId = event.payload.sourceBattleUnitId
        if (sourceId !== null) {
          const species = speciesByUnitId.get(sourceId)
          const side = sideByUnitId.get(sourceId)
          if (species !== undefined && side !== undefined) {
            const key = `${side}\u0000${species.id}`
            const existing = contributions.get(key) ?? {
              side,
              speciesId: species.id,
              speed: species.stats.speed,
              actions: 0,
              appliedDamage: 0,
              redirectedDamage: 0,
              barrierAbsorbed: 0,
            }
            existing.appliedDamage += event.payload.appliedDamage
            contributions.set(key, existing)
          }
        }
        break
      }
      case 'guard_shared': {
        redirectedDamage += event.payload.redirectedDamage
        const species = speciesByUnitId.get(event.payload.guardBattleUnitId)
        const side = sideByUnitId.get(event.payload.guardBattleUnitId)
        if (species !== undefined && side !== undefined) {
          const key = `${side}\u0000${species.id}`
          const existing = contributions.get(key) ?? {
            side,
            speciesId: species.id,
            speed: species.stats.speed,
            actions: 0,
            appliedDamage: 0,
            redirectedDamage: 0,
            barrierAbsorbed: 0,
          }
          existing.redirectedDamage += event.payload.redirectedDamage
          contributions.set(key, existing)
        }
        break
      }
      case 'barrier_absorbed': {
        barrierAbsorbed += event.payload.absorbedDamage
        const species = speciesByUnitId.get(event.payload.targetBattleUnitId)
        const side = sideByUnitId.get(event.payload.targetBattleUnitId)
        if (species !== undefined && side !== undefined) {
          const key = `${side}\u0000${species.id}`
          const existing = contributions.get(key) ?? {
            side,
            speciesId: species.id,
            speed: species.stats.speed,
            actions: 0,
            appliedDamage: 0,
            redirectedDamage: 0,
            barrierAbsorbed: 0,
          }
          existing.barrierAbsorbed += event.payload.absorbedDamage
          contributions.set(key, existing)
        }
        break
      }
      default:
        break
    }
  }

  for (const unitSummary of result.summary.units) {
    const species = speciesByUnitId.get(unitSummary.battleUnitId)
    if (species === undefined) continue
    const key = `${unitSummary.side}\u0000${species.id}`
    const existing = contributions.get(key) ?? {
      side: unitSummary.side,
      speciesId: species.id,
      speed: species.stats.speed,
      actions: 0,
      appliedDamage: 0,
      redirectedDamage: 0,
      barrierAbsorbed: 0,
    }
    existing.actions += unitSummary.actionCount
    contributions.set(key, existing)
  }

  return Object.freeze({
    stageId,
    profileId,
    outcome: result.summary.outcome,
    termination: result.summary.termination,
    finalVirtualTime: result.summary.finalVirtualTime,
    totalActions: result.summary.totalActions,
    skillUses,
    moves,
    calculatedDamage,
    appliedDamage,
    overkillDamage,
    redirectedDamage,
    barrierAbsorbed,
  })
}

function stageMetrics(
  record: VerticalSliceStageRecord,
  samples: readonly VerticalSliceBattleSampleMetrics[],
): VerticalSliceStageBalanceMetrics {
  const allyVictories = samples.filter((sample) => sample.outcome === 'ALLY_VICTORY').length
  const enemyVictories = samples.filter((sample) => sample.outcome === 'ENEMY_VICTORY').length
  const draws = samples.length - allyVictories - enemyVictories
  const actions = samples.reduce((total, sample) => total + sample.totalActions, 0)
  const skillUses = samples.reduce((total, sample) => total + sample.skillUses, 0)
  const moves = samples.reduce((total, sample) => total + sample.moves, 0)
  const calculatedDamage = samples.reduce((total, sample) => total + sample.calculatedDamage, 0)
  const overkillDamage = samples.reduce((total, sample) => total + sample.overkillDamage, 0)
  return Object.freeze({
    stageId: record.definition.stageId,
    band: stageBand(record),
    samples: samples.length,
    allyVictories,
    enemyVictories,
    draws,
    winRateBasisPoints: basisPoints(allyVictories, samples.length),
    timeoutRateBasisPoints: basisPoints(
      samples.filter((sample) => sample.termination === 'ACTION_LIMIT_REACHED').length,
      samples.length,
    ),
    meanVirtualTime: mean(
      samples.reduce((total, sample) => total + sample.finalVirtualTime, 0),
      samples.length,
    ),
    meanActions: mean(actions, samples.length),
    skillActionRateBasisPoints: basisPoints(skillUses, actions),
    movementRateBasisPoints: basisPoints(moves, actions),
    overkillRateBasisPoints: basisPoints(overkillDamage, calculatedDamage),
  })
}

function freezeContributions(
  contributions: ReadonlyMap<string, MutableContribution>,
): readonly VerticalSliceSpeciesContributionMetric[] {
  return Object.freeze(
    [...contributions.values()]
      .map((contribution) => {
        const totalActionValue =
          contribution.appliedDamage + contribution.redirectedDamage + contribution.barrierAbsorbed
        return Object.freeze({
          ...contribution,
          healing: 0,
          totalActionValue,
          actionValuePerActionPermille:
            contribution.actions === 0 ? 0 : Math.round((totalActionValue * 1000) / contribution.actions),
        })
      })
      .sort((left, right) => {
        const side = left.side.localeCompare(right.side, 'en')
        return side !== 0 ? side : compareIds(left.speciesId, right.speciesId)
      }),
  )
}

function speedValues(
  contributions: readonly VerticalSliceSpeciesContributionMetric[],
): readonly VerticalSliceSpeedValueMetric[] {
  const bySpeed = new Map<number, { unitsObserved: number; actions: number; totalActionValue: number }>()
  for (const contribution of contributions) {
    const current = bySpeed.get(contribution.speed) ?? {
      unitsObserved: 0,
      actions: 0,
      totalActionValue: 0,
    }
    current.unitsObserved += 1
    current.actions += contribution.actions
    current.totalActionValue += contribution.totalActionValue
    bySpeed.set(contribution.speed, current)
  }
  return Object.freeze(
    [...bySpeed.entries()]
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

function warningsFor(stages: readonly VerticalSliceStageBalanceMetrics[]): readonly string[] {
  const warnings: string[] = []
  for (const stage of stages) {
    if (stage.timeoutRateBasisPoints > 0) warnings.push(`${stage.stageId}: action-limit timeout observed`)
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
  const skillTotals = new Map<string, number>()
  const contributions = new Map<string, MutableContribution>()
  const sampleByStage = new Map<string, VerticalSliceBattleSampleMetrics[]>()
  let profileCount = 0

  for (const record of VERTICAL_SLICE_STAGE_RECORDS) {
    const band = stageBand(record)
    const profiles = VERTICAL_SLICE_BENCHMARK_PROFILES.filter((candidate) => candidate.band === band)
    profileCount = Math.max(profileCount, profiles.length)
    for (const benchmarkProfile of profiles) {
      const definition = createBattleDefinition(record, benchmarkProfile)
      const result = runHeadlessBattle(definition)
      const sample = collectSample(
        record.definition.stageId,
        benchmarkProfile.profileId,
        definition,
        result,
        skillTotals,
        contributions,
      )
      const stageSamples = sampleByStage.get(record.definition.stageId) ?? []
      stageSamples.push(sample)
      sampleByStage.set(record.definition.stageId, stageSamples)
    }
  }

  const stages = Object.freeze(
    VERTICAL_SLICE_STAGE_RECORDS.map((record) =>
      stageMetrics(record, Object.freeze(sampleByStage.get(record.definition.stageId) ?? [])),
    ),
  )
  const allSamples = [...sampleByStage.values()].flat()
  const totalActions = allSamples.reduce((total, sample) => total + sample.totalActions, 0)
  const totalSkillUses = allSamples.reduce((total, sample) => total + sample.skillUses, 0)
  const totalMoves = allSamples.reduce((total, sample) => total + sample.moves, 0)
  const totalCalculatedDamage = allSamples.reduce((total, sample) => total + sample.calculatedDamage, 0)
  const totalOverkill = allSamples.reduce((total, sample) => total + sample.overkillDamage, 0)
  const allyVictories = allSamples.filter((sample) => sample.outcome === 'ALLY_VICTORY').length
  const enemyVictories = allSamples.filter((sample) => sample.outcome === 'ENEMY_VICTORY').length
  const draws = allSamples.length - allyVictories - enemyVictories
  const totalSkillSelections = [...skillTotals.values()].reduce((total, count) => total + count, 0)
  const speciesContributions = freezeContributions(contributions)

  return Object.freeze({
    reportVersion: VERTICAL_SLICE_BALANCE_REPORT_VERSION,
    deterministic: true,
    sampleMatrix: Object.freeze({
      profiles: VERTICAL_SLICE_BENCHMARK_PROFILES.length,
      stages: VERTICAL_SLICE_STAGE_RECORDS.length,
      battles: allSamples.length,
    }),
    capabilities: Object.freeze({
      healingResolutionAvailable: false,
      overhealRateBasisPoints: null,
      note: 'The current headless runner executes SINGLE_ENEMY skills only; healing and overheal remain explicitly unavailable rather than reported as zero effectiveness.',
    }),
    overall: Object.freeze({
      samples: allSamples.length,
      allyVictories,
      enemyVictories,
      draws,
      winRateBasisPoints: basisPoints(allyVictories, allSamples.length),
      timeoutRateBasisPoints: basisPoints(
        allSamples.filter((sample) => sample.termination === 'ACTION_LIMIT_REACHED').length,
        allSamples.length,
      ),
      meanVirtualTime: mean(
        allSamples.reduce((total, sample) => total + sample.finalVirtualTime, 0),
        allSamples.length,
      ),
      meanActions: mean(totalActions, allSamples.length),
      skillActionRateBasisPoints: basisPoints(totalSkillUses, totalActions),
      movementRateBasisPoints: basisPoints(totalMoves, totalActions),
      overkillRateBasisPoints: basisPoints(totalOverkill, totalCalculatedDamage),
    }),
    stages,
    skills: Object.freeze(
      [...skillTotals.entries()]
        .sort(([left], [right]) => compareIds(left, right))
        .map(([skillId, uses]) =>
          Object.freeze({
            skillId,
            uses,
            selectionRateBasisPoints: basisPoints(uses, totalSkillSelections),
          }),
        ),
    ),
    speciesContributions,
    speedValues: speedValues(speciesContributions),
    warnings: warningsFor(stages),
  })
}

export function serializeVerticalSliceBalanceBenchmark(): string {
  return JSON.stringify(runVerticalSliceBalanceBenchmark(), null, 2)
}
