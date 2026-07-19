import { describe, expect, it } from 'vitest'
import {
  VERTICAL_SLICE_BLOOM_RESEARCH_DEFINITIONS,
  VERTICAL_SLICE_CONTENT_VALIDATION,
  VERTICAL_SLICE_GENERIC_SKILL_COSTS,
  VERTICAL_SLICE_MONSTER_RECORDS,
  VERTICAL_SLICE_PASSIVE_TRAITS,
  VERTICAL_SLICE_SKILL_RECORDS,
  validateVerticalSliceContent,
} from './vertical-slice-content'

describe('T044 vertical slice content', () => {
  it('contains the fixed 16-monster rarity distribution', () => {
    expect(
      VERTICAL_SLICE_MONSTER_RECORDS.map((record) => [
        record.displayName,
        record.definition.rarity,
      ]),
    ).toEqual([
      ['草牙ネズミ', 1],
      ['風羽虫', 1],
      ['苔芽', 1],
      ['泥殻虫', 1],
      ['火種トカゲ', 1],
      ['古歯車', 1],
      ['疾風狼', 2],
      ['岩甲虫', 2],
      ['火花鳥', 2],
      ['苔癒し', 2],
      ['鉄角獣', 3],
      ['毒針蛾', 3],
      ['炎機兵', 3],
      ['溶岩甲獣', 4],
      ['風樹祭司', 4],
      ['災炎翼竜', 5],
    ])
  })

  it('provides one authoring ticket, passive trait, innate skill, and bloom skill per monster', () => {
    expect(VERTICAL_SLICE_MONSTER_RECORDS).toHaveLength(16)
    expect(VERTICAL_SLICE_PASSIVE_TRAITS).toHaveLength(16)
    expect(
      VERTICAL_SLICE_SKILL_RECORDS.filter((record) => record.tier === 'INNATE'),
    ).toHaveLength(16)
    expect(
      VERTICAL_SLICE_SKILL_RECORDS.filter((record) => record.tier === 'BLOOM'),
    ).toHaveLength(16)
    expect(VERTICAL_SLICE_BLOOM_RESEARCH_DEFINITIONS).toHaveLength(16)

    for (const record of VERTICAL_SLICE_MONSTER_RECORDS) {
      expect(record.roleSentence.length).toBeGreaterThan(0)
      expect(record.strengths.length).toBeGreaterThan(0)
      expect(record.weaknesses.length).toBeGreaterThan(0)
      expect(record.counterplay.length).toBeGreaterThan(0)
      expect(record.testedMechanicIds.length).toBeGreaterThan(0)
      expect(record.definition.passiveTraitIds).toHaveLength(1)
      expect(record.definition.bloomSkillIds).toHaveLength(1)
    }
  })

  it('contains five T1 and five T2 generic skills inside the 70-90% efficiency band', () => {
    const generic = VERTICAL_SLICE_SKILL_RECORDS.filter((record) =>
      record.tier.startsWith('GENERIC'),
    )
    expect(generic.filter((record) => record.tier === 'GENERIC_T1')).toHaveLength(5)
    expect(generic.filter((record) => record.tier === 'GENERIC_T2')).toHaveLength(5)
    expect(Object.keys(VERTICAL_SLICE_GENERIC_SKILL_COSTS)).toHaveLength(10)
    for (const record of generic) {
      expect(record.efficiencyBasisPoints).toBeGreaterThanOrEqual(7000)
      expect(record.efficiencyBasisPoints).toBeLessThanOrEqual(9000)
      expect(VERTICAL_SLICE_GENERIC_SKILL_COSTS[record.definition.id]).toBeGreaterThan(0)
    }
  })

  it('returns the fixed T044 validation summary', () => {
    expect(VERTICAL_SLICE_CONTENT_VALIDATION).toEqual({
      species: 16,
      skills: 42,
      genericSkillCosts: 10,
      researchNodes: 0,
      finalResearchDefinitions: 0,
      bloomResearchDefinitions: 16,
      researchFacilityStages: 0,
      regions: 0,
      stages: 0,
      bossStages: 0,
      passiveTraits: 16,
      authoredMonsters: 16,
      authoredSkills: 42,
      innateSkills: 16,
      bloomSkills: 16,
      genericTier1Skills: 5,
      genericTier2Skills: 5,
    })
  })

  it('is byte-stable across 100 validations', () => {
    const expected = JSON.stringify(validateVerticalSliceContent())
    for (let run = 0; run < 100; run += 1) {
      expect(JSON.stringify(validateVerticalSliceContent())).toBe(expected)
    }
  })
})
