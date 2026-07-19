import { describe, expect, it } from 'vitest'
import { getBattleSpeedOptions } from './MinimalBattleScreen'

describe('cleared battle speed options', () => {
  it('keeps uncleared stages at x4 or lower', () => {
    expect(getBattleSpeedOptions(false)).toEqual([1, 2, 4])
  })

  it('adds x8 only for cleared stages', () => {
    expect(getBattleSpeedOptions(true)).toEqual([1, 2, 4, 8])
  })
})
