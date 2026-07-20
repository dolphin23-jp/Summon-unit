import { describe, expect, it } from 'vitest'
import { createStageBattleDefinition } from '../progression/stage-battle'
import { summonUnit } from '../progression/unit-economy'
import { createNextSummonInstanceId } from '../ui/SummonScreen'
import {
  VERTICAL_SLICE_RUNTIME_CATALOG,
  VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID,
  VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
  VERTICAL_SLICE_RUNTIME_VALIDATION,
} from './vertical-slice-runtime'

describe('T047 vertical-slice runtime integration', () => {
  it('connects the complete T046 catalog and an immediately playable first formation', () => {
    expect(VERTICAL_SLICE_RUNTIME_VALIDATION).toEqual({
      stages: 17,
      initialUnits: 5,
      initialFormationMembers: 3,
      unlockedInitialStages: 2,
      onboardingCues: 3,
      firstBattleAllies: 3,
      firstBattleEnemies: 1,
    })
  })

  it('creates byte-identical first-stage definitions across repeated builds', () => {
    const formationId = VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA.formations.activeFormationId
    expect(formationId).not.toBeNull()
    const build = () =>
      createStageBattleDefinition(
        VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
        VERTICAL_SLICE_RUNTIME_FIRST_STAGE_ID,
        formationId!,
        VERTICAL_SLICE_RUNTIME_CATALOG,
        { initialActionCost: 100, maxActions: 500 },
      )
    const expected = JSON.stringify(build())
    for (let index = 0; index < 20; index += 1) {
      expect(JSON.stringify(build())).toBe(expected)
    }
  })

  it('issues a deterministic collision-free instance ID and completes a summon transaction', () => {
    const speciesId = 'species.slice.grassfang-rat'
    const instanceId = createNextSummonInstanceId(
      VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
      speciesId,
    )
    expect(instanceId).toBe('unit.summoned.grassfang-rat-001')

    const result = summonUnit(
      VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
      { instanceId, speciesId },
      VERTICAL_SLICE_RUNTIME_CATALOG,
    )
    expect(result.currencySpent).toBe(100)
    expect(result.playerData.economy.currency).toBe(
      VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA.economy.currency - 100,
    )
    expect(result.playerData.collection.unitInstances.at(-1)).toMatchObject({
      instanceId,
      speciesId,
      conditionBasisPoints: 10_000,
    })
  })
})
