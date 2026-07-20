import type {
  HeadlessBattleDefinition,
  HeadlessBattleRunResult,
} from '../battle/headless-battle-runner'
import {
  ALL_BOARD_POSITIONS,
  getBoardPositionId,
  type BoardPosition,
} from '../battle/board'
import { getTotalBarrierCapacity } from '../battle/barrier'
import type { BattleEvent } from '../battle/event-log'
import type { BattleOutcome } from '../battle/defeat-and-victory'

export interface BattleReplayUnit {
  readonly battleUnitId: string
  readonly speciesId: string
  readonly side: BoardPosition['side']
  readonly position: BoardPosition
  readonly positionId: string
  readonly hp: number
  readonly maxHp: number
  readonly barrierTotal: number
  readonly defeated: boolean
}

export interface BattleReplayFrame {
  readonly eventIndex: number
  readonly virtualTime: number
  readonly outcome: BattleOutcome
  readonly units: readonly BattleReplayUnit[]
}

export interface BattleReplay {
  readonly frames: readonly BattleReplayFrame[]
  readonly events: readonly BattleEvent[]
}

export interface BattleReplayBoardCell {
  readonly position: BoardPosition
  readonly positionId: string
  readonly unit: BattleReplayUnit | null
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function freezePosition(position: BoardPosition): BoardPosition {
  return Object.freeze({ ...position })
}

function freezeUnit(unit: BattleReplayUnit): BattleReplayUnit {
  return Object.freeze({
    ...unit,
    position: freezePosition(unit.position),
  })
}

function freezeFrame(frame: BattleReplayFrame): BattleReplayFrame {
  return Object.freeze({
    ...frame,
    units: Object.freeze(frame.units.map(freezeUnit)),
  })
}

function parsePositionId(positionId: string): BoardPosition {
  const match = /^(ALLY|ENEMY):([0-2]):([0-2])$/.exec(positionId)
  if (match === null) {
    throw new Error(`invalid board position id: ${positionId}`)
  }
  return Object.freeze({
    side: match[1] as BoardPosition['side'],
    row: Number(match[2]) as BoardPosition['row'],
    column: Number(match[3]) as BoardPosition['column'],
  })
}

function createSpeciesHpMap(
  definition: HeadlessBattleDefinition,
): Readonly<Record<string, number>> {
  const hpBySpeciesId: Record<string, number> = {}
  for (const species of definition.species) {
    if (hpBySpeciesId[species.id] !== undefined) {
      throw new Error(`species ids must be unique: ${species.id}`)
    }
    hpBySpeciesId[species.id] = species.stats.hp
  }
  return Object.freeze(hpBySpeciesId)
}

export function createInitialBattleReplayFrame(
  definition: HeadlessBattleDefinition,
): BattleReplayFrame {
  const hpBySpeciesId = createSpeciesHpMap(definition)
  const seenUnitIds = new Set<string>()
  const units = definition.units.map((unitDefinition) => {
    if (seenUnitIds.has(unitDefinition.battleUnitId)) {
      throw new Error(
        `battleUnitId must be unique: ${unitDefinition.battleUnitId}`,
      )
    }
    seenUnitIds.add(unitDefinition.battleUnitId)

    const maxHp = hpBySpeciesId[unitDefinition.speciesId]
    if (maxHp === undefined) {
      throw new Error(`species master is missing: ${unitDefinition.speciesId}`)
    }
    const hp = unitDefinition.initialHp ?? maxHp
    return freezeUnit({
      battleUnitId: unitDefinition.battleUnitId,
      speciesId: unitDefinition.speciesId,
      side: unitDefinition.position.side,
      position: unitDefinition.position,
      positionId: getBoardPositionId(unitDefinition.position),
      hp,
      maxHp,
      barrierTotal: getTotalBarrierCapacity(unitDefinition.initialBarriers ?? []),
      defeated: hp === 0,
    })
  })

  units.sort((left, right) => compareIds(left.battleUnitId, right.battleUnitId))
  return freezeFrame({
    eventIndex: 0,
    virtualTime: 0,
    outcome: 'ONGOING',
    units,
  })
}

function updateUnit(
  units: readonly BattleReplayUnit[],
  battleUnitId: string,
  update: (unit: BattleReplayUnit) => BattleReplayUnit,
): readonly BattleReplayUnit[] {
  let found = false
  const nextUnits = units.map((unit) => {
    if (unit.battleUnitId !== battleUnitId) {
      return unit
    }
    found = true
    return freezeUnit(update(unit))
  })
  if (!found) {
    throw new Error(`replay unit is missing: ${battleUnitId}`)
  }
  return Object.freeze(nextUnits)
}

export function applyBattleEventToReplayFrame(
  frame: BattleReplayFrame,
  event: BattleEvent,
): BattleReplayFrame {
  if (event.sequence !== frame.eventIndex) {
    throw new Error('battle replay events must be applied in sequence order')
  }
  if (event.virtualTime < frame.virtualTime) {
    throw new Error('battle replay virtualTime must not move backwards')
  }

  let units = frame.units
  let outcome = frame.outcome
  switch (event.kind) {
    case 'unit_moved': {
      const position = parsePositionId(event.payload.toPositionId)
      units = updateUnit(units, event.payload.battleUnitId, (unit) => ({
        ...unit,
        side: position.side,
        position,
        positionId: event.payload.toPositionId,
      }))
      break
    }
    case 'barrier_absorbed':
      units = updateUnit(units, event.payload.targetBattleUnitId, (unit) => ({
        ...unit,
        barrierTotal: Math.max(0, unit.barrierTotal - event.payload.absorbedDamage),
      }))
      break
    case 'damage_applied':
      units = updateUnit(units, event.payload.targetBattleUnitId, (unit) => ({
        ...unit,
        hp: event.payload.hpAfter,
      }))
      break
    case 'healing_applied':
      units = updateUnit(units, event.payload.targetBattleUnitId, (unit) => ({
        ...unit,
        hp: event.payload.hpAfter,
      }))
      break
    case 'unit_defeated':
      units = updateUnit(units, event.payload.defeatedBattleUnitId, (unit) => ({
        ...unit,
        hp: 0,
        defeated: true,
      }))
      break
    case 'battle_ended':
      outcome = event.payload.outcome
      break
    case 'battle_started':
    case 'turn_started':
    case 'skill_used':
    case 'guard_shared':
    case 'effect_applied':
    case 'effect_merged':
    case 'effect_removed':
      break
  }

  return freezeFrame({
    eventIndex: frame.eventIndex + 1,
    virtualTime: event.virtualTime,
    outcome,
    units,
  })
}

function assertReplayMatchesResult(
  frame: BattleReplayFrame,
  result: HeadlessBattleRunResult,
): void {
  if (frame.eventIndex !== result.log.events.length) {
    throw new Error('final replay event index must match the event log length')
  }
  if (frame.virtualTime !== result.summary.finalVirtualTime) {
    throw new Error('final replay virtualTime must match the headless summary')
  }
  if (frame.outcome !== result.summary.outcome) {
    throw new Error('final replay outcome must match the headless summary')
  }
  if (frame.units.length !== result.summary.units.length) {
    throw new Error('final replay unit count must match the headless summary')
  }

  for (const summaryUnit of result.summary.units) {
    const replayUnit = frame.units.find(
      (candidate) => candidate.battleUnitId === summaryUnit.battleUnitId,
    )
    if (replayUnit === undefined) {
      throw new Error(`final replay unit is missing: ${summaryUnit.battleUnitId}`)
    }
    if (
      replayUnit.hp !== summaryUnit.hp ||
      replayUnit.barrierTotal !== summaryUnit.barrierTotal ||
      replayUnit.defeated !== summaryUnit.defeated ||
      replayUnit.positionId !== summaryUnit.positionId
    ) {
      throw new Error(`final replay unit state does not match: ${summaryUnit.battleUnitId}`)
    }
  }
}

export function createBattleReplay(
  definition: HeadlessBattleDefinition,
  result: HeadlessBattleRunResult,
): BattleReplay {
  const frames: BattleReplayFrame[] = [createInitialBattleReplayFrame(definition)]
  for (const event of result.log.events) {
    const currentFrame = frames.at(-1)
    if (currentFrame === undefined) {
      throw new Error('battle replay requires an initial frame')
    }
    frames.push(applyBattleEventToReplayFrame(currentFrame, event))
  }
  const finalFrame = frames.at(-1)
  if (finalFrame === undefined) {
    throw new Error('battle replay requires a final frame')
  }
  assertReplayMatchesResult(finalFrame, result)
  return Object.freeze({
    frames: Object.freeze(frames),
    events: result.log.events,
  })
}

export function getBattleReplayBoardCells(
  frame: BattleReplayFrame,
): readonly BattleReplayBoardCell[] {
  return Object.freeze(
    ALL_BOARD_POSITIONS.map((position) => {
      const positionId = getBoardPositionId(position)
      const unit =
        frame.units.find(
          (candidate) =>
            !candidate.defeated && candidate.positionId === positionId,
        ) ?? null
      return Object.freeze({
        position: freezePosition(position),
        positionId,
        unit,
      })
    }),
  )
}

function shortId(id: string): string {
  return id.split('.').at(-1) ?? id
}

export function formatBattleEventForDisplay(event: BattleEvent): string {
  switch (event.kind) {
    case 'battle_started':
      return '戦闘開始'
    case 'turn_started':
      return `${shortId(event.payload.battleUnitId)}の行動開始`
    case 'unit_moved':
      return `${shortId(event.payload.battleUnitId)}が${event.payload.fromPositionId}から${event.payload.toPositionId}へ移動`
    case 'skill_used':
      return `${shortId(event.payload.actorBattleUnitId)}が${shortId(event.payload.skillId)}を${shortId(event.payload.targetBattleUnitId)}へ使用`
    case 'guard_shared':
      return `${shortId(event.payload.guardBattleUnitId)}が${event.payload.redirectedDamage}ダメージを肩代わり`
    case 'barrier_absorbed':
      return `${shortId(event.payload.targetBattleUnitId)}の障壁が${event.payload.absorbedDamage}吸収${event.payload.broken ? '・破壊' : ''}`
    case 'damage_applied':
      return `${shortId(event.payload.targetBattleUnitId)}に${event.payload.appliedDamage}ダメージ（HP ${event.payload.hpAfter}）`
    case 'healing_applied':
      return `${shortId(event.payload.targetBattleUnitId)}を${event.payload.appliedHealing}回復（過剰 ${event.payload.overheal} / HP ${event.payload.hpAfter}）`
    case 'effect_applied':
      return `${shortId(event.payload.targetBattleUnitId)}に${shortId(event.payload.effectId)}を付与`
    case 'effect_merged':
      return `${shortId(event.payload.targetBattleUnitId)}の${shortId(event.payload.effectId)}を更新`
    case 'effect_removed':
      return `${shortId(event.payload.targetBattleUnitId)}の${shortId(event.payload.effectId)}を解除`
    case 'unit_defeated':
      return `${shortId(event.payload.defeatedBattleUnitId)}が戦闘不能`
    case 'battle_ended':
      return event.payload.outcome === 'ALLY_VICTORY' ? '味方勝利' : '味方敗北'
  }
}
