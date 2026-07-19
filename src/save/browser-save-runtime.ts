import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'
import { IndexedDbSaveRepository, isIndexedDbAvailable } from './indexeddb-save-repository'
import {
  DEFAULT_LOCAL_SAVE_SETTINGS,
  loadLocalSaveSettings,
  type LocalSaveSettings,
  type LocalSettingsStorage,
} from './local-save-settings'
import { type SaveSlotId, type SaveSlotSummary } from './save-model'
import type { SavedBattleSession } from './save-state'
import {
  listSaveSlotSummaries,
  loadSaveSlot,
  savePlayerDataAtomic,
  type LoadSaveSlotOptions,
  type SaveRepository,
  type SaveSlotMigrationReceipt,
} from './save-repository'

let generationSequence = 0

export function createRuntimeSaveGenerationId(
  slotId: SaveSlotId,
  savedAtEpochMs: number,
): string {
  generationSequence += 1
  return `${slotId}:generation:${savedAtEpochMs}:${generationSequence}`
}

interface BrowserMigrationGenerationInput {
  readonly slotId: SaveSlotId
  readonly savedAtEpochMs: number
}

export function createBrowserLoadSaveOptions(
  now: () => number = Date.now,
): LoadSaveSlotOptions {
  return Object.freeze({
    now,
    createMigrationGenerationId: ({
      slotId,
      savedAtEpochMs,
    }: BrowserMigrationGenerationInput) =>
      createRuntimeSaveGenerationId(slotId, savedAtEpochMs),
  })
}

export function createBrowserSaveRepository(): IndexedDbSaveRepository | null {
  return isIndexedDbAvailable() ? new IndexedDbSaveRepository() : null
}

export interface BrowserSaveBootstrapResult {
  readonly playerData: PlayerData
  readonly settings: LocalSaveSettings
  readonly summaries: readonly SaveSlotSummary[]
  readonly createdInitialSave: boolean
  readonly recoveredFromBackup: boolean
  readonly migration: SaveSlotMigrationReceipt | null
  readonly activeBattle: SavedBattleSession | null
}

export async function bootstrapBrowserSaveSystem(input: {
  readonly repository: SaveRepository
  readonly storage: LocalSettingsStorage
  readonly initialPlayerData: PlayerData
  readonly catalog: PlayerDataContentCatalog
  readonly now?: () => number
}): Promise<BrowserSaveBootstrapResult> {
  const now = input.now ?? Date.now
  const loadOptions = createBrowserLoadSaveOptions(now)
  const settings = loadLocalSaveSettings(input.storage)
  const loaded = await loadSaveSlot(
    input.repository,
    settings.activeSlotId,
    input.catalog,
    loadOptions,
  )
  let playerData: PlayerData
  let createdInitialSave = false
  let recoveredFromBackup = false
  let migration: SaveSlotMigrationReceipt | null = null
  let activeBattle: SavedBattleSession | null = null
  if (loaded === null) {
    const savedAtEpochMs = now()
    const saved = await savePlayerDataAtomic(
      input.repository,
      input.initialPlayerData,
      input.catalog,
      {
        slotId: settings.activeSlotId,
        generationId: createRuntimeSaveGenerationId(settings.activeSlotId, savedAtEpochMs),
        savedAtEpochMs,
      },
    )
    playerData = saved.playerData
    createdInitialSave = true
  } else {
    playerData = loaded.playerData
    recoveredFromBackup = loaded.recoveredFromBackup
    migration = loaded.migration
    activeBattle = loaded.activeBattle
  }
  const summaries = await listSaveSlotSummaries(
    input.repository,
    input.catalog,
    loadOptions,
  )
  return Object.freeze({
    playerData,
    settings: settings ?? DEFAULT_LOCAL_SAVE_SETTINGS,
    summaries,
    createdInitialSave,
    recoveredFromBackup,
    migration,
    activeBattle,
  })
}
