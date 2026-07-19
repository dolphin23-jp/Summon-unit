import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import {
  consumeBarrierLayers,
  createBarrierLayer,
  freezeBarrierLayerCollection,
  getTotalBarrierCapacity,
} from './barrier'
import { resolveBarrierGuardDamage } from './barrier-guard-resolution'
import {
  createGuardShare,
  freezeGuardShareCollection,
  getGuardShareForProtectedUnit,
} from './guard-share'
import { createBattleUnitState } from './unit-state'

const targetSpecies: MonsterSpecies = Object.freeze({
  id: 'species.target',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 3 }),
  innateSkillId: 'skill.target',
})

const guardSpecies: MonsterSpecies = Object.freeze({
  ...targetSpecies,
  id: 'species.guard',
  stats: Object.freeze({ hp: 100, attack: 10, defense: 999, speed: 3 }),
  innateSkillId: 'skill.guard',
})

function barrier(targetBattleUnitId: string, capacity: number, sequence: number) {
  return createBarrierLayer({
    targetBattleUnitId,
    capacity,
    applicationSequence: sequence,
  })
}

describe('barrier layers', () => {
  it('sorts layers stably and consumes oldest layers before HP', () => {
    const barriers = freezeBarrierLayerCollection([
      barrier('ally.target', 30, 2),
      barrier('ally.target', 15, 1),
    ])
    const result = consumeBarrierLayers(barriers, 40)

    expect(barriers.map((layer) => layer.applicationSequence)).toEqual([1, 2])
    expect(getTotalBarrierCapacity(barriers)).toBe(45)
    expect(result).toMatchObject({
      incomingDamage: 40,
      absorbedDamage: 40,
      remainingDamage: 0,
    })
    expect(result.consumptions).toHaveLength(2)
    expect(result.consumptions[0]).toMatchObject({ absorbedDamage: 15, broken: true })
    expect(result.consumptions[1]).toMatchObject({ absorbedDamage: 25, broken: false })
    expect(result.barriers).toHaveLength(1)
    expect(result.barriers[0].remainingCapacity).toBe(5)
    expect(getTotalBarrierCapacity(result.barriers)).toBe(5)
    expect(getTotalBarrierCapacity(barriers)).toBe(45)
  })

  it('reports a hit without HP damage when a barrier fully absorbs the hit', () => {
    const target = createBattleUnitState(targetSpecies, {
      battleUnitId: 'ally.target',
      position: { side: 'ALLY', row: 0, column: 1 },
      initialBarriers: [barrier('ally.target', 30, 1)],
    })
    const resolution = resolveBarrierGuardDamage({
      finalDamage: 20,
      target,
      targetSpecies,
    })

    expect(resolution.target.after.hp).toBe(100)
    expect(resolution.target.after.barriers[0].remainingCapacity).toBe(10)
    expect(resolution.target.barrierAbsorbedDamage).toBe(20)
    expect(resolution.target.hpDamage).toBe(0)
    expect(resolution.target.reactions).toEqual({
      hitOccurred: true,
      hpDamageOccurred: false,
    })
  })
})

describe('guard share', () => {
  it('splits final damage first, then applies each recipient barrier without defense recalculation', () => {
    const target = createBattleUnitState(targetSpecies, {
      battleUnitId: 'ally.target',
      position: { side: 'ALLY', row: 0, column: 1 },
      initialBarriers: [barrier('ally.target', 20, 1)],
    })
    const guard = createBattleUnitState(guardSpecies, {
      battleUnitId: 'ally.guard',
      position: { side: 'ALLY', row: 1, column: 1 },
      initialBarriers: [barrier('ally.guard', 40, 2)],
    })
    const guardShare = createGuardShare({
      protectedBattleUnitId: target.battleUnitId,
      guardBattleUnitId: guard.battleUnitId,
      sharePermille: 500,
      applicationSequence: 3,
    })

    const resolution = resolveBarrierGuardDamage({
      finalDamage: 101,
      target,
      targetSpecies,
      guard: { unit: guard, species: guardSpecies, guardShare },
    })

    expect(resolution.guardShare).not.toBeNull()
    expect(resolution.guardShare).toMatchObject({
      retainedDamage: 50,
      redirectedDamage: 51,
    })
    expect(resolution.target).toMatchObject({
      assignedDamage: 50,
      barrierAbsorbedDamage: 20,
      hpDamage: 30,
    })
    expect(resolution.target.after.hp).toBe(70)
    expect(resolution.guardShare?.guard).toMatchObject({
      assignedDamage: 51,
      barrierAbsorbedDamage: 40,
      hpDamage: 11,
    })
    expect(resolution.guardShare?.guard.after.hp).toBe(89)
    expect(resolution.guardShare?.guard.reactions).toEqual({
      hitOccurred: false,
      hpDamageOccurred: true,
    })
    expect(
      resolution.target.assignedDamage +
        (resolution.guardShare?.guard.assignedDamage ?? 0),
    ).toBe(101)
  })

  it('stops redirection after one guard level', () => {
    const shares = freezeGuardShareCollection([
      createGuardShare({
        protectedBattleUnitId: 'ally.target',
        guardBattleUnitId: 'ally.guard',
        sharePermille: 500,
        applicationSequence: 1,
      }),
      createGuardShare({
        protectedBattleUnitId: 'ally.guard',
        guardBattleUnitId: 'ally.third',
        sharePermille: 500,
        applicationSequence: 2,
      }),
    ])
    const targetShare = getGuardShareForProtectedUnit(shares, 'ally.target')
    const target = createBattleUnitState(targetSpecies, {
      battleUnitId: 'ally.target',
      position: { side: 'ALLY', row: 0, column: 1 },
    })
    const guard = createBattleUnitState(guardSpecies, {
      battleUnitId: 'ally.guard',
      position: { side: 'ALLY', row: 1, column: 1 },
    })

    if (targetShare === null) {
      throw new Error('target guard share must exist')
    }
    const resolution = resolveBarrierGuardDamage({
      finalDamage: 80,
      target,
      targetSpecies,
      guard: { unit: guard, species: guardSpecies, guardShare: targetShare },
    })

    expect(resolution.guardShare?.redirectedDamage).toBe(40)
    expect(resolution.guardShare?.guard.hpDamage).toBe(40)
    expect(resolution.guardShare?.guard.after.hp).toBe(60)
    expect(getGuardShareForProtectedUnit(shares, 'ally.guard')?.guardBattleUnitId).toBe(
      'ally.third',
    )
  })

  it('rejects cross-side guarding', () => {
    const target = createBattleUnitState(targetSpecies, {
      battleUnitId: 'ally.target',
      position: { side: 'ALLY', row: 0, column: 1 },
    })
    const enemyGuard = createBattleUnitState(guardSpecies, {
      battleUnitId: 'enemy.guard',
      position: { side: 'ENEMY', row: 0, column: 1 },
    })
    const guardShare = createGuardShare({
      protectedBattleUnitId: target.battleUnitId,
      guardBattleUnitId: enemyGuard.battleUnitId,
      sharePermille: 500,
      applicationSequence: 1,
    })

    expect(() =>
      resolveBarrierGuardDamage({
        finalDamage: 20,
        target,
        targetSpecies,
        guard: { unit: enemyGuard, species: guardSpecies, guardShare },
      }),
    ).toThrow('guard share requires units on the same side')
  })
})
