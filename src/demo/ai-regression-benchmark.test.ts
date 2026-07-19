import { describe, expect, it } from 'vitest'
import {
  runReferenceAiRegressionBenchmark,
  serializeReferenceAiRegressionBenchmark,
} from './ai-regression-benchmark'

describe('AI regression benchmark', () => {
  it('collects fixed headline metrics from configured AI decisions', () => {
    const metrics = runReferenceAiRegressionBenchmark()

    expect(metrics).toMatchObject({
      decisionCount: 5,
      skillSelectionCount: 3,
      moveSelectionCount: 2,
      bloomSelectionCount: 1,
      rawHealingTotal: 50,
      appliedHealingTotal: 40,
      overhealPermille: 200,
      backtrackSelectionCount: 0,
      oscillationSelectionCount: 0,
      backtrackPermilleOfMoves: 0,
      oscillationPermilleOfMoves: 0,
      excludedPolicyCandidateCount: 1,
    })
    expect(metrics.selectedCandidateIds).toHaveLength(5)
    expect(metrics.reasonTexts).toHaveLength(5)
    expect(metrics.calculatedDamageTotal).toBeGreaterThanOrEqual(
      metrics.appliedDamageTotal,
    )
  })

  it('returns byte-identical benchmark JSON for 100 runs', () => {
    const expected = serializeReferenceAiRegressionBenchmark()
    for (let index = 0; index < 100; index += 1) {
      expect(serializeReferenceAiRegressionBenchmark()).toBe(expected)
    }
  })
})
