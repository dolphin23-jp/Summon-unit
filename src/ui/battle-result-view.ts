import type {
  HeadlessBattleDefinition,
  HeadlessBattleRunResult,
} from '../battle/headless-battle-runner'
import type { BattleOutcome } from '../battle/defeat-and-victory'
import type { Side } from '../battle/board'
import type { StageBattleSettlement } from '../progression/stage-reward'

export type BattleResultTone = 'VICTORY' | 'DEFEAT' | 'DRAW' | 'LIMIT'

export interface BattleResultCatalystView {
  readonly catalystId: string
  readonly amount: number
}

export interface BattleResultRewardView {
  readonly currency: number
  readonly researchData: number
  readonly catalyst: number
  readonly catalysts: readonly BattleResultCatalystView[]
  readonly stub: boolean
}

export interface BattleResultAnalysisView {
  readonly speciesId: string
  readonly change: number
}

export interface BattleResultUnitStatsView {
  readonly battleUnitId: string
  readonly speciesId: string
  readonly side: Side
  readonly hp: number
  readonly maxHp: number
  readonly defeated: boolean
  readonly actionCount: number
  readonly skillUseCount: number
  readonly damageDealt: number
  readonly damageTaken: number
  readonly barrierAbsorbed: number
  readonly defeatCount: number
}

export interface BattleResultView {
  readonly tone: BattleResultTone
  readonly mark: string
  readonly title: string
  readonly summary: string
  readonly outcome: BattleOutcome
  readonly terminationLabel: string
  readonly finalVirtualTime: number
  readonly totalActions: number
  readonly rewards: BattleResultRewardView
  readonly repairCost: number
  readonly analysisChanges: readonly BattleResultAnalysisView[]
  readonly notifications: readonly string[]
  readonly regionalPoints: { readonly before: number; readonly after: number } | null
  readonly unitStats: readonly BattleResultUnitStatsView[]
}

interface MutableUnitStats {
  battleUnitId: string
  speciesId: string
  side: Side
  hp: number
  maxHp: number
  defeated: boolean
  actionCount: number
  skillUseCount: number
  damageDealt: number
  damageTaken: number
  barrierAbsorbed: number
  defeatCount: number
}

function compareIds(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function toneForOutcome(outcome: BattleOutcome): BattleResultTone {
  switch (outcome) {
    case 'ALLY_VICTORY':
      return 'VICTORY'
    case 'ALLY_DEFEAT':
      return 'DEFEAT'
    case 'DRAW':
      return 'DRAW'
    case 'ONGOING':
      return 'LIMIT'
  }
}

function presentationForTone(tone: BattleResultTone): {
  readonly mark: string
  readonly title: string
  readonly summary: string
} {
  switch (tone) {
    case 'VICTORY':
      return Object.freeze({ mark: 'WIN', title: '戦闘勝利', summary: '敵部隊を全滅させました。' })
    case 'DEFEAT':
      return Object.freeze({ mark: 'LOSE', title: '戦闘敗北', summary: '味方部隊が戦闘継続不能になりました。' })
    case 'DRAW':
      return Object.freeze({ mark: 'DRAW', title: '引き分け', summary: '勝敗条件が同値で終了しました。' })
    case 'LIMIT':
      return Object.freeze({ mark: 'LIMIT', title: '判定終了', summary: '行動上限に到達したため戦闘を終了しました。' })
  }
}

function stubRewardForTone(tone: BattleResultTone): BattleResultRewardView {
  switch (tone) {
    case 'VICTORY':
      return Object.freeze({
        currency: 120,
        researchData: 35,
        catalyst: 1,
        catalysts: Object.freeze([{ catalystId: 'stub.catalyst', amount: 1 }]),
        stub: true,
      })
    case 'DRAW':
      return Object.freeze({
        currency: 45,
        researchData: 12,
        catalyst: 0,
        catalysts: Object.freeze([]),
        stub: true,
      })
    case 'DEFEAT':
    case 'LIMIT':
      return Object.freeze({
        currency: 20,
        researchData: 6,
        catalyst: 0,
        catalysts: Object.freeze([]),
        stub: true,
      })
  }
}

function settledReward(settlement: StageBattleSettlement): BattleResultRewardView {
  const catalysts = Object.freeze(
    settlement.rewards.total.catalysts.map((catalyst) => Object.freeze({ ...catalyst })),
  )
  return Object.freeze({
    currency: settlement.rewards.total.currency,
    researchData: settlement.rewards.total.researchData,
    catalyst: catalysts.reduce((total, catalyst) => total + catalyst.amount, 0),
    catalysts,
    stub: false,
  })
}

function analysisChangeForTone(tone: BattleResultTone): number {
  switch (tone) {
    case 'VICTORY':
      return 8
    case 'DRAW':
      return 4
    case 'DEFEAT':
    case 'LIMIT':
      return 2
  }
}

function notificationsForTone(
  tone: BattleResultTone,
  allyStats: readonly BattleResultUnitStatsView[],
): readonly string[] {
  const mostActive = [...allyStats].sort((left, right) => {
    if (left.actionCount !== right.actionCount) {
      return right.actionCount - left.actionCount
    }
    return compareIds(left.battleUnitId, right.battleUnitId)
  })[0]

  if (tone === 'VICTORY') {
    return Object.freeze([
      mostActive === undefined
        ? '開花候補を確認できます（スタブ）'
        : `${mostActive.battleUnitId} に開花候補があります（スタブ）`,
      '新しい研究ヒントを獲得しました（スタブ）',
    ])
  }
  return Object.freeze(['戦闘観察記録が研究ノートへ追加されました（スタブ）'])
}

function createUnitStats(
  definition: HeadlessBattleDefinition,
  result: HeadlessBattleRunResult,
): readonly BattleResultUnitStatsView[] {
  const speciesMaxHp = new Map(definition.species.map((species) => [species.id, species.stats.hp]))
  const statsById = new Map<string, MutableUnitStats>()

  for (const unit of result.summary.units) {
    const maxHp = speciesMaxHp.get(unit.speciesId)
    if (maxHp === undefined) {
      throw new Error(`species master is missing for result unit: ${unit.speciesId}`)
    }
    statsById.set(unit.battleUnitId, {
      battleUnitId: unit.battleUnitId,
      speciesId: unit.speciesId,
      side: unit.side,
      hp: unit.hp,
      maxHp,
      defeated: unit.defeated,
      actionCount: 0,
      skillUseCount: 0,
      damageDealt: 0,
      damageTaken: 0,
      barrierAbsorbed: 0,
      defeatCount: 0,
    })
  }

  for (const event of result.log.events) {
    switch (event.kind) {
      case 'turn_started': {
        const stats = statsById.get(event.payload.battleUnitId)
        if (stats !== undefined) stats.actionCount += 1
        break
      }
      case 'skill_used': {
        const stats = statsById.get(event.payload.actorBattleUnitId)
        if (stats !== undefined) stats.skillUseCount += 1
        break
      }
      case 'damage_applied': {
        const target = statsById.get(event.payload.targetBattleUnitId)
        if (target !== undefined) target.damageTaken += event.payload.appliedDamage
        if (event.payload.sourceBattleUnitId !== null) {
          const source = statsById.get(event.payload.sourceBattleUnitId)
          if (source !== undefined) source.damageDealt += event.payload.appliedDamage
        }
        break
      }
      case 'barrier_absorbed': {
        const target = statsById.get(event.payload.targetBattleUnitId)
        if (target !== undefined) target.barrierAbsorbed += event.payload.absorbedDamage
        break
      }
      case 'unit_defeated': {
        if (event.payload.killerBattleUnitId !== null) {
          const killer = statsById.get(event.payload.killerBattleUnitId)
          if (killer !== undefined) killer.defeatCount += 1
        }
        break
      }
      default:
        break
    }
  }

  return Object.freeze(
    [...statsById.values()]
      .sort((left, right) => {
        if (left.side !== right.side) return left.side === 'ALLY' ? -1 : 1
        return compareIds(left.battleUnitId, right.battleUnitId)
      })
      .map((stats) => Object.freeze({ ...stats })),
  )
}

export function createBattleResultView(
  definition: HeadlessBattleDefinition,
  result: HeadlessBattleRunResult,
  settlement?: StageBattleSettlement | null,
): BattleResultView {
  const unitStats = createUnitStats(definition, result)
  const tone = toneForOutcome(result.summary.outcome)
  const presentation = presentationForTone(tone)
  const stubAnalysisChange = analysisChangeForTone(tone)
  const analysisChanges =
    settlement === undefined || settlement === null
      ? [...new Set(result.summary.units.map((unit) => unit.speciesId))]
          .sort(compareIds)
          .map((speciesId) => Object.freeze({ speciesId, change: stubAnalysisChange }))
      : settlement.analysisChanges
          .filter((change) => change.appliedAmount > 0)
          .map((change) =>
            Object.freeze({ speciesId: change.speciesId, change: change.appliedAmount }),
          )

  const allyStats = unitStats.filter((unit) => unit.side === 'ALLY')
  const missingAllyHp = allyStats.reduce((total, unit) => total + (unit.maxHp - unit.hp), 0)
  const defeatedAllyCount = allyStats.filter((unit) => unit.defeated).length
  const repairCost = Math.ceil(missingAllyHp / 10) * 5 + defeatedAllyCount * 20

  return Object.freeze({
    tone,
    mark: presentation.mark,
    title: presentation.title,
    summary: presentation.summary,
    outcome: result.summary.outcome,
    terminationLabel:
      result.summary.termination === 'ACTION_LIMIT_REACHED' ? '行動上限' : '勝敗確定',
    finalVirtualTime: result.summary.finalVirtualTime,
    totalActions: result.summary.totalActions,
    rewards:
      settlement === undefined || settlement === null
        ? stubRewardForTone(tone)
        : settledReward(settlement),
    repairCost,
    analysisChanges: Object.freeze(analysisChanges),
    notifications:
      settlement === undefined || settlement === null
        ? notificationsForTone(tone, allyStats)
        : settlement.notifications,
    regionalPoints:
      settlement === undefined || settlement === null
        ? null
        : Object.freeze({
            before: settlement.regionalPointsBefore,
            after: settlement.regionalPointsAfter,
          }),
    unitStats,
  })
}
