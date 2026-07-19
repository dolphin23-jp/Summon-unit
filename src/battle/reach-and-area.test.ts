import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { getBoardPositionId, type BoardPosition } from './board'
import { createBattleState, type BattleState } from './defeat-and-victory'
import {
  getAreaMaskPositions,
  getSkillReachablePositions,
  resolveSkillAreaTargets,
  resolveSkillReach,
} from './reach-and-area'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.test',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 30, defense: 20, speed: 3 }),
  innateSkillId: 'skill.test',
})

const baseSkill: SkillDefinition = Object.freeze({
  id: 'skill.test',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})

function unit(battleUnitId: string, position: BoardPosition) {
  return createBattleUnitState(species, { battleUnitId, position })
}

function createScenario(): BattleState {
  return createBattleState({
    units: [
      unit('ally.actor', { side: 'ALLY', row: 0, column: 1 }),
      unit('ally.support', { side: 'ALLY', row: 1, column: 0 }),
      unit('enemy.front', { side: 'ENEMY', row: 0, column: 1 }),
      unit('enemy.middle', { side: 'ENEMY', row: 1, column: 1 }),
      unit('enemy.back', { side: 'ENEMY', row: 2, column: 1 }),
      unit('enemy.left', { side: 'ENEMY', row: 0, column: 0 }),
      unit('enemy.right', { side: 'ENEMY', row: 0, column: 2 }),
      unit('enemy.back-left', { side: 'ENEMY', row: 2, column: 0 }),
    ],
  })
}

function positionIds(positions: readonly BoardPosition[]): readonly string[] {
  return positions.map(getBoardPositionId)
}

function targetIds(targets: readonly { readonly battleUnitId: string }[]): readonly string[] {
  return targets.map((target) => target.battleUnitId)
}

describe('T021 reach methods', () => {
  it('resolves CONTACT only across the opposing front cells', () => {
    const battle = createScenario()
    const skill: SkillDefinition = { ...baseSkill, reachMethod: 'CONTACT' }
    const reach = resolveSkillReach({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill,
      selectedTargetBattleUnitId: 'enemy.front',
    })

    expect(positionIds(reach.reachablePositions)).toEqual(['ENEMY:0:1'])
    expect(reach.actualTargetBattleUnitId).toBe('enemy.front')
    expect(reach.blockedByBattleUnitId).toBeNull()
  })

  it('keeps DIRECT cover but lets PIERCE reach every living enemy in the column', () => {
    const battle = createScenario()
    const direct = resolveSkillReach({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill: baseSkill,
      selectedTargetBattleUnitId: 'enemy.middle',
    })
    const pierce = resolveSkillReach({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill: { ...baseSkill, reachMethod: 'PIERCE' },
      selectedTargetBattleUnitId: 'enemy.middle',
    })

    expect(direct.actualTargetBattleUnitId).toBe('enemy.front')
    expect(direct.blockedByBattleUnitId).toBe('enemy.front')
    expect(pierce.actualTargetBattleUnitId).toBe('enemy.middle')
    expect(pierce.blockedByBattleUnitId).toBeNull()
    expect(pierce.traversedBattleUnitIds).toEqual([
      'enemy.front',
      'enemy.middle',
      'enemy.back',
    ])
  })

  it('lets ARC select an empty cell and SNIPE select a covered unit', () => {
    const battle = createScenario()
    const arc = resolveSkillReach({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill: { ...baseSkill, reachMethod: 'ARC' },
      selectedTargetPosition: { side: 'ENEMY', row: 2, column: 2 },
    })
    const snipe = resolveSkillReach({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill: { ...baseSkill, reachMethod: 'SNIPE' },
      selectedTargetBattleUnitId: 'enemy.back',
    })

    expect(arc.actualTargetBattleUnitId).toBeNull()
    expect(arc.impactPosition).toEqual({ side: 'ENEMY', row: 2, column: 2 })
    expect(snipe.actualTargetBattleUnitId).toBe('enemy.back')
    expect(snipe.blockedByBattleUnitId).toBeNull()
  })

  it('resolves SELF and GLOBAL without cover or random ordering', () => {
    const battle = createScenario()
    const self = resolveSkillReach({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill: {
        ...baseSkill,
        targetType: 'SELF',
        reachMethod: 'SELF',
      },
    })
    const globalSkill: SkillDefinition = {
      ...baseSkill,
      reachMethod: 'GLOBAL',
      areaMask: 'SIDE_ALL',
    }
    const global = resolveSkillReach({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill: globalSkill,
    })
    const area = resolveSkillAreaTargets({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill: globalSkill,
      reach: global,
    })

    expect(self.actualTargetBattleUnitId).toBe('ally.actor')
    expect(positionIds(global.reachablePositions)).toHaveLength(9)
    expect(targetIds(area.targets)).toEqual([
      'enemy.back-left',
      'enemy.back',
      'enemy.middle',
      'enemy.left',
      'enemy.front',
      'enemy.right',
    ])
  })

  it('returns identical reach data across repeated executions', () => {
    const battle = createScenario()
    const input = {
      battle,
      actorBattleUnitId: 'ally.actor',
      skill: { ...baseSkill, reachMethod: 'PIERCE' as const },
      selectedTargetBattleUnitId: 'enemy.back',
    }
    const expected = resolveSkillReach(input)

    for (let index = 0; index < 100; index += 1) {
      expect(resolveSkillReach(input)).toEqual(expected)
    }
  })
})

describe('T021 area masks', () => {
  const impact: BoardPosition = Object.freeze({
    side: 'ENEMY',
    row: 1,
    column: 1,
  })

  it('builds row, column, side, behind, cross, and surrounding masks at board edges', () => {
    expect(positionIds(getAreaMaskPositions('HORIZONTAL_ROW', impact))).toEqual([
      'ENEMY:1:0',
      'ENEMY:1:1',
      'ENEMY:1:2',
    ])
    expect(positionIds(getAreaMaskPositions('VERTICAL_COLUMN', impact))).toEqual([
      'ENEMY:2:1',
      'ENEMY:1:1',
      'ENEMY:0:1',
      'ALLY:0:1',
      'ALLY:1:1',
      'ALLY:2:1',
    ])
    expect(positionIds(getAreaMaskPositions('TARGET_AND_SIDES', impact))).toEqual([
      'ENEMY:1:0',
      'ENEMY:1:1',
      'ENEMY:1:2',
    ])
    expect(positionIds(getAreaMaskPositions('TARGET_AND_BEHIND', impact))).toEqual([
      'ENEMY:2:1',
      'ENEMY:1:1',
    ])
    expect(positionIds(getAreaMaskPositions('CROSS', impact))).toEqual([
      'ENEMY:2:1',
      'ENEMY:1:0',
      'ENEMY:1:1',
      'ENEMY:1:2',
      'ENEMY:0:1',
    ])
    expect(positionIds(getAreaMaskPositions('SURROUNDING_EIGHT', impact))).toEqual([
      'ENEMY:2:0',
      'ENEMY:2:1',
      'ENEMY:2:2',
      'ENEMY:1:0',
      'ENEMY:1:2',
      'ENEMY:0:0',
      'ENEMY:0:1',
      'ENEMY:0:2',
    ])
  })

  it('resolves occupied targets from an explicit area mask', () => {
    const battle = createScenario()
    const skill: SkillDefinition = {
      ...baseSkill,
      reachMethod: 'ARC',
      areaMask: 'TARGET_AND_BEHIND',
    }
    const reach = resolveSkillReach({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill,
      selectedTargetPosition: { side: 'ENEMY', row: 0, column: 1 },
    })
    const area = resolveSkillAreaTargets({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill,
      reach,
    })

    expect(targetIds(area.targets)).toEqual(['enemy.front', 'enemy.middle'])
    expect(positionIds(area.positions)).toEqual(['ENEMY:1:1', 'ENEMY:0:1'])
  })

  it('chains to the nearest unvisited target and breaks ties by battle unit id', () => {
    const battle = createScenario()
    const skill: SkillDefinition = {
      ...baseSkill,
      reachMethod: 'SNIPE',
      areaMask: 'CHAIN',
      chainTargetCount: 4,
    }
    const reach = resolveSkillReach({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill,
      selectedTargetBattleUnitId: 'enemy.front',
    })
    const area = resolveSkillAreaTargets({
      battle,
      actorBattleUnitId: 'ally.actor',
      skill,
      reach,
    })

    expect(targetIds(area.targets)).toEqual([
      'enemy.front',
      'enemy.left',
      'enemy.middle',
      'enemy.back',
    ])
    expect(new Set(targetIds(area.targets)).size).toBe(4)
  })

  it('exposes stable reachable positions for previews', () => {
    const battle = createScenario()
    expect(
      positionIds(
        getSkillReachablePositions(battle, 'ally.actor', {
          ...baseSkill,
          reachMethod: 'ARC',
        }),
      ),
    ).toEqual([
      'ENEMY:2:0',
      'ENEMY:2:1',
      'ENEMY:2:2',
      'ENEMY:1:0',
      'ENEMY:1:1',
      'ENEMY:1:2',
      'ENEMY:0:0',
      'ENEMY:0:1',
      'ENEMY:0:2',
    ])
  })
})
