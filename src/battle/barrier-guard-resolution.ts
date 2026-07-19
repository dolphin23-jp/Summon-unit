import type { MonsterSpecies } from '../content/monster-species'
import {
  consumeBarrierLayers,
  type BarrierLayerConsumption,
} from './barrier'
import {
  calculateGuardRedirectedDamage,
  type GuardShareState,
} from './guard-share'
import {
  assertValidBattleUnitState,
  withBattleUnitBarriers,
  withBattleUnitHp,
  type BattleUnitState,
} from './unit-state'

export interface DamageReactionSignals {
  readonly hitOccurred: boolean
  readonly hpDamageOccurred: boolean
}

export interface DamageRecipientResolution {
  readonly before: BattleUnitState
  readonly after: BattleUnitState
  readonly assignedDamage: number
  readonly barrierAbsorbedDamage: number
  readonly hpDamage: number
  readonly barrierConsumptions: readonly BarrierLayerConsumption[]
  readonly reactions: DamageReactionSignals
}

export interface GuardShareDamageResolution {
  readonly guardShare: GuardShareState
  readonly retainedDamage: number
  readonly redirectedDamage: number
  readonly guard: DamageRecipientResolution
}

export interface BarrierGuardDamageResolution {
  readonly finalDamage: number
  readonly target: DamageRecipientResolution
  readonly guardShare: GuardShareDamageResolution | null
}

export interface ResolveBarrierGuardDamageInput {
  readonly finalDamage: number
  readonly target: BattleUnitState
  readonly targetSpecies: MonsterSpecies
  readonly guard?: {
    readonly unit: BattleUnitState
    readonly species: MonsterSpecies
    readonly guardShare: GuardShareState
  } | null
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function resolveRecipientDamage(
  unit: BattleUnitState,
  species: MonsterSpecies,
  assignedDamage: number,
  hitOccurred: boolean,
): DamageRecipientResolution {
  assertValidBattleUnitState(unit, species)
  assertSafeIntegerAtLeast(assignedDamage, 0, 'assignedDamage')
  const barrierResult = consumeBarrierLayers(unit.barriers, assignedDamage)
  const hpDamage = Math.min(unit.hp, barrierResult.remainingDamage)
  const withBarriers = withBattleUnitBarriers(unit, species, barrierResult.barriers)
  const after = withBattleUnitHp(withBarriers, species, unit.hp - hpDamage)

  return Object.freeze({
    before: unit,
    after,
    assignedDamage,
    barrierAbsorbedDamage: barrierResult.absorbedDamage,
    hpDamage,
    barrierConsumptions: barrierResult.consumptions,
    reactions: Object.freeze({
      hitOccurred,
      hpDamageOccurred: hpDamage > 0,
    }),
  })
}

function assertGuardInput(
  target: BattleUnitState,
  guard: NonNullable<ResolveBarrierGuardDamageInput['guard']>,
): void {
  assertValidBattleUnitState(guard.unit, guard.species)
  if (guard.guardShare.protectedBattleUnitId !== target.battleUnitId) {
    throw new Error('guard share protected unit must match the damage target')
  }
  if (guard.guardShare.guardBattleUnitId !== guard.unit.battleUnitId) {
    throw new Error('guard share guard unit must match the supplied guard')
  }
  if (guard.unit.side !== target.side) {
    throw new Error('guard share requires units on the same side')
  }
  if (guard.unit.defeated) {
    throw new Error('defeated unit cannot receive guard-share damage')
  }
}

export function resolveBarrierGuardDamage(
  input: ResolveBarrierGuardDamageInput,
): BarrierGuardDamageResolution {
  assertSafeIntegerAtLeast(input.finalDamage, 1, 'finalDamage')
  assertValidBattleUnitState(input.target, input.targetSpecies)
  if (input.target.defeated) {
    throw new Error('defeated target cannot receive damage')
  }

  const guard = input.guard ?? null
  if (guard === null) {
    return Object.freeze({
      finalDamage: input.finalDamage,
      target: resolveRecipientDamage(
        input.target,
        input.targetSpecies,
        input.finalDamage,
        true,
      ),
      guardShare: null,
    })
  }

  assertGuardInput(input.target, guard)
  const redirectedDamage = calculateGuardRedirectedDamage(
    input.finalDamage,
    guard.guardShare.sharePermille,
  )
  const retainedDamage = input.finalDamage - redirectedDamage
  const targetResolution = resolveRecipientDamage(
    input.target,
    input.targetSpecies,
    retainedDamage,
    true,
  )
  const guardResolution = resolveRecipientDamage(
    guard.unit,
    guard.species,
    redirectedDamage,
    false,
  )

  return Object.freeze({
    finalDamage: input.finalDamage,
    target: targetResolution,
    guardShare: Object.freeze({
      guardShare: guard.guardShare,
      retainedDamage,
      redirectedDamage,
      guard: guardResolution,
    }),
  })
}
