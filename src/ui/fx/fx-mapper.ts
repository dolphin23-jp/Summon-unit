import type { BattleEvent } from '../../battle/event-log'
import type { SkillDefinition } from '../../content/skill-definition'
import {
  resolveAttributeFxColor,
  resolveSkillFx,
  type SkillFxDefinition,
  type SkillFxPreset,
} from '../../content/skill-fx'
import type { BattleMotionLevel } from '../battle-accessibility'

export const FX_COMMAND_KINDS = [
  'FLOAT_TEXT',
  'HIT_FLASH',
  'MOVE',
  'DEFEAT',
  'REVIVE',
  'ACTOR_FOCUS',
  'SKILL_PRESET',
] as const
export type FxCommandKind = (typeof FX_COMMAND_KINDS)[number]
export type FxTone = 'DAMAGE' | 'HEALING' | 'BARRIER' | 'STATUS' | 'NEUTRAL'

export interface FxCommand {
  readonly id: string
  readonly eventId: string
  readonly kind: FxCommandKind
  readonly positionId: string | null
  readonly fromPositionId: string | null
  readonly toPositionId: string | null
  readonly text: string | null
  readonly tone: FxTone
  readonly color: string
  readonly durationMs: number
  readonly scale: number
  readonly preset: SkillFxPreset | null
  readonly compact: boolean
}

export interface FxMapperOptions {
  readonly motionLevel: BattleMotionLevel
  readonly playbackRate?: number
  readonly skipAnimations?: boolean
  readonly positionIdByBattleUnitId: Readonly<Record<string, string>>
  readonly skills: readonly SkillDefinition[]
  readonly skillFx?: readonly SkillFxDefinition[]
}

function command(
  event: BattleEvent,
  suffix: string,
  fields: Omit<FxCommand, 'id' | 'eventId'>,
): FxCommand {
  return Object.freeze({ id: `fx:${event.id}:${suffix}`, eventId: event.id, ...fields })
}

function duration(base: number, playbackRate: number): number {
  return Math.max(80, Math.round(base / Math.max(1, playbackRate)))
}

function targetPosition(options: FxMapperOptions, battleUnitId: string | null): string | null {
  if (battleUnitId === null) return null
  return options.positionIdByBattleUnitId[battleUnitId] ?? null
}

function skillById(options: FxMapperOptions, skillId: string | null): SkillDefinition | undefined {
  if (skillId === null) return undefined
  return options.skills.find((skill) => skill.id === skillId)
}

function effectLabel(effectId: string): string {
  const key = effectId.toLowerCase()
  if (key.includes('poison')) return '毒'
  if (key.includes('burn')) return '火傷'
  if (key.includes('heal') || key.includes('regen')) return '再生'
  if (key.includes('guard')) return '防御'
  if (key.includes('slow') || key.includes('delay')) return '遅延'
  if (key.includes('cleanse')) return '浄化'
  return '状態'
}

function mapEvent(event: BattleEvent, options: FxMapperOptions): readonly FxCommand[] {
  const rate = options.playbackRate ?? 1
  switch (event.kind) {
    case 'battle_started':
    case 'battle_ended':
      return []
    case 'turn_started': {
      const positionId = targetPosition(options, event.payload.battleUnitId)
      if (positionId === null) return []
      return [
        command(event, 'focus', {
          kind: 'ACTOR_FOCUS',
          positionId,
          fromPositionId: null,
          toPositionId: null,
          text: null,
          tone: 'NEUTRAL',
          color: '#f8df82',
          durationMs: duration(520, rate),
          scale: 1,
          preset: null,
          compact: false,
        }),
      ]
    }
    case 'unit_moved':
      return [
        command(event, 'move', {
          kind: 'MOVE',
          positionId: event.payload.toPositionId,
          fromPositionId: event.payload.fromPositionId,
          toPositionId: event.payload.toPositionId,
          text: null,
          tone: 'NEUTRAL',
          color: '#b7d9e7',
          durationMs: duration(360, rate),
          scale: 1,
          preset: null,
          compact: false,
        }),
      ]
    case 'skill_used': {
      const skill = skillById(options, event.payload.skillId)
      const presentation = resolveSkillFx(skill, options.skillFx)
      const actorPosition = targetPosition(options, event.payload.actorBattleUnitId)
      const target = targetPosition(options, event.payload.targetBattleUnitId)
      if (target === null) return []
      return [
        command(event, 'skill', {
          kind: 'SKILL_PRESET',
          positionId: target,
          fromPositionId: actorPosition,
          toPositionId: target,
          text: null,
          tone: 'NEUTRAL',
          color: presentation.color,
          durationMs: duration(presentation.durationMs, rate),
          scale: presentation.scale,
          preset: presentation.preset,
          compact: false,
        }),
      ]
    }
    case 'guard_shared': {
      const positionId = targetPosition(options, event.payload.protectedBattleUnitId)
      if (positionId === null) return []
      return [
        command(event, 'guard', {
          kind: 'FLOAT_TEXT',
          positionId,
          fromPositionId: null,
          toPositionId: null,
          text: `かばう ${event.payload.redirectedDamage}`,
          tone: 'BARRIER',
          color: '#8bd5ff',
          durationMs: duration(620, rate),
          scale: 0.82,
          preset: null,
          compact: true,
        }),
      ]
    }
    case 'barrier_absorbed': {
      const positionId = targetPosition(options, event.payload.targetBattleUnitId)
      if (positionId === null) return []
      return [
        command(event, 'barrier', {
          kind: 'FLOAT_TEXT',
          positionId,
          fromPositionId: null,
          toPositionId: null,
          text: `吸収 ${event.payload.absorbedDamage}`,
          tone: 'BARRIER',
          color: '#79c8ff',
          durationMs: duration(680, rate),
          scale: 0.9,
          preset: null,
          compact: false,
        }),
        command(event, 'barrier-flash', {
          kind: 'HIT_FLASH',
          positionId,
          fromPositionId: null,
          toPositionId: null,
          text: null,
          tone: 'BARRIER',
          color: '#79c8ff',
          durationMs: duration(300, rate),
          scale: 1,
          preset: null,
          compact: false,
        }),
      ]
    }
    case 'damage_applied': {
      const positionId = targetPosition(options, event.payload.targetBattleUnitId)
      if (positionId === null) return []
      const skill = skillById(options, event.payload.skillId)
      const color = resolveAttributeFxColor(skill?.attributeId)
      const text =
        event.payload.appliedDamage === 0
          ? '無効'
          : event.payload.appliedDamage < event.payload.calculatedDamage
            ? `-${event.payload.appliedDamage} 軽減`
            : `-${event.payload.appliedDamage}`
      return [
        command(event, 'damage', {
          kind: 'FLOAT_TEXT',
          positionId,
          fromPositionId: null,
          toPositionId: null,
          text,
          tone: 'DAMAGE',
          color,
          durationMs: duration(event.payload.skillId === null ? 520 : 720, rate),
          scale: event.payload.skillId === null ? 0.72 : 1,
          preset: null,
          compact: event.payload.skillId === null,
        }),
        command(event, 'hit', {
          kind: 'HIT_FLASH',
          positionId,
          fromPositionId: null,
          toPositionId: null,
          text: null,
          tone: 'DAMAGE',
          color,
          durationMs: duration(260, rate),
          scale: 1,
          preset: null,
          compact: false,
        }),
      ]
    }
    case 'healing_applied': {
      const positionId = targetPosition(options, event.payload.targetBattleUnitId)
      if (positionId === null) return []
      const commands: FxCommand[] = [
        command(event, 'healing', {
          kind: 'FLOAT_TEXT',
          positionId,
          fromPositionId: null,
          toPositionId: null,
          text: `+${event.payload.appliedHealing}`,
          tone: 'HEALING',
          color: '#82e3a3',
          durationMs: duration(760, rate),
          scale: 1,
          preset: null,
          compact: false,
        }),
      ]
      if (event.payload.hpBefore === 0 && event.payload.appliedHealing > 0) {
        commands.push(
          command(event, 'revive', {
            kind: 'REVIVE',
            positionId,
            fromPositionId: null,
            toPositionId: null,
            text: null,
            tone: 'HEALING',
            color: '#82e3a3',
            durationMs: duration(680, rate),
            scale: 1,
            preset: null,
            compact: false,
          }),
        )
      }
      return commands
    }
    case 'effect_applied':
    case 'effect_merged':
    case 'effect_removed': {
      const positionId = targetPosition(options, event.payload.targetBattleUnitId)
      if (positionId === null) return []
      const removed = event.kind === 'effect_removed'
      return [
        command(event, removed ? 'effect-removed' : 'effect', {
          kind: 'FLOAT_TEXT',
          positionId,
          fromPositionId: null,
          toPositionId: null,
          text: removed
            ? `${effectLabel(event.payload.effectId)}解除`
            : effectLabel(event.payload.effectId),
          tone: 'STATUS',
          color: event.payload.effectId.toLowerCase().includes('burn') ? '#ff886d' : '#c89be8',
          durationMs: duration(560, rate),
          scale: 0.72,
          preset: null,
          compact: true,
        }),
      ]
    }
    case 'unit_defeated': {
      const positionId = targetPosition(options, event.payload.defeatedBattleUnitId)
      if (positionId === null) return []
      return [
        command(event, 'defeat', {
          kind: 'DEFEAT',
          positionId,
          fromPositionId: null,
          toPositionId: null,
          text: '撃破',
          tone: 'DAMAGE',
          color: '#eef4f7',
          durationMs: duration(760, rate),
          scale: 1,
          preset: null,
          compact: false,
        }),
      ]
    }
  }
}

const REDUCED_KINDS = new Set<FxCommandKind>(['FLOAT_TEXT', 'ACTOR_FOCUS', 'HIT_FLASH'])

export function mapBattleEventsToFxCommands(
  events: readonly BattleEvent[],
  options: FxMapperOptions,
): readonly FxCommand[] {
  if (options.motionLevel === 'MINIMAL' || options.skipAnimations) return Object.freeze([])
  const mapped = events.flatMap((event) => mapEvent(event, options))
  const filtered =
    options.motionLevel === 'REDUCED'
      ? mapped.filter((item) => REDUCED_KINDS.has(item.kind))
      : mapped
  return Object.freeze(filtered.map((item) => Object.freeze({ ...item })))
}
