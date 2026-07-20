import { describe, expect, it } from 'vitest'
import {
  FIRST_EXPEDITION_STEPS,
  confirmationCopy,
  shouldShowFirstExpeditionGuide,
} from './ux-guidance'

describe('UX guidance', () => {
  it('provides an ordered first expedition route', () => {
    expect(FIRST_EXPEDITION_STEPS.map((step) => step.order)).toEqual([1, 2, 3])
    expect(FIRST_EXPEDITION_STEPS.map((step) => step.destination)).toEqual([
      'COLLECTION',
      'REGION',
      'RESEARCH',
    ])
  })

  it('shows first-expedition guidance until a stage is cleared', () => {
    expect(shouldShowFirstExpeditionGuide(0)).toBe(true)
    expect(shouldShowFirstExpeditionGuide(1)).toBe(false)
  })

  it('describes irreversible operations explicitly', () => {
    const deletion = confirmationCopy('DELETE_SAVE', 'スロット 2')
    expect(deletion.tone).toBe('DANGER')
    expect(deletion.detail).toContain('取り消せません')
    expect(confirmationCopy('LOAD_SAVE', 'スロット 3').detail).toContain('未保存進行')
  })
})
