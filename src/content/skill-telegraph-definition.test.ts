import { describe, expect, it } from 'vitest'
import {
  assertValidSkillDefinition,
  resolveSkillTelegraphDelay,
  type SkillDefinition,
} from './skill-definition'

function skill(telegraphDelay?: number | null): SkillDefinition {
  return Object.freeze({
    id: 'skill.telegraph-test',
    slotType: 'INNATE',
    actionCost: 100,
    telegraphDelay,
    targetType: 'SINGLE_ENEMY',
    damageMultiplierPermille: 1000,
  })
}

describe('T022 telegraph skill metadata', () => {
  it('keeps existing skills immediate when telegraphDelay is absent or null', () => {
    const absent = skill()
    const explicitNull = skill(null)

    expect(() => assertValidSkillDefinition(absent)).not.toThrow()
    expect(() => assertValidSkillDefinition(explicitNull)).not.toThrow()
    expect(resolveSkillTelegraphDelay(absent)).toBeNull()
    expect(resolveSkillTelegraphDelay(explicitNull)).toBeNull()
  })

  it('accepts a positive integer telegraph delay', () => {
    const telegraphed = skill(25)

    expect(() => assertValidSkillDefinition(telegraphed)).not.toThrow()
    expect(resolveSkillTelegraphDelay(telegraphed)).toBe(25)
  })

  it('rejects zero, negative, fractional, and unsafe delays', () => {
    for (const delay of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => assertValidSkillDefinition(skill(delay))).toThrow(
        'skill.telegraphDelay must be a safe integer greater than or equal to 1',
      )
    }
  })
})
