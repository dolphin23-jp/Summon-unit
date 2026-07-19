import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { createBarrierLayer } from './barrier'
import { createGuardShare } from './guard-share'
import {
  runHeadlessBattle,
  type HeadlessBattleDefinition,
} from './headless-battle-runner'

const attackSkill: SkillDefinition = Object.freeze({
  id: 'skill.t020-strike',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})

const attackerSpecies: MonsterSpecies = Object.freeze({
  id: 'species.t020-attacker',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 100, defense: 0, speed: 10 }),
  innateSkillId: attackSkill.id,
})

const defenderSpecies: MonsterSpecies = Object.freeze({
  id: 'species.t020-defender',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 1, defense: 0, speed: 1 }),
  innateSkillId: attackSkill.id,
})

const definition: HeadlessBattleDefinition = Object.freeze({
  species: Object.freeze([attackerSpecies, defenderSpecies]),
  skills: Object.freeze([attackSkill]),
  maxActions: 1,
  guardShares: Object.freeze([
    createGuardShare({
      protectedBattleUnitId: 'enemy.target',
      guardBattleUnitId: 'enemy.guard',
      sharePermille: 500,
      applicationSequence: 1,
    }),
  ]),
  units: Object.freeze([
    Object.freeze({
      battleUnitId: 'ally.attacker',
      speciesId: attackerSpecies.id,
      position: Object.freeze({ side: 'ALLY' as const, row: 0 as const, column: 0 as const }),
      tiePriority: 0,
    }),
    Object.freeze({
      battleUnitId: 'enemy.target',
      speciesId: defenderSpecies.id,
      position: Object.freeze({ side: 'ENEMY' as const, row: 0 as const, column: 0 as const }),
      initialBarriers: Object.freeze([
        createBarrierLayer({
          targetBattleUnitId: 'enemy.target',
          capacity: 10,
          applicationSequence: 1,
        }),
      ]),
      tiePriority: 1,
    }),
    Object.freeze({
      battleUnitId: 'enemy.guard',
      speciesId: defenderSpecies.id,
      position: Object.freeze({ side: 'ENEMY' as const, row: 0 as const, column: 1 as const }),
      initialBarriers: Object.freeze([
        createBarrierLayer({
          targetBattleUnitId: 'enemy.guard',
          capacity: 10,
          applicationSequence: 2,
        }),
      ]),
      tiePriority: 2,
    }),
  ]),
})

describe('T020 headless barrier and guard-share integration', () => {
  it('splits final skill damage and consumes both barrier layers before HP', () => {
    const result = runHeadlessBattle(definition)
    const target = result.battle.units.find((unit) => unit.battleUnitId === 'enemy.target')
    const guard = result.battle.units.find((unit) => unit.battleUnitId === 'enemy.guard')

    expect(result.summary).toMatchObject({
      termination: 'ACTION_LIMIT_REACHED',
      outcome: 'ONGOING',
      totalActions: 1,
    })
    expect(target).toMatchObject({ hp: 60, barriers: [] })
    expect(guard).toMatchObject({ hp: 60, barriers: [] })
    expect(result.log.events.map((event) => event.kind)).toEqual([
      'battle_started',
      'turn_started',
      'skill_used',
      'guard_shared',
      'barrier_absorbed',
      'damage_applied',
      'barrier_absorbed',
      'damage_applied',
    ])
    expect(result.log.events[3]).toMatchObject({
      payload: {
        finalDamage: 100,
        retainedDamage: 50,
        redirectedDamage: 50,
      },
    })
    expect(result.summary.units.find((unit) => unit.battleUnitId === 'enemy.target')).toMatchObject({
      hp: 60,
      barrierTotal: 0,
    })
  })

  it('remains byte-identical across repeated executions', () => {
    const expected = JSON.stringify(runHeadlessBattle(definition))
    for (let index = 0; index < 20; index += 1) {
      expect(JSON.stringify(runHeadlessBattle(definition))).toBe(expected)
    }
  })
})
