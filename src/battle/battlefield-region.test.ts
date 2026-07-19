import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import {
  createBattlefieldRegion,
  resolveBattlefieldRegionEntries,
  resolveForcedMovementWithRegions,
} from './battlefield-region'
import { createBattleState } from './defeat-and-victory'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.region-test',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 20, defense: 20, speed: 3 }),
  innateSkillId: 'skill.test',
})

function unit(
  battleUnitId: string,
  side: 'ALLY' | 'ENEMY',
  row: 0 | 1 | 2,
  column: 0 | 1 | 2,
) {
  return createBattleUnitState(species, {
    battleUnitId,
    position: { side, row, column },
  })
}

function region(
  battlefieldRegionId: string,
  positions = [
    { side: 'ENEMY', row: 1, column: 1 } as const,
    { side: 'ENEMY', row: 1, column: 2 } as const,
  ],
  duration: number | null = 100,
) {
  return createBattlefieldRegion({
    battlefieldRegionId,
    effectId: `effect.${battlefieldRegionId}`,
    sourceBattleUnitId: 'ally.source',
    positions,
    createdAt: 0,
    duration,
  })
}

describe('T022 non-occupying battlefield regions', () => {
  it('triggers when normal movement enters from outside', () => {
    const entries = resolveBattlefieldRegionEntries({
      regions: [region('region.fire')],
      battleUnitId: 'enemy.target',
      from: { side: 'ENEMY', row: 0, column: 1 },
      to: { side: 'ENEMY', row: 1, column: 1 },
      cause: 'NORMAL_MOVEMENT',
      currentTime: 25,
    })

    expect(entries).toEqual([
      {
        battlefieldRegionId: 'region.fire',
        effectId: 'effect.region.fire',
        sourceBattleUnitId: 'ally.source',
        battleUnitId: 'enemy.target',
        cause: 'NORMAL_MOVEMENT',
        enteredPosition: { side: 'ENEMY', row: 1, column: 1 },
        enteredPositionId: 'ENEMY:1:1',
        triggeredAt: 25,
      },
    ])
  })

  it('does not retrigger while moving between cells inside the same region', () => {
    const entries = resolveBattlefieldRegionEntries({
      regions: [region('region.fire')],
      battleUnitId: 'enemy.target',
      from: { side: 'ENEMY', row: 1, column: 1 },
      to: { side: 'ENEMY', row: 1, column: 2 },
      cause: 'NORMAL_MOVEMENT',
      currentTime: 25,
    })

    expect(entries).toEqual([])
  })

  it('triggers after successful forced movement into the region', () => {
    const battle = createBattleState({
      units: [
        unit('ally.source', 'ALLY', 0, 1),
        unit('enemy.target', 'ENEMY', 0, 1),
      ],
    })
    const result = resolveForcedMovementWithRegions({
      battle,
      sourceBattleUnitId: 'ally.source',
      targetBattleUnitId: 'enemy.target',
      kind: 'PUSH',
      regions: [region('region.trap', [{ side: 'ENEMY', row: 1, column: 1 }])],
      currentTime: 40,
    })

    expect(result.movement.success).toBe(true)
    expect(result.regionEntries).toHaveLength(1)
    expect(result.regionEntries[0]).toMatchObject({
      battlefieldRegionId: 'region.trap',
      battleUnitId: 'enemy.target',
      cause: 'FORCED_MOVEMENT',
      enteredPositionId: 'ENEMY:1:1',
      triggeredAt: 40,
    })
  })

  it('triggers for a summon placed directly into the region', () => {
    const entries = resolveBattlefieldRegionEntries({
      regions: [region('region.poison')],
      battleUnitId: 'summon.egg',
      from: null,
      to: { side: 'ENEMY', row: 1, column: 1 },
      cause: 'SUMMON',
      currentTime: 10,
    })

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      battlefieldRegionId: 'region.poison',
      battleUnitId: 'summon.egg',
      cause: 'SUMMON',
    })
  })

  it('does not trigger before creation or at and after expiration', () => {
    const timed = createBattlefieldRegion({
      battlefieldRegionId: 'region.timed',
      effectId: 'effect.timed',
      positions: [{ side: 'ENEMY', row: 1, column: 1 }],
      createdAt: 10,
      duration: 20,
    })
    const base = {
      regions: [timed],
      battleUnitId: 'enemy.target',
      from: { side: 'ENEMY', row: 0, column: 1 } as const,
      to: { side: 'ENEMY', row: 1, column: 1 } as const,
      cause: 'NORMAL_MOVEMENT' as const,
    }

    expect(resolveBattlefieldRegionEntries({ ...base, currentTime: 9 })).toEqual([])
    expect(resolveBattlefieldRegionEntries({ ...base, currentTime: 10 })).toHaveLength(1)
    expect(resolveBattlefieldRegionEntries({ ...base, currentTime: 29 })).toHaveLength(1)
    expect(resolveBattlefieldRegionEntries({ ...base, currentTime: 30 })).toEqual([])
  })

  it('orders overlapping region triggers by stable region id', () => {
    const input = {
      regions: [region('region.zeta'), region('region.alpha')],
      battleUnitId: 'enemy.target',
      from: { side: 'ENEMY', row: 0, column: 1 } as const,
      to: { side: 'ENEMY', row: 1, column: 1 } as const,
      cause: 'FORCED_MOVEMENT' as const,
      currentTime: 5,
    }
    const entries = resolveBattlefieldRegionEntries(input)

    expect(entries.map((entry) => entry.battlefieldRegionId)).toEqual([
      'region.alpha',
      'region.zeta',
    ])
    for (let index = 0; index < 100; index += 1) {
      expect(resolveBattlefieldRegionEntries(input)).toEqual(entries)
    }
  })

  it('rejects cause and previous-position mismatches', () => {
    expect(() =>
      resolveBattlefieldRegionEntries({
        regions: [region('region.fire')],
        battleUnitId: 'summon.egg',
        from: { side: 'ENEMY', row: 0, column: 1 },
        to: { side: 'ENEMY', row: 1, column: 1 },
        cause: 'SUMMON',
        currentTime: 10,
      }),
    ).toThrow('SUMMON region entry must not have a previous position')

    expect(() =>
      resolveBattlefieldRegionEntries({
        regions: [region('region.fire')],
        battleUnitId: 'enemy.target',
        from: null,
        to: { side: 'ENEMY', row: 1, column: 1 },
        cause: 'FORCED_MOVEMENT',
        currentTime: 10,
      }),
    ).toThrow('FORCED_MOVEMENT region entry requires a previous position')
  })
})
