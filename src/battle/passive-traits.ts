import {
  runEffectResolutionPipeline,
  type EffectResolutionHook,
  type EffectResolutionPipelineResult,
  type RegisterActiveEffectInput,
} from './effect-framework'
import type { BattleTime } from './action-scheduling'
import type { BattleUnitId } from './unit-state'

export const PASSIVE_TRAIT_ABILITY_KINDS = [
  'CONSTANT_STAT_MODIFIER',
  'ON_HIT_REACTION',
  'STATUS_PARAMETER_OVERRIDE',
] as const

export type PassiveTraitAbilityKind = (typeof PASSIVE_TRAIT_ABILITY_KINDS)[number]

export interface ConstantStatModifierTraitAbility {
  readonly kind: 'CONSTANT_STAT_MODIFIER'
  readonly effectId: string
  readonly strength: number
}

export interface OnHitReactionTraitAbility {
  readonly kind: 'ON_HIT_REACTION'
  readonly effectId: string
  readonly strength: number
  readonly targetActionDuration: number
}

export interface StatusParameterOverrideTraitAbility {
  readonly kind: 'STATUS_PARAMETER_OVERRIDE'
  readonly statusId: string
  readonly strengthMultiplierPermille: number
  readonly durationDelta: number
}

export type PassiveTraitAbility =
  | ConstantStatModifierTraitAbility
  | OnHitReactionTraitAbility
  | StatusParameterOverrideTraitAbility

export interface PassiveTraitDefinition {
  readonly id: string
  readonly abilities: readonly PassiveTraitAbility[]
}

export type PassiveTraitPipelinePhase = 'INITIALIZE' | 'ON_HIT' | 'STATUS_APPLICATION'

export interface PassiveTraitPipelineContext {
  readonly phase: PassiveTraitPipelinePhase
  readonly ownerBattleUnitId: BattleUnitId
  readonly currentTime: BattleTime
  readonly nextApplicationSequence: number
  readonly pendingEffects: readonly RegisterActiveEffectInput[]
  readonly statusId: string | null
  readonly statusStrength: number | null
  readonly statusDuration: number | null
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

function assertSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer`)
  }
}

export function assertValidPassiveTraitDefinition(trait: PassiveTraitDefinition): void {
  assertNonEmptyId(trait.id, 'trait.id')
  const abilityKeys = new Set<string>()
  for (const [index, ability] of trait.abilities.entries()) {
    if (!PASSIVE_TRAIT_ABILITY_KINDS.includes(ability.kind)) {
      throw new Error(`trait.abilities[${index}].kind is invalid`)
    }
    let key: string
    switch (ability.kind) {
      case 'CONSTANT_STAT_MODIFIER':
        assertNonEmptyId(ability.effectId, `trait.abilities[${index}].effectId`)
        assertSafeIntegerAtLeast(
          ability.strength,
          0,
          `trait.abilities[${index}].strength`,
        )
        key = `${ability.kind}:${ability.effectId}`
        break
      case 'ON_HIT_REACTION':
        assertNonEmptyId(ability.effectId, `trait.abilities[${index}].effectId`)
        assertSafeIntegerAtLeast(
          ability.strength,
          0,
          `trait.abilities[${index}].strength`,
        )
        assertSafeIntegerAtLeast(
          ability.targetActionDuration,
          1,
          `trait.abilities[${index}].targetActionDuration`,
        )
        key = `${ability.kind}:${ability.effectId}`
        break
      case 'STATUS_PARAMETER_OVERRIDE':
        assertNonEmptyId(ability.statusId, `trait.abilities[${index}].statusId`)
        assertSafeIntegerAtLeast(
          ability.strengthMultiplierPermille,
          0,
          `trait.abilities[${index}].strengthMultiplierPermille`,
        )
        assertSafeInteger(ability.durationDelta, `trait.abilities[${index}].durationDelta`)
        key = `${ability.kind}:${ability.statusId}`
        break
    }
    if (abilityKeys.has(key)) {
      throw new Error(`trait abilities must be unique within a trait: ${key}`)
    }
    abilityKeys.add(key)
  }
}

function freezeContext(context: PassiveTraitPipelineContext): PassiveTraitPipelineContext {
  return Object.freeze({
    ...context,
    pendingEffects: Object.freeze(
      context.pendingEffects.map((effect) =>
        Object.freeze({
          ...effect,
          duration: Object.freeze({ ...effect.duration }),
        }),
      ),
    ),
  })
}

export function createPassiveTraitPipelineContext(input: {
  readonly phase: PassiveTraitPipelinePhase
  readonly ownerBattleUnitId: BattleUnitId
  readonly currentTime: BattleTime
  readonly applicationSequence?: number
  readonly statusId?: string | null
  readonly statusStrength?: number | null
  readonly statusDuration?: number | null
}): PassiveTraitPipelineContext {
  assertNonEmptyId(input.ownerBattleUnitId, 'ownerBattleUnitId')
  assertSafeIntegerAtLeast(input.currentTime, 0, 'currentTime')
  const nextApplicationSequence = input.applicationSequence ?? 0
  assertSafeIntegerAtLeast(nextApplicationSequence, 0, 'applicationSequence')

  const statusId = input.statusId ?? null
  const statusStrength = input.statusStrength ?? null
  const statusDuration = input.statusDuration ?? null
  if (input.phase === 'STATUS_APPLICATION') {
    if (statusId === null || statusStrength === null || statusDuration === null) {
      throw new Error('status application phase requires status parameters')
    }
    assertNonEmptyId(statusId, 'statusId')
    assertSafeIntegerAtLeast(statusStrength, 0, 'statusStrength')
    assertSafeIntegerAtLeast(statusDuration, 1, 'statusDuration')
  }

  return freezeContext({
    phase: input.phase,
    ownerBattleUnitId: input.ownerBattleUnitId,
    currentTime: input.currentTime,
    nextApplicationSequence,
    pendingEffects: [],
    statusId,
    statusStrength,
    statusDuration,
  })
}

function appendPendingEffect(
  context: PassiveTraitPipelineContext,
  input: Omit<RegisterActiveEffectInput, 'applicationSequence'>,
): PassiveTraitPipelineContext {
  const effect: RegisterActiveEffectInput = {
    ...input,
    applicationSequence: context.nextApplicationSequence,
  }
  return freezeContext({
    ...context,
    nextApplicationSequence: context.nextApplicationSequence + 1,
    pendingEffects: [...context.pendingEffects, effect],
  })
}

function applyStatusOverride(
  context: PassiveTraitPipelineContext,
  ability: StatusParameterOverrideTraitAbility,
): PassiveTraitPipelineContext {
  if (
    context.phase !== 'STATUS_APPLICATION' ||
    context.statusId !== ability.statusId ||
    context.statusStrength === null ||
    context.statusDuration === null
  ) {
    return context
  }

  const strength =
    (BigInt(context.statusStrength) * BigInt(ability.strengthMultiplierPermille) + 500n) /
    1000n
  if (strength > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('passive status strength must be a safe integer')
  }
  const duration = Math.max(1, context.statusDuration + ability.durationDelta)
  assertSafeIntegerAtLeast(duration, 1, 'passive status duration')
  return freezeContext({
    ...context,
    statusStrength: Number(strength),
    statusDuration: duration,
  })
}

export function compilePassiveTraitHooks(
  traits: readonly PassiveTraitDefinition[],
): readonly EffectResolutionHook<PassiveTraitPipelineContext>[] {
  const traitIds = new Set<string>()
  const hooks: EffectResolutionHook<PassiveTraitPipelineContext>[] = []

  for (const trait of traits) {
    assertValidPassiveTraitDefinition(trait)
    if (traitIds.has(trait.id)) {
      throw new Error(`passive trait ids must be unique: ${trait.id}`)
    }
    traitIds.add(trait.id)

    trait.abilities.forEach((ability, index) => {
      const id = `passive-trait:${trait.id}:${index}:${ability.kind}`
      if (ability.kind === 'CONSTANT_STAT_MODIFIER') {
        hooks.push(
          Object.freeze({
            id,
            stage: 'DAMAGE_HEALING_MODIFIERS',
            priority: 100,
            apply: (context) =>
              context.phase !== 'INITIALIZE'
                ? context
                : appendPendingEffect(context, {
                    effectId: ability.effectId,
                    sourceBattleUnitId: context.ownerBattleUnitId,
                    targetBattleUnitId: context.ownerBattleUnitId,
                    strength: ability.strength,
                    stackLimit: 1,
                    duration: { unit: 'BATTLE', remaining: null },
                    duplicateScope: 'TARGET',
                    appliedAt: context.currentTime,
                  }),
          }),
        )
        return
      }

      if (ability.kind === 'ON_HIT_REACTION') {
        hooks.push(
          Object.freeze({
            id,
            stage: 'POST_HIT_HEAL_REACTIONS',
            priority: 100,
            apply: (context) =>
              context.phase !== 'ON_HIT'
                ? context
                : appendPendingEffect(context, {
                    effectId: ability.effectId,
                    sourceBattleUnitId: context.ownerBattleUnitId,
                    targetBattleUnitId: context.ownerBattleUnitId,
                    strength: ability.strength,
                    stackLimit: 1,
                    duration: {
                      unit: 'TARGET_ACTIONS',
                      remaining: ability.targetActionDuration,
                    },
                    duplicateScope: 'TARGET',
                    appliedAt: context.currentTime,
                  }),
          }),
        )
        return
      }

      hooks.push(
        Object.freeze({
          id,
          stage: 'STATUS_CHANGES',
          priority: 100,
          apply: (context) => applyStatusOverride(context, ability),
        }),
      )
    })
  }

  return Object.freeze(hooks)
}

export function runPassiveTraitPipeline(
  initialContext: PassiveTraitPipelineContext,
  traits: readonly PassiveTraitDefinition[],
): EffectResolutionPipelineResult<PassiveTraitPipelineContext> {
  return runEffectResolutionPipeline(initialContext, compilePassiveTraitHooks(traits))
}
