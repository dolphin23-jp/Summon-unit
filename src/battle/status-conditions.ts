import {
  getAttributeMultiplierPermille,
  type AttributeId,
} from '../content/attribute'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  applyStatusResistanceMagnitude,
  resolveStatusResistanceStage,
  type StatusResistanceStage,
} from '../content/status-resistance'
import type { BattleTime } from './action-scheduling'
import {
  freezeActiveEffectCollection,
  freezeActiveEffectState,
  type ActiveEffectMutation,
  type ActiveEffectState,
  type EffectDurationUnit,
} from './effect-framework'
import { applyPermilleMultiplier } from './stat-modifiers'
import {
  assertValidBattleUnitState,
  withBattleUnitHp,
  withRegisteredBattleUnitEffect,
  withoutBattleUnitEffect,
  type BattleUnitId,
  type BattleUnitState,
} from './unit-state'

export const STATUS_CONDITION_IDS = [
  'poison',
  'burn',
  'movement-lock',
  'bloom-seal',
  'healing-inhibition',
] as const

export type StatusConditionId = (typeof STATUS_CONDITION_IDS)[number]
type TurnStartStatusId = Extract<StatusConditionId, 'poison' | 'burn'>
type BinaryTargetActionStatusId = Extract<
  StatusConditionId,
  'movement-lock' | 'bloom-seal'
>

export const STATUS_EFFECT_IDS = Object.freeze({
  POISON: 'effect.status.poison',
  BURN: 'effect.status.burn',
  'MOVEMENT-LOCK': 'effect.status.movement-lock',
  'BLOOM-SEAL': 'effect.status.bloom-seal',
  'HEALING-INHIBITION': 'effect.status.healing-inhibition',
} as const)

export const POISON_DEFAULT_TRIGGER_COUNT = 3
export const POISON_MAX_STACKS = 5
export const BURN_DEFAULT_TRIGGER_COUNT = 3
export const BURN_DEFAULT_ATTACK_REDUCTION_PERMILLE = 100

const STATUS_EFFECT_ID_BY_CONDITION: Readonly<Record<StatusConditionId, string>> = Object.freeze({
  poison: STATUS_EFFECT_IDS.POISON,
  burn: STATUS_EFFECT_IDS.BURN,
  'movement-lock': STATUS_EFFECT_IDS['MOVEMENT-LOCK'],
  'bloom-seal': STATUS_EFFECT_IDS['BLOOM-SEAL'],
  'healing-inhibition': STATUS_EFFECT_IDS['HEALING-INHIBITION'],
})

const TURN_START_STATUS_ORDER: readonly TurnStartStatusId[] = Object.freeze([
  'poison',
  'burn',
])

interface StatusApplicationBaseInput {
  readonly target: BattleUnitState
  readonly targetSpecies: MonsterSpecies
  readonly sourceBattleUnitId?: BattleUnitId | null
  readonly currentTime: BattleTime
  readonly applicationSequence: number
}

export interface ApplyPoisonStatusInput extends StatusApplicationBaseInput {
  readonly damagePerStack: number
  readonly stacks?: number
  readonly triggerCount?: number
}

export interface ApplyBurnStatusInput extends StatusApplicationBaseInput {
  readonly damagePerTrigger: number
  readonly triggerCount?: number
  readonly attackReductionPermille?: number
}

export interface ApplyMovementLockStatusInput extends StatusApplicationBaseInput {
  readonly targetActionCount: number
}

export interface ApplyBloomSealStatusInput extends StatusApplicationBaseInput {
  readonly targetActionCount: number
}

export interface ApplyHealingInhibitionStatusInput extends StatusApplicationBaseInput {
  readonly reductionPermille: number
  readonly targetActionCount: number
}

export interface StatusApplicationResult {
  readonly state: BattleUnitState
  readonly resistanceStage: StatusResistanceStage
  readonly applied: boolean
  readonly mutations: readonly ActiveEffectMutation[]
}

export type EffectDurationProgressReason =
  | 'TRIGGER_CONSUMED'
  | 'TARGET_ACTION_COMPLETED'

export interface EffectDurationChange {
  readonly before: ActiveEffectState
  readonly after: ActiveEffectState
  readonly reason: EffectDurationProgressReason
}

export interface StatusDamageTrigger {
  readonly statusId: TurnStartStatusId
  readonly activeEffectId: string
  readonly effectId: string
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly damageAttributeId: AttributeId
  readonly defenseIgnored: true
  readonly stacks: number
  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly hpBefore: number
  readonly hpAfter: number
  readonly durationRemainingBefore: number
  readonly durationRemainingAfter: number
  readonly durationChange: EffectDurationChange | null
  readonly removalMutation: ActiveEffectMutation | null
}

export interface TurnStartStatusResolution {
  readonly state: BattleUnitState
  readonly triggers: readonly StatusDamageTrigger[]
}

export interface TargetActionDurationResolution {
  readonly state: BattleUnitState
  readonly changes: readonly EffectDurationChange[]
  readonly removals: readonly ActiveEffectMutation[]
}

interface DurationConsumptionResult {
  readonly state: BattleUnitState
  readonly change: EffectDurationChange | null
  readonly removal: ActiveEffectMutation | null
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function assertApplicationBase(input: StatusApplicationBaseInput): void {
  assertValidBattleUnitState(input.target, input.targetSpecies)
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')
  assertSafeIntegerAtLeast(input.applicationSequence, 0, 'applicationSequence')
  if (input.sourceBattleUnitId !== undefined && input.sourceBattleUnitId !== null) {
    if (input.sourceBattleUnitId.trim().length === 0) {
      throw new Error('sourceBattleUnitId must be a non-empty string')
    }
  }
  if (input.target.defeated) {
    throw new Error('cannot apply a status condition to a defeated unit')
  }
}

function getResistanceStage(
  targetSpecies: MonsterSpecies,
  statusId: StatusConditionId,
): StatusResistanceStage {
  return resolveStatusResistanceStage(targetSpecies.tagIds, statusId)
}

function createNoApplicationResult(
  state: BattleUnitState,
  resistanceStage: StatusResistanceStage,
): StatusApplicationResult {
  return Object.freeze({
    state,
    resistanceStage,
    applied: false,
    mutations: Object.freeze([]),
  })
}

function appendMutation(
  mutations: ActiveEffectMutation[],
  mutation: ActiveEffectMutation | null,
): void {
  if (mutation !== null) {
    mutations.push(mutation)
  }
}

function createApplicationResult(
  state: BattleUnitState,
  resistanceStage: StatusResistanceStage,
  mutations: readonly ActiveEffectMutation[],
): StatusApplicationResult {
  return Object.freeze({
    state,
    resistanceStage,
    applied: mutations.length > 0,
    mutations: Object.freeze([...mutations]),
  })
}

export function applyPoisonStatus(input: ApplyPoisonStatusInput): StatusApplicationResult {
  assertApplicationBase(input)
  assertSafeIntegerAtLeast(input.damagePerStack, 1, 'damagePerStack')
  const stacks = input.stacks ?? 1
  const triggerCount = input.triggerCount ?? POISON_DEFAULT_TRIGGER_COUNT
  assertSafeIntegerAtLeast(stacks, 1, 'stacks')
  assertSafeIntegerAtLeast(triggerCount, 1, 'triggerCount')
  if (stacks > POISON_MAX_STACKS) {
    throw new Error(`poison stacks must not exceed ${POISON_MAX_STACKS}`)
  }

  const resistanceStage = getResistanceStage(input.targetSpecies, 'poison')
  const strength = applyStatusResistanceMagnitude(input.damagePerStack, resistanceStage)
  if (strength === 0) {
    return createNoApplicationResult(input.target, resistanceStage)
  }

  const update = withRegisteredBattleUnitEffect(input.target, input.targetSpecies, {
    effectId: STATUS_EFFECT_IDS.POISON,
    sourceBattleUnitId: input.sourceBattleUnitId ?? null,
    targetBattleUnitId: input.target.battleUnitId,
    strength,
    stacks,
    stackLimit: POISON_MAX_STACKS,
    duration: { unit: 'TRIGGERS', remaining: triggerCount },
    duplicateScope: 'TARGET',
    appliedAt: input.currentTime,
    applicationSequence: input.applicationSequence,
  })

  return createApplicationResult(
    update.state,
    resistanceStage,
    update.mutation === null ? [] : [update.mutation],
  )
}

export function applyBurnStatus(input: ApplyBurnStatusInput): StatusApplicationResult {
  assertApplicationBase(input)
  assertSafeIntegerAtLeast(input.damagePerTrigger, 1, 'damagePerTrigger')
  const triggerCount = input.triggerCount ?? BURN_DEFAULT_TRIGGER_COUNT
  const attackReductionPermille =
    input.attackReductionPermille ?? BURN_DEFAULT_ATTACK_REDUCTION_PERMILLE
  assertSafeIntegerAtLeast(triggerCount, 1, 'triggerCount')
  assertSafeIntegerAtLeast(attackReductionPermille, 1, 'attackReductionPermille')
  if (input.applicationSequence === Number.MAX_SAFE_INTEGER) {
    throw new Error('burn applicationSequence must leave room for its secondary effect')
  }

  const resistanceStage = getResistanceStage(input.targetSpecies, 'burn')
  const damageStrength = applyStatusResistanceMagnitude(
    input.damagePerTrigger,
    resistanceStage,
  )
  const attackReduction = applyStatusResistanceMagnitude(
    attackReductionPermille,
    resistanceStage,
  )
  if (damageStrength === 0 || attackReduction === 0) {
    return createNoApplicationResult(input.target, resistanceStage)
  }

  const mutations: ActiveEffectMutation[] = []
  const burnUpdate = withRegisteredBattleUnitEffect(input.target, input.targetSpecies, {
    effectId: STATUS_EFFECT_IDS.BURN,
    sourceBattleUnitId: input.sourceBattleUnitId ?? null,
    targetBattleUnitId: input.target.battleUnitId,
    strength: damageStrength,
    stackLimit: 1,
    duration: { unit: 'TRIGGERS', remaining: triggerCount },
    duplicateScope: 'TARGET',
    appliedAt: input.currentTime,
    applicationSequence: input.applicationSequence,
  })
  appendMutation(mutations, burnUpdate.mutation)

  const attackDownUpdate = withRegisteredBattleUnitEffect(
    burnUpdate.state,
    input.targetSpecies,
    {
      effectId: 'effect.debuff.attack',
      sourceBattleUnitId: input.sourceBattleUnitId ?? null,
      targetBattleUnitId: input.target.battleUnitId,
      strength: attackReduction,
      stackLimit: 1,
      duration: { unit: 'TARGET_ACTIONS', remaining: triggerCount },
      duplicateScope: 'TARGET',
      appliedAt: input.currentTime,
      applicationSequence: input.applicationSequence + 1,
    },
  )
  appendMutation(mutations, attackDownUpdate.mutation)

  return createApplicationResult(attackDownUpdate.state, resistanceStage, mutations)
}

function applyBinaryTargetActionStatus(
  input: StatusApplicationBaseInput & { readonly targetActionCount: number },
  statusId: BinaryTargetActionStatusId,
): StatusApplicationResult {
  assertApplicationBase(input)
  assertSafeIntegerAtLeast(input.targetActionCount, 1, 'targetActionCount')
  const resistanceStage = getResistanceStage(input.targetSpecies, statusId)
  const adjustedDuration = applyStatusResistanceMagnitude(
    input.targetActionCount,
    resistanceStage,
  )
  if (adjustedDuration === 0) {
    return createNoApplicationResult(input.target, resistanceStage)
  }

  const update = withRegisteredBattleUnitEffect(input.target, input.targetSpecies, {
    effectId: STATUS_EFFECT_ID_BY_CONDITION[statusId],
    sourceBattleUnitId: input.sourceBattleUnitId ?? null,
    targetBattleUnitId: input.target.battleUnitId,
    strength: 1,
    stackLimit: 1,
    duration: { unit: 'TARGET_ACTIONS', remaining: adjustedDuration },
    duplicateScope: 'TARGET',
    appliedAt: input.currentTime,
    applicationSequence: input.applicationSequence,
  })
  return createApplicationResult(
    update.state,
    resistanceStage,
    update.mutation === null ? [] : [update.mutation],
  )
}

export function applyMovementLockStatus(
  input: ApplyMovementLockStatusInput,
): StatusApplicationResult {
  return applyBinaryTargetActionStatus(input, 'movement-lock')
}

export function applyBloomSealStatus(
  input: ApplyBloomSealStatusInput,
): StatusApplicationResult {
  return applyBinaryTargetActionStatus(input, 'bloom-seal')
}

export function applyHealingInhibitionStatus(
  input: ApplyHealingInhibitionStatusInput,
): StatusApplicationResult {
  assertApplicationBase(input)
  assertSafeIntegerAtLeast(input.reductionPermille, 1, 'reductionPermille')
  assertSafeIntegerAtLeast(input.targetActionCount, 1, 'targetActionCount')

  const resistanceStage = getResistanceStage(input.targetSpecies, 'healing-inhibition')
  const reduction = applyStatusResistanceMagnitude(
    input.reductionPermille,
    resistanceStage,
  )
  if (reduction === 0) {
    return createNoApplicationResult(input.target, resistanceStage)
  }

  const update = withRegisteredBattleUnitEffect(input.target, input.targetSpecies, {
    effectId: STATUS_EFFECT_IDS['HEALING-INHIBITION'],
    sourceBattleUnitId: input.sourceBattleUnitId ?? null,
    targetBattleUnitId: input.target.battleUnitId,
    strength: reduction,
    stackLimit: 1,
    duration: { unit: 'TARGET_ACTIONS', remaining: input.targetActionCount },
    duplicateScope: 'TARGET',
    appliedAt: input.currentTime,
    applicationSequence: input.applicationSequence,
  })
  return createApplicationResult(
    update.state,
    resistanceStage,
    update.mutation === null ? [] : [update.mutation],
  )
}

function hasEffectId(state: BattleUnitState, effectId: string): boolean {
  return state.effects.some((effect) => effect.effectId === effectId)
}

export function isMovementLocked(state: BattleUnitState): boolean {
  return hasEffectId(state, STATUS_EFFECT_IDS['MOVEMENT-LOCK'])
}

export function isBloomSkillSealed(state: BattleUnitState): boolean {
  return hasEffectId(state, STATUS_EFFECT_IDS['BLOOM-SEAL'])
}

export function canUseSkillByStatus(
  state: BattleUnitState,
  skill: SkillDefinition,
): boolean {
  return skill.slotType !== 'BLOOM' || !isBloomSkillSealed(state)
}

function replaceEffects(
  state: BattleUnitState,
  species: MonsterSpecies,
  effects: readonly ActiveEffectState[],
): BattleUnitState {
  const nextState = Object.freeze({
    ...state,
    effects: freezeActiveEffectCollection(effects, state.battleUnitId),
  })
  assertValidBattleUnitState(nextState, species)
  return nextState
}

function consumeEffectDuration(
  state: BattleUnitState,
  species: MonsterSpecies,
  activeEffectId: string,
  expectedUnit: Exclude<EffectDurationUnit, 'BATTLE'>,
  reason: EffectDurationProgressReason,
): DurationConsumptionResult {
  const effect = state.effects.find(
    (candidate) => candidate.activeEffectId === activeEffectId,
  )
  if (effect === undefined) {
    return Object.freeze({ state, change: null, removal: null })
  }
  if (effect.duration.unit !== expectedUnit) {
    throw new Error(`${effect.effectId} must use ${expectedUnit} duration`)
  }

  if (effect.duration.remaining === 1) {
    const removed = withoutBattleUnitEffect(
      state,
      species,
      effect.activeEffectId,
      'EXPIRED',
    )
    return Object.freeze({
      state: removed.state,
      change: null,
      removal: removed.mutation,
    })
  }

  const after = freezeActiveEffectState({
    ...effect,
    duration: {
      unit: expectedUnit,
      remaining: effect.duration.remaining - 1,
    },
  })
  const nextState = replaceEffects(
    state,
    species,
    state.effects.map((candidate) =>
      candidate.activeEffectId === activeEffectId ? after : candidate,
    ),
  )
  return Object.freeze({
    state: nextState,
    change: Object.freeze({ before: effect, after, reason }),
    removal: null,
  })
}

function multiplySafeIntegers(left: number, right: number, field: string): number {
  assertSafeIntegerAtLeast(left, 0, `${field}.left`)
  assertSafeIntegerAtLeast(right, 0, `${field}.right`)
  const result = BigInt(left) * BigInt(right)
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${field} must be a safe integer`)
  }
  return Number(result)
}

function getTurnStartDamage(
  statusId: TurnStartStatusId,
  effect: ActiveEffectState,
  targetSpecies: MonsterSpecies,
): { readonly attributeId: AttributeId; readonly damage: number } {
  if (statusId === 'poison') {
    return Object.freeze({
      attributeId: 'attribute.neutral',
      damage: multiplySafeIntegers(effect.strength, effect.stacks, 'poisonDamage'),
    })
  }

  const fireMultiplier = getAttributeMultiplierPermille(
    'attribute.fire',
    targetSpecies.attributeId,
  )
  return Object.freeze({
    attributeId: 'attribute.fire',
    damage: Math.max(
      1,
      applyPermilleMultiplier(effect.strength, fireMultiplier, 'burnDamage'),
    ),
  })
}

function getRemainingAfterTrigger(progress: DurationConsumptionResult): number {
  if (progress.change === null) {
    return 0
  }
  if (progress.change.after.duration.unit !== 'TRIGGERS') {
    throw new Error('turn-start status must keep TRIGGERS duration')
  }
  return progress.change.after.duration.remaining
}

export function resolveTurnStartStatusConditions(
  state: BattleUnitState,
  species: MonsterSpecies,
): TurnStartStatusResolution {
  assertValidBattleUnitState(state, species)
  if (state.defeated) {
    return Object.freeze({ state, triggers: Object.freeze([]) })
  }

  let nextState = state
  const triggers: StatusDamageTrigger[] = []
  for (const statusId of TURN_START_STATUS_ORDER) {
    if (nextState.defeated) {
      break
    }
    const effectId = STATUS_EFFECT_ID_BY_CONDITION[statusId]
    const effect = nextState.effects.find(
      (candidate) => candidate.effectId === effectId,
    )
    if (effect === undefined) {
      continue
    }
    if (effect.duration.unit !== 'TRIGGERS') {
      throw new Error(`${effect.effectId} must use TRIGGERS duration`)
    }

    const damage = getTurnStartDamage(statusId, effect, species)
    const hpBefore = nextState.hp
    const appliedDamage = Math.min(damage.damage, hpBefore)
    nextState = withBattleUnitHp(
      nextState,
      species,
      hpBefore - appliedDamage,
    )
    const progress = consumeEffectDuration(
      nextState,
      species,
      effect.activeEffectId,
      'TRIGGERS',
      'TRIGGER_CONSUMED',
    )
    nextState = progress.state

    triggers.push(
      Object.freeze({
        statusId,
        activeEffectId: effect.activeEffectId,
        effectId: effect.effectId,
        sourceBattleUnitId: effect.sourceBattleUnitId,
        targetBattleUnitId: state.battleUnitId,
        damageAttributeId: damage.attributeId,
        defenseIgnored: true,
        stacks: effect.stacks,
        calculatedDamage: damage.damage,
        appliedDamage,
        hpBefore,
        hpAfter: nextState.hp,
        durationRemainingBefore: effect.duration.remaining,
        durationRemainingAfter: getRemainingAfterTrigger(progress),
        durationChange: progress.change,
        removalMutation: progress.removal,
      }),
    )
  }

  return Object.freeze({
    state: nextState,
    triggers: Object.freeze(triggers),
  })
}

export function consumeTargetActionDurations(
  state: BattleUnitState,
  species: MonsterSpecies,
): TargetActionDurationResolution {
  assertValidBattleUnitState(state, species)
  if (state.defeated) {
    return Object.freeze({
      state,
      changes: Object.freeze([]),
      removals: Object.freeze([]),
    })
  }

  const activeEffectIds = state.effects
    .filter((effect) => effect.duration.unit === 'TARGET_ACTIONS')
    .map((effect) => effect.activeEffectId)
    .sort()
  let nextState = state
  const changes: EffectDurationChange[] = []
  const removals: ActiveEffectMutation[] = []
  for (const activeEffectId of activeEffectIds) {
    const progress = consumeEffectDuration(
      nextState,
      species,
      activeEffectId,
      'TARGET_ACTIONS',
      'TARGET_ACTION_COMPLETED',
    )
    nextState = progress.state
    if (progress.change !== null) {
      changes.push(progress.change)
    }
    if (progress.removal !== null) {
      removals.push(progress.removal)
    }
  }

  return Object.freeze({
    state: nextState,
    changes: Object.freeze(changes),
    removals: Object.freeze(removals),
  })
}
