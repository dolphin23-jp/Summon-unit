import { useState } from 'react'
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
import { CollectionScreen } from './ui/CollectionScreen'
import { MinimalBattleScreen } from './ui/MinimalBattleScreen'
import { RegionScreen } from './ui/RegionScreen'
import { ResearchScreen } from './ui/ResearchScreen'

type AppScreen = 'REGION' | 'COLLECTION' | 'RESEARCH'

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

function mergeNotifications(
  current: readonly ProgressionNotification[],
  incoming: readonly ProgressionNotification[],
): readonly ProgressionNotification[] {
  const byId = new Map(current.map((notification) => [notification.id, notification]))
  for (const notification of incoming) byId.set(notification.id, notification)
  return Object.freeze([...byId.values()].sort((left, right) => left.id.localeCompare(right.id, 'en')))
}

function App() {
  const [playerData, setPlayerData] = useState<PlayerData>(T039_INITIAL_PLAYER_DATA)
  const [screen, setScreen] = useState<AppScreen>('REGION')
  const [battleSession, setBattleSession] = useState<BattleSession | null>(null)
  const [nextBattleSerial, setNextBattleSerial] = useState(1)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    T039_FOREST_NORMAL.stageId,
  )
  const [notifications, setNotifications] = useState<readonly ProgressionNotification[]>(() =>
    createCurrentProgressionNotifications(T039_INITIAL_PLAYER_DATA, T039_PLAYER_CATALOG),
  )

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
        onSettlement={(settlement) => updatePlayerData(settlement.playerData)}
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

  if (screen === 'RESEARCH') {
    return (
      <ResearchScreen
        playerData={playerData}
        catalog={T039_PLAYER_CATALOG}
        onPlayerDataChange={updatePlayerData}
        onOpenCollection={() => setScreen('COLLECTION')}
        onOpenRegion={() => setScreen('REGION')}
      />
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
