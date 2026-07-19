import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'
import { IndexedDbSaveRepository, isIndexedDbAvailable } from './indexeddb-save-repository'
import {
  DEFAULT_LOCAL_SAVE_SETTINGS,
  loadLocalSaveSettings,
  type LocalSaveSettings,
  type LocalSettingsStorage,
} from './local-save-settings'
import {
  listSaveSlotSummariesWithMigration,
  loadSaveSlotWithMigration,
  type SaveMigrationRuntime,
  type SaveSlotMigrationReceipt,
} from './save-migration'
import { type SaveSlotId, type SaveSlotSummary } from './save-model'
import { savePlayerDataAtomic, type SaveRepository } from './save-repository'

let generationSequence = 0

export function createRuntimeSaveGenerationId(
  slotId: SaveSlotId,
  savedAtEpochMs: number,
): string {
  generationSequence += 1
  return `${slotId}:generation:${savedAtEpochMs}:${generationSequence}`
}

export function createBrowserSaveMigrationRuntime(
  now: () => number = Date.now,
): SaveMigrationRuntime {
  return Object.freeze({
    now,
    createGenerationId: ({ slotId, savedAtEpochMs }) =>
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
}

export async function bootstrapBrowserSaveSystem(input: {
  readonly repository: SaveRepository
  readonly storage: LocalSettingsStorage
  readonly initialPlayerData: PlayerData
  readonly catalog: PlayerDataContentCatalog
  readonly now?: () => number
}): Promise<BrowserSaveBootstrapResult> {
  const now = input.now ?? Date.now
  const migrationRuntime = createBrowserSaveMigrationRuntime(now)
  const settings = loadLocalSaveSettings(input.storage)
  const loaded = await loadSaveSlotWithMigration(
    input.repository,
    settings.activeSlotId,
    input.catalog,
    migrationRuntime,
  )
  let playerData: PlayerData
  let createdInitialSave = false
  let recoveredFromBackup = false
  let migration: SaveSlotMigrationReceipt | null = null
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
  }
  const summaries = await listSaveSlotSummariesWithMigration(
    input.repository,
    input.catalog,
    migrationRuntime,
  )
  return Object.freeze({
    playerData,
    settings: settings ?? DEFAULT_LOCAL_SAVE_SETTINGS,
    summaries,
    createdInitialSave,
    recoveredFromBackup,
    migration,
  })
}
