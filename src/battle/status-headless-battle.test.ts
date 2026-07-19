import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  runHeadlessBattle,
  type HeadlessBattleDefinition,
} from './headless-battle-runner'
import {
  applyMovementLockStatus,
  applyPoisonStatus,
} from './status-conditions'
import { createBattleUnitState } from './unit-state'

const allySkill: SkillDefinition = Object.freeze({
  id: 'skill.status-ally',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})
const enemySkill: SkillDefinition = Object.freeze({
  id: 'skill.status-enemy',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})

const allySpecies: MonsterSpecies = Object.freeze({
  id: 'species.status-ally',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 20, defense: 10, speed: 1 }),
  innateSkillId: allySkill.id,
})
const enemySpecies: MonsterSpecies = Object.freeze({
  id: 'species.status-enemy',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.test',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 12, attack: 20, defense: 500, speed: 5 }),
  innateSkillId: enemySkill.id,
})

function createPoisonDefeatDefinition(): HeadlessBattleDefinition {
  const enemy = createBattleUnitState(enemySpecies, {
    battleUnitId: 'enemy.poisoned',
    position: { side: 'ENEMY', row: 0, column: 1 },
  })
  const poisoned = applyPoisonStatus({
    target: enemy,
    targetSpecies: enemySpecies,
    sourceBattleUnitId: 'ally.source',
    damagePerStack: 20,
    currentTime: 0,
    applicationSequence: 1,
  }).state

  return Object.freeze({
    species: Object.freeze([allySpecies, enemySpecies]),
    skills: Object.freeze([allySkill, enemySkill]),
    maxActions: 10,
    units: Object.freeze([
      Object.freeze({
        battleUnitId: 'ally.source',
        speciesId: allySpecies.id,
        position: Object.freeze({ side: 'ALLY' as const, row: 2 as const, column: 0 as const }),
        tiePriority: 1,
      }),
      Object.freeze({
        battleUnitId: enemy.battleUnitId,
        speciesId: enemySpecies.id,
        position: enemy.position,
        initialEffects: poisoned.effects,
        tiePriority: 0,
      }),
    ]),
  })
}

describe('status headless integration', () => {
  it('defeats a unit from poison before it can act and records a deterministic event sequence', () => {
    const definition = createPoisonDefeatDefinition()
    const first = runHeadlessBattle(definition)
    const second = runHeadlessBattle(definition)

    expect(first).toEqual(second)
    expect(first.summary).toMatchObject({
      termination: 'BATTLE_ENDED',
      outcome: 'ALLY_VICTORY',
      totalActions: 0,
    })
    expect(first.log.events.map((event) => event.kind)).toEqual([
      'battle_started',
      'turn_started',
      'damage_applied',
      'effect_merged',
      'unit_defeated',
      'battle_ended',
    ])
    expect(first.log.events[2]).toMatchObject({
      kind: 'damage_applied',
      payload: {
        sourceBattleUnitId: 'ally.source',
        targetBattleUnitId: 'enemy.poisoned',
        skillId: null,
        calculatedDamage: 20,
        appliedDamage: 12,
        hpBefore: 12,
        hpAfter: 0,
      },
    })
    expect(first.log.events.map((event) => event.sequence)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('forces a movement-locked unit to wait and expires the lock after its action', () => {
    const actorSpecies: MonsterSpecies = Object.freeze({
      ...allySpecies,
      id: 'species.locked-runner',
      innateSkillId: 'skill.locked-runner',
      stats: Object.freeze({ ...allySpecies.stats, speed: 5 }),
    })
    const actorSkill: SkillDefinition = Object.freeze({
      ...allySkill,
      id: actorSpecies.innateSkillId,
    })
    const actor = createBattleUnitState(actorSpecies, {
      battleUnitId: 'ally.locked',
      position: { side: 'ALLY', row: 0, column: 0 },
    })
    const locked = applyMovementLockStatus({
      target: actor,
      targetSpecies: actorSpecies,
      sourceBattleUnitId: 'enemy.remote',
      targetActionCount: 1,
      currentTime: 0,
      applicationSequence: 1,
    }).state
    const definition: HeadlessBattleDefinition = Object.freeze({
      species: Object.freeze([actorSpecies, enemySpecies]),
      skills: Object.freeze([actorSkill, enemySkill]),
      maxActions: 1,
      units: Object.freeze([
        Object.freeze({
          battleUnitId: actor.battleUnitId,
          speciesId: actorSpecies.id,
          position: actor.position,
          initialEffects: locked.effects,
          tiePriority: 0,
        }),
        Object.freeze({
          battleUnitId: 'enemy.remote',
          speciesId: enemySpecies.id,
          position: Object.freeze({ side: 'ENEMY' as const, row: 2 as const, column: 2 as const }),
          tiePriority: 1,
        }),
      ]),
    })

    const result = runHeadlessBattle(definition)

    expect(result.summary).toMatchObject({
      termination: 'ACTION_LIMIT_REACHED',
      outcome: 'ONGOING',
      totalActions: 1,
    })
    expect(result.log.events.some((event) => event.kind === 'unit_moved')).toBe(false)
    expect(result.log.events.at(-1)).toMatchObject({
      kind: 'effect_removed',
      payload: { effectId: 'effect.status.movement-lock', reason: 'EXPIRED' },
    })
    expect(
      result.battle.units.find((unit) => unit.battleUnitId === actor.battleUnitId)?.effects,
    ).toEqual([])
  })
})
