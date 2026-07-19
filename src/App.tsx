import { useState } from 'react'
import type { HeadlessBattleDefinition } from './battle/headless-battle-runner'
import {
  T037_GENERIC_SKILL_COSTS,
  T037_INITIAL_PLAYER_DATA,
  T037_PLAYER_CATALOG,
} from './demo/research-ui-demo'
import { STANDARD_INTERACTIVE_BATTLE } from './demo/standard-headless-battle'
import { createFormationBattleDefinition } from './progression/formation-editor'
import type { PlayerData } from './progression/player-data'
import { preserveResearchFacilityState } from './progression/research-facility'
import { CollectionScreen } from './ui/CollectionScreen'
import { MinimalBattleScreen } from './ui/MinimalBattleScreen'
import { ResearchScreen } from './ui/ResearchScreen'

type AppScreen = 'COLLECTION' | 'RESEARCH'

function App() {
  const [playerData, setPlayerData] = useState<PlayerData>(T037_INITIAL_PLAYER_DATA)
  const [screen, setScreen] = useState<AppScreen>('COLLECTION')
  const [battleDefinition, setBattleDefinition] = useState<HeadlessBattleDefinition | null>(null)

  const updatePlayerData = (next: PlayerData) => {
    setPlayerData((current) =>
      preserveResearchFacilityState(next, current, T037_PLAYER_CATALOG),
    )
  }

  if (battleDefinition !== null) {
    return (
      <MinimalBattleScreen
        definition={battleDefinition}
        onOpenFormation={() => {
          setBattleDefinition(null)
          setScreen('COLLECTION')
        }}
      />
    )
  }

  if (screen === 'RESEARCH') {
    return (
      <ResearchScreen
        playerData={playerData}
        catalog={T037_PLAYER_CATALOG}
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
        catalog={T037_PLAYER_CATALOG}
        genericSkillCosts={T037_GENERIC_SKILL_COSTS}
        onPlayerDataChange={updatePlayerData}
        onStartBattle={(formationId) =>
          setBattleDefinition(
            createFormationBattleDefinition(
              playerData,
              formationId,
              T037_PLAYER_CATALOG,
              STANDARD_INTERACTIVE_BATTLE,
            ),
          )
        }
      />
    </div>
  )
}

export default App
