import {
  assertValidActiveEffectCollection,
  type ActiveEffectState,
} from './effect-framework'

export const STAT_MULTIPLIER_SCALE = 1000

export const BATTLE_STAT_IDS = [
  'ATTACK',
  'DEFENSE',
  'SPEED',
  'ACTION_COST',
  'HEALING_RECEIVED',
] as const

export type BattleStatId = (typeof BATTLE_STAT_IDS)[number]

export interface BattleStatModifierRule {
  readonly stat: BattleStatId
  readonly buffEffectId: string
  readonly debuffEffectId: string
  readonly buffDirection: 1 | -1
  readonly minimumMultiplierPermille: number
  readonly maximumMultiplierPermille: number
}

export const BATTLE_STAT_MODIFIER_RULES: Readonly<Record<BattleStatId, BattleStatModifierRule>> =
  Object.freeze({
    ATTACK: Object.freeze({
      stat: 'ATTACK',
      buffEffectId: 'effect.buff.attack',
      debuffEffectId: 'effect.debuff.attack',
      buffDirection: 1,
      minimumMultiplierPermille: 500,
      maximumMultiplierPermille: 2000,
    }),
    DEFENSE: Object.freeze({
      stat: 'DEFENSE',
      buffEffectId: 'effect.buff.defense',
      debuffEffectId: 'effect.debuff.defense',
      buffDirection: 1,
      minimumMultiplierPermille: 250,
      maximumMultiplierPermille: 2500,
    }),
    SPEED: Object.freeze({
      stat: 'SPEED',
      buffEffectId: 'effect.buff.speed',
      debuffEffectId: 'effect.debuff.speed',
      buffDirection: 1,
      minimumMultiplierPermille: 500,
      maximumMultiplierPermille: 1500,
    }),
    ACTION_COST: Object.freeze({
      stat: 'ACTION_COST',
      buffEffectId: 'effect.buff.action-cost',
      debuffEffectId: 'effect.debuff.action-cost',
      buffDirection: -1,
      minimumMultiplierPermille: 500,
      maximumMultiplierPermille: 2000,
    }),
    HEALING_RECEIVED: Object.freeze({
      stat: 'HEALING_RECEIVED',
      buffEffectId: 'effect.buff.healing-received',
      debuffEffectId: 'effect.debuff.healing-received',
      buffDirection: 1,
      minimumMultiplierPermille: 0,
      maximumMultiplierPermille: 2500,
    }),
  })

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function clampBigInt(value: bigint, minimum: number, maximum: number): bigint {
  const minimumBig = BigInt(minimum)
  const maximumBig = BigInt(maximum)
  if (value < minimumBig) {
    return minimumBig
  }
  if (value > maximumBig) {
    return maximumBig
  }
  return value
}

function getEffectContribution(
  effect: ActiveEffectState,
  rule: BattleStatModifierRule,
): bigint {
  let direction = 0
  if (effect.effectId === rule.buffEffectId) {
    direction = rule.buffDirection
  } else if (effect.effectId === rule.debuffEffectId) {
    direction = -rule.buffDirection
  } else if (
    rule.stat === 'HEALING_RECEIVED' &&
    effect.effectId === 'effect.status.healing-inhibition'
  ) {
    direction = -1
  }
  if (direction === 0) {
    return 0n
  }
  return BigInt(direction) * BigInt(effect.strength) * BigInt(effect.stacks)
}

export function getBattleStatMultiplierPermille(
  effects: readonly ActiveEffectState[],
  stat: BattleStatId,
): number {
  assertValidActiveEffectCollection(effects)
  const rule = BATTLE_STAT_MODIFIER_RULES[stat]
  if (rule === undefined) {
    throw new Error(`battle stat is invalid: ${stat}`)
  }

  let multiplier = BigInt(STAT_MULTIPLIER_SCALE)
  for (const effect of effects) {
    multiplier += getEffectContribution(effect, rule)
  }
  multiplier = clampBigInt(
    multiplier,
    rule.minimumMultiplierPermille,
    rule.maximumMultiplierPermille,
  )

  if (multiplier > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('battle stat multiplier must be a safe integer')
  }
  return Number(multiplier)
}

export function applyPermilleMultiplier(
  value: number,
  multiplierPermille: number,
  field: string = 'value',
): number {
  assertSafeIntegerAtLeast(value, 0, field)
  assertSafeIntegerAtLeast(multiplierPermille, 0, 'multiplierPermille')

  const numerator = BigInt(value) * BigInt(multiplierPermille)
  const rounded = (numerator + BigInt(STAT_MULTIPLIER_SCALE / 2)) / BigInt(STAT_MULTIPLIER_SCALE)
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${field} after multiplier must be a safe integer`)
  }
  return Number(rounded)
}

export function getModifiedBattleStatValue(
  baseValue: number,
  effects: readonly ActiveEffectState[],
  stat: Exclude<BattleStatId, 'HEALING_RECEIVED'>,
): number {
  const minimumBase = stat === 'SPEED' || stat === 'ACTION_COST' ? 1 : 0
  assertSafeIntegerAtLeast(baseValue, minimumBase, `base${stat}`)
  const modified = applyPermilleMultiplier(
    baseValue,
    getBattleStatMultiplierPermille(effects, stat),
    `base${stat}`,
  )
  return stat === 'SPEED' || stat === 'ACTION_COST' ? Math.max(1, modified) : modified
}

export function getHealingReceivedMultiplierPermille(
  effects: readonly ActiveEffectState[],
): number {
  return getBattleStatMultiplierPermille(effects, 'HEALING_RECEIVED')
}

export function applyHealingReceivedModifier(
  baseHealing: number,
  effects: readonly ActiveEffectState[],
): number {
  return applyPermilleMultiplier(
    baseHealing,
    getHealingReceivedMultiplierPermille(effects),
    'baseHealing',
  )
}
