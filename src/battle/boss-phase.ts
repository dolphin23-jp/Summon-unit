import type { MonsterSpecies } from '../content/monster-species'
import { assertValidBattleState, type BattleState } from './defeat-and-victory'
import { pushTimelineEvent, type ScheduledEvent } from './timeline-queue'
import {
  withAddedBattleUnitBarrier,
  type BattleUnitId,
  type BattleUnitState,
} from './unit-state'

export type BossPhaseId = string

export type BossPhaseGimmick =
  | { readonly type: 'BARRIER'; readonly capacity: number }
  | { readonly type: 'NONE' }

export interface BossPhaseDefinition {
  readonly phaseId: BossPhaseId
  readonly enterAtOrBelowHpBasisPoints: number
  readonly actionSkillIds: readonly string[]
  readonly gimmick: BossPhaseGimmick
}

export interface BossEncounterDefinition {
  readonly bossBattleUnitId: BattleUnitId
  readonly phases: readonly BossPhaseDefinition[]
}

export interface BossPhaseRuntimeState {
  readonly bossBattleUnitId: BattleUnitId
  readonly currentPhaseIndex: number
  readonly pendingPhaseIndex: number | null
  readonly actionSkillIds: readonly string[]
}

export interface BossPhaseChangePayload {
  readonly bossBattleUnitId: BattleUnitId
  readonly fromPhaseId: BossPhaseId
  readonly toPhaseId: BossPhaseId
  readonly toPhaseIndex: number
}

export interface ReserveBossPhaseChangeResult {
  readonly battle: BattleState
  readonly state: BossPhaseRuntimeState
  readonly event: ScheduledEvent<BossPhaseChangePayload> | null
  readonly nextSequence: number
}

export interface ResolveBossPhaseChangeResult {
  readonly battle: BattleState
  readonly state: BossPhaseRuntimeState
  readonly fromPhaseId: BossPhaseId
  readonly toPhaseId: BossPhaseId
  readonly actionSkillIds: readonly string[]
  readonly appliedGimmick: BossPhaseGimmick
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be a safe integer from ${minimum} through ${maximum}`)
  }
}

function normalizeActionSkillIds(
  skillIds: readonly string[],
  knownSkillIds: ReadonlySet<string>,
  field: string,
): readonly string[] {
  if (skillIds.length === 0) {
    throw new Error(`${field} must contain at least one skill`)
  }
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const skillId of skillIds) {
    assertNonEmptyString(skillId, `${field}[]`)
    if (!knownSkillIds.has(skillId)) {
      throw new Error(`${field} references unknown skill: ${skillId}`)
    }
    if (seen.has(skillId)) {
      throw new Error(`${field} must not contain duplicates: ${skillId}`)
    }
    seen.add(skillId)
    normalized.push(skillId)
  }
  normalized.sort(compareIds)
  return Object.freeze(normalized)
}

export function normalizeBossEncounterDefinition(
  definition: BossEncounterDefinition,
  knownSkillIds: ReadonlySet<string>,
): BossEncounterDefinition {
  assertNonEmptyString(definition.bossBattleUnitId, 'boss.bossBattleUnitId')
  if (definition.phases.length < 2) {
    throw new Error('boss encounter must contain at least two phases')
  }
  const phaseIds = new Set<string>()
  let previousThreshold = 10_001
  const phases = definition.phases.map((phase, index) => {
    assertNonEmptyString(phase.phaseId, 'boss.phaseId')
    if (phaseIds.has(phase.phaseId)) {
      throw new Error(`boss phase id must be unique: ${phase.phaseId}`)
    }
    phaseIds.add(phase.phaseId)
    assertSafeIntegerInRange(
      phase.enterAtOrBelowHpBasisPoints,
      0,
      10_000,
      `boss.phase.${phase.phaseId}.enterAtOrBelowHpBasisPoints`,
    )
    if (index === 0 && phase.enterAtOrBelowHpBasisPoints !== 10_000) {
      throw new Error('boss first phase must start at 10000 HP basis points')
    }
    if (phase.enterAtOrBelowHpBasisPoints >= previousThreshold) {
      throw new Error('boss phase HP thresholds must strictly decrease')
    }
    previousThreshold = phase.enterAtOrBelowHpBasisPoints
    if (phase.gimmick.type === 'BARRIER') {
      assertSafeIntegerInRange(
        phase.gimmick.capacity,
        1,
        Number.MAX_SAFE_INTEGER,
        `boss.phase.${phase.phaseId}.gimmick.capacity`,
      )
    } else if (phase.gimmick.type !== 'NONE') {
      throw new Error(`boss phase gimmick is invalid: ${(phase.gimmick as { type: string }).type}`)
    }
    return Object.freeze({
      phaseId: phase.phaseId,
      enterAtOrBelowHpBasisPoints: phase.enterAtOrBelowHpBasisPoints,
      actionSkillIds: normalizeActionSkillIds(
        phase.actionSkillIds,
        knownSkillIds,
        `boss.phase.${phase.phaseId}.actionSkillIds`,
      ),
      gimmick: Object.freeze({ ...phase.gimmick }),
    })
  })
  return Object.freeze({
    bossBattleUnitId: definition.bossBattleUnitId,
    phases: Object.freeze(phases),
  })
}

function getBossUnit(battle: BattleState, bossBattleUnitId: BattleUnitId): BattleUnitState {
  const boss = battle.units.find((unit) => unit.battleUnitId === bossBattleUnitId)
  if (boss === undefined) {
    throw new Error(`boss battle unit does not exist: ${bossBattleUnitId}`)
  }
  return boss
}

function getBossSpecies(
  boss: BattleUnitState,
  speciesById: Readonly<Record<string, MonsterSpecies>>,
): MonsterSpecies {
  const species = speciesById[boss.speciesId]
  if (species === undefined) {
    throw new Error(`boss species master is missing: ${boss.speciesId}`)
  }
  return species
}

function withReplacedUnit(battle: BattleState, unit: BattleUnitState): BattleState {
  const next = Object.freeze({
    ...battle,
    units: Object.freeze(
      battle.units.map((candidate) =>
        candidate.battleUnitId === unit.battleUnitId ? unit : candidate,
      ),
    ),
  })
  assertValidBattleState(next)
  return next
}

export function createBossPhaseRuntimeState(
  definition: BossEncounterDefinition,
  battle: BattleState,
  knownSkillIds: ReadonlySet<string>,
): BossPhaseRuntimeState {
  const normalized = normalizeBossEncounterDefinition(definition, knownSkillIds)
  const boss = getBossUnit(battle, normalized.bossBattleUnitId)
  if (boss.side !== 'ENEMY') {
    throw new Error('boss battle unit must belong to the ENEMY side')
  }
  return Object.freeze({
    bossBattleUnitId: normalized.bossBattleUnitId,
    currentPhaseIndex: 0,
    pendingPhaseIndex: null,
    actionSkillIds: normalized.phases[0].actionSkillIds,
  })
}

export function reserveBossPhaseChange(input: {
  readonly battle: BattleState
  readonly state: BossPhaseRuntimeState
  readonly definition: BossEncounterDefinition
  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly knownSkillIds: ReadonlySet<string>
  readonly currentTime: number
  readonly sequence: number
}): ReserveBossPhaseChangeResult {
  assertSafeIntegerInRange(input.currentTime, 0, Number.MAX_SAFE_INTEGER, 'currentTime')
  assertSafeIntegerInRange(input.sequence, 0, Number.MAX_SAFE_INTEGER, 'sequence')
  const definition = normalizeBossEncounterDefinition(input.definition, input.knownSkillIds)
  if (input.state.bossBattleUnitId !== definition.bossBattleUnitId) {
    throw new Error('boss phase state and definition disagree')
  }
  if (input.state.pendingPhaseIndex !== null) {
    return Object.freeze({
      battle: input.battle,
      state: input.state,
      event: null,
      nextSequence: input.sequence,
    })
  }
  const nextPhaseIndex = input.state.currentPhaseIndex + 1
  const nextPhase = definition.phases[nextPhaseIndex]
  if (nextPhase === undefined) {
    return Object.freeze({
      battle: input.battle,
      state: input.state,
      event: null,
      nextSequence: input.sequence,
    })
  }
  const boss = getBossUnit(input.battle, definition.bossBattleUnitId)
  if (boss.defeated) {
    return Object.freeze({
      battle: input.battle,
      state: input.state,
      event: null,
      nextSequence: input.sequence,
    })
  }
  const species = getBossSpecies(boss, input.speciesById)
  const thresholdReached =
    BigInt(boss.hp) * 10_000n <=
    BigInt(species.stats.hp) * BigInt(nextPhase.enterAtOrBelowHpBasisPoints)
  if (!thresholdReached) {
    return Object.freeze({
      battle: input.battle,
      state: input.state,
      event: null,
      nextSequence: input.sequence,
    })
  }
  const currentPhase = definition.phases[input.state.currentPhaseIndex]
  if (currentPhase === undefined) {
    throw new Error('boss current phase does not exist')
  }
  const payload = Object.freeze({
    bossBattleUnitId: definition.bossBattleUnitId,
    fromPhaseId: currentPhase.phaseId,
    toPhaseId: nextPhase.phaseId,
    toPhaseIndex: nextPhaseIndex,
  })
  const event: ScheduledEvent<BossPhaseChangePayload> = Object.freeze({
    id: `boss-phase:${definition.bossBattleUnitId}:${nextPhase.phaseId}:${input.sequence}`,
    time: input.currentTime,
    priority: -100,
    sequence: input.sequence,
    kind: 'PHASE_CHANGE',
    payload,
  })
  return Object.freeze({
    battle: Object.freeze({
      ...input.battle,
      timeline: pushTimelineEvent(input.battle.timeline, event),
    }),
    state: Object.freeze({ ...input.state, pendingPhaseIndex: nextPhaseIndex }),
    event,
    nextSequence: input.sequence + 1,
  })
}

export function resolveBossPhaseChange(input: {
  readonly battle: BattleState
  readonly state: BossPhaseRuntimeState
  readonly definition: BossEncounterDefinition
  readonly event: ScheduledEvent
  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly knownSkillIds: ReadonlySet<string>
  readonly barrierApplicationSequence: number
}): ResolveBossPhaseChangeResult {
  const definition = normalizeBossEncounterDefinition(input.definition, input.knownSkillIds)
  if (input.event.kind !== 'PHASE_CHANGE') {
    throw new Error('boss phase resolver requires a PHASE_CHANGE event')
  }
  const payload = input.event.payload as BossPhaseChangePayload
  if (
    payload.bossBattleUnitId !== definition.bossBattleUnitId ||
    payload.toPhaseIndex !== input.state.pendingPhaseIndex
  ) {
    throw new Error('boss phase change event does not match pending state')
  }
  const currentPhase = definition.phases[input.state.currentPhaseIndex]
  const nextPhase = definition.phases[payload.toPhaseIndex]
  if (currentPhase === undefined || nextPhase === undefined) {
    throw new Error('boss phase change references an unknown phase')
  }
  if (payload.fromPhaseId !== currentPhase.phaseId || payload.toPhaseId !== nextPhase.phaseId) {
    throw new Error('boss phase change payload and definition disagree')
  }
  let battle = input.battle
  const boss = getBossUnit(battle, definition.bossBattleUnitId)
  if (!boss.defeated && nextPhase.gimmick.type === 'BARRIER') {
    assertSafeIntegerInRange(
      input.barrierApplicationSequence,
      0,
      Number.MAX_SAFE_INTEGER,
      'barrierApplicationSequence',
    )
    const species = getBossSpecies(boss, input.speciesById)
    const update = withAddedBattleUnitBarrier(boss, species, {
      barrierLayerId: `boss-phase-barrier:${boss.battleUnitId}:${nextPhase.phaseId}`,
      sourceBattleUnitId: boss.battleUnitId,
      targetBattleUnitId: boss.battleUnitId,
      capacity: nextPhase.gimmick.capacity,
      applicationSequence: input.barrierApplicationSequence,
    })
    battle = withReplacedUnit(battle, update.state)
  }
  return Object.freeze({
    battle,
    state: Object.freeze({
      bossBattleUnitId: definition.bossBattleUnitId,
      currentPhaseIndex: payload.toPhaseIndex,
      pendingPhaseIndex: null,
      actionSkillIds: nextPhase.actionSkillIds,
    }),
    fromPhaseId: currentPhase.phaseId,
    toPhaseId: nextPhase.phaseId,
    actionSkillIds: nextPhase.actionSkillIds,
    appliedGimmick: nextPhase.gimmick,
  })
}
