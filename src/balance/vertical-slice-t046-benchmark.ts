import {
  runHeadlessBattle,
  type HeadlessBattleDefinition,
  type HeadlessBattleRunResult,
} from '../battle/headless-battle-runner'
import type { MonsterSpecies } from '../content/monster-species'
import { VERTICAL_SLICE_T046_BALANCED_CATALOG } from '../content/vertical-slice-t046-balanced-master'
import { VERTICAL_SLICE_T046_STAGE_RECORDS } from '../content/vertical-slice-t046'
import type { VerticalSliceStageRecord } from '../content/vertical-slice-world'
import {
  VERTICAL_SLICE_BALANCE_MAX_ACTIONS,
  VERTICAL_SLICE_BALANCE_REPORT_VERSION,
  VERTICAL_SLICE_BENCHMARK_PROFILES,
  type VerticalSliceBalanceBand,
  type VerticalSliceBalanceReport,
  type VerticalSliceSpeciesContributionMetric,
  type VerticalSliceSpeedValueMetric,
  type VerticalSliceStageBalanceMetrics,
} from './vertical-slice-benchmark'

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

function bandFor(record: VerticalSliceStageRecord): VerticalSliceBalanceBand {
  if (record.definition.regionId === 'region.slice-b') return 'REGION_B'
  return (record.definition.access?.order ?? 1) <= 3 ? 'INTRO' : 'REGION_A'
}

function definitionFor(record: VerticalSliceStageRecord, profileId: string): HeadlessBattleDefinition {
  const profile = VERTICAL_SLICE_BENCHMARK_PROFILES.find(
    (candidate) => candidate.profileId === profileId,
  )
  if (profile === undefined) throw new Error(`unknown benchmark profile: ${profileId}`)
  return Object.freeze({
    species: VERTICAL_SLICE_T046_BALANCED_CATALOG.species,
    skills: VERTICAL_SLICE_T046_BALANCED_CATALOG.skills,
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
  const bySpeciesId = new Map(definition.species.map((species) => [species.id, species]))
  const entries: Array<readonly [string, MonsterSpecies]> = definition.units.map((unit) => {
    const species = bySpeciesId.get(unit.speciesId)
    if (species === undefined) throw new Error(`benchmark species is missing: ${unit.speciesId}`)
    return [unit.battleUnitId, species] as const
  })
  return new Map(entries)
}

function contribution(
  values: Map<string, MutableContribution>,
  side: 'ALLY' | 'ENEMY',
  species: MonsterSpecies,
): MutableContribution {
  const key = `${side}\u0000${species.id}`
  const existing = values.get(key)
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
  values.set(key, created)
  return created
}

function sampleFrom(
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
        contribution(contributions, side, species).appliedDamage += event.payload.appliedDamage
      }
    } else if (event.kind === 'guard_shared') {
      const species = speciesMap.get(event.payload.guardBattleUnitId)
      const side = sideMap.get(event.payload.guardBattleUnitId)
      if (species !== undefined && side !== undefined) {
        contribution(contributions, side, species).redirectedDamage += event.payload.redirectedDamage
      }
    } else if (event.kind === 'barrier_absorbed') {
      const species = speciesMap.get(event.payload.targetBattleUnitId)
      const side = sideMap.get(event.payload.targetBattleUnitId)
      if (species !== undefined && side !== undefined) {
        contribution(contributions, side, species).barrierAbsorbed += event.payload.absorbedDamage
      }
    }
  }

  for (const unit of result.summary.units) {
    const species = speciesMap.get(unit.battleUnitId)
    if (species !== undefined) contribution(contributions, unit.side, species).actions += unit.actionCount
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

function aggregate(samples: readonly Sample[]): Omit<VerticalSliceStageBalanceMetrics, 'stageId' | 'band'> {
  const allyVictories = samples.filter((sample) => sample.outcome === 'ALLY_VICTORY').length
  const allyDefeats = samples.filter((sample) => sample.outcome === 'ALLY_DEFEAT').length
  const actions = samples.reduce((total, sample) => total + sample.actions, 0)
  const calculatedDamage = samples.reduce((total, sample) => total + sample.calculatedDamage, 0)
  return Object.freeze({
    samples: samples.length,
    allyVictories,
    allyDefeats,
    draws: samples.length - allyVictories - allyDefeats,
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
    skillActionRateBasisPoints: basisPoints(
      samples.reduce((total, sample) => total + sample.skillUses, 0),
      actions,
    ),
    movementRateBasisPoints: basisPoints(
      samples.reduce((total, sample) => total + sample.moves, 0),
      actions,
    ),
    overkillRateBasisPoints: basisPoints(
      samples.reduce((total, sample) => total + sample.overkillDamage, 0),
      calculatedDamage,
    ),
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
        const side = compareIds(left.side, right.side)
        return side !== 0 ? side : compareIds(left.speciesId, right.speciesId)
      }),
  )
}

function speedValues(
  values: readonly VerticalSliceSpeciesContributionMetric[],
): readonly VerticalSliceSpeedValueMetric[] {
  const totals = new Map<number, { unitsObserved: number; actions: number; totalActionValue: number }>()
  for (const value of values) {
    const current = totals.get(value.speed) ?? { unitsObserved: 0, actions: 0, totalActionValue: 0 }
    current.unitsObserved += 1
    current.actions += value.actions
    current.totalActionValue += value.totalActionValue
    totals.set(value.speed, current)
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

function warnings(stages: readonly VerticalSliceStageBalanceMetrics[]): readonly string[] {
  return Object.freeze(
    stages
      .flatMap((stage) => {
        const messages: string[] = []
        if (stage.timeoutRateBasisPoints > 0) messages.push(`${stage.stageId}: timeout observed`)
        if (stage.band === 'INTRO' && stage.winRateBasisPoints < 6700) {
          messages.push(`${stage.stageId}: intro win rate below 67%`)
        }
        if (stage.band !== 'INTRO' && stage.winRateBasisPoints === 0) {
          messages.push(`${stage.stageId}: no benchmark profile won`)
        }
        return messages
      })
      .sort(compareIds),
  )
}

export function runVerticalSliceT046BalanceBenchmark(): VerticalSliceBalanceReport {
  const samplesByStage = new Map<string, Sample[]>()
  const allSamples: Sample[] = []
  const skillUses = new Map<string, number>()
  const mutableContributions = new Map<string, MutableContribution>()

  for (const record of VERTICAL_SLICE_T046_STAGE_RECORDS) {
    const stageSamples: Sample[] = []
    for (const profile of VERTICAL_SLICE_BENCHMARK_PROFILES.filter(
      (candidate) => candidate.band === bandFor(record),
    )) {
      const definition = definitionFor(record, profile.profileId)
      const sample = sampleFrom(
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
    VERTICAL_SLICE_T046_STAGE_RECORDS.map((record) =>
      Object.freeze({
        stageId: record.definition.stageId,
        band: bandFor(record),
        ...aggregate(samplesByStage.get(record.definition.stageId) ?? []),
      }),
    ),
  )
  const totalSkillUses = [...skillUses.values()].reduce((total, uses) => total + uses, 0)
  const contributions = freezeContributions(mutableContributions)

  return Object.freeze({
    reportVersion: VERTICAL_SLICE_BALANCE_REPORT_VERSION,
    deterministic: true,
    sampleMatrix: Object.freeze({
      profiles: VERTICAL_SLICE_BENCHMARK_PROFILES.length,
      profilesPerStage: 3,
      stages: VERTICAL_SLICE_T046_STAGE_RECORDS.length,
      battles: allSamples.length,
    }),
    capabilities: Object.freeze({
      healingResolutionAvailable: false,
      overhealRateBasisPoints: null,
      note: 'The current runner executes SINGLE_ENEMY skills only; healing and overheal are explicitly unavailable.',
    }),
    overall: aggregate(allSamples),
    stages,
    skills: Object.freeze(
      [...skillUses.entries()]
        .sort(([left], [right]) => compareIds(left, right))
        .map(([skillId, uses]) =>
          Object.freeze({ skillId, uses, selectionRateBasisPoints: basisPoints(uses, totalSkillUses) }),
        ),
    ),
    speciesContributions: contributions,
    speedValues: speedValues(contributions),
    warnings: warnings(stages),
  })
}

export function serializeVerticalSliceT046BalanceBenchmark(): string {
  return JSON.stringify(runVerticalSliceT046BalanceBenchmark(), null, 2)
}
