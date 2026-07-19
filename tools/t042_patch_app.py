from pathlib import Path

PATH = Path('src/App.tsx')
text = PATH.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'app pattern not found: {old[:120]!r}')
    text = text.replace(old, new, 1)


replace_once(
    "import type { HeadlessBattleDefinition } from './battle/headless-battle-runner'",
    """import type {
  HeadlessBattleDefinition,
  InteractiveBattleStableSnapshot,
} from './battle/headless-battle-runner'""",
)
replace_once(
    "import {\n  deleteSaveSlot,",
    "import { normalizeSavedBattleSession, type SavedBattleSession } from './save/save-state'\nimport { exportSaveTransferJson, importSaveTransferJson } from './save/save-transfer'\nimport {\n  deleteSaveSlot,",
)
replace_once(
    '  readonly fastModeAvailable: boolean\n}',
    '  readonly fastModeAvailable: boolean\n  readonly initialStableSnapshot?: InteractiveBattleStableSnapshot\n  readonly initialAttempt?: number\n}',
)
replace_once(
    '  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())\n',
    '  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())\n  const activeBattleRef = useRef<SavedBattleSession | null>(null)\n',
)
replace_once(
    """        setSaveSummaries(result.summaries)
        setSaveBootState('READY')
        if (result.recoveredFromBackup) {""",
    """        setSaveSummaries(result.summaries)
        setSaveBootState('READY')
        activeBattleRef.current = result.activeBattle
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
        } else if (result.recoveredFromBackup) {""",
)
replace_once(
    """  const persistPlayerData = async (
    nextPlayerData: PlayerData,
    slotId: SaveSlotId,
  ): Promise<void> => {""",
    """  const persistPlayerData = async (
    nextPlayerData: PlayerData,
    slotId: SaveSlotId,
    activeBattle: SavedBattleSession | null = activeBattleRef.current,
    refreshSummaries = true,
  ): Promise<void> => {""",
)
replace_once(
    """        generationId: createRuntimeSaveGenerationId(slotId, savedAtEpochMs),
        savedAtEpochMs,
      },
    )
    await refreshSaveSummaries()""",
    """        generationId: createRuntimeSaveGenerationId(slotId, savedAtEpochMs),
        savedAtEpochMs,
        activeBattle,
      },
    )
    if (refreshSummaries) await refreshSaveSummaries()""",
)
replace_once(
    '      setPlayerData(loaded.playerData)\n      setNotifications(',
    '      setPlayerData(loaded.playerData)\n      activeBattleRef.current = loaded.activeBattle\n      setNotifications(',
)
replace_once(
    """      setSaveNotice(
        loaded.recoveredFromBackup
          ? `${slotId}のバックアップ世代から復元しました。`
          : `${slotId}をロードしました。`,
      )
      setScreen('REGION')""",
    """      if (loaded.activeBattle !== null) {
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
        setScreen('REGION')
      }
      setSaveNotice(
        loaded.activeBattle !== null
          ? `${slotId}の中断戦闘を再開しました。`
          : loaded.recoveredFromBackup
            ? `${slotId}のバックアップ世代から復元しました。`
            : `${slotId}をロードしました。`,
      )""",
)
replace_once(
    '    setSelectedStageId(stageId)\n    setBattleSession({',
    '    setSelectedStageId(stageId)\n    activeBattleRef.current = null\n    setBattleSession({',
)
replace_once(
    """      fastModeAvailable:
        playerData.stageProgress?.completedStageIds.includes(stageId) ?? false,
    })""",
    """      fastModeAvailable:
        playerData.stageProgress?.completedStageIds.includes(stageId) ?? false,
      initialAttempt: 0,
    })""",
)
helpers = """
  const leaveBattle = (nextScreen: Exclude<AppScreen, 'SAVE'>): void => {
    activeBattleRef.current = null
    setBattleSession(null)
    setScreen(nextScreen)
    if (autosaveEnabled && saveBootState === 'READY') {
      void enqueueSaveTask(() => persistPlayerData(playerData, activeSlotId, null)).catch(
        (error) =>
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
        T039_PLAYER_CATALOG,
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
      const imported = importSaveTransferJson(json, T039_PLAYER_CATALOG)
      const savedAtEpochMs = Date.now()
      const saved = await enqueueSaveTask(() =>
        savePlayerDataAtomic(
          BROWSER_SAVE_REPOSITORY,
          imported.playerData,
          T039_PLAYER_CATALOG,
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
        createCurrentProgressionNotifications(saved.playerData, T039_PLAYER_CATALOG),
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
        setScreen('REGION')
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

"""
replace_once("  if (saveBootState === 'LOADING') {", helpers + "  if (saveBootState === 'LOADING') {")
replace_once(
    '        allowFastMode={battleSession.fastModeAvailable}\n        settleResult=',
    """        allowFastMode={battleSession.fastModeAvailable}
        initialStableSnapshot={battleSession.initialStableSnapshot}
        initialAttempt={battleSession.initialAttempt}
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
        settleResult=""",
)
replace_once(
    '        onSettlement={(settlement) => {\n          updatePlayerData(settlement.playerData)',
    '        onSettlement={(settlement) => {\n          activeBattleRef.current = null\n          updatePlayerData(settlement.playerData)',
)
replace_once(
    """        onOpenFormation={() => {
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
        }}""",
    """        onOpenFormation={() => leaveBattle('COLLECTION')}
        onOpenResearch={() => leaveBattle('RESEARCH')}
        onNextStage={() => leaveBattle('REGION')}""",
)
replace_once(
    '        onAutosaveChange={changeAutosave}\n        onBack=',
    '        onAutosaveChange={changeAutosave}\n        onExportJson={exportCurrentSave}\n        onImportJson={(json) => void importIntoActiveSlot(json)}\n        onBack=',
)

PATH.write_text(text)
