import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { resolveBattleUnitDefeat, createBattleState, type BattleState } from './defeat-and-victory'
import {
  getDirectEffectiveTarget,
  getDirectTargetingPreview,
  getSameColumnEnemyCandidates,
  isDirectTargetExposed,
  resolveDirectTarget,
} from './direct-targeting'
import { createBattleUnitState, withBattleUnitHp, type BattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.direct-test',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.direct-test',
  tagIds: Object.freeze(['tag.direct-test']),
  innateSkillId: 'skill.direct-test',
  stats: Object.freeze({ hp: 100, attack: 20, defense: 10, speed: 3 }),
})

interface UnitDefinition {
  readonly battleUnitId: string
  readonly side: 'ALLY' | 'ENEMY'
  readonly row: 0 | 1 | 2
  readonly column: 0 | 1 | 2
}

function createUnit(definition: UnitDefinition): BattleUnitState {
  return createBattleUnitState(species, {
    battleUnitId: definition.battleUnitId,
    position: {
      side: definition.side,
      row: definition.row,
      column: definition.column,
    },
  })
}

function createBattle(definitions: readonly UnitDefinition[]): BattleState {
  return createBattleState({ units: definitions.map(createUnit) })
}

const standardDefinitions: readonly UnitDefinition[] = [
  { battleUnitId: 'ally.attacker', side: 'ALLY', row: 2, column: 1 },
  { battleUnitId: 'enemy.front', side: 'ENEMY', row: 0, column: 1 },
  { battleUnitId: 'enemy.middle', side: 'ENEMY', row: 1, column: 1 },
  { battleUnitId: 'enemy.back', side: 'ENEMY', row: 2, column: 1 },
  { battleUnitId: 'enemy.other-column', side: 'ENEMY', row: 0, column: 0 },
]

function defeatUnit(
  battle: BattleState,
  defeatedBattleUnitId: string,
  killerBattleUnitId: string,
): BattleState {
  const current = battle.units.find((unit) => unit.battleUnitId === defeatedBattleUnitId)
  if (current === undefined) {
    throw new Error(`missing test unit: ${defeatedBattleUnitId}`)
  }

  return resolveBattleUnitDefeat({
    battle,
    defeatedUnit: withBattleUnitHp(current, species, 0),
    currentTime: 10,
    killerBattleUnitId,
  })
}

describe('DIRECT same-column candidates and cover', () => {
  it('orders living enemies from the attacker side and marks the first as the effective target', () => {
    const battle = createBattle(standardDefinitions)
    const candidates = getSameColumnEnemyCandidates(battle, 'ally.attacker')
    const preview = getDirectTargetingPreview(battle, 'ally.attacker')

    expect(candidates.map((unit) => unit.battleUnitId)).toEqual([
      'enemy.front',
      'enemy.middle',
      'enemy.back',
    ])
    expect(preview).toEqual({
      attackerBattleUnitId: 'ally.attacker',
      column: 1,
      effectiveTargetBattleUnitId: 'enemy.front',
      effectiveTargetPositionId: 'ENEMY:0:1',
      candidates: [
        {
          battleUnitId: 'enemy.front',
          position: { side: 'ENEMY', row: 0, column: 1 },
          positionId: 'ENEMY:0:1',
          distance: 3,
          status: 'EFFECTIVE_TARGET',
          blockedByBattleUnitId: null,
        },
        {
          battleUnitId: 'enemy.middle',
          position: { side: 'ENEMY', row: 1, column: 1 },
          positionId: 'ENEMY:1:1',
          distance: 4,
          status: 'BLOCKED',
          blockedByBattleUnitId: 'enemy.front',
        },
        {
          battleUnitId: 'enemy.back',
          position: { side: 'ENEMY', row: 2, column: 1 },
          positionId: 'ENEMY:2:1',
          distance: 5,
          status: 'BLOCKED',
          blockedByBattleUnitId: 'enemy.front',
        },
      ],
    })
  })

  it('stops a rear-targeted DIRECT line at the front enemy', () => {
    const battle = createBattle(standardDefinitions)

    expect(
      resolveDirectTarget({
        battle,
        attackerBattleUnitId: 'ally.attacker',
        intendedTargetBattleUnitId: 'enemy.back',
      }),
    ).toMatchObject({
      intendedTargetBattleUnitId: 'enemy.back',
      actualTargetBattleUnitId: 'enemy.front',
      blocked: true,
      blockingBattleUnitId: 'enemy.front',
    })

    expect(
      resolveDirectTarget({
        battle,
        attackerBattleUnitId: 'ally.attacker',
        intendedTargetBattleUnitId: 'enemy.front',
      }),
    ).toMatchObject({
      intendedTargetBattleUnitId: 'enemy.front',
      actualTargetBattleUnitId: 'enemy.front',
      blocked: false,
      blockingBattleUnitId: null,
    })
    expect(isDirectTargetExposed(battle, 'ally.attacker', 'enemy.front')).toBe(true)
    expect(isDirectTargetExposed(battle, 'ally.attacker', 'enemy.middle')).toBe(false)
  })

  it('exposes the next enemy after the front enemy is defeated and removed from occupancy', () => {
    const initialBattle = createBattle(standardDefinitions)
    const battle = defeatUnit(initialBattle, 'enemy.front', 'ally.attacker')
    const preview = getDirectTargetingPreview(battle, 'ally.attacker')

    expect(preview.effectiveTargetBattleUnitId).toBe('enemy.middle')
    expect(preview.candidates.map((candidate) => candidate.battleUnitId)).toEqual([
      'enemy.middle',
      'enemy.back',
    ])
    expect(preview.candidates[0]).toMatchObject({
      status: 'EFFECTIVE_TARGET',
      blockedByBattleUnitId: null,
    })
    expect(preview.candidates[1]).toMatchObject({
      status: 'BLOCKED',
      blockedByBattleUnitId: 'enemy.middle',
    })
    expect(getDirectEffectiveTarget(battle, 'ally.attacker')?.battleUnitId).toBe('enemy.middle')
  })

  it('ignores friendly units in the line and never treats them as cover', () => {
    const battle = createBattle([
      { battleUnitId: 'ally.attacker', side: 'ALLY', row: 2, column: 1 },
      { battleUnitId: 'ally.front-friend', side: 'ALLY', row: 0, column: 1 },
      { battleUnitId: 'ally.middle-friend', side: 'ALLY', row: 1, column: 1 },
      { battleUnitId: 'enemy.target', side: 'ENEMY', row: 2, column: 1 },
    ])

    const preview = getDirectTargetingPreview(battle, 'ally.attacker')
    expect(preview.effectiveTargetBattleUnitId).toBe('enemy.target')
    expect(preview.candidates.map((candidate) => candidate.battleUnitId)).toEqual([
      'enemy.target',
    ])
  })

  it('uses the opposing front row for an enemy-side attacker as well', () => {
    const battle = createBattle([
      { battleUnitId: 'enemy.attacker', side: 'ENEMY', row: 2, column: 2 },
      { battleUnitId: 'ally.front', side: 'ALLY', row: 0, column: 2 },
      { battleUnitId: 'ally.back', side: 'ALLY', row: 2, column: 2 },
    ])

    expect(
      getSameColumnEnemyCandidates(battle, 'enemy.attacker').map((unit) => unit.battleUnitId),
    ).toEqual(['ally.front', 'ally.back'])
    expect(getDirectEffectiveTarget(battle, 'enemy.attacker')?.battleUnitId).toBe('ally.front')
  })

  it('excludes other columns and reports no effective target for an empty column', () => {
    const battle = createBattle([
      { battleUnitId: 'ally.attacker', side: 'ALLY', row: 0, column: 2 },
      { battleUnitId: 'enemy.left', side: 'ENEMY', row: 0, column: 0 },
      { battleUnitId: 'enemy.center', side: 'ENEMY', row: 0, column: 1 },
    ])

    expect(getSameColumnEnemyCandidates(battle, 'ally.attacker')).toEqual([])
    expect(getDirectTargetingPreview(battle, 'ally.attacker')).toMatchObject({
      column: 2,
      effectiveTargetBattleUnitId: null,
      effectiveTargetPositionId: null,
      candidates: [],
    })
    expect(isDirectTargetExposed(battle, 'ally.attacker', 'enemy.center')).toBe(false)
    expect(() =>
      resolveDirectTarget({
        battle,
        attackerBattleUnitId: 'ally.attacker',
        intendedTargetBattleUnitId: 'enemy.center',
      }),
    ).toThrow('DIRECT intended target must be in the attacker column')
  })

  it('is deterministic across input order and returns immutable preview data', () => {
    const canonicalBattle = createBattle(standardDefinitions)
    const reversedBattle = createBattle([...standardDefinitions].reverse())
    const canonical = getDirectTargetingPreview(canonicalBattle, 'ally.attacker')
    const reversed = getDirectTargetingPreview(reversedBattle, 'ally.attacker')

    expect(reversed).toEqual(canonical)
    expect(Object.isFrozen(canonical)).toBe(true)
    expect(Object.isFrozen(canonical.candidates)).toBe(true)
    expect(canonical.candidates.every((candidate) => Object.isFrozen(candidate))).toBe(true)
    expect(canonical.candidates.every((candidate) => Object.isFrozen(candidate.position))).toBe(
      true,
    )
  })

  it('rejects missing or defeated attackers and invalid intended targets', () => {
    const initialBattle = createBattle([
      { battleUnitId: 'ally.attacker', side: 'ALLY', row: 0, column: 0 },
      { battleUnitId: 'ally.reserve', side: 'ALLY', row: 0, column: 1 },
      { battleUnitId: 'enemy.target', side: 'ENEMY', row: 0, column: 0 },
      { battleUnitId: 'enemy.reserve', side: 'ENEMY', row: 0, column: 1 },
    ])
    const defeatedAttackerBattle = defeatUnit(initialBattle, 'ally.attacker', 'enemy.target')

    expect(() => getDirectTargetingPreview(initialBattle, 'missing')).toThrow(
      'attackerBattleUnitId must reference a battle unit: missing',
    )
    expect(() => getDirectTargetingPreview(defeatedAttackerBattle, 'ally.attacker')).toThrow(
      'defeated attacker cannot resolve DIRECT targeting',
    )
    expect(() =>
      resolveDirectTarget({
        battle: initialBattle,
        attackerBattleUnitId: 'ally.attacker',
        intendedTargetBattleUnitId: 'ally.reserve',
      }),
    ).toThrow('DIRECT intended target must be an enemy')
  })
})
