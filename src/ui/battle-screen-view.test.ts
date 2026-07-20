import { describe, expect, it } from 'vitest'
import { createTelegraphResolveEvent } from '../battle/telegraph'
import { pushTimelineEvent } from '../battle/timeline-queue'
import { createInteractiveBattleRunner } from '../battle/headless-battle-runner'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import { createBattleScreenView } from './battle-screen-view'

function withTelegraphAndEffects() {
  const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
  const snapshot = runner.getSnapshot()
  const target = snapshot.battle.units.find((unit) => unit.battleUnitId === 'ally.alpha')
  if (target === undefined) {
    throw new Error('test target is missing')
  }
  const effect = Object.freeze({
    activeEffectId: 'active.test.poison',
    effectId: 'effect.status.poison',
    sourceBattleUnitId: 'enemy.delta',
    targetBattleUnitId: target.battleUnitId,
    strength: 4,
    stacks: 2,
    stackLimit: 5,
    duration: Object.freeze({ unit: 'TRIGGERS' as const, remaining: 3 }),
    duplicateScope: 'TARGET' as const,
    appliedAt: 0,
    applicationSequence: 0,
  })
  const baseSkill = STANDARD_HEADLESS_BATTLE.skills[0]
  if (baseSkill === undefined) {
    throw new Error('test skill is missing')
  }
  const telegraphSkill = Object.freeze({
    ...baseSkill,
    id: 'skill.test-telegraph',
    telegraphDelay: 250,
  })
  const telegraph = createTelegraphResolveEvent({
    telegraphId: 'telegraph.test',
    sourceBattleUnitId: 'enemy.delta',
    skill: telegraphSkill,
    targetPositions: [target.position],
    currentTime: snapshot.currentVirtualTime,
    sequence: 100,
  })
  const battle = Object.freeze({
    ...snapshot.battle,
    units: Object.freeze(
      snapshot.battle.units.map((unit) =>
        unit.battleUnitId === target.battleUnitId
          ? Object.freeze({ ...unit, effects: Object.freeze([effect]) })
          : unit,
      ),
    ),
    timeline: pushTimelineEvent(snapshot.battle.timeline, telegraph),
  })
  return Object.freeze({ ...snapshot, battle })
}

describe('battle screen view', () => {
  it('projects HP, barriers, attributes, status chips, next actions, and telegraph targets', () => {
    const snapshot = withTelegraphAndEffects()
    const view = createBattleScreenView(STANDARD_HEADLESS_BATTLE, snapshot)
    const cell = view.cells.find((candidate) => candidate.unit?.battleUnitId === 'ally.alpha')

    expect(view.cells).toHaveLength(18)
    expect(cell?.telegraphCount).toBe(1)
    expect(cell?.unit).toMatchObject({
      attributeLabel: '風',
      nextActionTime: expect.any(Number),
      effects: [expect.objectContaining({ label: '毒', stacks: 2, durationLabel: '残3回' })],
    })
    expect(view.timeline.some((entry) => entry.kind === 'TELEGRAPH_RESOLVE')).toBe(true)
    expect(view.timeline.length).toBeLessThanOrEqual(12)
  })

  it('adds a deterministic translucent provisional next action for a previewed manual option', () => {
    const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    runner.requestManualAllyAction()
    let snapshot = runner.getSnapshot()
    while (snapshot.status === 'READY') {
      snapshot = runner.step()
    }
    const option = snapshot.pendingManualAction?.options.find(
      (candidate) => candidate.kind !== 'WAIT',
    )
    if (option === undefined) {
      throw new Error('manual option with action cost is missing')
    }

    const first = createBattleScreenView(STANDARD_HEADLESS_BATTLE, snapshot, option)
    const second = createBattleScreenView(STANDARD_HEADLESS_BATTLE, snapshot, option)
    const provisional = first.timeline.find((entry) => entry.provisional)

    expect(provisional).toMatchObject({
      actorBattleUnitId: snapshot.pendingManualAction?.actorBattleUnitId,
      kind: 'UNIT_TURN',
      positionId: expect.any(String),
    })
    expect(JSON.stringify(second.timeline)).toBe(JSON.stringify(first.timeline))
  })

  it('keeps only four deterministic major effects and reports the hidden count', () => {
    const snapshot = withTelegraphAndEffects()
    const target = snapshot.battle.units.find((unit) => unit.battleUnitId === 'ally.alpha')
    if (target === undefined) {
      throw new Error('test target is missing')
    }
    const effects = Array.from({ length: 6 }, (_, index) =>
      Object.freeze({
        activeEffectId: `active.extra.${index}`,
        effectId: `effect.extra.${index}`,
        sourceBattleUnitId: null,
        targetBattleUnitId: target.battleUnitId,
        strength: index,
        stacks: 1,
        stackLimit: 1,
        duration: Object.freeze({ unit: 'BATTLE' as const, remaining: null }),
        duplicateScope: 'TARGET' as const,
        appliedAt: 0,
        applicationSequence: index,
      }),
    )
    const battle = Object.freeze({
      ...snapshot.battle,
      units: Object.freeze(
        snapshot.battle.units.map((unit) =>
          unit.battleUnitId === target.battleUnitId
            ? Object.freeze({ ...unit, effects: Object.freeze(effects) })
            : unit,
        ),
      ),
    })
    const view = createBattleScreenView(
      STANDARD_HEADLESS_BATTLE,
      Object.freeze({ ...snapshot, battle }),
    )
    const unit = view.cells.find((cell) => cell.unit?.battleUnitId === target.battleUnitId)?.unit

    expect(unit?.effects).toHaveLength(4)
    expect(unit?.hiddenEffectCount).toBe(2)
  })
})

describe('relative battle timeline labels', () => {
  it('orders same-time events deterministically and exposes player-facing relative labels', () => {
    const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    const snapshot = runner.getSnapshot()
    const view = createBattleScreenView(STANDARD_HEADLESS_BATTLE, snapshot)
    const repeated = createBattleScreenView(STANDARD_HEADLESS_BATTLE, snapshot)
    const sameTime = view.timeline.filter((entry, index, entries) =>
      entries.some((other, otherIndex) => otherIndex !== index && other.time === entry.time),
    )

    expect(view.timeline.map((entry) => entry.relativeOrder)).toEqual(
      view.timeline.map((_, index) => index + 1),
    )
    expect(view.timeline.every((entry) => entry.relativeLabel.length > 0)).toBe(true)
    expect(sameTime.length).toBeGreaterThan(1)
    expect(view.timeline.map((entry) => `${entry.time}:${entry.id}`)).toEqual(
      repeated.timeline.map((entry) => `${entry.time}:${entry.id}`),
    )
    expect(
      view.cells
        .flatMap((cell) => (cell.unit === null ? [] : [cell.unit]))
        .every(
          (unit) => unit.nextActionLabel === '予定なし' || unit.nextActionLabel.includes('次'),
        ),
    ).toBe(true)
  })
})
