import type {
  AiActionEvaluation,
  AiSkillActionResultPreview,
} from '../ai/action-evaluation'
import type { MonsterSpecies } from '../content/monster-species'
import {
  createUnitTurnEvent,
  rescheduleUnitActionAfterAction,
  type BattleTime,
  type UnitActionSchedule,
} from './action-scheduling'
import { getTotalBarrierCapacity } from './barrier'
import {
  resolveBarrierGuardDamage,
  type DamageRecipientResolution,
} from './barrier-guard-resolution'
import { getBoardPositionId } from './board'
import type { BattleState } from './defeat-and-victory'
import {
  getGuardShareForProtectedUnit,
  type GuardShareState,
} from './guard-share'
import { getModifiedBattleStatValue } from './stat-modifiers'
import { compareScheduledEvents } from './timeline-queue'
import type { BattleUnitId, BattleUnitState } from './unit-state'

export type ManualActionCategory = 'INNATE' | 'GENERIC' | 'BLOOM' | 'MOVE' | 'WAIT'

export interface ManualDamagePreview {
  readonly battleUnitId: BattleUnitId
  readonly role: 'PRIMARY' | 'AREA' | 'GUARD'
  readonly guardedForBattleUnitId: BattleUnitId | null
  readonly positionId: string
  readonly calculatedDamage: number
  readonly assignedDamage: number
  readonly barrierBefore: number
  readonly barrierAfter: number
  readonly barrierAbsorbedDamage: number
  readonly hpBefore: number
  readonly hpAfter: number
  readonly hpDamage: number
  readonly defeated: boolean
}

export interface ManualForcedMovementPreview {
  readonly targetBattleUnitId: BattleUnitId
  readonly fromPositionId: string
  readonly toPositionId: string | null
  readonly success: boolean
  readonly failureReason: string | null
}

export interface ManualActionPreview {
  readonly actionCost: number
  readonly nextActionTime: BattleTime
  readonly nextActionRank: number
  readonly fromPositionId: string
  readonly toPositionId: string
  readonly selectedTargetBattleUnitId: BattleUnitId | null
  readonly selectedTargetPositionId: string | null
  readonly actualTargetBattleUnitId: BattleUnitId | null
  readonly blockedByBattleUnitId: BattleUnitId | null
  readonly affectedPositionIds: readonly string[]
  readonly damageResults: readonly ManualDamagePreview[]
  readonly statusChanges: readonly string[]
  readonly forcedMovements: readonly ManualForcedMovementPreview[]
}

export interface CreateManualActionPreviewInput {
  readonly battle: BattleState
  readonly actor: BattleUnitState
  readonly actorSpecies: MonsterSpecies
  readonly actorSchedule: UnitActionSchedule
  readonly currentTime: BattleTime
  readonly nextTimelineSequence: number
  readonly evaluation: AiActionEvaluation
  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly guardShares: readonly GuardShareState[]
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

function getRequiredUnit(
  unitsById: ReadonlyMap<BattleUnitId, BattleUnitState>,
  battleUnitId: BattleUnitId,
): BattleUnitState {
  const unit = unitsById.get(battleUnitId)
  if (unit === undefined) {
    throw new Error(`battle unit is missing: ${battleUnitId}`)
  }
  return unit
}

function getNextActionRank(
  battle: BattleState,
  schedule: UnitActionSchedule,
  sequence: number,
): number {
  const provisional = createUnitTurnEvent(schedule, sequence)
  return (
    1 +
    battle.timeline.events.filter(
      (event) => compareScheduledEvents(event, provisional) < 0,
    ).length
  )
}

function freezeDamagePreview(
  resolution: DamageRecipientResolution,
  role: ManualDamagePreview['role'],
  guardedForBattleUnitId: BattleUnitId | null,
): ManualDamagePreview {
  return Object.freeze({
    battleUnitId: resolution.before.battleUnitId,
    role,
    guardedForBattleUnitId,
    positionId: getBoardPositionId(resolution.before.position),
    calculatedDamage: resolution.assignedDamage,
    assignedDamage: resolution.assignedDamage,
    barrierBefore: getTotalBarrierCapacity(resolution.before.barriers),
    barrierAfter: getTotalBarrierCapacity(resolution.after.barriers),
    barrierAbsorbedDamage: resolution.barrierAbsorbedDamage,
    hpBefore: resolution.before.hp,
    hpAfter: resolution.after.hp,
    hpDamage: resolution.hpDamage,
    defeated: resolution.after.defeated,
  })
}

function zeroDamagePreview(
  unit: BattleUnitState,
  role: ManualDamagePreview['role'],
): ManualDamagePreview {
  const barrier = getTotalBarrierCapacity(unit.barriers)
  return Object.freeze({
    battleUnitId: unit.battleUnitId,
    role,
    guardedForBattleUnitId: null,
    positionId: getBoardPositionId(unit.position),
    calculatedDamage: 0,
    assignedDamage: 0,
    barrierBefore: barrier,
    barrierAfter: barrier,
    barrierAbsorbedDamage: 0,
    hpBefore: unit.hp,
    hpAfter: unit.hp,
    hpDamage: 0,
    defeated: unit.defeated,
  })
}

function previewSkillDamage(
  input: CreateManualActionPreviewInput,
  preview: AiSkillActionResultPreview,
): readonly ManualDamagePreview[] {
  const unitsById = new Map(
    input.battle.units.map((unit) => [unit.battleUnitId, unit] as const),
  )
  const results: ManualDamagePreview[] = []

  for (const predicted of preview.targetResults) {
    const target = getRequiredUnit(unitsById, predicted.battleUnitId)
    if (target.defeated) {
      continue
    }
    const role: ManualDamagePreview['role'] =
      predicted.battleUnitId === preview.reach.actualTargetBattleUnitId
        ? 'PRIMARY'
        : 'AREA'
    if (predicted.calculatedDamage === 0) {
      results.push(zeroDamagePreview(target, role))
      continue
    }

    const targetSpecies = getRequiredSpecies(input.speciesById, target.speciesId)
    const guardShare = getGuardShareForProtectedUnit(
      input.guardShares,
      target.battleUnitId,
    )
    const guard =
      guardShare === null
        ? null
        : getRequiredUnit(unitsById, guardShare.guardBattleUnitId)
    const livingGuard =
      guardShare === null || guard === null || guard.defeated
        ? null
        : Object.freeze({
            unit: guard,
            species: getRequiredSpecies(input.speciesById, guard.speciesId),
            guardShare,
          })
    const mitigation = resolveBarrierGuardDamage({
      finalDamage: predicted.calculatedDamage,
      target,
      targetSpecies,
      guard: livingGuard,
    })

    results.push(freezeDamagePreview(mitigation.target, role, null))
    unitsById.set(target.battleUnitId, mitigation.target.after)
    if (mitigation.guardShare !== null) {
      results.push(
        freezeDamagePreview(
          mitigation.guardShare.guard,
          'GUARD',
          target.battleUnitId,
        ),
      )
      unitsById.set(
        mitigation.guardShare.guard.before.battleUnitId,
        mitigation.guardShare.guard.after,
      )
    }
  }

  return Object.freeze(results)
}

export function createManualActionPreview(
  input: CreateManualActionPreviewInput,
): ManualActionPreview {
  const effectiveSpeed = getModifiedBattleStatValue(
    input.actorSpecies.stats.speed,
    input.actor.effects,
    'SPEED',
  )
  const schedule = rescheduleUnitActionAfterAction(
    input.actorSchedule,
    input.currentTime,
    input.evaluation.preview.actionCost,
    effectiveSpeed,
  )
  const fromPositionId = getBoardPositionId(input.actor.position)

  if (input.evaluation.preview.kind === 'MOVE') {
    return Object.freeze({
      actionCost: input.evaluation.preview.actionCost,
      nextActionTime: schedule.nextActionTime,
      nextActionRank: getNextActionRank(
        input.battle,
        schedule,
        input.nextTimelineSequence,
      ),
      fromPositionId,
      toPositionId: input.evaluation.preview.toPositionId,
      selectedTargetBattleUnitId: null,
      selectedTargetPositionId: input.evaluation.preview.toPositionId,
      actualTargetBattleUnitId: null,
      blockedByBattleUnitId: null,
      affectedPositionIds: input.evaluation.preview.affectedPositionIds,
      damageResults: Object.freeze([]),
      statusChanges: Object.freeze([]),
      forcedMovements: Object.freeze([]),
    })
  }

  const candidate = input.evaluation.preview.candidate
  return Object.freeze({
    actionCost: input.evaluation.preview.actionCost,
    nextActionTime: schedule.nextActionTime,
    nextActionRank: getNextActionRank(
      input.battle,
      schedule,
      input.nextTimelineSequence,
    ),
    fromPositionId,
    toPositionId: fromPositionId,
    selectedTargetBattleUnitId: candidate.selectedTargetBattleUnitId,
    selectedTargetPositionId:
      candidate.selectedTargetPosition === null
        ? null
        : getBoardPositionId(candidate.selectedTargetPosition),
    actualTargetBattleUnitId:
      input.evaluation.preview.reach.actualTargetBattleUnitId,
    blockedByBattleUnitId: input.evaluation.preview.reach.blockedByBattleUnitId,
    affectedPositionIds: input.evaluation.preview.affectedPositionIds,
    damageResults: previewSkillDamage(input, input.evaluation.preview),
    statusChanges: Object.freeze([]),
    forcedMovements: Object.freeze([]),
  })
}

export function createWaitManualActionPreview(input: {
  readonly battle: BattleState
  readonly actor: BattleUnitState
  readonly schedule: UnitActionSchedule
  readonly effectiveActionCost: number
  readonly nextSchedule: UnitActionSchedule
  readonly nextTimelineSequence: number
}): ManualActionPreview {
  const positionId = getBoardPositionId(input.actor.position)
  return Object.freeze({
    actionCost: input.effectiveActionCost,
    nextActionTime: input.nextSchedule.nextActionTime,
    nextActionRank: getNextActionRank(
      input.battle,
      input.nextSchedule,
      input.nextTimelineSequence,
    ),
    fromPositionId: positionId,
    toPositionId: positionId,
    selectedTargetBattleUnitId: null,
    selectedTargetPositionId: null,
    actualTargetBattleUnitId: null,
    blockedByBattleUnitId: null,
    affectedPositionIds: Object.freeze([]),
    damageResults: Object.freeze([]),
    statusChanges: Object.freeze([]),
    forcedMovements: Object.freeze([]),
  })
}
