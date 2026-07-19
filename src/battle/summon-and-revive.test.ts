import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { createBarrierLayer } from './barrier'
import { createBattlefieldRegion } from './battlefield-region'
import type { BoardPosition } from './board'
import {
  createBattleState,
  resolveBattleUnitDefeat,
  type BattleState,
} from './defeat-and-victory'
import { createOccupyingBoardObjectState } from './occupying-board-object'
import {
  EMPTY_BATTLE_REVIVAL_STATE,
  REVIVE_HP_PERMILLE,
  reviveBattleUnit,
  summonBattleUnit,
} from './summon-and-revive'
import { createBattleUnitState, withBattleUnitHp } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.summon-revive',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 20, defense: 10, speed: 4 }),
  innateSkillId: 'skill.test',
})

function unit(
  battleUnitId: string,
  side: 'ALLY' | 'ENEMY',
  row: 0 | 1 | 2,
  column: 0 | 1 | 2,
  withTemporaryState = false,
) {
  return createBattleUnitState(species, {
    battleUnitId,
    position: { side, row, column },
    initialBarriers: withTemporaryState
      ? [
          createBarrierLayer({
            targetBattleUnitId: battleUnitId,
            capacity: 20,
            applicationSequence: 0,
          }),
        ]
      : [],
    initialEffects: withTemporaryState
      ? [
          {
            activeEffectId: `effect:${battleUnitId}`,
            effectId: 'effect.temporary',
            sourceBattleUnitId: null,
            targetBattleUnitId: battleUnitId,
            strength: 10,
            stacks: 1,
            stackLimit: 1,
            duration: { unit: 'TARGET_ACTIONS', remaining: 2 },
            duplicateScope: 'TARGET',
            appliedAt: 0,
            applicationSequence: 0,
          },
        ]
      : [],
  })
}

function baseBattle(): BattleState {
  return createBattleState({
    units: [
      unit('ally.summoner', 'ALLY', 0, 0),
      unit('ally.target', 'ALLY', 1, 1, true),
      unit('enemy.anchor', 'ENEMY', 0, 0),
    ],
  })
}

function defeat(
  battle: BattleState,
  battleUnitId: string,
  currentTime: number,
  killerBattleUnitId: string,
): BattleState {
  const target = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (target === undefined) {
    throw new Error(`missing test unit: ${battleUnitId}`)
  }
  return resolveBattleUnitDefeat({
    battle,
    defeatedUnit: withBattleUnitHp(target, species, 0),
    currentTime,
    killerBattleUnitId,
  })
}

function allSidePositions(side: 'ALLY' | 'ENEMY'): readonly BoardPosition[] {
  return [0, 1, 2].flatMap((row) =>
    [0, 1, 2].map((column) => ({
      side,
      row: row as 0 | 1 | 2,
      column: column as 0 | 1 | 2,
    })),
  )
}

describe('T023 summon', () => {
  it('summons into an empty cell, waits for its first action, and triggers regions', () => {
    const battle = baseBattle()
    const region = createBattlefieldRegion({
      battlefieldRegionId: 'region.summon-entry',
      effectId: 'effect.entry',
      positions: [{ side: 'ALLY', row: 2, column: 2 }],
      createdAt: 0,
    })
    const result = summonBattleUnit({
      battle,
      summonerBattleUnitId: 'ally.summoner',
      summonedBattleUnitId: 'ally.summoned',
      summonedSpecies: species,
      destination: { side: 'ALLY', row: 2, column: 2 },
      currentTime: 100,
      initialActionCost: 100,
      tiePriority: 7,
      regions: [region],
    })

    expect(result.summonedUnit.position).toEqual({ side: 'ALLY', row: 2, column: 2 })
    expect(result.summonedSchedule.nextActionTime).toBe(25_100)
    expect(result.summonedSchedule.tie).toEqual({
      actionCount: 0,
      lastActionTime: 100,
      tiePriority: 7,
      battleUnitId: 'ally.summoned',
    })
    expect(result.battle.occupancy.at(-1)).toMatchObject({
      battleUnitId: 'ally.summoned',
      position: { side: 'ALLY', row: 2, column: 2 },
    })
    expect(result.regionEntries).toEqual([
      expect.objectContaining({
        battlefieldRegionId: 'region.summon-entry',
        battleUnitId: 'ally.summoned',
        cause: 'SUMMON',
        enteredPositionId: 'ALLY:2:2',
      }),
    ])
    expect(battle.units).toHaveLength(3)
  })

  it('keeps a summoned unit after its summoner is defeated', () => {
    const summoned = summonBattleUnit({
      battle: baseBattle(),
      summonerBattleUnitId: 'ally.summoner',
      summonedBattleUnitId: 'ally.summoned',
      summonedSpecies: species,
      destination: { side: 'ALLY', row: 2, column: 2 },
      currentTime: 100,
      initialActionCost: 100,
      tiePriority: 0,
    })
    const afterSummonerDefeat = defeat(
      summoned.battle,
      'ally.summoner',
      200,
      'enemy.anchor',
    )

    expect(
      afterSummonerDefeat.units.find((candidate) => candidate.battleUnitId === 'ally.summoned')
        ?.defeated,
    ).toBe(false)
    expect(
      afterSummonerDefeat.occupancy.some(
        (occupant) => occupant.battleUnitId === 'ally.summoned',
      ),
    ).toBe(true)
  })

  it('rejects unit and board-object occupancy, wrong side, and duplicate ids', () => {
    const battle = baseBattle()
    const object = createOccupyingBoardObjectState({
      boardObjectId: 'object.blocker',
      objectTypeId: 'object.crystal',
      position: { side: 'ALLY', row: 2, column: 2 },
      maxHp: 50,
    })
    const common = {
      battle,
      summonerBattleUnitId: 'ally.summoner',
      summonedSpecies: species,
      currentTime: 100,
      initialActionCost: 100,
      tiePriority: 0,
    }

    expect(() =>
      summonBattleUnit({
        ...common,
        summonedBattleUnitId: 'ally.occupied',
        destination: { side: 'ALLY', row: 1, column: 1 },
      }),
    ).toThrow('summon destination must be empty')
    expect(() =>
      summonBattleUnit({
        ...common,
        summonedBattleUnitId: 'ally.object-blocked',
        destination: { side: 'ALLY', row: 2, column: 2 },
        occupyingObjects: [object],
      }),
    ).toThrow('summon destination must be empty')
    expect(() =>
      summonBattleUnit({
        ...common,
        summonedBattleUnitId: 'ally.wrong-side',
        destination: { side: 'ENEMY', row: 2, column: 2 },
      }),
    ).toThrow('summon destination must be on the summoner side')
    expect(() =>
      summonBattleUnit({
        ...common,
        summonedBattleUnitId: 'ally.target',
        destination: { side: 'ALLY', row: 2, column: 2 },
      }),
    ).toThrow('battleUnitId must be unique: ally.target')
  })

  it('enforces nine living cells but permits a replacement after one of nine is defeated', () => {
    const allies = allSidePositions('ALLY').map((position, index) =>
      unit(`ally.${index}`, 'ALLY', position.row, position.column),
    )
    const enemy = unit('enemy.anchor', 'ENEMY', 0, 0)
    const fullBattle = createBattleState({ units: [...allies, enemy] })

    expect(() =>
      summonBattleUnit({
        battle: fullBattle,
        summonerBattleUnitId: 'ally.0',
        summonedBattleUnitId: 'ally.extra',
        summonedSpecies: species,
        destination: { side: 'ALLY', row: 2, column: 2 },
        currentTime: 10,
        initialActionCost: 100,
        tiePriority: 0,
      }),
    ).toThrow('summon side already occupies the nine-unit limit')

    const reduced = defeat(fullBattle, 'ally.8', 20, 'enemy.anchor')
    const replacement = summonBattleUnit({
      battle: reduced,
      summonerBattleUnitId: 'ally.0',
      summonedBattleUnitId: 'ally.extra',
      summonedSpecies: species,
      destination: { side: 'ALLY', row: 2, column: 2 },
      currentTime: 30,
      initialActionCost: 100,
      tiePriority: 0,
    })

    expect(replacement.battle.units.filter((candidate) => candidate.side === 'ALLY')).toHaveLength(10)
    expect(replacement.battle.occupancy.filter((occupant) => occupant.position.side === 'ALLY')).toHaveLength(9)
  })
})

describe('T023 revive', () => {
  it('revives at the original cell with 30% HP, clears temporary state, and waits', () => {
    const defeated = defeat(baseBattle(), 'ally.target', 100, 'enemy.anchor')
    const result = reviveBattleUnit({
      battle: defeated,
      targetBattleUnitId: 'ally.target',
      targetSpecies: species,
      revivalState: EMPTY_BATTLE_REVIVAL_STATE,
      currentTime: 200,
      initialActionCost: 100,
      tiePriority: 3,
    })

    expect(REVIVE_HP_PERMILLE).toBe(300)
    expect(result.restoredHp).toBe(30)
    expect(result.destination).toEqual({ side: 'ALLY', row: 1, column: 1 })
    expect(result.revivedUnit.hp).toBe(30)
    expect(result.revivedUnit.defeated).toBe(false)
    expect(result.revivedUnit.effects).toEqual([])
    expect(result.revivedUnit.barriers).toEqual([])
    expect(result.revivedSchedule.nextActionTime).toBe(25_200)
    expect(result.battle.defeatRecords).toEqual([])
    expect(result.revivalState.revivedBattleUnitIds).toEqual(['ally.target'])
  })

  it('uses the first stable adjacent empty cell when the original cell is occupied', () => {
    const initial = createBattleState({
      units: [
        unit('ally.summoner', 'ALLY', 0, 0),
        unit('ally.blocker', 'ALLY', 0, 1),
        unit('ally.target', 'ALLY', 1, 1),
        unit('enemy.anchor', 'ENEMY', 0, 0),
      ],
    })
    const defeated = defeat(initial, 'ally.target', 100, 'enemy.anchor')
    const occupiedOriginal = summonBattleUnit({
      battle: defeated,
      summonerBattleUnitId: 'ally.summoner',
      summonedBattleUnitId: 'ally.on-original',
      summonedSpecies: species,
      destination: { side: 'ALLY', row: 1, column: 1 },
      currentTime: 150,
      initialActionCost: 100,
      tiePriority: 0,
    })
    const revived = reviveBattleUnit({
      battle: occupiedOriginal.battle,
      targetBattleUnitId: 'ally.target',
      targetSpecies: species,
      currentTime: 200,
      initialActionCost: 100,
      tiePriority: 0,
    })

    expect(revived.destination).toEqual({ side: 'ALLY', row: 0, column: 2 })
  })

  it('allows a second defeat but rejects a second revival in the same battle', () => {
    const firstDefeat = defeat(baseBattle(), 'ally.target', 100, 'enemy.anchor')
    const revived = reviveBattleUnit({
      battle: firstDefeat,
      targetBattleUnitId: 'ally.target',
      targetSpecies: species,
      currentTime: 200,
      initialActionCost: 100,
      tiePriority: 0,
    })
    const secondDefeat = defeat(revived.battle, 'ally.target', 300, 'enemy.anchor')

    expect(secondDefeat.defeatRecords).toEqual([
      {
        defeatedBattleUnitId: 'ally.target',
        killerBattleUnitId: 'enemy.anchor',
        defeatedAt: 300,
      },
    ])
    expect(() =>
      reviveBattleUnit({
        battle: secondDefeat,
        targetBattleUnitId: 'ally.target',
        targetSpecies: species,
        revivalState: revived.revivalState,
        currentTime: 400,
        initialActionCost: 100,
        tiePriority: 0,
      }),
    ).toThrow('battle unit may be revived only once per battle')
  })

  it('is deterministic across one hundred identical resolutions', () => {
    const defeated = defeat(baseBattle(), 'ally.target', 100, 'enemy.anchor')
    const input = {
      battle: defeated,
      targetBattleUnitId: 'ally.target',
      targetSpecies: species,
      currentTime: 200,
      initialActionCost: 100,
      tiePriority: 0,
    }
    const expected = reviveBattleUnit(input)

    for (let index = 0; index < 100; index += 1) {
      expect(reviveBattleUnit(input)).toEqual(expected)
    }
  })
})
