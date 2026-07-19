import { describe, expect, it } from 'vitest'
import {
  formatReferenceHeadlessBattleV2,
  runReferenceHeadlessBattleV2,
} from './reference-headless-battle-v2'

const REFERENCE_V2_GOLDEN_SUMMARY = Object.freeze({
  outcome: 'ALLY_VICTORY',
  timeoutCriterion: 'REMAINING_HP_RATIO',
  finalVirtualTime: 60,
  battleEventCount: 12,
  traceEventCount: 11,
  units: Object.freeze([
    Object.freeze({
      battleUnitId: 'ally.caster',
      hp: 120,
      barrierTotal: 0,
      effectIds: Object.freeze([]),
      defeated: false,
      positionId: 'ALLY:0:0',
    }),
    Object.freeze({
      battleUnitId: 'ally.guard',
      hp: 134,
      barrierTotal: 5,
      effectIds: Object.freeze(['effect.debuff.attack']),
      defeated: false,
      positionId: 'ALLY:0:1',
    }),
    Object.freeze({
      battleUnitId: 'enemy.minion',
      hp: 30,
      barrierTotal: 0,
      effectIds: Object.freeze([]),
      defeated: false,
      positionId: 'ENEMY:1:1',
    }),
    Object.freeze({
      battleUnitId: 'enemy.summoner',
      hp: 130,
      barrierTotal: 0,
      effectIds: Object.freeze([]),
      defeated: false,
      positionId: 'ENEMY:0:0',
    }),
    Object.freeze({
      battleUnitId: 'enemy.victim',
      hp: 0,
      barrierTotal: 0,
      effectIds: Object.freeze([]),
      defeated: true,
      positionId: 'ENEMY:0:2',
    }),
  ]),
})

const REFERENCE_V2_GOLDEN_TRACE_KINDS = Object.freeze([
  'POISON_APPLIED',
  'BURN_APPLIED',
  'BARRIER_ABSORBED',
  'TELEGRAPH_DECLARED',
  'UNIT_SUMMONED',
  'REGION_ENTERED',
  'TELEGRAPH_RESOLVED',
  'STATUS_TRIGGERED',
  'UNIT_DEFEATED',
  'STATUS_TRIGGERED',
  'TIMEOUT_RESOLVED',
])

describe('T024 deterministic reference battle v2', () => {
  it('matches the reviewed golden summary and full-effect trace', () => {
    const result = runReferenceHeadlessBattleV2()

    expect(result.summary).toEqual(REFERENCE_V2_GOLDEN_SUMMARY)
    expect(result.trace.map((event) => event.kind)).toEqual(
      REFERENCE_V2_GOLDEN_TRACE_KINDS,
    )
    expect(result.trace.find((event) => event.kind === 'TELEGRAPH_RESOLVED')).toMatchObject({
      subjectId: 'telegraph.reference-v2',
      value: 'enemy.minion',
    })
    expect(result.trace.find((event) => event.kind === 'REGION_ENTERED')).toMatchObject({
      subjectId: 'region.reference-v2.summon-cell',
      value: 'enemy.minion',
    })
    expect(result.log.events.at(-1)).toMatchObject({
      kind: 'battle_ended',
      virtualTime: 60,
      payload: { outcome: 'ALLY_VICTORY' },
    })
  })

  it('contains poison, burn, barrier, telegraph, summon, region, and timeout evidence', () => {
    const result = runReferenceHeadlessBattleV2()
    const kinds = new Set(result.trace.map((event) => event.kind))

    expect(kinds).toEqual(
      new Set([
        'POISON_APPLIED',
        'BURN_APPLIED',
        'BARRIER_ABSORBED',
        'TELEGRAPH_DECLARED',
        'UNIT_SUMMONED',
        'REGION_ENTERED',
        'TELEGRAPH_RESOLVED',
        'STATUS_TRIGGERED',
        'UNIT_DEFEATED',
        'TIMEOUT_RESOLVED',
      ]),
    )
    expect(result.timeoutResolution).toMatchObject({
      outcome: 'ALLY_VICTORY',
      decisiveCriterion: 'REMAINING_HP_RATIO',
      ally: { livingUnitCount: 2, remainingHpRatioMicros: 1_957_142 },
      enemy: { livingUnitCount: 2, remainingHpRatioMicros: 1_500_000 },
    })
  })

  it('returns byte-identical output for one hundred fresh executions', () => {
    const expected = formatReferenceHeadlessBattleV2(runReferenceHeadlessBattleV2())

    for (let index = 0; index < 100; index += 1) {
      expect(formatReferenceHeadlessBattleV2(runReferenceHeadlessBattleV2())).toBe(
        expected,
      )
    }
  })
})
