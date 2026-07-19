import { describe, expect, it } from 'vitest'
import { getTotalBarrierCapacity } from './barrier'
import {
  createInteractiveBattleRunner,
  type HeadlessBattleDefinition,
  type InteractiveBattleSnapshot,
} from './interactive-battle-runner'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'

function advanceToManual(
  definition: HeadlessBattleDefinition = STANDARD_HEADLESS_BATTLE,
): {
  readonly runner: ReturnType<typeof createInteractiveBattleRunner>
  readonly snapshot: InteractiveBattleSnapshot
} {
  const runner = createInteractiveBattleRunner(definition)
  runner.requestManualAllyAction()
  let snapshot = runner.getSnapshot()
  while (snapshot.status === 'READY') {
    snapshot = runner.step()
  }
  if (snapshot.pendingManualAction === null) {
    throw new Error('manual action was not reached')
  }
  return Object.freeze({ runner, snapshot })
}

function withBarrierAndGuard(): HeadlessBattleDefinition {
  return Object.freeze({
    ...STANDARD_HEADLESS_BATTLE,
    units: Object.freeze(
      STANDARD_HEADLESS_BATTLE.units.map((unit) =>
        unit.battleUnitId === 'enemy.delta'
          ? Object.freeze({
              ...unit,
              initialBarriers: Object.freeze([
                Object.freeze({
                  barrierLayerId: 'barrier.test.delta',
                  sourceBattleUnitId: 'enemy.alpha',
                  targetBattleUnitId: 'enemy.delta',
                  initialCapacity: 8,
                  remainingCapacity: 8,
                  applicationSequence: 0,
                }),
              ]),
            })
          : unit,
      ),
    ),
    guardShares: Object.freeze([
      Object.freeze({
        guardShareId: 'guard.test.delta',
        protectedBattleUnitId: 'enemy.delta',
        guardBattleUnitId: 'enemy.alpha',
        sharePermille: 300,
        applicationSequence: 0,
      }),
    ]),
  })
}

describe('manual action confirmed previews', () => {
  it('exposes innate, generic, bloom, move, and wait independently of AUTO policies', () => {
    const { snapshot } = advanceToManual()
    const pending = snapshot.pendingManualAction
    if (pending === null) {
      throw new Error('manual action is missing')
    }

    expect(new Set(pending.options.map((option) => option.category))).toEqual(
      new Set(['INNATE', 'GENERIC', 'BLOOM', 'MOVE', 'WAIT']),
    )
    expect(
      pending.options.some(
        (option) =>
          option.skillId === 'skill.demo-bloom' && option.recommended === false,
      ),
    ).toBe(true)
  })

  it('does not mutate battle state while selecting and matches the committed result', () => {
    const { runner, snapshot } = advanceToManual()
    const option = snapshot.pendingManualAction?.options.find(
      (candidate) =>
        candidate.skillId === 'skill.demo-bloom' &&
        candidate.preview.damageResults.some((result) => result.role === 'PRIMARY'),
    )
    if (option === undefined) {
      throw new Error('bloom manual option is missing')
    }
    const before = runner.getSnapshot()
    const primary = option.preview.damageResults.find((result) => result.role === 'PRIMARY')
    if (primary === undefined) {
      throw new Error('primary preview is missing')
    }

    expect(runner.getSnapshot()).toEqual(before)
    expect(option.preview.nextActionRank).toBeGreaterThan(0)

    const after = runner.submitManualAction(option.candidateId)
    const committed = after.battle.units.find(
      (unit) => unit.battleUnitId === primary.battleUnitId,
    )
    expect(committed?.hp).toBe(primary.hpAfter)
    expect(committed === undefined ? null : getTotalBarrierCapacity(committed.barriers)).toBe(
      primary.barrierAfter,
    )
  })

  it('previews barrier absorption and guard sharing with the same results used by commit', () => {
    const { runner, snapshot } = advanceToManual(withBarrierAndGuard())
    const option = snapshot.pendingManualAction?.options.find(
      (candidate) =>
        candidate.skillId === 'skill.demo-bloom' &&
        candidate.preview.selectedTargetBattleUnitId === 'enemy.delta',
    )
    if (option === undefined) {
      throw new Error('guarded target option is missing')
    }
    const protectedResult = option.preview.damageResults.find(
      (result) => result.battleUnitId === 'enemy.delta' && result.role === 'PRIMARY',
    )
    const guardResult = option.preview.damageResults.find(
      (result) => result.role === 'GUARD',
    )
    if (protectedResult === undefined || guardResult === undefined) {
      throw new Error('guard preview rows are missing')
    }

    expect(protectedResult.barrierAbsorbedDamage).toBeGreaterThan(0)
    expect(guardResult.guardedForBattleUnitId).toBe('enemy.delta')

    const after = runner.submitManualAction(option.candidateId)
    const protectedUnit = after.battle.units.find(
      (unit) => unit.battleUnitId === protectedResult.battleUnitId,
    )
    const guardUnit = after.battle.units.find(
      (unit) => unit.battleUnitId === guardResult.battleUnitId,
    )
    expect(protectedUnit?.hp).toBe(protectedResult.hpAfter)
    expect(guardUnit?.hp).toBe(guardResult.hpAfter)
    expect(
      protectedUnit === undefined
        ? null
        : getTotalBarrierCapacity(protectedUnit.barriers),
    ).toBe(protectedResult.barrierAfter)
  })
})
