import { useEffect, useRef, useState } from 'react'
import type {
  HeadlessBattleDefinition,
  InteractiveBattleStableSnapshot,
} from './battle/headless-battle-runner'
import {
  VERTICAL_SLICE_RUNTIME_CATALOG,
  VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID,
  VERTICAL_SLICE_RUNTIME_GENERIC_SKILL_COSTS,
  VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
  VERTICAL_SLICE_RUNTIME_ONBOARDING_CUES,
} from './content/vertical-slice-runtime'
import { STANDARD_INTERACTIVE_BATTLE } from './demo/standard-headless-battle'
import type { PlayerData } from './progression/player-data'
import {
  createCurrentProgressionNotifications,
  deriveProgressionNotifications,
  type ProgressionNotification,
} from './progression/progression-notifications'
import { getUnlockedStageIds } from './progression/region-progression'
import {
  createStageBattleDefinition,
  runInstantStageSimulation,
  type InstantStageSimulationResult,
} from './progression/stage-battle'
import { createStagePlayerData, settleStageBattle } from './progression/stage-reward'
import {
  bootstrapBrowserSaveSystem,
  createBrowserSaveRepository,
  createRuntimeSaveGenerationId,
  type BrowserSaveBootstrapResult,
} from './save/browser-save-runtime'
import {
  DEFAULT_LOCAL_SAVE_SETTINGS,
  storeLocalSaveSettings,
  type LocalSettingsStorage,
} from './save/local-save-settings'
import {
  SAVE_SLOT_IDS,
  createEmptySaveSlotSummary,
  type SaveSlotId,
  type SaveSlotSummary,
} from './save/save-model'
import { normalizeSavedBattleSession, type SavedBattleSession } from './save/save-state'
import { exportSaveTransferJson, importSaveTransferJson } from './save/save-transfer'
import {
  deleteSaveSlot,
  listSaveSlotSummaries,
  loadSaveSlot,
  savePlayerDataAtomic,
} from './save/save-repository'
import { CollectionScreen } from './ui/CollectionScreen'
import { HomeScreen } from './ui/HomeScreen'
import { MinimalBattleScreen } from './ui/MinimalBattleScreen'
import { T040RegionScreen as RegionScreen } from './ui/T040RegionScreen'
import { T048ResearchScreen } from './ui/T048ResearchScreen'
import { SaveSlotScreen } from './ui/SaveSlotScreen'
import { SummonScreen } from './ui/SummonScreen'

const BROWSER_SAVE_REPOSITORY = createBrowserSaveRepository()
let browserBootstrapPromise: Promise<BrowserSaveBootstrapResult> | null = null

type AppScreen = 'HOME' | 'REGION' | 'COLLECTION' | 'RESEARCH' | 'SUMMON' | 'SAVE'
type SaveBootState = 'LOADING' | 'READY' | 'UNAVAILABLE'

interface BattleSession {
  readonly stageId: string
  readonly definition: HeadlessBattleDefinition
  readonly serial: number
  readonly fastModeAvailable: boolean
  readonly initialStableSnapshot?: InteractiveBattleStableSnapshot
  readonly initialAttempt?: number
}

const BATTLE_DEFAULTS = Object.freeze({
  initialActionCost: STANDARD_INTERACTIVE_BATTLE.initialActionCost,
  maxActions: STANDARD_INTERACTIVE_BATTLE.maxActions,
})

function getBrowserLocalSettingsStorage(): LocalSettingsStorage | null {
  if (typeof window === 'undefined') return null
  return Object.freeze({
    getItem(key: string): string | null {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem(key: string, value: string): void {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // IndexedDB saves remain usable when localStorage is unavailable.
      }
    },
  })
}

function getBrowserBootstrap(): Promise<BrowserSaveBootstrapResult> | null {
  const storage = getBrowserLocalSettingsStorage()
  if (BROWSER_SAVE_REPOSITORY === null || storage === null) return null
  browserBootstrapPromise ??= bootstrapBrowserSaveSystem({
    repository: BROWSER_SAVE_REPOSITORY,
    storage,
    initialPlayerData: VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
    catalog: VERTICAL_SLICE_RUNTIME_CATALOG,
  })
  return browserBootstrapPromise
}

function mergeNotifications(
  current: readonly ProgressionNotification[],
  incoming: readonly ProgressionNotification[],
): readonly ProgressionNotification[] {
  const byId = new Map(current.map((notification) => [notification.id, notification]))
  for (const notification of incoming) byId.set(notification.id, notification)
  return Object.freeze(
    [...byId.values()].sort((left, right) => left.id.localeCompare(right.id, 'en')),
  )
}

function emptySaveSummaries(): readonly SaveSlotSummary[] {
  return Object.freeze(SAVE_SLOT_IDS.map(createEmptySaveSlotSummary))
}

function App() {
  const [playerData, setPlayerData] = useState<PlayerData>(
    VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
  )
  const [screen, setScreen] = useState<AppScreen>('HOME')
  const [screenBeforeSave, setScreenBeforeSave] = useState<Exclude<AppScreen, 'SAVE'>>('HOME')
  const [battleSession, setBattleSession] = useState<BattleSession | null>(null)
  const [nextBattleSerial, setNextBattleSerial] = useState(1)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID,
  )
  const [notifications, setNotifications] = useState<readonly ProgressionNotification[]>(() =>
    createCurrentProgressionNotifications(
      VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
      VERTICAL_SLICE_RUNTIME_CATALOG,
    ),
  )
  const [saveBootState, setSaveBootState] = useState<SaveBootState>('LOADING')
  const [saveSummaries, setSaveSummaries] = useState<readonly SaveSlotSummary[]>(emptySaveSummaries)
  const [activeSlotId, setActiveSlotId] = useState<SaveSlotId>(
    DEFAULT_LOCAL_SAVE_SETTINGS.activeSlotId,
  )
  const [autosaveEnabled, setAutosaveEnabled] = useState(
    DEFAULT_LOCAL_SAVE_SETTINGS.autosaveEnabled,
  )
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const activeBattleRef = useRef<SavedBattleSession | null>(null)

  useEffect(() => {
    const reportWindowError = (event: ErrorEvent) => {
      setSaveNotice(`実行時エラーを検出しました: ${event.message || '不明なエラー'}`)
    }
    const reportUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      setSaveNotice(
        reason instanceof Error
          ? `未処理の非同期エラーを検出しました: ${reason.message}`
          : '未処理の非同期エラーを検出しました。',
      )
    }
    window.addEventListener('error', reportWindowError)
    window.addEventListener('unhandledrejection', reportUnhandledRejection)
    return () => {
      window.removeEventListener('error', reportWindowError)
      window.removeEventListener('unhandledrejection', reportUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    const bootstrap = getBrowserBootstrap()
    if (bootstrap === null) {
      setSaveBootState('UNAVAILABLE')
      setSaveNotice('このブラウザではIndexedDBを利用できないため、進行は永続化されません。')
      return undefined
    }
    let cancelled = false
    bootstrap
      .then((result) => {
        if (cancelled) return
        setPlayerData(result.playerData)
        setNotifications(
          createCurrentProgressionNotifications(result.playerData, VERTICAL_SLICE_RUNTIME_CATALOG),
        )
        setActiveSlotId(result.settings.activeSlotId)
        setAutosaveEnabled(result.settings.autosaveEnabled)
        setSaveSummaries(result.summaries)
        setSaveBootState('READY')
        activeBattleRef.current = result.activeBattle
        const unlockedStageIds = getUnlockedStageIds(
          result.playerData,
          VERTICAL_SLICE_RUNTIME_CATALOG,
        )
        setSelectedStageId(unlockedStageIds[0] ?? null)
        if (result.activeBattle !== null) {
          setBattleSession({
            stageId: result.activeBattle.stageId,
            definition: result.activeBattle.definition,
            serial: result.activeBattle.serial,
            fastModeAvailable: result.activeBattle.fastModeAvailable,
            initialStableSnapshot: result.activeBattle.stableSnapshot,
            initialAttempt: result.activeBattle.attempt,
          })
          setNextBattleSerial((current) => Math.max(current, result.activeBattle!.serial + 1))
          setSaveNotice('中断していた戦闘をstableスナップショットから再開しました。')
        } else if (result.recoveredFromBackup) {
          setSaveNotice('現在世代を検証できなかったため、バックアップ世代から復元しました。')
        } else if (result.createdInitialSave) {
          setSaveNotice('v0.1垂直スライスの初期進行を保存しました。')
        }
      })
      .catch((error) => {
        if (cancelled) return
        setSaveBootState('UNAVAILABLE')
        setScreen('HOME')
        setSaveNotice(
          error instanceof Error
            ? `セーブの初期化に失敗したため、初期進行で継続します: ${error.message}`
            : 'セーブの初期化に失敗したため、初期進行で継続します。',
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  const enqueueSaveTask = <T,>(task: () => Promise<T>): Promise<T> => {
    const result = saveQueueRef.current.then(task, task)
    saveQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  const refreshSaveSummaries = async (): Promise<void> => {
    if (BROWSER_SAVE_REPOSITORY === null) return
    setSaveSummaries(
      await listSaveSlotSummaries(BROWSER_SAVE_REPOSITORY, VERTICAL_SLICE_RUNTIME_CATALOG),
    )
  }

  const persistPlayerData = async (
    nextPlayerData: PlayerData,
    slotId: SaveSlotId,
    activeBattle: SavedBattleSession | null = activeBattleRef.current,
    refreshSummaries = true,
  ): Promise<void> => {
    if (BROWSER_SAVE_REPOSITORY === null || saveBootState !== 'READY') return
    const savedAtEpochMs = Date.now()
    await savePlayerDataAtomic(
      BROWSER_SAVE_REPOSITORY,
      nextPlayerData,
      VERTICAL_SLICE_RUNTIME_CATALOG,
      {
        slotId,
        generationId: createRuntimeSaveGenerationId(slotId, savedAtEpochMs),
        savedAtEpochMs,
        activeBattle,
      },
    )
    if (refreshSummaries) await refreshSaveSummaries()
  }

  const queueAutosave = (nextPlayerData: PlayerData): void => {
    if (!autosaveEnabled || saveBootState !== 'READY') return
    void enqueueSaveTask(() => persistPlayerData(nextPlayerData, activeSlotId)).catch((error) =>
      setSaveNotice(
        error instanceof Error
          ? `自動保存に失敗しました: ${error.message}`
          : '自動保存に失敗しました。',
      ),
    )
  }

  const updatePlayerData = (next: PlayerData) => {
    try {
      const normalized = createStagePlayerData(
        {
          ...next,
          facilities: next.facilities ?? playerData.facilities,
          stageProgress: next.stageProgress ?? playerData.stageProgress,
        },
        VERTICAL_SLICE_RUNTIME_CATALOG,
      )
      const derived = deriveProgressionNotifications(
        playerData,
        normalized,
        VERTICAL_SLICE_RUNTIME_CATALOG,
      )
      setPlayerData(normalized)
      if (derived.length > 0) {
        setNotifications((current) => mergeNotifications(current, derived))
      }
      queueAutosave(normalized)
    } catch (error) {
      setSaveNotice(
        error instanceof Error
          ? `進行データの更新を拒否しました: ${error.message}`
          : '進行データの更新を拒否しました。',
      )
    }
  }

  const openSaveScreen = (from: Exclude<AppScreen, 'SAVE'>): void => {
    setScreenBeforeSave(from)
    setScreen('SAVE')
  }

  const saveToSlot = async (slotId: SaveSlotId): Promise<void> => {
    if (BROWSER_SAVE_REPOSITORY === null || saveBootState !== 'READY') {
      setSaveNotice('IndexedDBを利用できないため保存できません。')
      return
    }
    setSaveBusy(true)
    try {
      await enqueueSaveTask(() => persistPlayerData(playerData, slotId))
      setActiveSlotId(slotId)
      const storage = getBrowserLocalSettingsStorage()
      if (storage !== null) {
        storeLocalSaveSettings(storage, { activeSlotId: slotId, autosaveEnabled })
      }
      setSaveNotice(`${slotId}へ現在の進行を保存し、使用中スロットに設定しました。`)
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : 'スロット保存に失敗しました。')
    } finally {
      setSaveBusy(false)
    }
  }

  const loadSlot = async (slotId: SaveSlotId): Promise<void> => {
    if (BROWSER_SAVE_REPOSITORY === null || saveBootState !== 'READY') {
      setSaveNotice('IndexedDBを利用できないためロードできません。')
      return
    }
    setSaveBusy(true)
    try {
      await saveQueueRef.current
      const loaded = await loadSaveSlot(
        BROWSER_SAVE_REPOSITORY,
        slotId,
        VERTICAL_SLICE_RUNTIME_CATALOG,
      )
      if (loaded === null) throw new Error(`${slotId}に有効な保存データがありません。`)
      setPlayerData(loaded.playerData)
      activeBattleRef.current = loaded.activeBattle
      setNotifications(
        createCurrentProgressionNotifications(loaded.playerData, VERTICAL_SLICE_RUNTIME_CATALOG),
      )
      setActiveSlotId(slotId)
      const storage = getBrowserLocalSettingsStorage()
      if (storage !== null) {
        storeLocalSaveSettings(storage, { activeSlotId: slotId, autosaveEnabled })
      }
      await refreshSaveSummaries()
      const unlockedStageIds = getUnlockedStageIds(
        loaded.playerData,
        VERTICAL_SLICE_RUNTIME_CATALOG,
      )
      setSelectedStageId((current) =>
        current !== null && unlockedStageIds.includes(current)
          ? current
          : (unlockedStageIds[0] ?? null),
      )
      if (loaded.activeBattle !== null) {
        setBattleSession({
          stageId: loaded.activeBattle.stageId,
          definition: loaded.activeBattle.definition,
          serial: loaded.activeBattle.serial,
          fastModeAvailable: loaded.activeBattle.fastModeAvailable,
          initialStableSnapshot: loaded.activeBattle.stableSnapshot,
          initialAttempt: loaded.activeBattle.attempt,
        })
        setNextBattleSerial((current) => Math.max(current, loaded.activeBattle!.serial + 1))
      } else {
        setBattleSession(null)
        setScreen('HOME')
      }
      setSaveNotice(
        loaded.activeBattle !== null
          ? `${slotId}の中断戦闘を再開しました。`
          : loaded.recoveredFromBackup
            ? `${slotId}のバックアップ世代から復元しました。`
            : `${slotId}をロードしました。`,
      )
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : 'スロットのロードに失敗しました。')
    } finally {
      setSaveBusy(false)
    }
  }

  const removeSlot = async (slotId: SaveSlotId): Promise<void> => {
    if (slotId === activeSlotId) {
      setSaveNotice('使用中スロットは削除できません。先に別スロットをロードしてください。')
      return
    }
    if (BROWSER_SAVE_REPOSITORY === null || saveBootState !== 'READY') return
    setSaveBusy(true)
    try {
      await enqueueSaveTask(() => deleteSaveSlot(BROWSER_SAVE_REPOSITORY, slotId))
      await refreshSaveSummaries()
      setSaveNotice(`${slotId}の現在世代とバックアップを削除しました。`)
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : 'スロット削除に失敗しました。')
    } finally {
      setSaveBusy(false)
    }
  }

  const changeAutosave = (enabled: boolean): void => {
    setAutosaveEnabled(enabled)
    const storage = getBrowserLocalSettingsStorage()
    if (storage !== null) {
      storeLocalSaveSettings(storage, { activeSlotId, autosaveEnabled: enabled })
    }
    setSaveNotice(enabled ? '自動保存を有効にしました。' : '自動保存を無効にしました。')
    if (enabled) {
      void enqueueSaveTask(() => persistPlayerData(playerData, activeSlotId)).catch((error) =>
        setSaveNotice(
          error instanceof Error
            ? `自動保存に失敗しました: ${error.message}`
            : '自動保存に失敗しました。',
        ),
      )
    }
  }

  const startBattle = (stageId: string, formationId: string) => {
    try {
      const definition = createStageBattleDefinition(
        playerData,
        stageId,
        formationId,
        VERTICAL_SLICE_RUNTIME_CATALOG,
        BATTLE_DEFAULTS,
      )
      setSelectedStageId(stageId)
      activeBattleRef.current = null
      setBattleSession({
        stageId,
        definition,
        serial: nextBattleSerial,
        fastModeAvailable: playerData.stageProgress?.completedStageIds.includes(stageId) ?? false,
        initialAttempt: 0,
      })
      setNextBattleSerial((current) => current + 1)
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : '戦闘を開始できませんでした。')
      setScreen('REGION')
    }
  }

  const instantSimulate = (stageId: string, formationId: string): InstantStageSimulationResult => {
    const serial = nextBattleSerial
    const result = runInstantStageSimulation(
      playerData,
      VERTICAL_SLICE_RUNTIME_CATALOG,
      {
        stageId,
        formationId,
        settlementId: `${stageId}:instant-${serial}`,
        bonusRollBasisPoints: (serial * 7919 + 1871) % 10_000,
      },
      BATTLE_DEFAULTS,
    )
    setSelectedStageId(stageId)
    setNextBattleSerial((current) => current + 1)
    updatePlayerData(result.settlement.playerData)
    return result
  }

  const leaveBattle = (nextScreen: Exclude<AppScreen, 'SAVE'>): void => {
    activeBattleRef.current = null
    setBattleSession(null)
    setScreen(nextScreen)
    if (autosaveEnabled && saveBootState === 'READY') {
      void enqueueSaveTask(() => persistPlayerData(playerData, activeSlotId, null)).catch((error) =>
        setSaveNotice(
          error instanceof Error
            ? `戦闘中断データの削除に失敗しました: ${error.message}`
            : '戦闘中断データの削除に失敗しました。',
        ),
      )
    }
  }

  const exportCurrentSave = (): void => {
    try {
      const json = exportSaveTransferJson(
        { playerData, activeBattle: activeBattleRef.current },
        VERTICAL_SLICE_RUNTIME_CATALOG,
      )
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `summon-unit-${activeSlotId}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setSaveNotice(`${activeSlotId}をJSONへエクスポートしました。`)
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : 'JSONエクスポートに失敗しました。')
    }
  }

  const importIntoActiveSlot = async (json: string): Promise<void> => {
    if (BROWSER_SAVE_REPOSITORY === null || saveBootState !== 'READY') {
      setSaveNotice('IndexedDBを利用できないためインポートできません。')
      return
    }
    setSaveBusy(true)
    try {
      const imported = importSaveTransferJson(json, VERTICAL_SLICE_RUNTIME_CATALOG)
      const savedAtEpochMs = Date.now()
      const saved = await enqueueSaveTask(() =>
        savePlayerDataAtomic(
          BROWSER_SAVE_REPOSITORY,
          imported.playerData,
          VERTICAL_SLICE_RUNTIME_CATALOG,
          {
            slotId: activeSlotId,
            generationId: createRuntimeSaveGenerationId(activeSlotId, savedAtEpochMs),
            savedAtEpochMs,
            activeBattle: imported.activeBattle,
          },
        ),
      )
      setPlayerData(saved.playerData)
      activeBattleRef.current = saved.activeBattle
      setNotifications(
        createCurrentProgressionNotifications(saved.playerData, VERTICAL_SLICE_RUNTIME_CATALOG),
      )
      await refreshSaveSummaries()
      if (saved.activeBattle !== null) {
        setBattleSession({
          stageId: saved.activeBattle.stageId,
          definition: saved.activeBattle.definition,
          serial: saved.activeBattle.serial,
          fastModeAvailable: saved.activeBattle.fastModeAvailable,
          initialStableSnapshot: saved.activeBattle.stableSnapshot,
          initialAttempt: saved.activeBattle.attempt,
        })
        setNextBattleSerial((current) => Math.max(current, saved.activeBattle!.serial + 1))
      } else {
        setBattleSession(null)
        setScreen('HOME')
      }
      setSaveNotice(
        imported.appliedMigrations.length > 0
          ? `JSONをschema ${imported.originalSchemaVersion}から${saved.playerData.schemaVersion}へ移行して${activeSlotId}へ保存しました。`
          : `JSONを検証して${activeSlotId}へ保存しました。`,
      )
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : 'JSONインポートに失敗しました。')
    } finally {
      setSaveBusy(false)
    }
  }

  if (saveBootState === 'LOADING') {
    return (
      <main className="save-loading" aria-busy="true">
        <div className="collection-panel">
          <p className="eyebrow">LOADING SAVE SLOT</p>
          <h1>進行データを復元しています</h1>
          <p>IndexedDBの現在世代を検証し、必要ならバックアップを確認しています。</p>
        </div>
      </main>
    )
  }

  if (battleSession !== null) {
    const battleStage = VERTICAL_SLICE_RUNTIME_CATALOG.stages.find(
      (stage) => stage.stageId === battleSession.stageId,
    )
    const battleRegion = VERTICAL_SLICE_RUNTIME_CATALOG.regions.find(
      (region) => region.regionId === battleStage?.regionId,
    )
    return (
      <MinimalBattleScreen
        definition={battleSession.definition}
        allowFastMode={battleSession.fastModeAvailable}
        initialStableSnapshot={battleSession.initialStableSnapshot}
        initialAttempt={battleSession.initialAttempt}
        themeColor={battleRegion?.themeColor}
        regionName={battleRegion?.name}
        stageName={battleStage?.theme}
        onStableSnapshot={(stableSnapshot, attempt) => {
          const savedBattle = normalizeSavedBattleSession({
            saveVersion: 1,
            stageId: battleSession.stageId,
            serial: battleSession.serial,
            attempt,
            fastModeAvailable: battleSession.fastModeAvailable,
            definition: battleSession.definition,
            stableSnapshot,
          })
          activeBattleRef.current = savedBattle
          if (autosaveEnabled && saveBootState === 'READY') {
            void enqueueSaveTask(() =>
              persistPlayerData(playerData, activeSlotId, savedBattle, false),
            ).catch((error) =>
              setSaveNotice(
                error instanceof Error
                  ? `戦闘スナップショットの保存に失敗しました: ${error.message}`
                  : '戦闘スナップショットの保存に失敗しました。',
              ),
            )
          }
        }}
        settleResult={(result, attempt) =>
          settleStageBattle(playerData, result, VERTICAL_SLICE_RUNTIME_CATALOG, {
            settlementId: `${battleSession.stageId}:run-${battleSession.serial}:attempt-${attempt}`,
            stageId: battleSession.stageId,
            bonusRollBasisPoints: (battleSession.serial * 7919 + attempt * 3571) % 10_000,
          })
        }
        onSettlement={(settlement) => {
          activeBattleRef.current = null
          updatePlayerData(settlement.playerData)
          if (settlement.victory) {
            setBattleSession((current) =>
              current === null ? null : { ...current, fastModeAvailable: true },
            )
          }
        }}
        onOpenFormation={() => leaveBattle('COLLECTION')}
        onOpenResearch={() => leaveBattle('RESEARCH')}
        onNextStage={() => leaveBattle('REGION')}
      />
    )
  }

  if (screen === 'SAVE') {
    return (
      <SaveSlotScreen
        summaries={saveSummaries}
        activeSlotId={activeSlotId}
        autosaveEnabled={autosaveEnabled}
        busy={saveBusy || saveBootState !== 'READY'}
        notice={saveNotice}
        onSaveToSlot={(slotId) => void saveToSlot(slotId)}
        onLoadSlot={(slotId) => void loadSlot(slotId)}
        onDeleteSlot={(slotId) => void removeSlot(slotId)}
        onAutosaveChange={changeAutosave}
        onExportJson={exportCurrentSave}
        onImportJson={(json) => void importIntoActiveSlot(json)}
        onBack={() => setScreen(screenBeforeSave)}
      />
    )
  }

  if (screen === 'HOME') {
    return (
      <HomeScreen
        playerData={playerData}
        notice={saveNotice}
        persistenceAvailable={saveBootState === 'READY'}
        onOpenRegion={() => setScreen('REGION')}
        onOpenCollection={() => setScreen('COLLECTION')}
        onOpenResearch={() => setScreen('RESEARCH')}
        onOpenSummon={() => setScreen('SUMMON')}
        onOpenSave={() => openSaveScreen('HOME')}
      />
    )
  }

  if (screen === 'RESEARCH') {
    return (
      <div className="t039-research-shell">
        <nav className="t039-screen-navigation" aria-label="主要画面">
          <button type="button" className="collection-button" onClick={() => setScreen('HOME')}>
            ホーム
          </button>
          <button
            type="button"
            className="collection-button collection-button--primary"
            onClick={() => setScreen('REGION')}
          >
            地域・ステージ
          </button>
          <button type="button" className="collection-button" onClick={() => setScreen('SUMMON')}>
            召喚
          </button>
          <button
            type="button"
            className="collection-button"
            onClick={() => openSaveScreen('RESEARCH')}
          >
            セーブスロット
          </button>
        </nav>
        <T048ResearchScreen
          playerData={playerData}
          catalog={VERTICAL_SLICE_RUNTIME_CATALOG}
          onPlayerDataChange={updatePlayerData}
          onOpenCollection={() => setScreen('COLLECTION')}
        />
      </div>
    )
  }

  if (screen === 'SUMMON') {
    return (
      <SummonScreen
        playerData={playerData}
        catalog={VERTICAL_SLICE_RUNTIME_CATALOG}
        onPlayerDataChange={updatePlayerData}
        onOpenHome={() => setScreen('HOME')}
        onOpenCollection={() => setScreen('COLLECTION')}
        onOpenResearch={() => setScreen('RESEARCH')}
      />
    )
  }

  if (screen === 'COLLECTION') {
    return (
      <div className="t039-collection-shell">
        <nav className="t039-screen-navigation" aria-label="主要画面">
          <button type="button" className="collection-button" onClick={() => setScreen('HOME')}>
            ホーム
          </button>
          <button
            type="button"
            className="collection-button collection-button--primary"
            onClick={() => setScreen('REGION')}
          >
            地域・ステージ
          </button>
          <button type="button" className="collection-button" onClick={() => setScreen('RESEARCH')}>
            研究網・施設
          </button>
          <button type="button" className="collection-button" onClick={() => setScreen('SUMMON')}>
            召喚
          </button>
          <button
            type="button"
            className="collection-button"
            onClick={() => openSaveScreen('COLLECTION')}
          >
            セーブスロット
          </button>
        </nav>
        <CollectionScreen
          playerData={playerData}
          catalog={VERTICAL_SLICE_RUNTIME_CATALOG}
          genericSkillCosts={VERTICAL_SLICE_RUNTIME_GENERIC_SKILL_COSTS}
          onPlayerDataChange={updatePlayerData}
          onStartBattle={(formationId) => {
            const unlockedStageIds = getUnlockedStageIds(playerData, VERTICAL_SLICE_RUNTIME_CATALOG)
            const stageId =
              selectedStageId !== null && unlockedStageIds.includes(selectedStageId)
                ? selectedStageId
                : unlockedStageIds[0]
            if (stageId === undefined) {
              setSaveNotice('出撃可能なステージがありません。')
              return
            }
            startBattle(stageId, formationId)
          }}
        />
      </div>
    )
  }

  const onboardingCue = VERTICAL_SLICE_RUNTIME_ONBOARDING_CUES.find(
    (cue) => cue.stageId === selectedStageId,
  )

  return (
    <div className="t040-region-shell">
      <nav className="t039-screen-navigation" aria-label="主要画面">
        <button type="button" className="collection-button" onClick={() => setScreen('HOME')}>
          ホーム
        </button>
        <button type="button" className="collection-button" onClick={() => setScreen('SUMMON')}>
          召喚
        </button>
      </nav>
      {onboardingCue !== undefined && (
        <aside className="collection-panel" aria-live="polite">
          <p className="panel-heading__kicker">FIELD GUIDANCE</p>
          <h2>{onboardingCue.headline}</h2>
          <p>{onboardingCue.prompt}</p>
          <small>{onboardingCue.tip}</small>
        </aside>
      )}
      <RegionScreen
        playerData={playerData}
        catalog={VERTICAL_SLICE_RUNTIME_CATALOG}
        selectedStageId={selectedStageId}
        notifications={notifications}
        onSelectStage={setSelectedStageId}
        onStartBattle={startBattle}
        onInstantSimulate={instantSimulate}
        onOpenCollection={() => setScreen('COLLECTION')}
        onOpenResearch={() => setScreen('RESEARCH')}
        onOpenSave={() => openSaveScreen('REGION')}
        onDismissNotification={(notificationId) =>
          setNotifications((current) =>
            Object.freeze(current.filter((notification) => notification.id !== notificationId)),
          )
        }
        onDismissAllNotifications={() => setNotifications(Object.freeze([]))}
      />
    </div>
  )
}

export default App
