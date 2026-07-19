import {
  assertValidSkillDefinition,
  type SkillDefinition,
  type SkillId,
  type SkillUsageCondition,
} from '../content/skill-definition'
import type { MonsterSpecies } from '../content/monster-species'
import { canUseSkillByStatus } from './status-conditions'
import {
  assertValidBattleUnitState,
  type BattleUnitState,
} from './unit-state'

export interface SkillUsageState {
  readonly skillId: SkillId
  readonly cooldownRemaining: number
  readonly usesRemaining: number | null
}

export type SkillUsageBook = readonly SkillUsageState[]

export interface SkillUsabilityInput {
  readonly usageBook: SkillUsageBook
  readonly skill: SkillDefinition
  readonly actor: BattleUnitState
  readonly actorSpecies: MonsterSpecies
  readonly target?: BattleUnitState
  readonly targetSpecies?: MonsterSpecies
}

function assertNonEmptyId(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function freezeUsageState(state: SkillUsageState): SkillUsageState {
  assertValidSkillUsageState(state)
  return Object.freeze({ ...state })
}

export function assertValidSkillUsageState(state: SkillUsageState): void {
  assertNonEmptyId(state.skillId, 'skillUsage.skillId')
  assertSafeIntegerAtLeast(
    state.cooldownRemaining,
    0,
    'skillUsage.cooldownRemaining',
  )
  if (state.usesRemaining !== null) {
    assertSafeIntegerAtLeast(state.usesRemaining, 0, 'skillUsage.usesRemaining')
  }
}

export function assertValidSkillUsageBook(book: SkillUsageBook): void {
  const seen = new Set<string>()
  for (const state of book) {
    assertValidSkillUsageState(state)
    if (seen.has(state.skillId)) {
      throw new Error(`skill usage state must be unique: ${state.skillId}`)
    }
    seen.add(state.skillId)
  }
}

export function createSkillUsageBook(
  skills: readonly SkillDefinition[],
): SkillUsageBook {
  const seen = new Set<string>()
  const states = skills.map((skill) => {
    assertValidSkillDefinition(skill)
    if (seen.has(skill.id)) {
      throw new Error(`skill ids must be unique: ${skill.id}`)
    }
    seen.add(skill.id)
    return freezeUsageState({
      skillId: skill.id,
      cooldownRemaining: 0,
      usesRemaining: skill.usageLimit ?? null,
    })
  })
  states.sort((left, right) => compareIds(left.skillId, right.skillId))
  return Object.freeze(states)
}

export function getSkillUsageState(
  book: SkillUsageBook,
  skillId: SkillId,
): SkillUsageState {
  assertValidSkillUsageBook(book)
  assertNonEmptyId(skillId, 'skillId')
  const state = book.find((candidate) => candidate.skillId === skillId)
  if (state === undefined) {
    throw new Error(`skill usage state is missing: ${skillId}`)
  }
  return state
}

function conditionMatches(
  condition: SkillUsageCondition,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  target?: BattleUnitState,
  targetSpecies?: MonsterSpecies,
): boolean {
  const threshold = BigInt(condition.thresholdPermille)
  const actorHpScaled = BigInt(actor.hp) * 1000n
  switch (condition.type) {
    case 'ACTOR_HP_AT_OR_BELOW':
      return actorHpScaled <= BigInt(actorSpecies.stats.hp) * threshold
    case 'ACTOR_HP_AT_OR_ABOVE':
      return actorHpScaled >= BigInt(actorSpecies.stats.hp) * threshold
    case 'TARGET_HP_AT_OR_BELOW':
      return (
        target !== undefined &&
        targetSpecies !== undefined &&
        BigInt(target.hp) * 1000n <= BigInt(targetSpecies.stats.hp) * threshold
      )
    case 'TARGET_HP_AT_OR_ABOVE':
      return (
        target !== undefined &&
        targetSpecies !== undefined &&
        BigInt(target.hp) * 1000n >= BigInt(targetSpecies.stats.hp) * threshold
      )
  }
}

export function canUseSkillWithUsageState(input: SkillUsabilityInput): boolean {
  assertValidSkillDefinition(input.skill)
  assertValidSkillUsageBook(input.usageBook)
  assertValidBattleUnitState(input.actor, input.actorSpecies)
  if (input.target !== undefined || input.targetSpecies !== undefined) {
    if (input.target === undefined || input.targetSpecies === undefined) {
      throw new Error('target and targetSpecies must be supplied together')
    }
    assertValidBattleUnitState(input.target, input.targetSpecies)
  }

  if (input.actor.defeated || !canUseSkillByStatus(input.actor, input.skill)) {
    return false
  }
  const state = getSkillUsageState(input.usageBook, input.skill.id)
  if (state.cooldownRemaining > 0 || state.usesRemaining === 0) {
    return false
  }

  return (input.skill.usageConditions ?? []).every((condition) =>
    conditionMatches(
      condition,
      input.actor,
      input.actorSpecies,
      input.target,
      input.targetSpecies,
    ),
  )
}

export function assertCanUseSkillWithUsageState(input: SkillUsabilityInput): void {
  if (!canUseSkillWithUsageState(input)) {
    throw new Error(`skill is not currently usable: ${input.skill.id}`)
  }
}

export function completeActorActionSkillUsage(
  book: SkillUsageBook,
  skills: readonly SkillDefinition[],
  usedSkillId: SkillId | null,
): SkillUsageBook {
  assertValidSkillUsageBook(book)
  const skillById = new Map<string, SkillDefinition>()
  for (const skill of skills) {
    assertValidSkillDefinition(skill)
    if (skillById.has(skill.id)) {
      throw new Error(`skill ids must be unique: ${skill.id}`)
    }
    skillById.set(skill.id, skill)
  }
  if (usedSkillId !== null && !skillById.has(usedSkillId)) {
    throw new Error(`used skill is missing from definitions: ${usedSkillId}`)
  }

  const next = book.map((state) => {
    const skill = skillById.get(state.skillId)
    if (skill === undefined) {
      throw new Error(`skill definition is missing: ${state.skillId}`)
    }

    if (state.skillId === usedSkillId) {
      if (state.usesRemaining === 0) {
        throw new Error(`skill usage limit is exhausted: ${state.skillId}`)
      }
      return freezeUsageState({
        skillId: state.skillId,
        cooldownRemaining: skill.cooldownActions ?? 0,
        usesRemaining:
          state.usesRemaining === null ? null : state.usesRemaining - 1,
      })
    }

    return freezeUsageState({
      ...state,
      cooldownRemaining: Math.max(0, state.cooldownRemaining - 1),
    })
  })
  next.sort((left, right) => compareIds(left.skillId, right.skillId))
  return Object.freeze(next)
}
