import type { BossEncounterDefinition } from '../battle/boss-phase'
import type { HeadlessBattleUnitDefinition } from '../battle/headless-battle-runner'
import type { PlayerData } from '../progression/player-data'
import { createStagePlayerData } from '../progression/stage-reward'
import { validateContentCatalog, type ContentValidationSummary } from './content-validation'
import {
  VERTICAL_SLICE_INITIAL_PLAYER_DATA,
  VERTICAL_SLICE_STAGE_RECORDS,
  VERTICAL_SLICE_WORLD_CATALOG,
  type VerticalSliceStageRecord,
} from './vertical-slice-world'
import { VERTICAL_SLICE_GENERIC_SKILL_COSTS } from './vertical-slice-content'

export interface VerticalSliceOnboardingCue {
  readonly stageId: string
  readonly headline: string
  readonly prompt: string
  readonly tip: string
}

export interface VerticalSliceT046ValidationSummary extends ContentValidationSummary {
  readonly onboardingCues: number
  readonly balancedBossStages: number
  readonly adjustedStages: number
  readonly initialUnits: number
  readonly initialFormationMembers: number
}

export const VERTICAL_SLICE_ONBOARDING_CUES: readonly VerticalSliceOnboardingCue[] =
  Object.freeze([
    Object.freeze({
      stageId: 'stage.slice.a-01-order',
      headline: '次の行動時刻を見る',
      prompt: '軽い技は威力より先手を取りやすい。タイムラインの並びを一度見比べよう。',
      tip: '大技だけを選ばず、先に動ける回数も判断材料にする。',
    }),
    Object.freeze({
      stageId: 'stage.slice.a-02-cover',
      headline: '前列の後ろは狙いにくい',
      prompt: '直線攻撃は同じ列の前列に止められる。射線か前列を変える方法を探そう。',
      tip: '射手だけを選び続けず、遮蔽役を崩す順番も試す。',
    }),
    Object.freeze({
      stageId: 'stage.slice.a-03-movement',
      headline: '攻撃できない時は位置を変える',
      prompt: '敵が射程外なら通常移動も一手になる。次の攻撃位置を先に確保しよう。',
      tip: '固定配置に固執せず、追える列と安全な列を選ぶ。',
    }),
  ])

const ADJUSTED_STAGE_IDS = Object.freeze([
  'stage.slice.a-03-movement',
  'stage.slice.b-06-telegraph',
  'stage.slice.b-08-wyvern-boss',
])

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right, 'en')))
}

function balancedBossDefinition(record: VerticalSliceStageRecord): BossEncounterDefinition | null {
  const boss = record.definition.boss
  if (boss === null) return null
  const bossUnit = record.definition.enemyFormation.units.find(
    (unit) => unit.battleUnitId === boss.bossBattleUnitId,
  )
  if (bossUnit === undefined) throw new Error(`T046 boss unit is missing: ${record.definition.stageId}`)
  const species = VERTICAL_SLICE_WORLD_CATALOG.species.find(
    (candidate) => candidate.id === bossUnit.speciesId,
  )
  if (species === undefined) throw new Error(`T046 boss species is missing: ${bossUnit.speciesId}`)
  return Object.freeze({
    bossBattleUnitId: boss.bossBattleUnitId,
    phases: Object.freeze(
      boss.phases.map((phase) => {
        const gimmick =
          record.definition.stageId === 'stage.slice.b-08-wyvern-boss' &&
          phase.gimmick.type === 'BARRIER'
            ? Object.freeze({ type: 'BARRIER' as const, capacity: 40 })
            : Object.freeze({ ...phase.gimmick })
        return Object.freeze({
          ...phase,
          actionSkillIds: uniqueSorted([species.innateSkillId, ...phase.actionSkillIds]),
          gimmick,
        })
      }),
    ),
  })
}

function adjustedUnits(record: VerticalSliceStageRecord): readonly HeadlessBattleUnitDefinition[] {
  const stageId = record.definition.stageId
  if (stageId === 'stage.slice.a-03-movement') {
    const gale = record.definition.enemyFormation.units.find(
      (unit) => unit.speciesId === 'species.slice.gale-wolf',
    )
    if (gale === undefined) throw new Error('T046 A-03 gale wolf is missing')
    return Object.freeze([Object.freeze({ ...gale, initialHp: 82 })])
  }
  if (stageId === 'stage.slice.b-06-telegraph') {
    return Object.freeze(
      record.definition.enemyFormation.units
        .filter((unit) => unit.speciesId !== 'species.slice.spark-bird')
        .map((unit) =>
          Object.freeze({
            ...unit,
            ...(unit.speciesId === 'species.slice.flame-automaton' ? { initialHp: 125 } : {}),
          }),
        ),
    )
  }
  if (stageId === 'stage.slice.b-08-wyvern-boss') {
    const wyvern = record.definition.enemyFormation.units.find(
      (unit) => unit.speciesId === 'species.slice.disaster-flame-wyvern',
    )
    if (wyvern === undefined) throw new Error('T046 B-08 wyvern is missing')
    return Object.freeze([Object.freeze({ ...wyvern, initialHp: 180 })])
  }
  return record.definition.enemyFormation.units
}

function balancedStageRecord(record: VerticalSliceStageRecord): VerticalSliceStageRecord {
  const units = adjustedUnits(record)
  const unitIds = new Set(units.map((unit) => unit.battleUnitId))
  return Object.freeze({
    ...record,
    definition: Object.freeze({
      ...record.definition,
      enemyFormation: Object.freeze({
        units,
        aiConfigurations: Object.freeze(
          Object.fromEntries(
            Object.entries(record.definition.enemyFormation.aiConfigurations).filter(([unitId]) =>
              unitIds.has(unitId),
            ),
          ),
        ),
      }),
      boss: balancedBossDefinition(record),
    }),
  })
}

export const VERTICAL_SLICE_T046_STAGE_RECORDS: readonly VerticalSliceStageRecord[] =
  Object.freeze(VERTICAL_SLICE_STAGE_RECORDS.map(balancedStageRecord))

export const VERTICAL_SLICE_T046_STAGES = Object.freeze(
  VERTICAL_SLICE_T046_STAGE_RECORDS.map((record) => record.definition),
)

export const VERTICAL_SLICE_T046_WORLD_CATALOG = Object.freeze({
  ...VERTICAL_SLICE_WORLD_CATALOG,
  stages: VERTICAL_SLICE_T046_STAGES,
})

const EMBER_INSTANCE_ID = 'unit.slice.ember-01'

export const VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA: PlayerData = createStagePlayerData(
  {
    ...VERTICAL_SLICE_INITIAL_PLAYER_DATA,
    gameVersion: '0.0.0-t046',
    contentVersion: 'slice-t046-pass1',
    collection: {
      ...VERTICAL_SLICE_INITIAL_PLAYER_DATA.collection,
      unitInstances: [
        ...VERTICAL_SLICE_INITIAL_PLAYER_DATA.collection.unitInstances,
        {
          instanceId: EMBER_INSTANCE_ID,
          speciesId: 'species.slice.ember-gecko',
          learnedGenericSkillIds: ['skill.slice.generic.light-strike'],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
      ],
    },
    formations: {
      activeFormationId: 'formation.slice.starter',
      formations: [
        {
          formationId: 'formation.slice.starter',
          name: '初期観測班',
          members: [
            {
              instanceId: 'unit.slice.grassfang-01',
              position: { row: 0, column: 0 },
              loadout: { genericSkillId: 'skill.slice.generic.light-strike', bloomSkillId: null },
              tiePriority: 0,
              ai: {
                individualStrategy: 'ASSAULT',
                teamStrategy: 'FAST_KILL',
                skillPolicies: [],
              },
            },
            {
              instanceId: EMBER_INSTANCE_ID,
              position: { row: 1, column: 0 },
              loadout: { genericSkillId: 'skill.slice.generic.light-strike', bloomSkillId: null },
              tiePriority: 1,
              ai: {
                individualStrategy: 'STANDARD',
                teamStrategy: 'STABLE_CLEAR',
                skillPolicies: [],
              },
            },
            {
              instanceId: 'unit.slice.windwing-01',
              position: { row: 2, column: 1 },
              loadout: { genericSkillId: 'skill.slice.generic.long-shot', bloomSkillId: null },
              tiePriority: 2,
              ai: {
                individualStrategy: 'FIXED_TURRET',
                teamStrategy: 'STABLE_CLEAR',
                skillPolicies: [],
              },
            },
          ],
        },
      ],
    },
  },
  VERTICAL_SLICE_T046_WORLD_CATALOG,
)

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`${field} must be non-empty`)
}

export function validateVerticalSliceT046(): VerticalSliceT046ValidationSummary {
  const base = validateContentCatalog(VERTICAL_SLICE_T046_WORLD_CATALOG, {
    genericSkillCosts: VERTICAL_SLICE_GENERIC_SKILL_COSTS,
  })
  if (VERTICAL_SLICE_ONBOARDING_CUES.length !== 3) {
    throw new Error('T046 onboarding must contain exactly three cues')
  }
  const cueIds = new Set<string>()
  for (const cue of VERTICAL_SLICE_ONBOARDING_CUES) {
    assertNonEmpty(cue.stageId, 'T046 cue stageId')
    assertNonEmpty(cue.headline, `${cue.stageId}.headline`)
    assertNonEmpty(cue.prompt, `${cue.stageId}.prompt`)
    assertNonEmpty(cue.tip, `${cue.stageId}.tip`)
    if (cueIds.has(cue.stageId)) throw new Error(`T046 cue stage must be unique: ${cue.stageId}`)
    cueIds.add(cue.stageId)
    if (!VERTICAL_SLICE_T046_STAGES.some((stage) => stage.stageId === cue.stageId)) {
      throw new Error(`T046 cue references unknown stage: ${cue.stageId}`)
    }
  }
  const balancedBossStages = VERTICAL_SLICE_T046_STAGES.filter((stage) => stage.boss !== null)
  for (const stage of balancedBossStages) {
    const boss = stage.boss
    if (boss === null) continue
    const unit = stage.enemyFormation.units.find(
      (candidate) => candidate.battleUnitId === boss.bossBattleUnitId,
    )
    const species = VERTICAL_SLICE_T046_WORLD_CATALOG.species.find(
      (candidate) => candidate.id === unit?.speciesId,
    )
    if (species === undefined) throw new Error(`T046 boss species is missing: ${stage.stageId}`)
    for (const phase of boss.phases) {
      if (!phase.actionSkillIds.includes(species.innateSkillId)) {
        throw new Error(`T046 boss phase must retain innate skill: ${phase.phaseId}`)
      }
    }
  }
  return Object.freeze({
    ...base,
    onboardingCues: VERTICAL_SLICE_ONBOARDING_CUES.length,
    balancedBossStages: balancedBossStages.length,
    adjustedStages: ADJUSTED_STAGE_IDS.length,
    initialUnits: VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA.collection.unitInstances.length,
    initialFormationMembers:
      VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA.formations.formations[0]?.members.length ?? 0,
  })
}

export const VERTICAL_SLICE_T046_VALIDATION = validateVerticalSliceT046()
