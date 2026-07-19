import { describe, expect, it } from 'vitest'
import { runVerticalSliceT046BalanceBenchmark } from './vertical-slice-t046-benchmark'

describe('T046 vertical slice balance benchmark', () => {
  it('collects the fixed 51-battle metric matrix without hiding unsupported healing', () => {
    const report = runVerticalSliceT046BalanceBenchmark()
    expect(report.sampleMatrix).toEqual({
      profiles: 9,
      profilesPerStage: 3,
      stages: 17,
      battles: 51,
    })
    expect(report.capabilities.healingResolutionAvailable).toBe(false)
    expect(report.capabilities.overhealRateBasisPoints).toBeNull()
    expect(report.stages).toHaveLength(17)
    expect(report.stages.every((stage) => stage.samples === 3)).toBe(true)
    expect(report.skills.length).toBeGreaterThan(0)
    expect(report.speciesContributions.length).toBeGreaterThan(0)
    expect(report.speedValues.length).toBeGreaterThan(0)
  })

  it('removes action-limit timeouts and keeps every introductory stage at two wins or better', () => {
    const report = runVerticalSliceT046BalanceBenchmark()
    expect(report.overall.timeoutRateBasisPoints).toBe(0)
    for (const stage of report.stages.filter((candidate) => candidate.band === 'INTRO')) {
      expect(stage.allyVictories).toBeGreaterThanOrEqual(2)
    }
    expect(
      report.stages.find((stage) => stage.stageId === 'stage.slice.b-06-telegraph')
        ?.allyVictories,
    ).toBeGreaterThan(0)
    expect(
      report.stages.find((stage) => stage.stageId === 'stage.slice.b-08-wyvern-boss')
        ?.allyVictories,
    ).toBeGreaterThan(0)
  })

  it('is byte-stable across repeated runs', () => {
    expect(JSON.stringify(runVerticalSliceT046BalanceBenchmark())).toBe(
      JSON.stringify(runVerticalSliceT046BalanceBenchmark()),
    )
  })
})
