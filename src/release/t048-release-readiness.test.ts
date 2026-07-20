import { describe, expect, it } from 'vitest'
import { runVerticalSliceT046BalanceBenchmark } from '../balance/vertical-slice-t046-benchmark'
import {
  VERTICAL_SLICE_RUNTIME_CATALOG,
  VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
} from '../content/vertical-slice-runtime'
import { unlockBloomSkill } from '../progression/bloom-research'
import { createPlayerData } from '../progression/player-data'

const RELEASE_BALANCE_REPORT = runVerticalSliceT046BalanceBenchmark()

describe('T048 release readiness', () => {
  it('keeps the balanced benchmark deterministic and free from timeouts or warnings', () => {
    expect(RELEASE_BALANCE_REPORT.deterministic).toBe(true)
    expect(RELEASE_BALANCE_REPORT.sampleMatrix).toEqual({
      profiles: 9,
      profilesPerStage: 3,
      stages: 17,
      battles: 51,
    })
    expect(RELEASE_BALANCE_REPORT.overall.timeoutRateBasisPoints).toBe(0)
    expect(RELEASE_BALANCE_REPORT.warnings).toEqual([])
    expect(RELEASE_BALANCE_REPORT.overall.allyVictories).toBe(45)
    expect(RELEASE_BALANCE_REPORT.overall.allyDefeats).toBe(6)
  })

  it('allows an unlocked R1 species to complete bloom research once analysis is sufficient', () => {
    const speciesId = 'species.slice.grassfang-rat'
    const skillId = 'skill.slice.grassfang-pack-run'
    const prepared = createPlayerData(
      {
        ...VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA,
        collection: {
          ...VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA.collection,
          speciesStates:
            VERTICAL_SLICE_RUNTIME_INITIAL_PLAYER_DATA.collection.speciesStates.map((state) =>
              state.speciesId === speciesId
                ? { ...state, analysisBasisPoints: 1500 }
                : state,
            ),
        },
      },
      VERTICAL_SLICE_RUNTIME_CATALOG,
    )

    const result = unlockBloomSkill(
      prepared,
      speciesId,
      skillId,
      VERTICAL_SLICE_RUNTIME_CATALOG,
    )

    expect(result.requiredAnalysisBasisPoints).toBe(1500)
    expect(result.currencySpent).toBe(30)
    expect(result.researchDataSpent).toBe(10)
    expect(
      result.playerData.collection.speciesStates.find(
        (state) => state.speciesId === speciesId,
      )?.bloomSkillIds,
    ).toContain(skillId)
  })

  it('records support resolution as unavailable until the runner accepts ally-target skills', () => {
    expect(RELEASE_BALANCE_REPORT.capabilities).toEqual({
      healingResolutionAvailable: false,
      overhealRateBasisPoints: null,
      note: 'The current runner executes SINGLE_ENEMY skills only; healing and overheal are explicitly unavailable.',
    })
  })
})
