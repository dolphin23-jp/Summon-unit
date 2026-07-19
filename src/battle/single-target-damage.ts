import {
  ATTRIBUTE_MULTIPLIER_SCALE,
  getAttributeMultiplierPermille,
} from '../content/attribute'
import {
  DAMAGE_MULTIPLIER_SCALE,
  assertValidSkillDefinition,
  resolveSkillAttributeId,
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
import { getModifiedBattleStatValue } from './stat-modifiers'
import {
  assertValidBattleUnitState,
  withBattleUnitHp,
  type BattleUnitState,
} from './unit-state'

export interface SingleTargetDamagePreviewInput {
  readonly actor: BattleUnitState
  readonly actorSpecies: MonsterSpecies
  readonly target: BattleUnitState
  readonly targetSpecies: MonsterSpecies
  readonly skill: SkillDefinition
}

export interface SingleTargetDamagePreview {
  readonly calculatedDamage: number
  readonly effectiveAttack: number
  readonly effectiveDefense: number
  readonly attributeMultiplierPermille: number
}

export interface SingleTargetSkillUseInput extends SingleTargetDamagePreviewInput {
  readonly actorSchedule: UnitActionSchedule
  readonly currentTime: BattleTime
}

export interface SingleTargetSkillUseResult extends SingleTargetDamagePreview {
  readonly target: BattleUnitState
  readonly actorSchedule: UnitActionSchedule
  readonly appliedDamage: number
  readonly effectiveActionCost: number
  readonly effectiveSpeed: number
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function assertValidPreviewInput(input: SingleTargetDamagePreviewInput): void {
  assertValidMonsterSpecies(input.actorSpecies)
  assertValidMonsterSpecies(input.targetSpecies)
  assertValidBattleUnitState(input.actor, input.actorSpecies)
  assertValidBattleUnitState(input.target, input.targetSpecies)
  assertValidSkillDefinition(input.skill)
}

function assertValidUseInput(input: SingleTargetSkillUseInput): void {
  assertValidPreviewInput(input)
  assertValidUnitActionSchedule(input.actorSchedule)
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')
}

export function calculateSingleTargetDamage(
  attack: number,
  defense: number,
  damageMultiplierPermille: number,
  attributeMultiplierPermille: number = ATTRIBUTE_MULTIPLIER_SCALE,
): number {
  assertSafeIntegerAtLeast(attack, 0, 'attack')
  assertSafeIntegerAtLeast(defense, 0, 'defense')
  assertSafeIntegerAtLeast(
    damageMultiplierPermille,
    1,
    'damageMultiplierPermille',
  )
  assertSafeIntegerAtLeast(
    attributeMultiplierPermille,
    1,
    'attributeMultiplierPermille',
  )

  const numerator =
    BigInt(attack) *
    BigInt(damageMultiplierPermille) *
    BigInt(attributeMultiplierPermille) *
    100n
  const denominator =
    BigInt(DAMAGE_MULTIPLIER_SCALE) *
    BigInt(ATTRIBUTE_MULTIPLIER_SCALE) *
    (100n + BigInt(defense))
  const roundedDamage = (numerator + denominator / 2n) / denominator
  const damage = roundedDamage < 1n ? 1n : roundedDamage

  if (damage > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('calculated damage must be a safe integer')
  }

  return Number(damage)
}

export function previewSingleTargetSkillDamage(
  input: SingleTargetDamagePreviewInput,
): SingleTargetDamagePreview {
  assertValidPreviewInput(input)

  const effectiveAttack = getModifiedBattleStatValue(
    input.actorSpecies.stats.attack,
    input.actor.effects,
    'ATTACK',
  )
  const effectiveDefense = getModifiedBattleStatValue(
    input.targetSpecies.stats.defense,
    input.target.effects,
    'DEFENSE',
  )
  const skillAttributeId = resolveSkillAttributeId(input.skill)
  const attributeMultiplierPermille = getAttributeMultiplierPermille(
    skillAttributeId,
    input.targetSpecies.attributeId,
  )
  const calculatedDamage = calculateSingleTargetDamage(
    effectiveAttack,
    effectiveDefense,
    input.skill.damageMultiplierPermille,
    attributeMultiplierPermille,
  )

  return Object.freeze({
    calculatedDamage,
    effectiveAttack,
    effectiveDefense,
    attributeMultiplierPermille,
  })
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

  const preview = previewSingleTargetSkillDamage(input)
  const nextHp = Math.max(0, input.target.hp - preview.calculatedDamage)
  const target = withBattleUnitHp(input.target, input.targetSpecies, nextHp)
  const effectiveActionCost = getModifiedBattleStatValue(
    input.skill.actionCost,
    input.actor.effects,
    'ACTION_COST',
  )
  const effectiveSpeed = getModifiedBattleStatValue(
    input.actorSpecies.stats.speed,
    input.actor.effects,
    'SPEED',
  )
  const actorSchedule = rescheduleUnitActionAfterAction(
    input.actorSchedule,
    input.currentTime,
    effectiveActionCost,
    effectiveSpeed,
  )

  return Object.freeze({
    ...preview,
    target,
    actorSchedule,
    appliedDamage: input.target.hp - target.hp,
    effectiveActionCost,
    effectiveSpeed,
  })
}
