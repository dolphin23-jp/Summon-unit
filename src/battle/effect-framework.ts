import type { BattleTime } from './action-scheduling'
import type { BattleUnitId } from './unit-state'

export type EffectId = string
export type ActiveEffectId = string

export const EFFECT_DURATION_UNITS = [
  'TARGET_ACTIONS',
  'SOURCE_ACTIONS',
  'VIRTUAL_TIME',
  'TRIGGERS',
  'BATTLE',
] as const

export type EffectDurationUnit = (typeof EFFECT_DURATION_UNITS)[number]
export type CountedEffectDurationUnit = Exclude<EffectDurationUnit, 'BATTLE'>

export interface CountedEffectDuration {
  readonly unit: CountedEffectDurationUnit
  readonly remaining: number
}

export interface BattleEffectDuration {
  readonly unit: 'BATTLE'
  readonly remaining: null
}

export type EffectDuration = CountedEffectDuration | BattleEffectDuration
export type EffectDuplicateScope = 'TARGET' | 'SOURCE'

export interface ActiveEffectState {
  readonly activeEffectId: ActiveEffectId
  readonly effectId: EffectId
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly strength: number
  readonly stacks: number
  readonly stackLimit: number
  readonly duration: EffectDuration
  readonly duplicateScope: EffectDuplicateScope
  readonly appliedAt: BattleTime
  readonly applicationSequence: number
}

export interface RegisterActiveEffectInput {
  readonly activeEffectId?: ActiveEffectId
  readonly effectId: EffectId
  readonly sourceBattleUnitId?: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly strength: number
  readonly stacks?: number
  readonly stackLimit?: number
  readonly duration: EffectDuration
  readonly duplicateScope?: EffectDuplicateScope
  readonly appliedAt: BattleTime
  readonly applicationSequence: number
}

export type EffectRemovalReason =
  | 'EXPIRED'
  | 'DISPELLED'
  | 'REPLACED'
  | 'BATTLE_ENDED'
  | 'SCRIPT'

export interface ActiveEffectAppliedMutation {
  readonly kind: 'APPLIED'
  readonly before: null
  readonly after: ActiveEffectState
}

export interface ActiveEffectMergedMutation {
  readonly kind: 'MERGED'
  readonly before: ActiveEffectState
  readonly after: ActiveEffectState
}

export interface ActiveEffectRemovedMutation {
  readonly kind: 'REMOVED'
  readonly before: ActiveEffectState
  readonly after: null
  readonly reason: EffectRemovalReason
}

export type ActiveEffectMutation =
  | ActiveEffectAppliedMutation
  | ActiveEffectMergedMutation
  | ActiveEffectRemovedMutation

export interface ActiveEffectCollectionUpdate {
  readonly effects: readonly ActiveEffectState[]
  readonly mutation: ActiveEffectMutation | null
}

export const EFFECT_RESOLUTION_STAGES = [
  'DEFEAT_PREVENTION',
  'DAMAGE_HEALING_MODIFIERS',
  'BARRIERS_AND_REDIRECTION',
  'HP_APPLICATION',
  'DEFEAT_CHECK',
  'POST_HIT_HEAL_REACTIONS',
  'POSITION_CHANGE',
  'TIME_CHANGE',
  'STATUS_CHANGES',
  'LOG_AND_PRESENTATION',
] as const

export type EffectResolutionStage = (typeof EFFECT_RESOLUTION_STAGES)[number]

export interface EffectResolutionHook<TContext> {
  readonly id: string
  readonly stage: EffectResolutionStage
  readonly priority: number
  readonly apply: (context: TContext) => TContext
}

export interface EffectResolutionStageTrace {
  readonly stage: EffectResolutionStage
  readonly hookIds: readonly string[]
}

export interface EffectResolutionPipelineResult<TContext> {
  readonly context: TContext
  readonly trace: readonly EffectResolutionStageTrace[]
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

function assertValidStrength(value: number): void {
  assertSafeIntegerAtLeast(value, 0, 'effect.strength')
}

export function assertValidEffectDuration(duration: EffectDuration): void {
  if (!EFFECT_DURATION_UNITS.includes(duration.unit)) {
    throw new Error('effect.duration.unit is invalid')
  }

  if (duration.unit === 'BATTLE') {
    if (duration.remaining !== null) {
      throw new Error('battle duration must use null remaining')
    }
    return
  }

  assertSafeIntegerAtLeast(duration.remaining, 1, 'effect.duration.remaining')
}

function freezeEffectDuration(duration: EffectDuration): EffectDuration {
  assertValidEffectDuration(duration)
  return Object.freeze({ ...duration })
}

export function assertValidActiveEffectState(effect: ActiveEffectState): void {
  assertNonEmptyId(effect.activeEffectId, 'effect.activeEffectId')
  assertNonEmptyId(effect.effectId, 'effect.effectId')
  assertNonEmptyId(effect.targetBattleUnitId, 'effect.targetBattleUnitId')
  if (effect.sourceBattleUnitId !== null) {
    assertNonEmptyId(effect.sourceBattleUnitId, 'effect.sourceBattleUnitId')
  }

  assertValidStrength(effect.strength)
  assertSafeIntegerAtLeast(effect.stacks, 1, 'effect.stacks')
  assertSafeIntegerAtLeast(effect.stackLimit, 1, 'effect.stackLimit')
  if (effect.stacks > effect.stackLimit) {
    throw new Error('effect.stacks must not exceed effect.stackLimit')
  }

  assertValidEffectDuration(effect.duration)
  assertSafeIntegerAtLeast(effect.appliedAt, 0, 'effect.appliedAt')
  assertSafeIntegerAtLeast(effect.applicationSequence, 0, 'effect.applicationSequence')

  if (effect.duration.unit === 'SOURCE_ACTIONS') {
    if (effect.sourceBattleUnitId === null) {
      throw new Error('source action duration requires sourceBattleUnitId')
    }
    if (effect.duplicateScope !== 'SOURCE') {
      throw new Error('source action duration requires SOURCE duplicate scope')
    }
  }
}

function getDuplicateGroupKey(effect: ActiveEffectState): string {
  return `${effect.targetBattleUnitId}\u0000${effect.effectId}`
}

function getDuplicateKey(effect: ActiveEffectState): string {
  const groupKey = getDuplicateGroupKey(effect)
  return effect.duplicateScope === 'TARGET'
    ? `${groupKey}\u0000TARGET`
    : `${groupKey}\u0000SOURCE\u0000${effect.sourceBattleUnitId ?? ''}`
}

export function assertValidActiveEffectCollection(
  effects: readonly ActiveEffectState[],
  targetBattleUnitId?: BattleUnitId,
): void {
  const activeIds = new Set<string>()
  const duplicateKeys = new Set<string>()
  const scopeByGroup = new Map<string, EffectDuplicateScope>()

  for (const effect of effects) {
    assertValidActiveEffectState(effect)

    if (targetBattleUnitId !== undefined && effect.targetBattleUnitId !== targetBattleUnitId) {
      throw new Error('effect.targetBattleUnitId must match the owning battle unit')
    }
    if (activeIds.has(effect.activeEffectId)) {
      throw new Error(`activeEffectId must be unique: ${effect.activeEffectId}`)
    }
    activeIds.add(effect.activeEffectId)

    const groupKey = getDuplicateGroupKey(effect)
    const establishedScope = scopeByGroup.get(groupKey)
    if (establishedScope !== undefined && establishedScope !== effect.duplicateScope) {
      throw new Error('same-name effects must use one duplicate scope')
    }
    scopeByGroup.set(groupKey, effect.duplicateScope)

    const duplicateKey = getDuplicateKey(effect)
    if (duplicateKeys.has(duplicateKey)) {
      throw new Error(`same-name effect must be merged before storage: ${effect.effectId}`)
    }
    duplicateKeys.add(duplicateKey)
  }
}

export function freezeActiveEffectState(effect: ActiveEffectState): ActiveEffectState {
  assertValidActiveEffectState(effect)
  return Object.freeze({
    ...effect,
    duration: freezeEffectDuration(effect.duration),
  })
}

export function freezeActiveEffectCollection(
  effects: readonly ActiveEffectState[],
  targetBattleUnitId?: BattleUnitId,
): readonly ActiveEffectState[] {
  assertValidActiveEffectCollection(effects, targetBattleUnitId)
  return Object.freeze(effects.map(freezeActiveEffectState))
}

export function getActiveEffectId(
  effectId: EffectId,
  targetBattleUnitId: BattleUnitId,
  applicationSequence: number,
): ActiveEffectId {
  assertNonEmptyId(effectId, 'effectId')
  assertNonEmptyId(targetBattleUnitId, 'targetBattleUnitId')
  assertSafeIntegerAtLeast(applicationSequence, 0, 'applicationSequence')
  return `active-effect:${targetBattleUnitId}:${effectId}:${applicationSequence}`
}

function createActiveEffectState(input: RegisterActiveEffectInput): ActiveEffectState {
  const sourceBattleUnitId = input.sourceBattleUnitId ?? null
  const effect: ActiveEffectState = {
    activeEffectId:
      input.activeEffectId ??
      getActiveEffectId(input.effectId, input.targetBattleUnitId, input.applicationSequence),
    effectId: input.effectId,
    sourceBattleUnitId,
    targetBattleUnitId: input.targetBattleUnitId,
    strength: input.strength,
    stacks: input.stacks ?? 1,
    stackLimit: input.stackLimit ?? 1,
    duration: input.duration,
    duplicateScope: input.duplicateScope ?? 'TARGET',
    appliedAt: input.appliedAt,
    applicationSequence: input.applicationSequence,
  }
  return freezeActiveEffectState(effect)
}

function sameDuplicateSlot(left: ActiveEffectState, right: ActiveEffectState): boolean {
  return getDuplicateKey(left) === getDuplicateKey(right)
}

function getLongerDuration(
  current: EffectDuration,
  incoming: EffectDuration,
): EffectDuration {
  if (current.unit !== incoming.unit) {
    throw new Error('same-name effects must keep the same duration unit')
  }
  if (current.unit === 'BATTLE') {
    return current
  }
  if (incoming.unit === 'BATTLE') {
    throw new Error('same-name effects must keep the same duration unit')
  }
  return incoming.remaining > current.remaining ? incoming : current
}

function mergeSameNameEffect(
  current: ActiveEffectState,
  incoming: ActiveEffectState,
): ActiveEffectState {
  if (current.stackLimit !== incoming.stackLimit) {
    throw new Error('same-name effects must keep the same stack limit')
  }
  if (current.duplicateScope !== incoming.duplicateScope) {
    throw new Error('same-name effects must keep the same duplicate scope')
  }

  const incomingIsStronger = incoming.strength > current.strength
  const duration = getLongerDuration(current.duration, incoming.duration)
  const stacks = Math.min(current.stackLimit, current.stacks + incoming.stacks)

  return freezeActiveEffectState({
    ...current,
    sourceBattleUnitId: incomingIsStronger
      ? incoming.sourceBattleUnitId
      : current.sourceBattleUnitId,
    strength: Math.max(current.strength, incoming.strength),
    stacks,
    duration,
  })
}

export function registerActiveEffect(
  effects: readonly ActiveEffectState[],
  input: RegisterActiveEffectInput,
): ActiveEffectCollectionUpdate {
  assertValidActiveEffectCollection(effects)
  const incoming = createActiveEffectState(input)

  const sameNameEffects = effects.filter(
    (effect) =>
      effect.effectId === incoming.effectId &&
      effect.targetBattleUnitId === incoming.targetBattleUnitId,
  )
  if (sameNameEffects.some((effect) => effect.duplicateScope !== incoming.duplicateScope)) {
    throw new Error('same-name effects must keep the same duplicate scope')
  }

  const duplicateIndex = effects.findIndex((effect) => sameDuplicateSlot(effect, incoming))
  if (duplicateIndex === -1) {
    if (effects.some((effect) => effect.activeEffectId === incoming.activeEffectId)) {
      throw new Error(`activeEffectId must be unique: ${incoming.activeEffectId}`)
    }
    const nextEffects = freezeActiveEffectCollection([...effects, incoming])
    return Object.freeze({
      effects: nextEffects,
      mutation: Object.freeze({ kind: 'APPLIED', before: null, after: incoming }),
    })
  }

  const current = effects[duplicateIndex]
  const merged = mergeSameNameEffect(current, incoming)
  const nextEffects = freezeActiveEffectCollection(
    effects.map((effect, index) => (index === duplicateIndex ? merged : effect)),
  )
  return Object.freeze({
    effects: nextEffects,
    mutation: Object.freeze({ kind: 'MERGED', before: current, after: merged }),
  })
}

export function removeActiveEffect(
  effects: readonly ActiveEffectState[],
  activeEffectId: ActiveEffectId,
  reason: EffectRemovalReason = 'SCRIPT',
): ActiveEffectCollectionUpdate {
  assertValidActiveEffectCollection(effects)
  assertNonEmptyId(activeEffectId, 'activeEffectId')

  const removed = effects.find((effect) => effect.activeEffectId === activeEffectId)
  if (removed === undefined) {
    return Object.freeze({
      effects: freezeActiveEffectCollection(effects),
      mutation: null,
    })
  }

  const nextEffects = freezeActiveEffectCollection(
    effects.filter((effect) => effect.activeEffectId !== activeEffectId),
  )
  return Object.freeze({
    effects: nextEffects,
    mutation: Object.freeze({ kind: 'REMOVED', before: removed, after: null, reason }),
  })
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function getStageIndex(stage: EffectResolutionStage): number {
  return EFFECT_RESOLUTION_STAGES.indexOf(stage)
}

function assertValidEffectResolutionHooks<TContext>(
  hooks: readonly EffectResolutionHook<TContext>[],
): void {
  const ids = new Set<string>()
  for (const hook of hooks) {
    assertNonEmptyId(hook.id, 'hook.id')
    assertSafeIntegerAtLeast(hook.priority, 0, 'hook.priority')
    if (!EFFECT_RESOLUTION_STAGES.includes(hook.stage)) {
      throw new Error('hook.stage is invalid')
    }
    if (ids.has(hook.id)) {
      throw new Error(`effect resolution hook id must be unique: ${hook.id}`)
    }
    ids.add(hook.id)
  }
}

export function runEffectResolutionPipeline<TContext>(
  initialContext: TContext,
  hooks: readonly EffectResolutionHook<TContext>[],
): EffectResolutionPipelineResult<TContext> {
  assertValidEffectResolutionHooks(hooks)

  const orderedHooks = [...hooks].sort((left, right) => {
    const stageOrder = getStageIndex(left.stage) - getStageIndex(right.stage)
    if (stageOrder !== 0) {
      return stageOrder
    }
    if (left.priority !== right.priority) {
      return left.priority - right.priority
    }
    return compareIds(left.id, right.id)
  })

  let context = initialContext
  const trace: EffectResolutionStageTrace[] = []
  for (const stage of EFFECT_RESOLUTION_STAGES) {
    const stageHooks = orderedHooks.filter((hook) => hook.stage === stage)
    for (const hook of stageHooks) {
      context = hook.apply(context)
    }
    trace.push(
      Object.freeze({
        stage,
        hookIds: Object.freeze(stageHooks.map((hook) => hook.id)),
      }),
    )
  }

  return Object.freeze({
    context,
    trace: Object.freeze(trace),
  })
}
