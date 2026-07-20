import { describe, expect, it } from 'vitest'
import { VERTICAL_SLICE_SKILLS } from './vertical-slice-content'
import {
  VERTICAL_SLICE_SKILL_FX,
  VERTICAL_SLICE_SKILL_FX_VALIDATION,
  resolveSkillFx,
  validateSkillFxCatalog,
  type SkillFxDefinition,
} from './skill-fx'

describe('skill FX master', () => {
  it('validates registered skill ids, presets, colors, and parameters', () => {
    expect(VERTICAL_SLICE_SKILL_FX_VALIDATION).toEqual({ definitions: 3, presets: 3 })
    expect(validateSkillFxCatalog(VERTICAL_SLICE_SKILL_FX, VERTICAL_SLICE_SKILLS)).toEqual(
      VERTICAL_SLICE_SKILL_FX_VALIDATION,
    )
  })

  it('changes a skill presentation through data only', () => {
    const skill = VERTICAL_SLICE_SKILLS.find(
      (candidate) => candidate.id === 'skill.slice.grassfang-bite',
    )
    expect(skill).toBeDefined()
    const custom: readonly SkillFxDefinition[] = Object.freeze([
      Object.freeze({
        skillId: skill!.id,
        preset: 'RIPPLE',
        color: '#123abc',
        durationMs: 777,
        scale: 1.4,
      }),
    ])
    expect(resolveSkillFx(skill, custom)).toMatchObject({
      preset: 'RIPPLE',
      color: '#123abc',
      durationMs: 777,
      scale: 1.4,
    })
  })

  it('rejects unknown presets and unknown skills', () => {
    expect(() =>
      validateSkillFxCatalog(
        [
          {
            skillId: 'skill.slice.grassfang-bite',
            preset: 'UNKNOWN',
            color: '#123abc',
            durationMs: 300,
            scale: 1,
          } as unknown as SkillFxDefinition,
        ],
        VERTICAL_SLICE_SKILLS,
      ),
    ).toThrow(/preset/)
    expect(() =>
      validateSkillFxCatalog(
        [
          {
            skillId: 'skill.unknown',
            preset: 'SLASH',
            color: '#123abc',
            durationMs: 300,
            scale: 1,
          },
        ],
        VERTICAL_SLICE_SKILLS,
      ),
    ).toThrow(/unknown skill/)
  })
})
