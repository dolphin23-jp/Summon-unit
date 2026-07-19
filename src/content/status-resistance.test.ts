import { describe, expect, it } from 'vitest'
import {
  applyStatusResistanceMagnitude,
  assertValidStatusResistanceTags,
  getStatusResistanceMultiplierPermille,
  getStatusResistanceTagId,
  resolveStatusResistanceStage,
} from './status-resistance'

describe('status resistance tags', () => {
  it('defaults to normal resistance when no matching tag exists', () => {
    expect(resolveStatusResistanceStage(['tag.beast'], 'poison')).toBe('NORMAL')
    expect(getStatusResistanceMultiplierPermille(['tag.beast'], 'poison')).toBe(1000)
  })

  it.each([
    ['IMMUNE', 0],
    ['STRONG', 500],
    ['LIGHT', 750],
    ['NORMAL', 1000],
    ['WEAK', 1250],
  ] as const)('resolves %s to %i permille', (stage, multiplier) => {
    const tag = getStatusResistanceTagId('poison', stage)

    expect(resolveStatusResistanceStage([tag], 'poison')).toBe(stage)
    expect(getStatusResistanceMultiplierPermille([tag], 'poison')).toBe(multiplier)
  })

  it('scales a deterministic status magnitude and treats immunity as zero', () => {
    expect(applyStatusResistanceMagnitude(3, 'IMMUNE')).toBe(0)
    expect(applyStatusResistanceMagnitude(3, 'STRONG')).toBe(2)
    expect(applyStatusResistanceMagnitude(3, 'LIGHT')).toBe(2)
    expect(applyStatusResistanceMagnitude(3, 'NORMAL')).toBe(3)
    expect(applyStatusResistanceMagnitude(3, 'WEAK')).toBe(4)
  })

  it('supports independent resistance tags for different statuses', () => {
    const tags = [
      getStatusResistanceTagId('poison', 'IMMUNE'),
      getStatusResistanceTagId('burn', 'WEAK'),
    ]

    expect(() => assertValidStatusResistanceTags(tags)).not.toThrow()
    expect(resolveStatusResistanceStage(tags, 'poison')).toBe('IMMUNE')
    expect(resolveStatusResistanceStage(tags, 'burn')).toBe('WEAK')
  })

  it('rejects conflicting stages for one status', () => {
    const tags = [
      getStatusResistanceTagId('poison', 'STRONG'),
      getStatusResistanceTagId('poison', 'WEAK'),
    ]

    expect(() => assertValidStatusResistanceTags(tags)).toThrow(
      'status resistance tags conflict for poison',
    )
    expect(() => resolveStatusResistanceStage(tags, 'poison')).toThrow(
      'status resistance tags conflict for poison',
    )
  })

  it('rejects malformed resistance tags and duplicate tags', () => {
    expect(() => assertValidStatusResistanceTags(['tag.resistance.poison.unknown'])).toThrow(
      'status resistance tag is invalid: tag.resistance.poison.unknown',
    )
    expect(() => assertValidStatusResistanceTags(['tag.beast', 'tag.beast'])).toThrow(
      'tagIds must not contain duplicates: tag.beast',
    )
  })
})
