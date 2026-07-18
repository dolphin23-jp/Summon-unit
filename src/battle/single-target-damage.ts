import {
  DAMAGE_MULTIPLIER_SCALE,
  assertValidSkillDefinition,
  type SkillDefinition,
} from '../content/skill-definition'
import {
  assertValidMonsterSpecies,
  type MonsterSpecies,
} from '../content/monster-species'
import {
  assertValidUnitActionSchedule,
  rescheduleUnitActionAfterAction,
  type BattleTime,
  type UnitActionSchedule,
} from './action-scheduling'
import {
  assertValidBattleUnitState,
  withBattleUnitHp,
  type BattleUnitState,
} from './unit-state'

export interface SingleTargetSkillUseInput {
  readonly actor: BattleUnitState
  readonly actorSpecies: MonsterSpecies
  readonly actorSchedule: UnitActionSchedule
  readonly target: BattleUnitState
  readonly targetSpecies: MonsterSpecies
  readonly skill: SkillDefinition
  readonly currentTime: BattleTime
}

export interface SingleTargetSkillUseResult {
  readonly target: BattleUnitState
  readonly actorSchedule: UnitActionSchedule
  readonly calculatedDamage: number
  readonly appliedDamage: number
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function assertValidUseInput(input: SingleTargetSkillUseInput): void {
  assertValidMonsterSpecies(input.actorSpecies)
  assertValidMonsterSpecies(input.targetSpecies)
  assertValidBattleUnitState(input.actor, input.actorSpecies)
  assertValidBattleUnitState(input.target, input.targetSpecies)
  assertValidUnitActionSchedule(input.actorSchedule)
  assertValidSkillDefinition(input.skill)
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')
}

export function calculateSingleTargetDamage(
  attack: number,
  defense: number,
  damageMultiplierPermille: number,
): number {
  assertSafeIntegerAtLeast(attack, 0, 'attack')
  assertSafeIntegerAtLeast(defense, 0, 'defense')
  assertSafeIntegerAtLeast(
    damageMultiplierPermille,
    1,
    'damageMultiplierPermille',
  )

  const numerator = BigInt(attack) * BigInt(damageMultiplierPermille) * 100n
  const denominator =
    BigInt(DAMAGE_MULTIPLIER_SCALE) * (100n + BigInt(defense))
  const roundedDamage = (numerator + denominator / 2n) / denominator
  const damage = roundedDamage < 1n ? 1n : roundedDamage

  if (damage > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('calculated damage must be a safe integer')
  }

  return Number(damage)
}

export function canUseSingleTargetInnateSkill(input: SingleTargetSkillUseInput): boolean {
  assertValidUseInput(input)

  return (
    !input.actor.defeated &&
    !input.target.defeated &&
    input.actor.side !== input.target.side &&
    input.actorSpecies.innateSkillId === input.skill.id &&
    input.actorSchedule.battleUnitId === input.actor.battleUnitId &&
    input.currentTime === input.actorSchedule.nextActionTime
  )
}

function assertCanUseSingleTargetInnateSkill(input: SingleTargetSkillUseInput): void {
  if (input.actor.defeated) {
    throw new Error('defeated actor cannot use a skill')
  }

  if (input.target.defeated) {
    throw new Error('defeated target cannot be selected')
  }

  if (input.actor.side === input.target.side) {
    throw new Error('single-target damage skill requires an enemy target')
  }

  if (input.actorSpecies.innateSkillId !== input.skill.id) {
    throw new Error('skill.id must match actorSpecies.innateSkillId')
  }

  if (input.actorSchedule.battleUnitId !== input.actor.battleUnitId) {
    throw new Error('actorSchedule.battleUnitId must match actor.battleUnitId')
  }

  if (input.currentTime !== input.actorSchedule.nextActionTime) {
    throw new Error('currentTime must match actorSchedule.nextActionTime')
  }
}

export function useSingleTargetInnateSkill(
  input: SingleTargetSkillUseInput,
): SingleTargetSkillUseResult {
  assertValidUseInput(input)
  assertCanUseSingleTargetInnateSkill(input)

  const calculatedDamage = calculateSingleTargetDamage(
    input.actorSpecies.stats.attack,
    input.targetSpecies.stats.defense,
    input.skill.damageMultiplierPermille,
  )
  const nextHp = Math.max(0, input.target.hp - calculatedDamage)
  const target = withBattleUnitHp(input.target, input.targetSpecies, nextHp)
  const actorSchedule = rescheduleUnitActionAfterAction(
    input.actorSchedule,
    input.currentTime,
    input.skill.actionCost,
    input.actorSpecies.stats.speed,
  )

  return Object.freeze({
    target,
    actorSchedule,
    calculatedDamage,
    appliedDamage: input.target.hp - target.hp,
  })
}
