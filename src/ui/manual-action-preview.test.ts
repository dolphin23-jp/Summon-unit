import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import { getTotalBarrierCapacity } from '../battle/barrier'
import {
  createInteractiveBattleRunner,
  type HeadlessBattleDefinition,
  type InteractiveBattleSnapshot,
} from '../battle/interactive-battle-runner'

function advanceToManual(snapshot: InteractiveBattleSnapshot, step: () => InteractiveBattleSnapshot) {
  let current = snapshot
  while (current.status === 'READY') {
    current = step()
  }
  return current
}

describe('T030 manual commands and confirmed previews', () => {
  it('exposes innate, generic, bloom, movement, and wait as separate manual actions', () => {
    const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    runner.requestManualAllyAction()
    const snapshot = advanceToManual(runner.getSnapshot(), () => runner.step())
    const pending = snapshot.pendingManualAction

    expect(snapshot.status).toBe('AWAITING_MANUAL_ACTION')
    expect(pending).not.toBeNull()
    const slots = new Set(pending?.options.map((option) => option.slot))
    expect(slots).toEqual(new Set(['INNATE', 'GENERIC', 'BLOOM', 'MOVE', 'WAIT']))

    const generic = pending?.options.find(
      (option) => option.skillId === 'skill.demo-venom-sweep' && option.preview.statusChanges.length > 0,
    )
    expect(generic?.preview.affectedPositionIds.length).toBeGreaterThan(1)
    expect(generic?.preview.statusChanges.some((change) => change.kind === 'POISON')).toBe(true)

    const bloom = pending?.options.find(
      (option) => option.skillId === 'skill.demo-bloom-drive',
    )
    expect(bloom?.preview.forcedMovements).toHaveLength(1)
    expect(bloom?.preview.nextTimelineRank).not.toBeNull()
  })

  it('commits the same HP, status, and next-turn result shown before confirmation', () => {
    const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
    runner.requestManualAllyAction()
    const waiting = advanceToManual(runner.getSnapshot(), () => runner.step())
    const option = waiting.pendingManualAction?.options.find(
      (candidate) =>
        candidate.skillId === 'skill.demo-venom-sweep' &&
        candidate.preview.damageRecipients.length > 0 &&
        candidate.preview.statusChanges.some((change) => change.applied),
    )
    expect(option).toBeDefined()
    if (option === undefined) {
      return
    }

    const committed = runner.submitManualAction(option.candidateId)
    for (const recipient of option.preview.damageRecipients) {
      const unit = committed.battle.units.find(
        (candidate) => candidate.battleUnitId === recipient.battleUnitId,
      )
      expect(unit?.hp).toBe(recipient.hpAfter)
    }
    for (const status of option.preview.statusChanges.filter((change) => change.applied)) {
      const unit = committed.battle.units.find(
        (candidate) => candidate.battleUnitId === status.targetBattleUnitId,
      )
      expect(unit?.effects.some((effect) => status.effectIds.includes(effect.effectId))).toBe(true)
    }
    if (committed.battle.outcome === 'ONGOING') {
      const actorId = waiting.pendingManualAction?.actorBattleUnitId
      const nextTurn = committed.battle.timeline.events.find(
        (event) =>
          event.kind === 'UNIT_TURN' &&
          (event.payload as { readonly battleUnitId?: string }).battleUnitId === actorId,
      )
      expect(nextTurn?.time).toBe(option.preview.nextActionTime)
    }
  })

  it('includes barrier and guard-share mitigation in the exact damage preview', () => {
    const species: readonly MonsterSpecies[] = Object.freeze([
      Object.freeze({
        id: 'species.preview-attacker',
        rarity: 1,
        attributeId: 'attribute.neutral',
        primarySpeciesId: 'group.preview-attacker',
        tagIds: Object.freeze([]),
        innateSkillId: 'skill.preview-hit',
        stats: Object.freeze({ hp: 100, attack: 50, defense: 0, speed: 10 }),
      }),
      Object.freeze({
        id: 'species.preview-defender',
        rarity: 1,
        attributeId: 'attribute.neutral',
        primarySpeciesId: 'group.preview-defender',
        tagIds: Object.freeze([]),
        innateSkillId: 'skill.preview-hit',
        stats: Object.freeze({ hp: 100, attack: 10, defense: 0, speed: 1 }),
      }),
    ])
    const skills: readonly SkillDefinition[] = Object.freeze([
      Object.freeze({
        id: 'skill.preview-hit',
        slotType: 'INNATE',
        actionCost: 100,
        targetType: 'SINGLE_ENEMY',
        reachMethod: 'DIRECT',
        damageMultiplierPermille: 1000,
      }),
    ])
    const definition: HeadlessBattleDefinition = Object.freeze({
      species,
      skills,
      initialActionCost: 100,
      maxActions: 10,
      guardShares: Object.freeze([
        Object.freeze({
          guardShareId: 'guard.preview',
          protectedBattleUnitId: 'enemy.target',
          guardBattleUnitId: 'enemy.guard',
          sharePermille: 500,
          applicationSequence: 0,
        }),
      ]),
      units: Object.freeze([
        Object.freeze({
          battleUnitId: 'ally.actor',
          speciesId: 'species.preview-attacker',
          position: Object.freeze({ side: 'ALLY' as const, row: 0 as const, column: 1 as const }),
          tiePriority: 0,
        }),
        Object.freeze({
          battleUnitId: 'enemy.target',
          speciesId: 'species.preview-defender',
          position: Object.freeze({ side: 'ENEMY' as const, row: 0 as const, column: 1 as const }),
          initialBarriers: Object.freeze([
            Object.freeze({
              barrierLayerId: 'barrier.target',
              sourceBattleUnitId: null,
              targetBattleUnitId: 'enemy.target',
              initialCapacity: 5,
              remainingCapacity: 5,
              applicationSequence: 0,
            }),
          ]),
          tiePriority: 1,
        }),
        Object.freeze({
          battleUnitId: 'enemy.guard',
          speciesId: 'species.preview-defender',
          position: Object.freeze({ side: 'ENEMY' as const, row: 1 as const, column: 1 as const }),
          initialBarriers: Object.freeze([
            Object.freeze({
              barrierLayerId: 'barrier.guard',
              sourceBattleUnitId: null,
              targetBattleUnitId: 'enemy.guard',
              initialCapacity: 3,
              remainingCapacity: 3,
              applicationSequence: 1,
            }),
          ]),
          tiePriority: 2,
        }),
      ]),
    })

    const runner = createInteractiveBattleRunner(definition)
    runner.requestManualAllyAction()
    const waiting = advanceToManual(runner.getSnapshot(), () => runner.step())
    const option = waiting.pendingManualAction?.options.find(
      (candidate) => candidate.skillId === 'skill.preview-hit' && candidate.selectedTargetBattleUnitId === 'enemy.target',
    )
    expect(option).toBeDefined()
    expect(option?.preview.damageRecipients).toEqual([
      expect.objectContaining({
        battleUnitId: 'enemy.target',
        role: 'PRIMARY',
        assignedDamage: 25,
        barrierAbsorbedDamage: 5,
        hpDamage: 20,
        hpAfter: 80,
      }),
      expect.objectContaining({
        battleUnitId: 'enemy.guard',
        role: 'GUARD',
        protectedBattleUnitId: 'enemy.target',
        assignedDamage: 25,
        barrierAbsorbedDamage: 3,
        hpDamage: 22,
        hpAfter: 78,
      }),
    ])

    if (option === undefined) {
      return
    }
    const committed = runner.submitManualAction(option.candidateId)
    const target = committed.battle.units.find((unit) => unit.battleUnitId === 'enemy.target')
    const guard = committed.battle.units.find((unit) => unit.battleUnitId === 'enemy.guard')
    expect(target?.hp).toBe(80)
    expect(guard?.hp).toBe(78)
    expect(target === undefined ? null : getTotalBarrierCapacity(target.barriers)).toBe(0)
    expect(guard === undefined ? null : getTotalBarrierCapacity(guard.barriers)).toBe(0)
  })
})
