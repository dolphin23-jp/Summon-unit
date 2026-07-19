import {
  assertValidAttributeId,
  normalizeAttributeId,
  type AttributeId,
  type AttributeInputId,
} from './attribute'

export type SkillId = string

export const DAMAGE_MULTIPLIER_SCALE = 1000

export const SKILL_SLOT_TYPES = ['INNATE', 'GENERIC', 'BLOOM'] as const
export type SkillSlotType = (typeof SKILL_SLOT_TYPES)[number]

export interface SkillDefinition {
  readonly id: SkillId
  readonly slotType: SkillSlotType
  readonly attributeId?: AttributeInputId
  readonly actionCost: number
  readonly targetType: 'SINGLE_ENEMY'
  readonly damageMultiplierPermille: number
}

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

export function assertValidSkillDefinition(skill: SkillDefinition): void {
  assertNonEmptyString(skill.id, 'skill.id')

  if (!SKILL_SLOT_TYPES.includes(skill.slotType)) {
    throw new Error('skill.slotType must be INNATE, GENERIC, or BLOOM')
  }

  if (skill.attributeId !== undefined) {
    assertValidAttributeId(skill.attributeId)
  }

  if (skill.targetType !== 'SINGLE_ENEMY') {
    throw new Error('skill.targetType must be SINGLE_ENEMY')
  }

  assertSafeIntegerAtLeast(skill.actionCost, 1, 'skill.actionCost')
  assertSafeIntegerAtLeast(
    skill.damageMultiplierPermille,
    1,
    'skill.damageMultiplierPermille',
  )
}

export function resolveSkillAttributeId(skill: SkillDefinition): AttributeId {
  assertValidSkillDefinition(skill)
  return normalizeAttributeId(skill.attributeId ?? 'attribute.neutral')
}
