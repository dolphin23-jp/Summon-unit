import { useEffect, useRef, useState } from 'react'
import type { HeadlessBattleDefinition } from './battle/headless-battle-runner'
import {
  T039_FOREST_NORMAL,
  T039_GENERIC_SKILL_COSTS,
  T039_INITIAL_PLAYER_DATA,
  T039_PLAYER_CATALOG,
} from './demo/region-ui-demo'
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
import {
  deleteSaveSlot,
  listSaveSlotSummaries,
  loadSaveSlot,
  savePlayerDataAtomic,
} from './save/save-repository'
import { CollectionScreen } from './ui/CollectionScreen'
import { MinimalBattleScreen } from './ui/MinimalBattleScreen'
import { RegionScreen } from './ui/RegionScreen'
import { ResearchScreen } from './ui/ResearchScreen'
import { SaveSlotScreen } from './ui/SaveSlotScreen'

const BROWSER_SAVE_REPOSITORY = createBrowserSaveRepository()
let browserBootstrapPromise: Promise<BrowserSaveBootstrapResult> | null = null

type AppScreen = 'REGION' | 'COLLECTION' | 'RESEARCH' | 'SAVE'
type SaveBootState = 'LOADING' | 'READY' | 'UNAVAILABLE'

interface BattleSession {
  readonly stageId: string
  readonly definition: HeadlessBattleDefinition
  readonly serial: number
  readonly fastModeAvailable: boolean
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
    initialPlayerData: T039_INITIAL_PLAYER_DATA,
    catalog: T039_PLAYER_CATALOG,
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
  const [playerData, setPlayerData] = useState<PlayerData>(T039_INITIAL_PLAYER_DATA)
  const [screen, setScreen] = useState<AppScreen>('REGION')
  const [screenBeforeSave, setScreenBeforeSave] = useState<Exclude<AppScreen, 'SAVE'>>('REGION')
  const [battleSession, setBattleSession] = useState<BattleSession | null>(null)
  const [nextBattleSerial, setNextBattleSerial] = useState(1)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    T039_FOREST_NORMAL.stageId,
  )
  const [notifications, setNotifications] = useState<readonly ProgressionNotification[]>(() =>
    createCurrentProgressionNotifications(T039_INITIAL_PLAYER_DATA, T039_PLAYER_CATALOG),
  )
  const [saveBootState, setSaveBootState] = useState<SaveBootState>('LOADING')
  const [saveSummaries, setSaveSummaries] = useState<readonly SaveSlotSummary[]>(
    emptySaveSummaries,
  )
  const [activeSlotId, setActiveSlotId] = useState<SaveSlotId>(
    DEFAULT_LOCAL_SAVE_SETTINGS.activeSlotId,
  )
  const [autosaveEnabled, setAutosaveEnabled] = useState(
    DEFAULT_LOCAL_SAVE_SETTINGS.autosaveEnabled,
  )
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

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
          createCurrentProgressionNotifications(result.playerData, T039_PLAYER_CATALOG),
        )
        setActiveSlotId(result.settings.activeSlotId)
        setAutosaveEnabled(result.settings.autosaveEnabled)
        setSaveSummaries(result.summaries)
        setSaveBootState('READY')
        if (result.recoveredFromBackup) {
          setSaveNotice('現在世代を検証できなかったため、バックアップ世代から復元しました。')
        } else if (result.createdInitialSave) {
          setSaveNotice('スロット1を作成し、初期進行を保存しました。')
        }
      })
      .catch((error) => {
        if (cancelled) return
        setSaveBootState('UNAVAILABLE')
        setSaveNotice(
          error instanceof Error
            ? `セーブの初期化に失敗しました: ${error.message}`
            : 'セーブの初期化に失敗しました。',
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
      await listSaveSlotSummaries(BROWSER_SAVE_REPOSITORY, T039_PLAYER_CATALOG),
    )
  }

  const persistPlayerData = async (
    nextPlayerData: PlayerData,
    slotId: SaveSlotId,
  ): Promise<void> => {
    if (BROWSER_SAVE_REPOSITORY === null || saveBootState !== 'READY') return
    const savedAtEpochMs = Date.now()
    await savePlayerDataAtomic(
      BROWSER_SAVE_REPOSITORY,
      nextPlayerData,
      T039_PLAYER_CATALOG,
      {
        slotId,
        generationId: createRuntimeSaveGenerationId(slotId, savedAtEpochMs),
        savedAtEpochMs,
      },
    )
    await refreshSaveSummaries()
  }

  const queueAutosave = (nextPlayerData: PlayerData): void => {
    if (!autosaveEnabled || saveBootState !== 'READY') return
    void enqueueSaveTask(() => persistPlayerData(nextPlayerData, activeSlotId)).catch((error) =>
      setSaveNotice(
        error instanceof Error ? `自動保存に失敗しました: ${error.message}` : '自動保存に失敗しました。',
      ),
    )
  }

  const updatePlayerData = (next: PlayerData) => {
    const normalized = createStagePlayerData(
      {
        ...next,
        facilities: next.facilities ?? playerData.facilities,
        stageProgress: next.stageProgress ?? playerData.stageProgress,
      },
      T039_PLAYER_CATALOG,
    )
    const derived = deriveProgressionNotifications(
      playerData,
      normalized,
      T039_PLAYER_CATALOG,
    )
    setPlayerData(normalized)
    if (derived.length > 0) {
      setNotifications((current) => mergeNotifications(current, derived))
    }
    queueAutosave(normalized)
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
        T039_PLAYER_CATALOG,
      )
      if (loaded === null) throw new Error(`${slotId}に保存データがありません。`)
      setPlayerData(loaded.playerData)
      setNotifications(
        createCurrentProgressionNotifications(loaded.playerData, T039_PLAYER_CATALOG),
      )
      setActiveSlotId(slotId)
      const storage = getBrowserLocalSettingsStorage()
      if (storage !== null) {
        storeLocalSaveSettings(storage, { activeSlotId: slotId, autosaveEnabled })
      }
      await refreshSaveSummaries()
      const unlockedStageIds = getUnlockedStageIds(loaded.playerData, T039_PLAYER_CATALOG)
      setSelectedStageId((current) =>
        current !== null && unlockedStageIds.includes(current)
          ? current
          : (unlockedStageIds[0] ?? null),
      )
      setSaveNotice(
        loaded.recoveredFromBackup
          ? `${slotId}のバックアップ世代から復元しました。`
          : `${slotId}をロードしました。`,
      )
      setScreen('REGION')
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
          error instanceof Error ? `自動保存に失敗しました: ${error.message}` : '自動保存に失敗しました。',
        ),
      )
    }
  }

  const startBattle = (stageId: string, formationId: string) => {
    const definition = createStageBattleDefinition(
      playerData,
      stageId,
      formationId,
      T039_PLAYER_CATALOG,
      BATTLE_DEFAULTS,
    )
    setSelectedStageId(stageId)
    setBattleSession({
      stageId,
      definition,
      serial: nextBattleSerial,
      fastModeAvailable:
        playerData.stageProgress?.completedStageIds.includes(stageId) ?? false,
    })
    setNextBattleSerial((current) => current + 1)
  }

  const instantSimulate = (
    stageId: string,
    formationId: string,
  ): InstantStageSimulationResult => {
    const serial = nextBattleSerial
    const result = runInstantStageSimulation(
      playerData,
      T039_PLAYER_CATALOG,
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
    return (
      <MinimalBattleScreen
        definition={battleSession.definition}
        allowFastMode={battleSession.fastModeAvailable}
        settleResult={(result, attempt) =>
          settleStageBattle(playerData, result, T039_PLAYER_CATALOG, {
            settlementId: `${battleSession.stageId}:run-${battleSession.serial}:attempt-${attempt}`,
            stageId: battleSession.stageId,
            bonusRollBasisPoints:
              (battleSession.serial * 7919 + attempt * 3571) % 10_000,
          })
        }
        onSettlement={(settlement) => {
          updatePlayerData(settlement.playerData)
          if (settlement.victory) {
            setBattleSession((current) =>
              current === null ? null : { ...current, fastModeAvailable: true },
            )
          }
        }}
        onOpenFormation={() => {
          setBattleSession(null)
          setScreen('COLLECTION')
        }}
        onOpenResearch={() => {
          setBattleSession(null)
          setScreen('RESEARCH')
        }}
        onNextStage={() => {
          setBattleSession(null)
          setScreen('REGION')
        }}
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
        onBack={() => setScreen(screenBeforeSave)}
      />
    )
  }

  if (screen === 'RESEARCH') {
    return (
      <div className="t039-research-shell">
        <nav className="t039-screen-navigation" aria-label="主要画面">
          <button
            type="button"
            className="collection-button collection-button--primary"
            onClick={() => setScreen('REGION')}
          >
            地域・ステージ
          </button>
          <button
            type="button"
            className="collection-button"
            onClick={() => openSaveScreen('RESEARCH')}
          >
            セーブスロット
          </button>
        </nav>
        <ResearchScreen
          playerData={playerData}
          catalog={T039_PLAYER_CATALOG}
          onPlayerDataChange={updatePlayerData}
          onOpenCollection={() => setScreen('COLLECTION')}
        />
      </div>
    )
  }

  if (screen === 'COLLECTION') {
    return (
      <div className="t039-collection-shell">
        <nav className="t039-screen-navigation" aria-label="主要画面">
          <button
            type="button"
            className="collection-button collection-button--primary"
            onClick={() => setScreen('REGION')}
          >
            地域・ステージ
          </button>
          <button
            type="button"
            className="collection-button"
            onClick={() => setScreen('RESEARCH')}
          >
            研究網・施設
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
          catalog={T039_PLAYER_CATALOG}
          genericSkillCosts={T039_GENERIC_SKILL_COSTS}
          onPlayerDataChange={updatePlayerData}
          onStartBattle={(formationId) => {
            const unlockedStageIds = getUnlockedStageIds(playerData, T039_PLAYER_CATALOG)
            const stageId =
              selectedStageId !== null && unlockedStageIds.includes(selectedStageId)
                ? selectedStageId
                : unlockedStageIds[0]
            if (stageId === undefined) {
              throw new Error('出撃可能なステージがありません。')
            }
            startBattle(stageId, formationId)
          }}
        />
      </div>
    )
  }

  return (
    <RegionScreen
      playerData={playerData}
      catalog={T039_PLAYER_CATALOG}
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
          Object.freeze(
            current.filter((notification) => notification.id !== notificationId),
          ),
        )
      }
      onDismissAllNotifications={() => setNotifications(Object.freeze([]))}
    />
  )
}

export default App
