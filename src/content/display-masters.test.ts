import { describe, expect, it } from 'vitest'
import {
  DISPLAY_MASTER_VALIDATION,
  formatUnitDisplayName,
  resolveCatalystName,
  resolveDisplayName,
  resolveRewardName,
  resolveSkillDescription,
  resolveSkillName,
  resolveSpeciesName,
  resolveStageName,
  validateDisplayMasterEntries,
} from './display-masters'

describe('display masters', () => {
  it('resolves authored ids without exposing internal ids', () => {
    expect(resolveSpeciesName('species.slice.grassfang-rat')).toBe('草牙ネズミ')
    expect(resolveSkillName('skill.slice.moss-drop')).toBe('苔雫')
    expect(resolveSkillDescription('skill.slice.moss-drop')).toContain('回復')
    expect(resolveStageName('stage.slice.a-01-order')).not.toContain('.')
    expect(resolveCatalystName('catalyst.slice.wind')).toBe('風触媒')
    expect(resolveRewardName('regional.slice-a.wind-30')).toBe('風触媒補給')
    expect(resolveDisplayName('unknown.value')).toBe('不明な項目')
    expect(formatUnitDisplayName('species.slice.grassfang-rat', 'unit.slice.grassfang-01')).toBe(
      '草牙ネズミ #1',
    )
  })

  it('covers the vertical slice masters', () => {
    expect(DISPLAY_MASTER_VALIDATION.species).toBeGreaterThanOrEqual(16)
    expect(DISPLAY_MASTER_VALIDATION.skills).toBeGreaterThanOrEqual(40)
    expect(DISPLAY_MASTER_VALIDATION.stages).toBeGreaterThanOrEqual(17)
    expect(DISPLAY_MASTER_VALIDATION.regions).toBeGreaterThanOrEqual(2)
  })

  it('rejects empty descriptions and id-shaped display names', () => {
    expect(() =>
      validateDisplayMasterEntries([
        { id: 'skill.test.empty', kind: 'SKILL', name: '試験技', description: '' },
      ]),
    ).toThrow('skill description must be non-empty')
    expect(() =>
      validateDisplayMasterEntries([
        { id: 'species.test.bad', kind: 'SPECIES', name: 'species.test.bad' },
      ]),
    ).toThrow('display name must not expose an id')
  })
})
