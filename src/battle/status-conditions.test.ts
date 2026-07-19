import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { getStatusResistanceTagId } from '../content/status-resistance'
import { createInitialUnitActionSchedule } from './action-scheduling'
import { createBattleState } from './defeat-and-victory'
import {
  getNormalMovementCandidates,
  performNormalMovement,
} from './normal-movement'
import {
  applyHealingReceivedModifier,
  getModifiedBattleStatValue,
} from './stat-modifiers'
import {
  POISON_MAX_STACKS,
  STATUS_EFFECT_IDS,
  applyBloomSealStatus,
  applyBurnStatus,
  applyHealingInhibitionStatus,
  applyMovementLockStatus,
  applyPoisonStatus,
  canUseSkillByStatus,
  consumeTargetActionDurations,
  isBloomSkillSealed,
  isMovementLocked,
  resolveTurnStartStatusConditions,
} from './status-conditions'
import { createBattleUnitState } from './unit-state'

function createSpecies(
  id: string,
  attributeId: MonsterSpecies['attributeId'] = 'attribute.neutral',
  tagIds: readonly string[] = [],
): MonsterSpecies {
  return Object.freeze({
    id,
    rarity: 1,
    attributeId,
    primarySpeciesId: 'species-group.test',
    tagIds: Object.freeze([...tagIds]),
    stats: Object.freeze({ hp: 120, attack: 30, defense: 999, speed: 3 }),
    innateSkillId: `skill.${id}`,
  })
}

function createTarget(species: MonsterSpecies, battleUnitId = 'enemy.target') {
  return createBattleUnitState(species, {
    battleUnitId,
    position: { side: 'ENEMY', row: 1, column: 1 },
  })
}

const sourceBattleUnitId = 'ally.source'

const innateSkill: SkillDefinition = Object.freeze({
  id: 'skill.innate',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})
const genericSkill: SkillDefinition = Object.freeze({
  ...innateSkill,
  id: 'skill.generic',
  slotType: 'GENERIC',
})
const bloomSkill: SkillDefinition = Object.freeze({
  ...innateSkill,
  id: 'skill.bloom',
  slotType: 'BLOOM',
})

describe('poison status', () => {
  it('deals defense-ignoring damage at turn start three times and then expires', () => {
    const species = createSpecies('species.poison-target')
    const initial = createTarget(species)
    const applied = applyPoisonStatus({
      target: initial,
      targetSpecies: species,
      sourceBattleUnitId,
      damagePerStack: 4,
      stacks: 2,
      currentTime: 10,
      applicationSequence: 1,
    })

    expect(applied.applied).toBe(true)
    expect(applied.state.effects[0]).toMatchObject({
      effectId: STATUS_EFFECT_IDS.POISON,
      strength: 4,
      stacks: 2,
      stackLimit: POISON_MAX_STACKS,
      duration: { unit: 'TRIGGERS', remaining: 3 },
    })

    const first = resolveTurnStartStatusConditions(applied.state, species)
    const second = resolveTurnStartStatusConditions(first.state, species)
    const third = resolveTurnStartStatusConditions(second.state, species)

    expect(first.triggers[0]).toMatchObject({
      statusId: 'poison',
      defenseIgnored: true,
      calculatedDamage: 8,
      appliedDamage: 8,
      hpBefore: 120,
      hpAfter: 112,
      durationRemainingBefore: 3,
      durationRemainingAfter: 2,
    })
    expect(second.state.hp).toBe(104)
    expect(third.state.hp).toBe(96)
    expect(third.state.effects.some((effect) => effect.effectId === STATUS_EFFECT_IDS.POISON)).toBe(
      false,
    )
    expect(third.triggers[0].removalMutation).toMatchObject({
      kind: 'REMOVED',
      reason: 'EXPIRED',
    })
    expect(initial.hp).toBe(120)
  })

  it('merges poison to the stronger magnitude and caps stacks at five', () => {
    const species = createSpecies('species.poison-stack')
    const initial = createTarget(species)
    const first = applyPoisonStatus({
      target: initial,
      targetSpecies: species,
      sourceBattleUnitId,
      damagePerStack: 4,
      stacks: 3,
      triggerCount: 2,
      currentTime: 0,
      applicationSequence: 1,
    })
    const second = applyPoisonStatus({
      target: first.state,
      targetSpecies: species,
      sourceBattleUnitId: 'ally.other-source',
      damagePerStack: 6,
      stacks: 4,
      triggerCount: 4,
      currentTime: 1,
      applicationSequence: 2,
    })

    expect(second.state.effects).toHaveLength(1)
    expect(second.state.effects[0]).toMatchObject({
      sourceBattleUnitId: 'ally.other-source',
      strength: 6,
      stacks: 5,
      duration: { unit: 'TRIGGERS', remaining: 4 },
    })
    expect(resolveTurnStartStatusConditions(second.state, species).triggers[0].calculatedDamage).toBe(
      30,
    )
  })
})

describe('burn status', () => {
  it('deals fire damage and applies an attack reduction for the same action span', () => {
    const species = createSpecies('species.wind-target', 'attribute.wind')
    const initial = createTarget(species)
    const applied = applyBurnStatus({
      target: initial,
      targetSpecies: species,
      sourceBattleUnitId,
      damagePerTrigger: 8,
      attackReductionPermille: 200,
      triggerCount: 3,
      currentTime: 0,
      applicationSequence: 10,
    })

    expect(applied.state.effects.map((effect) => effect.effectId)).toEqual([
      STATUS_EFFECT_IDS.BURN,
      'effect.debuff.attack',
    ])
    expect(getModifiedBattleStatValue(species.stats.attack, applied.state.effects, 'ATTACK')).toBe(
      24,
    )

    const triggered = resolveTurnStartStatusConditions(applied.state, species)
    expect(triggered.triggers).toHaveLength(1)
    expect(triggered.triggers[0]).toMatchObject({
      statusId: 'burn',
      damageAttributeId: 'attribute.fire',
      calculatedDamage: 10,
      appliedDamage: 10,
    })

    const actionCompleted = consumeTargetActionDurations(triggered.state, species)
    expect(
      actionCompleted.state.effects.find((effect) => effect.effectId === 'effect.debuff.attack'),
    ).toMatchObject({ duration: { unit: 'TARGET_ACTIONS', remaining: 2 } })
    expect(
      actionCompleted.state.effects.find((effect) => effect.effectId === STATUS_EFFECT_IDS.BURN),
    ).toMatchObject({ duration: { unit: 'TRIGGERS', remaining: 2 } })
  })
})

describe('status resistance application', () => {
  it('blocks immune statuses and scales numeric poison magnitude', () => {
    const immuneSpecies = createSpecies('species.immune', 'attribute.neutral', [
      getStatusResistanceTagId('poison', 'IMMUNE'),
    ])
    const strongSpecies = createSpecies('species.strong', 'attribute.neutral', [
      getStatusResistanceTagId('poison', 'STRONG'),
    ])

    const immune = applyPoisonStatus({
      target: createTarget(immuneSpecies, 'enemy.immune'),
      targetSpecies: immuneSpecies,
      damagePerStack: 10,
      currentTime: 0,
      applicationSequence: 1,
    })
    const strong = applyPoisonStatus({
      target: createTarget(strongSpecies, 'enemy.strong'),
      targetSpecies: strongSpecies,
      damagePerStack: 10,
      currentTime: 0,
      applicationSequence: 1,
    })

    expect(immune.applied).toBe(false)
    expect(immune.state.effects).toEqual([])
    expect(strong.state.effects[0].strength).toBe(5)
  })

  it('scales binary status duration without randomness', () => {
    const strongSpecies = createSpecies('species.lock-strong', 'attribute.neutral', [
      getStatusResistanceTagId('movement-lock', 'STRONG'),
    ])
    const weakSpecies = createSpecies('species.lock-weak', 'attribute.neutral', [
      getStatusResistanceTagId('movement-lock', 'WEAK'),
    ])

    const strong = applyMovementLockStatus({
      target: createTarget(strongSpecies, 'enemy.lock-strong'),
      targetSpecies: strongSpecies,
      targetActionCount: 3,
      currentTime: 0,
      applicationSequence: 1,
    })
    const weak = applyMovementLockStatus({
      target: createTarget(weakSpecies, 'enemy.lock-weak'),
      targetSpecies: weakSpecies,
      targetActionCount: 2,
      currentTime: 0,
      applicationSequence: 1,
    })

    expect(strong.state.effects[0].duration.remaining).toBe(2)
    expect(weak.state.effects[0].duration.remaining).toBe(3)
    expect(applyMovementLockStatus({
      target: createTarget(strongSpecies, 'enemy.repeat'),
      targetSpecies: strongSpecies,
      targetActionCount: 3,
      currentTime: 0,
      applicationSequence: 1,
    })).toEqual(
      applyMovementLockStatus({
        target: createTarget(strongSpecies, 'enemy.repeat'),
        targetSpecies: strongSpecies,
        targetActionCount: 3,
        currentTime: 0,
        applicationSequence: 1,
      }),
    )
  })
})

describe('movement lock, bloom seal, and healing inhibition', () => {
  it('removes normal movement candidates and rejects direct movement', () => {
    const actorSpecies = createSpecies('species.locked-actor')
    const enemySpecies = createSpecies('species.enemy')
    const actor = createBattleUnitState(actorSpecies, {
      battleUnitId: 'ally.locked',
      position: { side: 'ALLY', row: 1, column: 1 },
    })
    const locked = applyMovementLockStatus({
      target: actor,
      targetSpecies: actorSpecies,
      sourceBattleUnitId,
      targetActionCount: 1,
      currentTime: 0,
      applicationSequence: 1,
    }).state
    const enemy = createBattleUnitState(enemySpecies, {
      battleUnitId: 'enemy.unit',
      position: { side: 'ENEMY', row: 0, column: 0 },
    })
    const battle = createBattleState({ units: [locked, enemy] })
    const schedule = createInitialUnitActionSchedule(locked, actorSpecies, 100, 0)

    expect(isMovementLocked(locked)).toBe(true)
    expect(getNormalMovementCandidates(battle, locked.battleUnitId)).toEqual([])
    expect(() =>
      performNormalMovement({
        battle,
        actorBattleUnitId: locked.battleUnitId,
        actorSpecies,
        actorSchedule: schedule,
        destination: { side: 'ALLY', row: 1, column: 2 },
        currentTime: schedule.nextActionTime,
      }),
    ).toThrow('movement-locked unit cannot move')

    const expired = consumeTargetActionDurations(locked, actorSpecies)
    expect(isMovementLocked(expired.state)).toBe(false)
    expect(expired.removals[0]).toMatchObject({ kind: 'REMOVED', reason: 'EXPIRED' })
  })

  it('seals only BLOOM skills', () => {
    const species = createSpecies('species.bloom-target')
    const sealed = applyBloomSealStatus({
      target: createTarget(species),
      targetSpecies: species,
      targetActionCount: 2,
      currentTime: 0,
      applicationSequence: 1,
    }).state

    expect(isBloomSkillSealed(sealed)).toBe(true)
    expect(canUseSkillByStatus(sealed, innateSkill)).toBe(true)
    expect(canUseSkillByStatus(sealed, genericSkill)).toBe(true)
    expect(canUseSkillByStatus(sealed, bloomSkill)).toBe(false)
  })

  it('reduces received healing and expires by target actions', () => {
    const species = createSpecies('species.heal-target')
    const inhibited = applyHealingInhibitionStatus({
      target: createTarget(species),
      targetSpecies: species,
      reductionPermille: 500,
      targetActionCount: 1,
      currentTime: 0,
      applicationSequence: 1,
    }).state

    expect(applyHealingReceivedModifier(40, inhibited.effects)).toBe(20)
    const expired = consumeTargetActionDurations(inhibited, species)
    expect(applyHealingReceivedModifier(40, expired.state.effects)).toBe(40)
  })
})
