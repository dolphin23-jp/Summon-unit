import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { appendBattleEvent, EMPTY_BATTLE_EVENT_LOG } from './event-log'
import { resolveUnitHealing } from './healing'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.healing-test',
  rarity: 1,
  attributeId: 'attribute.earth',
  primarySpeciesId: 'species-group.plant',
  tagIds: Object.freeze([]),
  innateSkillId: 'skill.healing-test',
  stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 3 }),
})

describe('unit healing', () => {
  it('applies missing HP and reports overheal deterministically', () => {
    const target = createBattleUnitState(species, {
      battleUnitId: 'ally.healing-target',
      position: { side: 'ALLY', row: 1, column: 1 },
      initialHp: 75,
    })
    const result = resolveUnitHealing(target, species, 40)
    expect(result).toMatchObject({
      baseHealing: 40,
      modifiedHealing: 40,
      appliedHealing: 25,
      overheal: 15,
    })
    expect(result.after.hp).toBe(100)
    expect(target.hp).toBe(75)
  })

  it('records a validated healing event including overheal', () => {
    const log = appendBattleEvent(EMPTY_BATTLE_EVENT_LOG, {
      kind: 'healing_applied',
      virtualTime: 100,
      payload: {
        sourceBattleUnitId: 'ally.healer',
        targetBattleUnitId: 'ally.target',
        skillId: 'skill.heal',
        baseHealing: 40,
        modifiedHealing: 40,
        appliedHealing: 25,
        overheal: 15,
        hpBefore: 75,
        hpAfter: 100,
      },
    })
    expect(log.events[0]).toMatchObject({
      kind: 'healing_applied',
      payload: { appliedHealing: 25, overheal: 15 },
    })
  })
})
