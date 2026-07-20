import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UX_GUIDANCE_STATE,
  GLOSSARY_ENTRIES,
  UX_GUIDANCE_STORAGE_KEY,
  UX_GUIDANCE_VALIDATION,
  completeFirstRunGuide,
  loadUxGuidanceState,
  storeUxGuidanceState,
  type UxGuidanceStorage,
} from './ux-guidance'

function createMemoryStorage(initial: string | null = null): UxGuidanceStorage & { value: string | null } {
  return {
    value: initial,
    getItem(key) {
      return key === UX_GUIDANCE_STORAGE_KEY ? this.value : null
    },
    setItem(key, value) {
      if (key === UX_GUIDANCE_STORAGE_KEY) this.value = value
    },
  }
}

describe('UX guidance state', () => {
  it('uses a safe default for missing or invalid storage', () => {
    expect(loadUxGuidanceState(createMemoryStorage())).toEqual(DEFAULT_UX_GUIDANCE_STATE)
    expect(loadUxGuidanceState(createMemoryStorage('{bad json'))).toEqual(DEFAULT_UX_GUIDANCE_STATE)
    expect(loadUxGuidanceState(createMemoryStorage('{"version":1,"firstRunCompleted":"yes"}'))).toEqual(
      DEFAULT_UX_GUIDANCE_STATE,
    )
  })

  it('persists and completes the first-run guide', () => {
    const storage = createMemoryStorage()
    storeUxGuidanceState(storage, { version: 1, firstRunCompleted: false })
    expect(loadUxGuidanceState(storage).firstRunCompleted).toBe(false)
    completeFirstRunGuide(storage)
    expect(loadUxGuidanceState(storage).firstRunCompleted).toBe(true)
  })

  it('authors complete and unique guidance content', () => {
    expect(UX_GUIDANCE_VALIDATION.steps).toBeGreaterThanOrEqual(3)
    expect(UX_GUIDANCE_VALIDATION.contexts).toBe(7)
    expect(new Set(GLOSSARY_ENTRIES.map((entry) => entry.term)).size).toBe(
      GLOSSARY_ENTRIES.length,
    )
  })
})
