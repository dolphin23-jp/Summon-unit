import { describe, expect, it } from 'vitest'
import { isBattleMotionLevel, resolveInitialBattleMotionLevel } from './battle-accessibility'

describe('battle motion accessibility', () => {
  it('treats prefers-reduced-motion as minimal animation regardless of stored preference', () => {
    expect(resolveInitialBattleMotionLevel(null, true)).toBe('MINIMAL')
    expect(resolveInitialBattleMotionLevel('STANDARD', true)).toBe('MINIMAL')
  })

  it('uses a valid stored preference when reduced motion is not requested', () => {
    expect(resolveInitialBattleMotionLevel('REDUCED', false)).toBe('REDUCED')
    expect(resolveInitialBattleMotionLevel('invalid', false)).toBe('STANDARD')
    expect(isBattleMotionLevel('MINIMAL')).toBe(true)
  })
})
