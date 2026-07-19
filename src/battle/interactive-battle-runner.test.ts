import { describe, expect, it } from 'vitest'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import {
  MANUAL_WAIT_CANDIDATE_ID,
  createInteractiveBattleRunner,
  runHeadlessBattle,
} from './interactive-battle-runner'

describe('interactive battle runner', () => {
  it('advances one action at a time and matches the compatibility headless run', () => {
    const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)

    expect(runner.getSnapshot()).toMatchObject({
      status: 'READY',
      currentVirtualTime: 0,
      totalActions: 0,
    })

    const first = runner.step()
    expect(first.status).toBe('READY')
    expect(first.totalActions).toBe(1)
    expect(first.currentVirtualTime).toBeGreaterThan(0)
    expect(first.lastDecisionLog).not.toBeNull()

    while (runner.getSnapshot().status === 'READY') {
      runner.step()
    }

    expect(runner.getResult()).toEqual(runHeadlessBattle(STANDARD_HEADLESS_BATTLE))
  })

  it('stops at the next ally action and returns to automatic execution after one manual action', () => {
    const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    runner.requestManualAllyAction()

    let snapshot = runner.getSnapshot()
    while (snapshot.status === 'READY') {
      snapshot = runner.step()
    }

    expect(snapshot.status).toBe('AWAITING_MANUAL_ACTION')
    expect(snapshot.pendingManualAction?.actorBattleUnitId.startsWith('ally.')).toBe(true)
    expect(snapshot.pendingManualAction?.options.some(
      (option) => option.candidateId === MANUAL_WAIT_CANDIDATE_ID,
    )).toBe(true)

    const actionCountBefore = snapshot.totalActions
    snapshot = runner.submitManualAction(MANUAL_WAIT_CANDIDATE_ID)

    expect(snapshot.status).toBe('READY')
    expect(snapshot.totalActions).toBe(actionCountBefore + 1)
    expect(snapshot.pendingManualAction).toBeNull()
    expect(snapshot.manualAllyActionRequested).toBe(false)

    const afterAuto = runner.step()
    expect(afterAuto.totalActions).toBe(snapshot.totalActions + 1)
  })

  it('publishes immutable snapshots after control and execution transitions', () => {
    const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    const snapshots = [] as ReturnType<typeof runner.getSnapshot>[]
    const unsubscribe = runner.subscribe((snapshot) => snapshots.push(snapshot))

    runner.requestManualAllyAction()
    runner.cancelManualAllyActionRequest()
    runner.step()
    unsubscribe()
    runner.step()

    expect(snapshots).toHaveLength(3)
    expect(Object.isFrozen(snapshots[0])).toBe(true)
    expect(snapshots.at(-1)?.totalActions).toBe(1)
  })
})
