import { isSaveSlotId, type SaveSlotId } from './save-model'

export const LOCAL_SAVE_SETTINGS_KEY = 'summon-unit.save-settings.v1'

export interface LocalSaveSettings {
  readonly activeSlotId: SaveSlotId
  readonly autosaveEnabled: boolean
}

export interface LocalSettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const DEFAULT_LOCAL_SAVE_SETTINGS: LocalSaveSettings = Object.freeze({
  activeSlotId: 'slot-1',
  autosaveEnabled: true,
})

export function loadLocalSaveSettings(
  storage: LocalSettingsStorage,
): LocalSaveSettings {
  let raw: string | null
  try {
    raw = storage.getItem(LOCAL_SAVE_SETTINGS_KEY)
  } catch {
    return DEFAULT_LOCAL_SAVE_SETTINGS
  }
  if (raw === null) return DEFAULT_LOCAL_SAVE_SETTINGS
  try {
    const parsed = JSON.parse(raw) as Partial<LocalSaveSettings>
    if (
      typeof parsed.activeSlotId !== 'string' ||
      !isSaveSlotId(parsed.activeSlotId) ||
      typeof parsed.autosaveEnabled !== 'boolean'
    ) {
      return DEFAULT_LOCAL_SAVE_SETTINGS
    }
    return Object.freeze({
      activeSlotId: parsed.activeSlotId,
      autosaveEnabled: parsed.autosaveEnabled,
    })
  } catch {
    return DEFAULT_LOCAL_SAVE_SETTINGS
  }
}

export function storeLocalSaveSettings(
  storage: LocalSettingsStorage,
  settings: LocalSaveSettings,
): void {
  if (!isSaveSlotId(settings.activeSlotId)) {
    throw new Error(`local active save slot is invalid: ${settings.activeSlotId}`)
  }
  if (typeof settings.autosaveEnabled !== 'boolean') {
    throw new Error('local autosaveEnabled must be a boolean')
  }
  storage.setItem(
    LOCAL_SAVE_SETTINGS_KEY,
    JSON.stringify({
      activeSlotId: settings.activeSlotId,
      autosaveEnabled: settings.autosaveEnabled,
    }),
  )
}
