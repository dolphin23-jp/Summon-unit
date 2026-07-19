import type { AiDecisionReasonLog } from '../ai/configured-decision'
import type { UnitTurnEventPayload } from '../battle/action-scheduling'
import { getTotalBarrierCapacity } from '../battle/barrier'
import {
  ALL_BOARD_POSITIONS,
  getBoardPositionId,
  type BoardPosition,
} from '../battle/board'
import type { ActiveEffectState } from '../battle/effect-framework'
import type {
  HeadlessBattleDefinition,
  InteractiveBattleSnapshot,
  InteractiveManualActionOption,
} from '../battle/headless-battle-runner'
import type { TelegraphResolvePayload } from '../battle/telegraph'
import type { ScheduledEvent, ScheduledEventKind } from '../battle/timeline-queue'
import type { BattleUnitState } from '../battle/unit-state'
import type { MonsterSpecies } from '../content/monster-species'

export const BATTLE_TIMELINE_LIMIT = 12
export const BATTLE_UNIT_EFFECT_LIMIT = 4

export interface BattleScreenEffectView {
  readonly activeEffectId: string
  readonly effectId: string
  readonly label: string
  readonly stacks: number
  readonly durationLabel: string
}

export interface BattleScreenUnitView {
  readonly battleUnitId: string
  readonly speciesId: string
  readonly side: BattleUnitState['side']
  readonly position: BoardPosition
  readonly positionId: string
  readonly hp: number
  readonly maxHp: number
  readonly barrierTotal: number
  readonly attributeId: string
  readonly attributeLabel: string
  readonly nextActionTime: number | null
  readonly nextActionDelta: number | null
  readonly effects: readonly BattleScreenEffectView[]
  readonly hiddenEffectCount: number
  readonly telegraphCount: number
  readonly defeated: boolean
}

export interface BattleScreenBoardCellView {
  readonly position: BoardPosition
  readonly positionId: string
  readonly telegraphCount: number
  readonly previewRole:
    | 'SELECTED'
    | 'AFFECTED'
    | 'MOVE_DESTINATION'
    | 'FORCED_DESTINATION'
    | null
  readonly previewDamage: number
  readonly previewDefeated: boolean
  readonly unit: BattleScreenUnitView | null
}

export interface BattleTimelineEntryView {
  readonly id: string
  readonly kind: ScheduledEventKind
  readonly time: number
  readonly delta: number
  readonly label: string
  readonly detail: string | null
  readonly actorBattleUnitId: string | null
  readonly positionId: string | null
  readonly reservation: boolean
  readonly provisional: boolean
}

export interface BattleScreenView {
  readonly cells: readonly BattleScreenBoardCellView[]
  readonly timeline: readonly BattleTimelineEntryView[]
  readonly lastDecisionLog: AiDecisionReasonLog | null
}

const ATTRIBUTE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'attribute.neutral': '無',
  'attribute.fire': '火',
  'attribute.water': '水',
  'attribute.wind': '風',
  'attribute.air': '風',
  'attribute.earth': '地',
  'attribute.light': '光',
  'attribute.dark': '闇',
})

const EFFECT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'effect.status.poison': '毒',
  'effect.status.burn': '火傷',
  'effect.status.movement-lock': '移動不能',
  'effect.status.bloom-seal': '開花封印',
  'effect.status.healing-inhibition': '回復阻害',
})

const EFFECT_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  'effect.status.poison': 0,
  'effect.status.burn': 1,
  'effect.status.movement-lock': 2,
  'effect.status.bloom-seal': 3,
  'effect.status.healing-inhibition': 4,
})

function compareIds(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function shortId(id: string): string {
  return id.split('.').at(-1) ?? id
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}

function getSpeciesMap(
  definition: HeadlessBattleDefinition,
): Readonly<Record<string, MonsterSpecies>> {
  const result: Record<string, MonsterSpecies> = {}
  for (const species of definition.species) {
    if (result[species.id] !== undefined) {
      throw new Error(`species ids must be unique: ${species.id}`)
    }
    result[species.id] = species
  }
  return Object.freeze(result)
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

function effectDurationLabel(effect: ActiveEffectState): string {
  if (effect.duration.unit === 'BATTLE') {
    return '戦闘中'
  }
  const remaining = effect.duration.remaining
  switch (effect.duration.unit) {
    case 'TARGET_ACTIONS':
      return `残${remaining}行動`
    case 'SOURCE_ACTIONS':
      return `源残${remaining}行動`
    case 'VIRTUAL_TIME':
      return `残${remaining}t`
    case 'TRIGGERS':
      return `残${remaining}回`
  }
}

function compareEffects(left: ActiveEffectState, right: ActiveEffectState): number {
  const priorityDifference =
    (EFFECT_PRIORITY[left.effectId] ?? 100) - (EFFECT_PRIORITY[right.effectId] ?? 100)
  if (priorityDifference !== 0) {
    return priorityDifference
  }
  if (left.stacks !== right.stacks) {
    return right.stacks - left.stacks
  }
  if (left.strength !== right.strength) {
    return right.strength - left.strength
  }
  if (left.applicationSequence !== right.applicationSequence) {
    return left.applicationSequence - right.applicationSequence
  }
  return compareIds(left.activeEffectId, right.activeEffectId)
}

function createEffectViews(
  effects: readonly ActiveEffectState[],
): readonly BattleScreenEffectView[] {
  return Object.freeze(
    [...effects]
      .sort(compareEffects)
      .slice(0, BATTLE_UNIT_EFFECT_LIMIT)
      .map((effect) =>
        Object.freeze({
          activeEffectId: effect.activeEffectId,
          effectId: effect.effectId,
          label: EFFECT_LABELS[effect.effectId] ?? shortId(effect.effectId),
          stacks: effect.stacks,
          durationLabel: effectDurationLabel(effect),
        }),
      ),
  )
}

function getUnitTurnPayload(event: ScheduledEvent): UnitTurnEventPayload | null {
  if (event.kind !== 'UNIT_TURN' || !isRecord(event.payload)) {
    return null
  }
  const battleUnitId = event.payload.battleUnitId
  const tie = event.payload.tie
  if (typeof battleUnitId !== 'string' || !isRecord(tie)) {
    return null
  }
  return event.payload as unknown as UnitTurnEventPayload
}

function getTelegraphPayload(event: ScheduledEvent): TelegraphResolvePayload | null {
  if (event.kind !== 'TELEGRAPH_RESOLVE' || !isRecord(event.payload)) {
    return null
  }
  if (!Array.isArray(event.payload.targetPositions)) {
    return null
  }
  return event.payload as unknown as TelegraphResolvePayload
}

function getNextActionTime(
  snapshot: InteractiveBattleSnapshot,
  battleUnitId: string,
): number | null {
  for (const event of snapshot.battle.timeline.events) {
    const payload = getUnitTurnPayload(event)
    if (payload?.battleUnitId === battleUnitId) {
      return event.time
    }
  }
  return null
}

function telegraphCountsByPosition(
  snapshot: InteractiveBattleSnapshot,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const event of snapshot.battle.timeline.events) {
    const payload = getTelegraphPayload(event)
    if (payload === null) {
      continue
    }
    for (const position of payload.targetPositions) {
      const positionId = getBoardPositionId(position)
      counts.set(positionId, (counts.get(positionId) ?? 0) + 1)
    }
  }
  return counts
}

function createUnitView(
  definition: HeadlessBattleDefinition,
  snapshot: InteractiveBattleSnapshot,
  speciesById: Readonly<Record<string, MonsterSpecies>>,
  unit: BattleUnitState,
  telegraphCount: number,
): BattleScreenUnitView {
  const species = getRequiredSpecies(speciesById, unit.speciesId)
  const definitionUnit = definition.units.find(
    (candidate) => candidate.battleUnitId === unit.battleUnitId,
  )
  const maxHp = species.stats.hp
  const nextActionTime = getNextActionTime(snapshot, unit.battleUnitId)
  const effects = createEffectViews(unit.effects)
  if (definitionUnit === undefined && unit.sourceInstanceId !== null) {
    throw new Error(`battle definition unit is missing: ${unit.battleUnitId}`)
  }
  return Object.freeze({
    battleUnitId: unit.battleUnitId,
    speciesId: unit.speciesId,
    side: unit.side,
    position: Object.freeze({ ...unit.position }),
    positionId: getBoardPositionId(unit.position),
    hp: unit.hp,
    maxHp,
    barrierTotal: getTotalBarrierCapacity(unit.barriers),
    attributeId: species.attributeId,
    attributeLabel: ATTRIBUTE_LABELS[species.attributeId] ?? shortId(species.attributeId),
    nextActionTime,
    nextActionDelta:
      nextActionTime === null ? null : Math.max(0, nextActionTime - snapshot.currentVirtualTime),
    effects,
    hiddenEffectCount: Math.max(0, unit.effects.length - effects.length),
    telegraphCount,
    defeated: unit.defeated,
  })
}

function timelineLabel(event: ScheduledEvent): {
  readonly label: string
  readonly detail: string | null
  readonly actorBattleUnitId: string | null
  readonly positionId: string | null
} {
  const unitTurn = getUnitTurnPayload(event)
  if (unitTurn !== null) {
    return Object.freeze({
      label: `${shortId(unitTurn.battleUnitId)} 行動`,
      detail: `行動回数 ${unitTurn.tie.actionCount}`,
      actorBattleUnitId: unitTurn.battleUnitId,
      positionId: null,
    })
  }

  const telegraph = getTelegraphPayload(event)
  if (telegraph !== null) {
    const positionIds = telegraph.targetPositions.map(getBoardPositionId)
    return Object.freeze({
      label: `${shortId(telegraph.skillId)} 予兆着弾`,
      detail: positionIds.join(' / '),
      actorBattleUnitId: telegraph.sourceBattleUnitId,
      positionId: positionIds[0] ?? null,
    })
  }

  const payload: Readonly<Record<string, unknown>> = isRecord(event.payload)
    ? event.payload
    : Object.freeze({})
  const actorBattleUnitId =
    typeof payload.battleUnitId === 'string'
      ? payload.battleUnitId
      : typeof payload.sourceBattleUnitId === 'string'
        ? payload.sourceBattleUnitId
        : null
  switch (event.kind) {
    case 'SUMMON':
      return Object.freeze({
        label: '召喚',
        detail: actorBattleUnitId === null ? null : shortId(actorBattleUnitId),
        actorBattleUnitId,
        positionId: null,
      })
    case 'TERRAIN_TRIGGER':
      return Object.freeze({
        label: '設置物・領域発動',
        detail: null,
        actorBattleUnitId,
        positionId: null,
      })
    case 'PHASE_CHANGE':
      return Object.freeze({
        label: 'フェーズ移行',
        detail: null,
        actorBattleUnitId,
        positionId: null,
      })
    case 'UNIT_TURN':
    case 'TELEGRAPH_RESOLVE':
      return Object.freeze({
        label: event.kind,
        detail: null,
        actorBattleUnitId,
        positionId: null,
      })
  }
}

function createTimelineEntry(
  event: ScheduledEvent,
  currentVirtualTime: number,
): BattleTimelineEntryView {
  const presentation = timelineLabel(event)
  return Object.freeze({
    id: event.id,
    kind: event.kind,
    time: event.time,
    delta: Math.max(0, event.time - currentVirtualTime),
    label: presentation.label,
    detail: presentation.detail,
    actorBattleUnitId: presentation.actorBattleUnitId,
    positionId: presentation.positionId,
    reservation: event.kind !== 'UNIT_TURN',
    provisional: false,
  })
}

function createProvisionalTimelineEntry(
  snapshot: InteractiveBattleSnapshot,
  option: InteractiveManualActionOption | null,
): BattleTimelineEntryView | null {
  const pending = snapshot.pendingManualAction
  if (pending === null || option === null) {
    return null
  }
  const actor = snapshot.battle.units.find(
    (unit) => unit.battleUnitId === pending.actorBattleUnitId,
  )
  if (actor === undefined || actor.defeated) {
    return null
  }
  const positionId = option.preview.toPositionId ?? getBoardPositionId(actor.position)
  return Object.freeze({
    id: `provisional:${option.candidateId}`,
    kind: 'UNIT_TURN',
    time: option.preview.nextActionTime,
    delta: Math.max(0, option.preview.nextActionTime - snapshot.currentVirtualTime),
    label: `${shortId(actor.battleUnitId)} 次回行動（仮）`,
    detail: `${option.label}後 / ${positionId} / 順位 ${option.preview.nextTimelineRank ?? '終了'}`,
    actorBattleUnitId: actor.battleUnitId,
    positionId,
    reservation: false,
    provisional: true,
  })
}

function compareTimelineEntries(
  left: BattleTimelineEntryView,
  right: BattleTimelineEntryView,
): number {
  if (left.time !== right.time) {
    return left.time - right.time
  }
  if (left.provisional !== right.provisional) {
    return left.provisional ? 1 : -1
  }
  return compareIds(left.id, right.id)
}

export function createBattleScreenView(
  definition: HeadlessBattleDefinition,
  snapshot: InteractiveBattleSnapshot,
  previewOption: InteractiveManualActionOption | null = null,
): BattleScreenView {
  const speciesById = getSpeciesMap(definition)
  const telegraphs = telegraphCountsByPosition(snapshot)
  const affected = new Set(previewOption?.preview.affectedPositionIds ?? [])
  const damageByUnitId = new Map<string, { readonly hpDamage: number; readonly defeated: boolean }>()
  for (const recipient of previewOption?.preview.damageRecipients ?? []) {
    const previous = damageByUnitId.get(recipient.battleUnitId)
    damageByUnitId.set(recipient.battleUnitId, {
      hpDamage: (previous?.hpDamage ?? 0) + recipient.hpDamage,
      defeated: (previous?.defeated ?? false) || recipient.defeated,
    })
  }
  const forcedDestinations = new Set(
    (previewOption?.preview.forcedMovements ?? []).flatMap((movement) =>
      movement.toPositionId === null ? [] : [movement.toPositionId],
    ),
  )
  const selectedPositionId = previewOption?.selectedTargetPositionId ?? null
  const moveDestinationId =
    previewOption?.kind === 'MOVE' ? previewOption.preview.toPositionId : null

  const cells = ALL_BOARD_POSITIONS.map((position) => {
    const positionId = getBoardPositionId(position)
    const telegraphCount = telegraphs.get(positionId) ?? 0
    const unit =
      snapshot.battle.units.find(
        (candidate) => !candidate.defeated && getBoardPositionId(candidate.position) === positionId,
      ) ?? null
    const unitDamage = unit === null ? undefined : damageByUnitId.get(unit.battleUnitId)
    const previewRole =
      moveDestinationId === positionId
        ? 'MOVE_DESTINATION'
        : forcedDestinations.has(positionId)
          ? 'FORCED_DESTINATION'
          : selectedPositionId === positionId
            ? 'SELECTED'
            : affected.has(positionId)
              ? 'AFFECTED'
              : null
    return Object.freeze({
      position: Object.freeze({ ...position }),
      positionId,
      telegraphCount,
      previewRole,
      previewDamage: unitDamage?.hpDamage ?? 0,
      previewDefeated: unitDamage?.defeated ?? false,
      unit:
        unit === null
          ? null
          : createUnitView(definition, snapshot, speciesById, unit, telegraphCount),
    })
  })

  const timeline = snapshot.battle.timeline.events.map((event) =>
    createTimelineEntry(event, snapshot.currentVirtualTime),
  )
  const provisional = createProvisionalTimelineEntry(snapshot, previewOption)
  if (provisional !== null) {
    timeline.push(provisional)
  }
  timeline.sort(compareTimelineEntries)

  return Object.freeze({
    cells: Object.freeze(cells),
    timeline: Object.freeze(timeline.slice(0, BATTLE_TIMELINE_LIMIT)),
    lastDecisionLog: snapshot.lastDecisionLog,
  })
}
