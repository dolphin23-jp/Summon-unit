import {
  previewAiActionCandidate,
  type AiEvaluationInput,
  type AiSkillActionCandidate,
  type AiSkillActionResultPreview,
} from '../ai/action-evaluation'
import type { StatusResistanceStage } from '../content/status-resistance'
import {
  resolveSkillAreaMask,
  type SkillEffectDefinition,
  type SkillStatusEffectDefinition,
} from '../content/skill-definition'
import type { MonsterSpecies } from '../content/monster-species'
import {
  createUnitTurnEvent,
  rescheduleUnitActionAfterAction,
  type BattleTime,
  type UnitActionSchedule,
} from './action-scheduling'
import {
  resolveBarrierGuardDamage,
  type BarrierGuardDamageResolution,
  type DamageRecipientResolution,
} from './barrier-guard-resolution'
import { getBoardPositionId } from './board'
import {
  assertValidBattleState,
  resolveBattleUnitDefeat,
  type BattleState,
} from './defeat-and-victory'
import type { ActiveEffectMutation } from './effect-framework'
import {
  resolveForcedMovement,
  type ForcedMovementFailureReason,
  type ForcedMovementResult,
} from './forced-movement'
import {
  getGuardShareForProtectedUnit,
  type GuardShareState,
} from './guard-share'
import { getModifiedBattleStatValue } from './stat-modifiers'
import {
  applyBloomSealStatus,
  applyBurnStatus,
  applyHealingInhibitionStatus,
  applyMovementLockStatus,
  applyPoisonStatus,
  type StatusApplicationResult,
} from './status-conditions'
import { compareScheduledEvents } from './timeline-queue'
import type { BattleUnitId, BattleUnitState } from './unit-state'

export type ManualActionKind = 'USE_SKILL' | 'MOVE' | 'WAIT'

export interface ManualDamageRecipientPreview {
  readonly battleUnitId: BattleUnitId
  readonly role: 'PRIMARY' | 'GUARD'
  readonly protectedBattleUnitId: BattleUnitId | null
  readonly assignedDamage: number
  readonly barrierAbsorbedDamage: number
  readonly hpDamage: number
  readonly hpBefore: number
  readonly hpAfter: number
  readonly defeated: boolean
}

export interface ManualStatusChangePreview {
  readonly targetBattleUnitId: BattleUnitId
  readonly kind: SkillStatusEffectDefinition['kind']
  readonly applied: boolean
  readonly resistanceStage: StatusResistanceStage
  readonly effectIds: readonly string[]
}

export interface ManualForcedMovementPreview {
  readonly targetBattleUnitId: BattleUnitId
  readonly kind: Extract<SkillEffectDefinition, { readonly kind: 'FORCED_MOVEMENT' }>['movementKind']
  readonly success: boolean
  readonly failureReason: ForcedMovementFailureReason | null
  readonly fromPositionId: string
  readonly toPositionId: string | null
  readonly attemptedPositionId: string | null
}

export interface ManualActionPreview {
  readonly kind: ManualActionKind
  readonly actionCost: number
  readonly nextActionTime: BattleTime
  readonly nextTimelineRank: number | null
  readonly selectedTargetBattleUnitId: BattleUnitId | null
  readonly selectedTargetPositionId: string | null
  readonly affectedPositionIds: readonly string[]
  readonly reachMethod: AiSkillActionResultPreview['reach']['reachMethod'] | null
  readonly areaMask: AiSkillActionResultPreview['area']['areaMask'] | null
  readonly blockedByBattleUnitId: BattleUnitId | null
  readonly actualTargetBattleUnitId: BattleUnitId | null
  readonly telegraphDelay: number | null
  readonly totalCalculatedDamage: number
  readonly totalHpDamage: number
  readonly damageRecipients: readonly ManualDamageRecipientPreview[]
  readonly defeatedBattleUnitIds: readonly BattleUnitId[]
  readonly statusChanges: readonly ManualStatusChangePreview[]
  readonly forcedMovements: readonly ManualForcedMovementPreview[]
  readonly fromPositionId: string | null
  readonly toPositionId: string | null
}

export interface ManualSkillDamageStep {
  readonly primaryTargetBattleUnitId: BattleUnitId
  readonly resolution: BarrierGuardDamageResolution
}

export interface ManualSkillActionResolution {
  readonly battle: BattleState
  readonly actorSchedule: UnitActionSchedule
  readonly rawPreview: AiSkillActionResultPreview
  readonly preview: ManualActionPreview
  readonly damageSteps: readonly ManualSkillDamageStep[]
  readonly effectMutations: readonly ActiveEffectMutation[]
  readonly forcedMovementResults: readonly ForcedMovementResult[]
}

export interface ResolveManualSkillActionInput {
  readonly evaluationInput: AiEvaluationInput
  readonly candidate: AiSkillActionCandidate
  readonly actorSchedule: UnitActionSchedule
  readonly currentTime: BattleTime
  readonly guardShares: readonly GuardShareState[]
  readonly nextTimelineSequence: number
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

function applyRecipientResolution(
  battle: BattleState,
  resolution: DamageRecipientResolution,
  killerBattleUnitId: BattleUnitId,
  currentTime: BattleTime,
): BattleState {
  return resolution.after.defeated
    ? resolveBattleUnitDefeat({
        battle,
        defeatedUnit: resolution.after,
        killerBattleUnitId,
        currentTime,
      })
    : replaceLivingUnit(battle, resolution.after)
}

function getLivingGuard(
  battle: BattleState,
  target: BattleUnitState,
  speciesById: Readonly<Record<string, MonsterSpecies>>,
  guardShares: readonly GuardShareState[],
): {
  readonly unit: BattleUnitState
  readonly species: MonsterSpecies
  readonly guardShare: GuardShareState
} | null {
  const guardShare = getGuardShareForProtectedUnit(guardShares, target.battleUnitId)
  if (guardShare === null) {
    return null
  }
  const guard = getRequiredUnit(battle, guardShare.guardBattleUnitId)
  if (guard.defeated) {
    return null
  }
  return Object.freeze({
    unit: guard,
    species: getRequiredSpecies(speciesById, guard.speciesId),
    guardShare,
  })
}

function createRecipientPreview(
  resolution: DamageRecipientResolution,
  role: ManualDamageRecipientPreview['role'],
  protectedBattleUnitId: BattleUnitId | null,
): ManualDamageRecipientPreview {
  return Object.freeze({
    battleUnitId: resolution.before.battleUnitId,
    role,
    protectedBattleUnitId,
    assignedDamage: resolution.assignedDamage,
    barrierAbsorbedDamage: resolution.barrierAbsorbedDamage,
    hpDamage: resolution.hpDamage,
    hpBefore: resolution.before.hp,
    hpAfter: resolution.after.hp,
    defeated: resolution.after.defeated,
  })
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

function createStatusPreview(
  targetBattleUnitId: BattleUnitId,
  effect: SkillStatusEffectDefinition,
  result: StatusApplicationResult,
): ManualStatusChangePreview {
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

function createForcedMovementPreview(
  result: ForcedMovementResult,
): ManualForcedMovementPreview {
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

export function getPredictedUnitTurnRank(
  battle: BattleState,
  schedule: UnitActionSchedule,
  sequence: number,
): number | null {
  if (battle.outcome !== 'ONGOING') {
    return null
  }
  const event = createUnitTurnEvent(schedule, sequence)
  const events = [...battle.timeline.events, event].sort(compareScheduledEvents)
  const index = events.findIndex((candidate) => candidate.id === event.id)
  return index < 0 ? null : index + 1
}

export function resolveManualSkillAction(
  input: ResolveManualSkillActionInput,
): ManualSkillActionResolution {
  const raw = previewAiActionCandidate(input.evaluationInput, input.candidate)
  if (raw.kind !== 'USE_SKILL') {
    throw new Error('manual skill resolution requires a skill candidate')
  }
  const actor = getRequiredUnit(
    input.evaluationInput.battle,
    input.evaluationInput.actorBattleUnitId,
  )
  const actorSpecies = getRequiredSpecies(
    input.evaluationInput.speciesById,
    actor.speciesId,
  )
  const skill = input.evaluationInput.availableSkills.find(
    (candidate) => candidate.id === input.candidate.skillId,
  )
  if (skill === undefined) {
    throw new Error(`candidate skill is not available: ${input.candidate.skillId}`)
  }
  const effectiveSpeed = getModifiedBattleStatValue(
    actorSpecies.stats.speed,
    actor.effects,
    'SPEED',
  )
  const actorSchedule = rescheduleUnitActionAfterAction(
    input.actorSchedule,
    input.currentTime,
    raw.actionCost,
    effectiveSpeed,
  )

  let battle = input.evaluationInput.battle
  let applicationSequence = input.applicationSequenceStart
  const defeatCountBefore = battle.defeatRecords.length
  const damageSteps: ManualSkillDamageStep[] = []
  const damageRecipients: ManualDamageRecipientPreview[] = []
  const effectMutations: ActiveEffectMutation[] = []
  const statusChanges: ManualStatusChangePreview[] = []
  const forcedMovementResults: ForcedMovementResult[] = []
  const forcedMovementPreviews: ManualForcedMovementPreview[] = []
  const forcedEffects = (skill.effects ?? []).filter(
    (effect): effect is Extract<SkillEffectDefinition, { readonly kind: 'FORCED_MOVEMENT' }> =>
      effect.kind === 'FORCED_MOVEMENT',
  )
  const statusEffects = (skill.effects ?? []).filter(
    (effect): effect is SkillStatusEffectDefinition => effect.kind !== 'FORCED_MOVEMENT',
  )

  for (const rawTarget of raw.targetResults) {
    let target = getRequiredUnit(battle, rawTarget.battleUnitId)
    if (target.defeated) {
      continue
    }

    if (rawTarget.calculatedDamage > 0) {
      const targetSpecies = getRequiredSpecies(
        input.evaluationInput.speciesById,
        target.speciesId,
      )
      const resolution = resolveBarrierGuardDamage({
        finalDamage: rawTarget.calculatedDamage,
        target,
        targetSpecies,
        guard: getLivingGuard(
          battle,
          target,
          input.evaluationInput.speciesById,
          input.guardShares,
        ),
      })
      damageSteps.push(
        Object.freeze({
          primaryTargetBattleUnitId: target.battleUnitId,
          resolution,
        }),
      )
      damageRecipients.push(
        createRecipientPreview(resolution.target, 'PRIMARY', null),
      )
      battle = applyRecipientResolution(
        battle,
        resolution.target,
        actor.battleUnitId,
        input.currentTime,
      )
      if (resolution.guardShare !== null) {
        damageRecipients.push(
          createRecipientPreview(
            resolution.guardShare.guard,
            'GUARD',
            target.battleUnitId,
          ),
        )
        battle = applyRecipientResolution(
          battle,
          resolution.guardShare.guard,
          actor.battleUnitId,
          input.currentTime,
        )
      }
    }

    target = getRequiredUnit(battle, rawTarget.battleUnitId)
    if (target.defeated) {
      continue
    }

    for (const effect of forcedEffects) {
      const movement = resolveForcedMovement({
        battle,
        sourceBattleUnitId: actor.battleUnitId,
        targetBattleUnitId: target.battleUnitId,
        kind: effect.movementKind,
      })
      forcedMovementResults.push(movement)
      forcedMovementPreviews.push(createForcedMovementPreview(movement))
      battle = movement.battle
    }

    if (battle.outcome !== 'ONGOING') {
      continue
    }
    target = getRequiredUnit(battle, rawTarget.battleUnitId)
    for (const effect of statusEffects) {
      const targetSpecies = getRequiredSpecies(
        input.evaluationInput.speciesById,
        target.speciesId,
      )
      const result = applyStatusEffect(
        effect,
        target,
        targetSpecies,
        actor.battleUnitId,
        input.currentTime,
        applicationSequence,
      )
      statusChanges.push(createStatusPreview(target.battleUnitId, effect, result))
      effectMutations.push(...result.mutations)
      applicationSequence += Math.max(1, result.mutations.length)
      target = result.state
      battle = replaceLivingUnit(battle, target)
    }
  }

  const defeatedBattleUnitIds = Object.freeze(
    battle.defeatRecords
      .slice(defeatCountBefore)
      .map((record) => record.defeatedBattleUnitId),
  )
  const totalHpDamage = damageRecipients.reduce(
    (sum, recipient) => sum + recipient.hpDamage,
    0,
  )
  const preview: ManualActionPreview = Object.freeze({
    kind: 'USE_SKILL',
    actionCost: raw.actionCost,
    nextActionTime: actorSchedule.nextActionTime,
    nextTimelineRank: getPredictedUnitTurnRank(
      battle,
      actorSchedule,
      input.nextTimelineSequence,
    ),
    selectedTargetBattleUnitId: raw.reach.selectedTargetBattleUnitId,
    selectedTargetPositionId:
      input.candidate.selectedTargetPosition === null
        ? null
        : getBoardPositionId(input.candidate.selectedTargetPosition),
    affectedPositionIds: raw.affectedPositionIds,
    reachMethod: raw.reach.reachMethod,
    areaMask: resolveSkillAreaMask(skill),
    blockedByBattleUnitId: raw.reach.blockedByBattleUnitId,
    actualTargetBattleUnitId: raw.reach.actualTargetBattleUnitId,
    telegraphDelay: raw.telegraphDelay,
    totalCalculatedDamage: raw.totalCalculatedDamage,
    totalHpDamage,
    damageRecipients: Object.freeze(damageRecipients),
    defeatedBattleUnitIds,
    statusChanges: Object.freeze(statusChanges),
    forcedMovements: Object.freeze(forcedMovementPreviews),
    fromPositionId: null,
    toPositionId: null,
  })

  return Object.freeze({
    battle,
    actorSchedule,
    rawPreview: raw,
    preview,
    damageSteps: Object.freeze(damageSteps),
    effectMutations: Object.freeze(effectMutations),
    forcedMovementResults: Object.freeze(forcedMovementResults),
  })
}
