import type { SkillDefinition } from './skill-definition'
import { resolveSkillAreaMask, resolveSkillReachMethod } from './skill-definition'
import { VERTICAL_SLICE_SKILLS } from './vertical-slice-content'

export const SKILL_FX_PRESETS = ['SLASH', 'PROJECTILE', 'RIPPLE'] as const
export type SkillFxPreset = (typeof SKILL_FX_PRESETS)[number]

export interface SkillFxDefinition {
  readonly skillId: string
  readonly preset: SkillFxPreset
  readonly color: string
  readonly durationMs: number
  readonly scale: number
}

export interface SkillFxValidationSummary {
  readonly definitions: number
  readonly presets: number
}

function defineSkillFx(definition: SkillFxDefinition): SkillFxDefinition {
  return Object.freeze({ ...definition })
}

export const VERTICAL_SLICE_SKILL_FX: readonly SkillFxDefinition[] = Object.freeze([
  defineSkillFx({
    skillId: 'skill.slice.grassfang-bite',
    preset: 'SLASH',
    color: '#88d8a8',
    durationMs: 360,
    scale: 1,
  }),
  defineSkillFx({
    skillId: 'skill.slice.windwing-line-needle',
    preset: 'PROJECTILE',
    color: '#8ce6d0',
    durationMs: 420,
    scale: 0.9,
  }),
  defineSkillFx({
    skillId: 'skill.slice.moss-drop',
    preset: 'RIPPLE',
    color: '#a7df9b',
    durationMs: 520,
    scale: 1.15,
  }),
])

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`${field} must be non-empty`)
}

function assertValidDefinition(definition: SkillFxDefinition, index: number): void {
  const field = `skillFx[${index}]`
  assertNonEmpty(definition.skillId, `${field}.skillId`)
  if (!SKILL_FX_PRESETS.includes(definition.preset)) {
    throw new Error(`${field}.preset is invalid`)
  }
  if (!/^#[0-9a-f]{6}$/i.test(definition.color)) {
    throw new Error(`${field}.color must be a six-digit hex color`)
  }
  if (!Number.isSafeInteger(definition.durationMs) || definition.durationMs < 80 || definition.durationMs > 2_000) {
    throw new Error(`${field}.durationMs must be an integer between 80 and 2000`)
  }
  if (!Number.isFinite(definition.scale) || definition.scale < 0.5 || definition.scale > 2.5) {
    throw new Error(`${field}.scale must be between 0.5 and 2.5`)
  }
}

export function validateSkillFxCatalog(
  definitions: readonly SkillFxDefinition[],
  skills: readonly Pick<SkillDefinition, 'id'>[],
): SkillFxValidationSummary {
  const knownSkillIds = new Set(skills.map((skill) => skill.id))
  const seen = new Set<string>()
  definitions.forEach((definition, index) => {
    assertValidDefinition(definition, index)
    if (seen.has(definition.skillId)) {
      throw new Error(`skillFx skillId must be unique: ${definition.skillId}`)
    }
    if (!knownSkillIds.has(definition.skillId)) {
      throw new Error(`skillFx references unknown skill: ${definition.skillId}`)
    }
    seen.add(definition.skillId)
  })
  return Object.freeze({ definitions: definitions.length, presets: SKILL_FX_PRESETS.length })
}

export function resolveAttributeFxColor(attributeId: string | undefined): string {
  const key = attributeId?.split('.').at(-1) ?? 'neutral'
  const colors: Readonly<Record<string, string>> = Object.freeze({
    fire: '#ff7a5c',
    water: '#6bb6ff',
    wind: '#79d8ae',
    air: '#79d8ae',
    earth: '#d0a66b',
    light: '#ffe99b',
    dark: '#ba91e8',
    neutral: '#d5e2ea',
  })
  return colors[key] ?? colors.neutral
}

export function resolveSkillFx(
  skill: SkillDefinition | undefined,
  definitions: readonly SkillFxDefinition[] = VERTICAL_SLICE_SKILL_FX,
): SkillFxDefinition {
  if (skill !== undefined) {
    const registered = definitions.find((definition) => definition.skillId === skill.id)
    if (registered !== undefined) return registered
  }

  const preset: SkillFxPreset =
    skill === undefined
      ? 'SLASH'
      : resolveSkillAreaMask(skill) !== 'SINGLE'
        ? 'RIPPLE'
        : ['DIRECT', 'ARC', 'SNIPE', 'GLOBAL'].includes(resolveSkillReachMethod(skill))
          ? 'PROJECTILE'
          : resolveSkillReachMethod(skill) === 'SELF'
            ? 'RIPPLE'
            : 'SLASH'

  return Object.freeze({
    skillId: skill?.id ?? 'skill.fx.generic',
    preset,
    color: resolveAttributeFxColor(skill?.attributeId),
    durationMs: preset === 'RIPPLE' ? 520 : preset === 'PROJECTILE' ? 420 : 360,
    scale: 1,
  })
}

export const VERTICAL_SLICE_SKILL_FX_VALIDATION = validateSkillFxCatalog(
  VERTICAL_SLICE_SKILL_FX,
  VERTICAL_SLICE_SKILLS,
)
