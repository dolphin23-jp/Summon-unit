import { useState } from 'react'
import type { HeadlessBattleDefinition } from './battle/headless-battle-runner'
import {
  T038_GENERIC_SKILL_COSTS,
  T038_INITIAL_PLAYER_DATA,
  T038_PLAYER_CATALOG,
  T038_STAGE,
} from './demo/stage-reward-demo'
import { STANDARD_INTERACTIVE_BATTLE } from './demo/standard-headless-battle'
import { createFormationBattleDefinition } from './progression/formation-editor'
import type { PlayerData } from './progression/player-data'
import { createStagePlayerData, settleStageBattle } from './progression/stage-reward'
import { CollectionScreen } from './ui/CollectionScreen'
import { MinimalBattleScreen } from './ui/MinimalBattleScreen'
import { ResearchScreen } from './ui/ResearchScreen'

type AppScreen = 'COLLECTION' | 'RESEARCH'

interface BattleSession {
  readonly definition: HeadlessBattleDefinition
  readonly serial: number
}

function App() {
  const [playerData, setPlayerData] = useState<PlayerData>(T038_INITIAL_PLAYER_DATA)
  const [screen, setScreen] = useState<AppScreen>('COLLECTION')
  const [battleSession, setBattleSession] = useState<BattleSession | null>(null)
  const [nextBattleSerial, setNextBattleSerial] = useState(1)

  const updatePlayerData = (next: PlayerData) => {
    setPlayerData((current) =>
      createStagePlayerData(
        {
          ...next,
          facilities: next.facilities ?? current.facilities,
          stageProgress: next.stageProgress ?? current.stageProgress,
        },
        T038_PLAYER_CATALOG,
      ),
    )
  }

  if (battleSession !== null) {
    return (
      <MinimalBattleScreen
        definition={battleSession.definition}
        settleResult={(result, attempt) =>
          settleStageBattle(playerData, result, T038_PLAYER_CATALOG, {
            settlementId: `${T038_STAGE.stageId}:run-${battleSession.serial}:attempt-${attempt}`,
            stageId: T038_STAGE.stageId,
            bonusRollBasisPoints: (battleSession.serial * 7919 + attempt * 3571) % 10_000,
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
      />
    )
  }

  if (screen === 'RESEARCH') {
    return (
      <ResearchScreen
        playerData={playerData}
        catalog={T038_PLAYER_CATALOG}
        onPlayerDataChange={updatePlayerData}
        onOpenCollection={() => setScreen('COLLECTION')}
      />
    )
  }

  return (
    <div className="t037-collection-shell">
      <button
        type="button"
        className="collection-button collection-button--primary research-entry-button"
        onClick={() => setScreen('RESEARCH')}
      >
        研究網・施設を開く
      </button>
      <CollectionScreen
        playerData={playerData}
        catalog={T038_PLAYER_CATALOG}
        genericSkillCosts={T038_GENERIC_SKILL_COSTS}
        onPlayerDataChange={updatePlayerData}
        onStartBattle={(formationId) => {
          const definition = createFormationBattleDefinition(
            playerData,
            formationId,
            T038_PLAYER_CATALOG,
            STANDARD_INTERACTIVE_BATTLE,
          )
          setBattleSession({ definition, serial: nextBattleSerial })
          setNextBattleSerial((current) => current + 1)
        }}
      />
    </div>
  )
}

export default App
