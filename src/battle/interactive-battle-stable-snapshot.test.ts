import { describe, expect, it } from 'vitest'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import { createInteractiveBattleRunner } from './interactive-battle-runner'

function runUntilTerminal(runner: ReturnType<typeof createInteractiveBattleRunner>): void {
  while (runner.getSnapshot().status === 'READY') runner.step()
}

describe('interactive battle stable snapshots', () => {
  it('round-trips through JSON and resumes to the same deterministic result', () => {
    const original = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    for (let index = 0; index < 6; index += 1) original.step()

    const stable = original.getStableSnapshot()
    const roundTripped = JSON.parse(JSON.stringify(stable)) as typeof stable
    const restored = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE, roundTripped)

    expect(restored.getStableSnapshot()).toEqual(stable)
    runUntilTerminal(original)
    runUntilTerminal(restored)
    expect(restored.getResult()).toEqual(original.getResult())
  })

  it('preserves a pending request for the next ally manual action', () => {
    const original = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    original.step()
    original.requestManualAllyAction()
    const restored = createInteractiveBattleRunner(
      STANDARD_HEADLESS_BATTLE,
      JSON.parse(JSON.stringify(original.getStableSnapshot())) as ReturnType<
        typeof original.getStableSnapshot
      >,
    )

    let left = original.getSnapshot()
    let right = restored.getSnapshot()
    while (left.status === 'READY' && right.status === 'READY') {
      left = original.step()
      right = restored.step()
    }

    expect(right).toEqual(left)
    expect(right.status).toBe('AWAITING_MANUAL_ACTION')
  })

  it('refuses to capture the partially processed manual selection state', () => {
    const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    runner.requestManualAllyAction()
    while (runner.getSnapshot().status === 'READY') runner.step()

    expect(runner.getSnapshot().status).toBe('AWAITING_MANUAL_ACTION')
    expect(() => runner.getStableSnapshot()).toThrow('manual action')
  })
})
