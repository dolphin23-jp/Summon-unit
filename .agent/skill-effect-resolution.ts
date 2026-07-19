import type { StatusResistanceStage } from '../content/status-resistance'
import type {
  SkillDefinition,
  SkillStatusEffectDefinition,
} from '../content/skill-definition'
import type { MonsterSpecies } from '../content/monster-species'
import type { BattleTime } from './action-scheduling'
import { getBoardPositionId } from './board'
import {
  assertValidBattleState,
  type BattleState,
} from './defeat-and-victory'
import type { ActiveEffectMutation } from './effect-framework'
import {
  resolveForcedMovement,
  type ForcedMovementFailureReason,
  type ForcedMovementResult,
} from './forced-movement'
import {
  applyBloomSealStatus,
  applyBurnStatus,
  applyHealingInhibitionStatus,
  applyMovementLockStatus,
  applyPoisonStatus,
  type StatusApplicationResult,
} from './status-conditions'
import type { BattleUnitId, BattleUnitState } from './unit-state'

export interface ResolvedSkillStatusChange {
  readonly targetBattleUnitId: BattleUnitId
  readonly kind: SkillStatusEffectDefinition['kind']
  readonly applied: boolean
  readonly resistanceStage: StatusResistanceStage
  readonly effectIds: readonly string[]
}

export interface ResolvedSkillForcedMovement {
  readonly targetBattleUnitId: BattleUnitId
  readonly kind: ForcedMovementResult['kind']
  readonly success: boolean
  readonly failureReason: ForcedMovementFailureReason | null
  readonly fromPositionId: string
  readonly toPositionId: string | null
  readonly attemptedPositionId: string | null
}

export interface SkillEffectResolution {
  readonly battle: BattleState
  readonly statusChanges: readonly ResolvedSkillStatusChange[]
  readonly forcedMovements: readonly ResolvedSkillForcedMovement[]
  readonly effectMutations: readonly ActiveEffectMutation[]
  readonly movementResults: readonly ForcedMovementResult[]
}

export interface ResolveSkillEffectsInput {
  readonly battle: BattleState
  readonly actorBattleUnitId: BattleUnitId
  readonly targetBattleUnitIds: readonly BattleUnitId[]
  readonly skill: SkillDefinition
  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly currentTime: BattleTime
  readonly applicationSequenceStart: number
}

function getRequiredUnit(battle: BattleState, battleUnitId: BattleUnitId): BattleUnitState {
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`battle unit is missing: ${battleUnitId}`)
  }
  return unit
}

function getRequiredSpecies(
  speciesById: Readonly<Record<string, MonsterSpecies>>,
  speciesId: string,
): MonsterSpecies {
  const species = speciesById[speciesId]
  if (species === undefined) {
    throw new Error(`species master is missing: ${speciesId}`)
  }
  return species
}

function replaceLivingUnit(battle: BattleState, updatedUnit: BattleUnitState): BattleState {
  if (updatedUnit.defeated) {
    throw new Error('replaceLivingUnit requires a living unit')
  }
  const nextBattle: BattleState = Object.freeze({
    ...battle,
    units: Object.freeze(
      battle.units.map((unit) =>
        unit.battleUnitId === updatedUnit.battleUnitId ? updatedUnit : unit,
      ),
    ),
  })
  assertValidBattleState(nextBattle)
  return nextBattle
}

function expectedEffectIds(effect: SkillStatusEffectDefinition): readonly string[] {
  switch (effect.kind) {
    case 'POISON':
      return Object.freeze(['effect.status.poison'])
    case 'BURN':
      return Object.freeze(['effect.status.burn', 'effect.debuff.attack'])
    case 'MOVEMENT_LOCK':
      return Object.freeze(['effect.status.movement-lock'])
    case 'BLOOM_SEAL':
      return Object.freeze(['effect.status.bloom-seal'])
    case 'HEALING_INHIBITION':
      return Object.freeze(['effect.status.healing-inhibition'])
  }
}

function applyStatusEffect(
  effect: SkillStatusEffectDefinition,
  target: BattleUnitState,
  targetSpecies: MonsterSpecies,
  sourceBattleUnitId: BattleUnitId,
  currentTime: BattleTime,
  applicationSequence: number,
): StatusApplicationResult {
  const common = {
    target,
    targetSpecies,
    sourceBattleUnitId,
    currentTime,
    applicationSequence,
  } as const
  switch (effect.kind) {
    case 'POISON':
      return applyPoisonStatus({
        ...common,
        damagePerStack: effect.damagePerStack,
        ...(effect.stacks === undefined ? {} : { stacks: effect.stacks }),
        ...(effect.triggerCount === undefined
          ? {}
          : { triggerCount: effect.triggerCount }),
      })
    case 'BURN':
      return applyBurnStatus({
        ...common,
        damagePerTrigger: effect.damagePerTrigger,
        ...(effect.triggerCount === undefined
          ? {}
          : { triggerCount: effect.triggerCount }),
        ...(effect.attackReductionPermille === undefined
          ? {}
          : { attackReductionPermille: effect.attackReductionPermille }),
      })
    case 'MOVEMENT_LOCK':
      return applyMovementLockStatus({
        ...common,
        targetActionCount: effect.targetActionCount,
      })
    case 'BLOOM_SEAL':
      return applyBloomSealStatus({
        ...common,
        targetActionCount: effect.targetActionCount,
      })
    case 'HEALING_INHIBITION':
      return applyHealingInhibitionStatus({
        ...common,
        reductionPermille: effect.reductionPermille,
        targetActionCount: effect.targetActionCount,
      })
  }
}

function createStatusChange(
  targetBattleUnitId: BattleUnitId,
  effect: SkillStatusEffectDefinition,
  result: StatusApplicationResult,
): ResolvedSkillStatusChange {
  const mutationEffectIds = result.mutations.map((mutation) =>
    mutation.after === null ? mutation.before.effectId : mutation.after.effectId,
  )
  return Object.freeze({
    targetBattleUnitId,
    kind: effect.kind,
    applied: result.applied,
    resistanceStage: result.resistanceStage,
    effectIds: Object.freeze(
      mutationEffectIds.length === 0 ? [...expectedEffectIds(effect)] : mutationEffectIds,
    ),
  })
}

function createForcedMovement(
  result: ForcedMovementResult,
): ResolvedSkillForcedMovement {
  return Object.freeze({
    targetBattleUnitId: result.targetBattleUnitId,
    kind: result.kind,
    success: result.success,
    failureReason: result.failureReason,
    fromPositionId: getBoardPositionId(result.from),
    toPositionId: result.to === null ? null : getBoardPositionId(result.to),
    attemptedPositionId:
      result.attemptedDestination === null
        ? null
        : getBoardPositionId(result.attemptedDestination),
  })
}

export function resolveSkillEffects(input: ResolveSkillEffectsInput): SkillEffectResolution {
  assertValidBattleState(input.battle)
  let battle = input.battle
  let applicationSequence = input.applicationSequenceStart
  const statusChanges: ResolvedSkillStatusChange[] = []
  const forcedMovements: ResolvedSkillForcedMovement[] = []
  const effectMutations: ActiveEffectMutation[] = []
  const movementResults: ForcedMovementResult[] = []
  const seenTargets = new Set<BattleUnitId>()

  for (const targetBattleUnitId of input.targetBattleUnitIds) {
    if (seenTargets.has(targetBattleUnitId)) {
      continue
    }
    seenTargets.add(targetBattleUnitId)

    let target = getRequiredUnit(battle, targetBattleUnitId)
    if (target.defeated) {
      continue
    }

    for (const effect of input.skill.effects ?? []) {
      target = getRequiredUnit(battle, targetBattleUnitId)
      if (target.defeated) {
        break
      }

      if (effect.kind === 'FORCED_MOVEMENT') {
        if (input.actorBattleUnitId === targetBattleUnitId) {
          continue
        }
        const movement = resolveForcedMovement({
          battle,
          sourceBattleUnitId: input.actorBattleUnitId,
          targetBattleUnitId,
          kind: effect.movementKind,
        })
        movementResults.push(movement)
        forcedMovements.push(createForcedMovement(movement))
        battle = movement.battle
        continue
      }

      const targetSpecies = getRequiredSpecies(input.speciesById, target.speciesId)
      const result = applyStatusEffect(
        effect,
        target,
        targetSpecies,
        input.actorBattleUnitId,
        input.currentTime,
        applicationSequence,
      )
      statusChanges.push(createStatusChange(targetBattleUnitId, effect, result))
      effectMutations.push(...result.mutations)
      applicationSequence += Math.max(1, result.mutations.length)
      battle = replaceLivingUnit(battle, result.state)
    }
  }

  return Object.freeze({
    battle,
    statusChanges: Object.freeze(statusChanges),
    forcedMovements: Object.freeze(forcedMovements),
    effectMutations: Object.freeze(effectMutations),
    movementResults: Object.freeze(movementResults),
  })
}
