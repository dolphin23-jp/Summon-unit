import {
  assertValidAttributeId,
  normalizeAttributeId,
  type AttributeId,
  type AttributeInputId,
} from './attribute'

export type SkillId = string

export const DAMAGE_MULTIPLIER_SCALE = 1000
export const DEFAULT_CHAIN_TARGET_COUNT = 3

export const SKILL_SLOT_TYPES = ['INNATE', 'GENERIC', 'BLOOM'] as const
export type SkillSlotType = (typeof SKILL_SLOT_TYPES)[number]

export const SKILL_TARGET_TYPES = [
  'SINGLE_ENEMY',
  'SINGLE_ALLY',
  'SINGLE_ALLY_AND_ADJACENT',
  'SELF',
  'SELF_AREA',
] as const
export type SkillTargetType = (typeof SKILL_TARGET_TYPES)[number]

export const SKILL_TARGET_SIDES = ['ENEMY', 'ALLY', 'SELF'] as const
export type SkillTargetSide = (typeof SKILL_TARGET_SIDES)[number]

export const SKILL_TARGET_SHAPES = ['SINGLE', 'SINGLE_AND_ADJACENT'] as const
export type SkillTargetShape = (typeof SKILL_TARGET_SHAPES)[number]

export const SKILL_REACH_METHODS = [
  'CONTACT',
  'DIRECT',
  'PIERCE',
  'ARC',
  'SNIPE',
  'SELF',
  'GLOBAL',
] as const
export type SkillReachMethod = (typeof SKILL_REACH_METHODS)[number]

export const SKILL_AREA_MASKS = [
  'SINGLE',
  'HORIZONTAL_ROW',
  'VERTICAL_COLUMN',
  'TARGET_AND_SIDES',
  'TARGET_AND_BEHIND',
  'CROSS',
  'SURROUNDING_EIGHT',
  'CHAIN',
  'SIDE_ALL',
] as const
export type SkillAreaMask = (typeof SKILL_AREA_MASKS)[number]

export interface SkillTargetSelector {
  readonly side: SkillTargetSide
  readonly shape: SkillTargetShape
}

export const SKILL_USAGE_CONDITION_TYPES = [
  'ACTOR_HP_AT_OR_BELOW',
  'ACTOR_HP_AT_OR_ABOVE',
  'TARGET_HP_AT_OR_BELOW',
  'TARGET_HP_AT_OR_ABOVE',
] as const
export type SkillUsageConditionType = (typeof SKILL_USAGE_CONDITION_TYPES)[number]

export interface SkillUsageCondition {
  readonly type: SkillUsageConditionType
  readonly thresholdPermille: number
}

export interface SkillDefinition {
  readonly id: SkillId
  readonly slotType: SkillSlotType
  readonly attributeId?: AttributeInputId
  readonly actionCost: number
  readonly telegraphDelay?: number | null
  readonly targetType: SkillTargetType
  readonly targetSelector?: SkillTargetSelector
  readonly reachMethod?: SkillReachMethod
  readonly areaMask?: SkillAreaMask
  readonly chainTargetCount?: number
  readonly damageMultiplierPermille: number
  readonly healingPower?: number
  readonly cooldownActions?: number
  readonly usageLimit?: number
  readonly usageConditions?: readonly SkillUsageCondition[]
}

const DEFAULT_TARGET_SELECTOR_BY_TYPE: Readonly<
  Record<SkillTargetType, SkillTargetSelector>
> = Object.freeze({
  SINGLE_ENEMY: Object.freeze({ side: 'ENEMY', shape: 'SINGLE' }),
  SINGLE_ALLY: Object.freeze({ side: 'ALLY', shape: 'SINGLE' }),
  SINGLE_ALLY_AND_ADJACENT: Object.freeze({
    side: 'ALLY',
    shape: 'SINGLE_AND_ADJACENT',
  }),
  SELF: Object.freeze({ side: 'SELF', shape: 'SINGLE' }),
  SELF_AREA: Object.freeze({ side: 'SELF', shape: 'SINGLE_AND_ADJACENT' }),
})

const DEFAULT_REACH_METHOD_BY_TYPE: Readonly<Record<SkillTargetType, SkillReachMethod>> =
  Object.freeze({
    SINGLE_ENEMY: 'DIRECT',
    SINGLE_ALLY: 'SNIPE',
    SINGLE_ALLY_AND_ADJACENT: 'SNIPE',
    SELF: 'SELF',
    SELF_AREA: 'SELF',
  })

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function assertValidTargetSelector(selector: SkillTargetSelector): void {
  if (!SKILL_TARGET_SIDES.includes(selector.side)) {
    throw new Error('skill.targetSelector.side is invalid')
  }
  if (!SKILL_TARGET_SHAPES.includes(selector.shape)) {
    throw new Error('skill.targetSelector.shape is invalid')
  }
}

function assertValidUsageCondition(
  condition: SkillUsageCondition,
  index: number,
): void {
  if (!SKILL_USAGE_CONDITION_TYPES.includes(condition.type)) {
    throw new Error(`skill.usageConditions[${index}].type is invalid`)
  }
  assertSafeIntegerAtLeast(
    condition.thresholdPermille,
    0,
    `skill.usageConditions[${index}].thresholdPermille`,
  )
  if (condition.thresholdPermille > 1000) {
    throw new Error(
      `skill.usageConditions[${index}].thresholdPermille must be less than or equal to 1000`,
    )
  }
}

export function resolveSkillTargetSelector(skill: SkillDefinition): SkillTargetSelector {
  if (!SKILL_TARGET_TYPES.includes(skill.targetType)) {
    throw new Error('skill.targetType is invalid')
  }
  const expected = DEFAULT_TARGET_SELECTOR_BY_TYPE[skill.targetType]
  if (skill.targetSelector === undefined) {
    return expected
  }
  assertValidTargetSelector(skill.targetSelector)
  if (
    skill.targetSelector.side !== expected.side ||
    skill.targetSelector.shape !== expected.shape
  ) {
    throw new Error('skill.targetSelector must match skill.targetType')
  }
  return Object.freeze({ ...skill.targetSelector })
}

export function resolveSkillReachMethod(skill: SkillDefinition): SkillReachMethod {
  const reachMethod = skill.reachMethod ?? DEFAULT_REACH_METHOD_BY_TYPE[skill.targetType]
  if (!SKILL_REACH_METHODS.includes(reachMethod)) {
    throw new Error('skill.reachMethod is invalid')
  }
  return reachMethod
}

export function resolveSkillAreaMask(skill: SkillDefinition): SkillAreaMask {
  const areaMask = skill.areaMask ?? 'SINGLE'
  if (!SKILL_AREA_MASKS.includes(areaMask)) {
    throw new Error('skill.areaMask is invalid')
  }
  return areaMask
}

export function resolveSkillChainTargetCount(skill: SkillDefinition): number {
  const areaMask = resolveSkillAreaMask(skill)
  if (areaMask !== 'CHAIN') {
    if (skill.chainTargetCount !== undefined) {
      throw new Error('skill.chainTargetCount is only valid for CHAIN areaMask')
    }
    return 1
  }

  const count = skill.chainTargetCount ?? DEFAULT_CHAIN_TARGET_COUNT
  assertSafeIntegerAtLeast(count, 2, 'skill.chainTargetCount')
  return count
}

export function resolveSkillTelegraphDelay(skill: SkillDefinition): number | null {
  const delay = skill.telegraphDelay ?? null
  if (delay === null) {
    return null
  }
  assertSafeIntegerAtLeast(delay, 1, 'skill.telegraphDelay')
  return delay
}

function assertCompatibleReachAndTarget(skill: SkillDefinition): void {
  const selector = resolveSkillTargetSelector(skill)
  const reachMethod = resolveSkillReachMethod(skill)
  const areaMask = resolveSkillAreaMask(skill)

  if (reachMethod === 'SELF' && selector.side !== 'SELF') {
    throw new Error('SELF reachMethod requires a SELF target selector')
  }
  if (selector.side === 'SELF' && reachMethod !== 'SELF') {
    throw new Error('SELF target selector requires SELF reachMethod')
  }
  if (
    (reachMethod === 'CONTACT' ||
      reachMethod === 'DIRECT' ||
      reachMethod === 'PIERCE') &&
    selector.side !== 'ENEMY'
  ) {
    throw new Error(`${reachMethod} reachMethod requires an ENEMY target selector`)
  }
  if (reachMethod === 'GLOBAL' && areaMask !== 'SIDE_ALL') {
    throw new Error('GLOBAL reachMethod requires SIDE_ALL areaMask')
  }

  resolveSkillChainTargetCount(skill)
}

export function assertValidSkillDefinition(skill: SkillDefinition): void {
  assertNonEmptyString(skill.id, 'skill.id')

  if (!SKILL_SLOT_TYPES.includes(skill.slotType)) {
    throw new Error('skill.slotType must be INNATE, GENERIC, or BLOOM')
  }

  if (skill.attributeId !== undefined) {
    assertValidAttributeId(skill.attributeId)
  }

  resolveSkillTargetSelector(skill)
  assertCompatibleReachAndTarget(skill)

  assertSafeIntegerAtLeast(skill.actionCost, 1, 'skill.actionCost')
  resolveSkillTelegraphDelay(skill)
  assertSafeIntegerAtLeast(
    skill.damageMultiplierPermille,
    1,
    'skill.damageMultiplierPermille',
  )
  if (skill.healingPower !== undefined) {
    assertSafeIntegerAtLeast(skill.healingPower, 1, 'skill.healingPower')
    if (resolveSkillTargetSelector(skill).side === 'ENEMY') {
      throw new Error('skill.healingPower requires an ALLY or SELF target selector')
    }
  }

  if (skill.cooldownActions !== undefined) {
    assertSafeIntegerAtLeast(skill.cooldownActions, 0, 'skill.cooldownActions')
  }
  if (skill.usageLimit !== undefined) {
    assertSafeIntegerAtLeast(skill.usageLimit, 1, 'skill.usageLimit')
  }

  const seenConditions = new Set<SkillUsageConditionType>()
  for (const [index, condition] of (skill.usageConditions ?? []).entries()) {
    assertValidUsageCondition(condition, index)
    if (seenConditions.has(condition.type)) {
      throw new Error(`skill.usageConditions must not repeat ${condition.type}`)
    }
    seenConditions.add(condition.type)
  }
}

export function resolveSkillAttributeId(skill: SkillDefinition): AttributeId {
  assertValidSkillDefinition(skill)
  return normalizeAttributeId(skill.attributeId ?? 'attribute.neutral')
}
