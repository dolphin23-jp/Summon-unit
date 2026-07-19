import type { BattleEventLog } from './event-log'
import type { BattleOutcome, BattleState } from './defeat-and-victory'
import type { BattleUnitId } from './unit-state'

export const HP_RATIO_MICRO_SCALE = 1_000_000

export const TIMEOUT_TIE_POLICIES = ['DRAW', 'ALLY_DEFEAT'] as const
export type TimeoutTiePolicy = (typeof TIMEOUT_TIE_POLICIES)[number]

export type TimeoutDecisiveCriterion =
  | 'LIVING_UNIT_COUNT'
  | 'REMAINING_HP_RATIO'
  | 'DAMAGE_DEALT'
  | 'EXACT_TIE'

export interface TimeoutSideMetrics {
  readonly livingUnitCount: number
  readonly remainingHpRatioMicros: number
  readonly damageDealt: number
}

export interface BattleTimeoutResolution {
  readonly outcome: Exclude<BattleOutcome, 'ONGOING'>
  readonly decisiveCriterion: TimeoutDecisiveCriterion
  readonly ally: TimeoutSideMetrics
  readonly enemy: TimeoutSideMetrics
  readonly tiePolicy: TimeoutTiePolicy
}

export interface ResolveBattleTimeoutInput {
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly maxHpByBattleUnitId: Readonly<Record<BattleUnitId, number>>
  readonly tiePolicy?: TimeoutTiePolicy
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function addSafeInteger(left: number, right: number, field: string): number {
  const total = BigInt(left) + BigInt(right)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${field} must be a safe integer`)
  }
  return Number(total)
}

function getUnitMaxHp(
  maxHpByBattleUnitId: Readonly<Record<BattleUnitId, number>>,
  battleUnitId: BattleUnitId,
): number {
  const maxHp = maxHpByBattleUnitId[battleUnitId]
  if (maxHp === undefined) {
    throw new Error(`max HP is missing for battle unit: ${battleUnitId}`)
  }
  assertSafeIntegerAtLeast(maxHp, 1, `maxHpByBattleUnitId.${battleUnitId}`)
  return maxHp
}

function calculateRemainingHpRatioMicros(
  battle: BattleState,
  side: 'ALLY' | 'ENEMY',
  maxHpByBattleUnitId: Readonly<Record<BattleUnitId, number>>,
): number {
  let total = 0
  for (const unit of battle.units) {
    if (unit.side !== side || unit.defeated) {
      continue
    }
    const maxHp = getUnitMaxHp(maxHpByBattleUnitId, unit.battleUnitId)
    const scaled = (BigInt(unit.hp) * BigInt(HP_RATIO_MICRO_SCALE)) / BigInt(maxHp)
    total = addSafeInteger(total, Number(scaled), `${side} remaining HP ratio`)
  }
  return total
}

function calculateDamageDealt(
  battle: BattleState,
  log: BattleEventLog,
  side: 'ALLY' | 'ENEMY',
): number {
  const sideByUnitId = new Map(
    battle.units.map((unit) => [unit.battleUnitId, unit.side] as const),
  )
  let total = 0
  for (const event of log.events) {
    if (event.kind !== 'damage_applied' || event.payload.sourceBattleUnitId === null) {
      continue
    }
    if (sideByUnitId.get(event.payload.sourceBattleUnitId) !== side) {
      continue
    }
    total = addSafeInteger(total, event.payload.appliedDamage, `${side} damage dealt`)
  }
  return total
}

function createSideMetrics(
  battle: BattleState,
  log: BattleEventLog,
  side: 'ALLY' | 'ENEMY',
  maxHpByBattleUnitId: Readonly<Record<BattleUnitId, number>>,
): TimeoutSideMetrics {
  return Object.freeze({
    livingUnitCount: battle.units.filter(
      (unit) => unit.side === side && !unit.defeated,
    ).length,
    remainingHpRatioMicros: calculateRemainingHpRatioMicros(
      battle,
      side,
      maxHpByBattleUnitId,
    ),
    damageDealt: calculateDamageDealt(battle, log, side),
  })
}

function compareMetric(allyValue: number, enemyValue: number): BattleOutcome | null {
  if (allyValue === enemyValue) {
    return null
  }
  return allyValue > enemyValue ? 'ALLY_VICTORY' : 'ALLY_DEFEAT'
}

export function resolveBattleTimeout(
  input: ResolveBattleTimeoutInput,
): BattleTimeoutResolution {
  if (input.battle.outcome !== 'ONGOING') {
    throw new Error('timeout resolution requires an ongoing battle')
  }
  const tiePolicy = input.tiePolicy ?? 'DRAW'
  if (!TIMEOUT_TIE_POLICIES.includes(tiePolicy)) {
    throw new Error('tiePolicy must be DRAW or ALLY_DEFEAT')
  }

  const ally = createSideMetrics(
    input.battle,
    input.log,
    'ALLY',
    input.maxHpByBattleUnitId,
  )
  const enemy = createSideMetrics(
    input.battle,
    input.log,
    'ENEMY',
    input.maxHpByBattleUnitId,
  )

  const livingOutcome = compareMetric(ally.livingUnitCount, enemy.livingUnitCount)
  if (livingOutcome !== null) {
    return Object.freeze({
      outcome: livingOutcome,
      decisiveCriterion: 'LIVING_UNIT_COUNT',
      ally,
      enemy,
      tiePolicy,
    })
  }

  const hpOutcome = compareMetric(
    ally.remainingHpRatioMicros,
    enemy.remainingHpRatioMicros,
  )
  if (hpOutcome !== null) {
    return Object.freeze({
      outcome: hpOutcome,
      decisiveCriterion: 'REMAINING_HP_RATIO',
      ally,
      enemy,
      tiePolicy,
    })
  }

  const damageOutcome = compareMetric(ally.damageDealt, enemy.damageDealt)
  if (damageOutcome !== null) {
    return Object.freeze({
      outcome: damageOutcome,
      decisiveCriterion: 'DAMAGE_DEALT',
      ally,
      enemy,
      tiePolicy,
    })
  }

  return Object.freeze({
    outcome: tiePolicy,
    decisiveCriterion: 'EXACT_TIE',
    ally,
    enemy,
    tiePolicy,
  })
}
