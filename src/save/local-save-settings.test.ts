import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCAL_SAVE_SETTINGS,
  LOCAL_SAVE_SETTINGS_KEY,
  loadLocalSaveSettings,
  storeLocalSaveSettings,
  type LocalSettingsStorage,
} from './local-save-settings'

class TestStorage implements LocalSettingsStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('local save settings', () => {
  it('uses slot 1 with autosave enabled by default', () => {
    const storage = new TestStorage()
    expect(loadLocalSaveSettings(storage)).toEqual(DEFAULT_LOCAL_SAVE_SETTINGS)
  })

  it('round-trips the active slot and autosave preference', () => {
    const storage = new TestStorage()
    storeLocalSaveSettings(storage, {
      activeSlotId: 'slot-3',
      autosaveEnabled: false,
    })
    expect(loadLocalSaveSettings(storage)).toEqual({
      activeSlotId: 'slot-3',
      autosaveEnabled: false,
    })
  })

  it('falls back safely when stored JSON is malformed or invalid', () => {
    const storage = new TestStorage()
    storage.values.set(LOCAL_SAVE_SETTINGS_KEY, '{broken')
    expect(loadLocalSaveSettings(storage)).toEqual(DEFAULT_LOCAL_SAVE_SETTINGS)
    storage.values.set(
      LOCAL_SAVE_SETTINGS_KEY,
      JSON.stringify({ activeSlotId: 'slot-9', autosaveEnabled: true }),
    )
    expect(loadLocalSaveSettings(storage)).toEqual(DEFAULT_LOCAL_SAVE_SETTINGS)
  })
})
