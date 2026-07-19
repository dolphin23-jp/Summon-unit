import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHAIN_TARGET_COUNT,
  assertValidSkillDefinition,
  resolveSkillAreaMask,
  resolveSkillChainTargetCount,
  resolveSkillReachMethod,
  type SkillDefinition,
} from './skill-definition'

const baseSkill: SkillDefinition = Object.freeze({
  id: 'skill.test',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})

describe('T021 skill reach and area metadata', () => {
  it('keeps existing single-enemy skills compatible with DIRECT and SINGLE defaults', () => {
    expect(() => assertValidSkillDefinition(baseSkill)).not.toThrow()
    expect(resolveSkillReachMethod(baseSkill)).toBe('DIRECT')
    expect(resolveSkillAreaMask(baseSkill)).toBe('SINGLE')
  })

  it('accepts every new reach method with a compatible selector', () => {
    const skills: readonly SkillDefinition[] = [
      { ...baseSkill, id: 'skill.contact', reachMethod: 'CONTACT' },
      { ...baseSkill, id: 'skill.pierce', reachMethod: 'PIERCE' },
      { ...baseSkill, id: 'skill.arc', reachMethod: 'ARC' },
      { ...baseSkill, id: 'skill.snipe', reachMethod: 'SNIPE' },
      {
        ...baseSkill,
        id: 'skill.self',
        targetType: 'SELF',
        reachMethod: 'SELF',
      },
      {
        ...baseSkill,
        id: 'skill.global',
        reachMethod: 'GLOBAL',
        areaMask: 'SIDE_ALL',
      },
    ]

    for (const skill of skills) {
      expect(() => assertValidSkillDefinition(skill)).not.toThrow()
    }
  })

  it('uses a stable default chain length and validates explicit chain counts', () => {
    const chainSkill: SkillDefinition = {
      ...baseSkill,
      areaMask: 'CHAIN',
    }
    expect(resolveSkillChainTargetCount(chainSkill)).toBe(DEFAULT_CHAIN_TARGET_COUNT)
    expect(
      resolveSkillChainTargetCount({ ...chainSkill, chainTargetCount: 5 }),
    ).toBe(5)
    expect(() =>
      assertValidSkillDefinition({ ...chainSkill, chainTargetCount: 1 }),
    ).toThrow('skill.chainTargetCount must be a safe integer greater than or equal to 2')
  })

  it('rejects incompatible reach and area combinations', () => {
    expect(() =>
      assertValidSkillDefinition({
        ...baseSkill,
        targetType: 'SINGLE_ALLY',
        reachMethod: 'CONTACT',
      }),
    ).toThrow('CONTACT reachMethod requires an ENEMY target selector')
    expect(() =>
      assertValidSkillDefinition({ ...baseSkill, reachMethod: 'GLOBAL' }),
    ).toThrow('GLOBAL reachMethod requires SIDE_ALL areaMask')
    expect(() =>
      assertValidSkillDefinition({ ...baseSkill, chainTargetCount: 4 }),
    ).toThrow('skill.chainTargetCount is only valid for CHAIN areaMask')
  })
})
