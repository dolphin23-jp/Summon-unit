import { useState } from 'react'
import type { HeadlessBattleDefinition } from './battle/headless-battle-runner'
import {
  T033_GENERIC_SKILL_COSTS,
  T033_INITIAL_LEARNING_STATE,
  T033_INITIAL_PLAYER_DATA,
  T033_PLAYER_CATALOG,
} from './demo/player-collection-demo'
import { STANDARD_INTERACTIVE_BATTLE } from './demo/standard-headless-battle'
import { createFormationBattleDefinition } from './progression/formation-editor'
import type { GenericSkillLearningState } from './progression/generic-skill-learning'
import type { PlayerData } from './progression/player-data'
import { CollectionScreen } from './ui/CollectionScreen'
import { MinimalBattleScreen } from './ui/MinimalBattleScreen'

function App() {
  const [playerData, setPlayerData] = useState<PlayerData>(T033_INITIAL_PLAYER_DATA)
  const [learningState, setLearningState] = useState<GenericSkillLearningState>(
    T033_INITIAL_LEARNING_STATE,
  )
  const [battleDefinition, setBattleDefinition] = useState<HeadlessBattleDefinition | null>(null)

  if (battleDefinition !== null) {
    return (
      <MinimalBattleScreen
        definition={battleDefinition}
        onOpenFormation={() => setBattleDefinition(null)}
      />
    )
  }

  return (
    <CollectionScreen
      playerData={playerData}
      catalog={T033_PLAYER_CATALOG}
      learningState={learningState}
      genericSkillCosts={T033_GENERIC_SKILL_COSTS}
      onPlayerDataChange={setPlayerData}
      onLearningStateChange={setLearningState}
      onStartBattle={(formationId) =>
        setBattleDefinition(
          createFormationBattleDefinition(
            playerData,
            formationId,
            T033_PLAYER_CATALOG,
            STANDARD_INTERACTIVE_BATTLE,
          ),
        )
      }
    />
  )
}

export default App
