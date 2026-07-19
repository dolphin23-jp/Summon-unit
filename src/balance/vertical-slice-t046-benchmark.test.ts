import { describe, expect, it } from 'vitest'
import { runVerticalSliceT046BalanceBenchmark } from './vertical-slice-t046-benchmark'

const REPORT = runVerticalSliceT046BalanceBenchmark()

describe('T046 vertical slice balance benchmark', () => {
  it('collects the fixed 51-battle metric matrix without hiding unsupported healing', () => {
    expect(REPORT.sampleMatrix).toEqual({
      profiles: 9,
      profilesPerStage: 3,
      stages: 17,
      battles: 51,
    })
    expect(REPORT.capabilities.healingResolutionAvailable).toBe(false)
    expect(REPORT.capabilities.overhealRateBasisPoints).toBeNull()
    expect(REPORT.stages).toHaveLength(17)
    expect(REPORT.stages.every((stage) => stage.samples === 3)).toBe(true)
    expect(REPORT.skills.length).toBeGreaterThan(0)
    expect(REPORT.speciesContributions.length).toBeGreaterThan(0)
    expect(REPORT.speedValues.length).toBeGreaterThan(0)
  })

  it('removes action-limit timeouts and keeps every introductory stage at two wins or better', () => {
    expect(REPORT.overall.timeoutRateBasisPoints).toBe(0)
    for (const stage of REPORT.stages.filter((candidate) => candidate.band === 'INTRO')) {
      expect(stage.allyVictories).toBeGreaterThanOrEqual(2)
    }
    expect(
      REPORT.stages.find((stage) => stage.stageId === 'stage.slice.b-06-telegraph')
        ?.allyVictories,
    ).toBeGreaterThan(0)
    expect(
      REPORT.stages.find((stage) => stage.stageId === 'stage.slice.b-08-wyvern-boss')
        ?.allyVictories,
    ).toBeGreaterThan(0)
  })

  it('is byte-stable across repeated runs', () => {
    expect(JSON.stringify(runVerticalSliceT046BalanceBenchmark())).toBe(JSON.stringify(REPORT))
  }, 15_000)
})
