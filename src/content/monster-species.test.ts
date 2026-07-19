import { describe, expect, it } from 'vitest'
import { getStatusResistanceTagId } from './status-resistance'
import { assertValidMonsterSpecies, type MonsterSpecies } from './monster-species'

const validSpecies: MonsterSpecies = {
  id: 'species.grass-fang-rat',
  rarity: 1,
  attributeId: 'attribute.wind',
  primarySpeciesId: 'species-group.beast',
  tagIds: ['tag.beast'],
  stats: { hp: 120, attack: 30, defense: 20, speed: 3 },
  innateSkillId: 'skill.razor-claw',
}

const invalidCases: readonly (readonly [MonsterSpecies, string])[] = [
  [{ ...validSpecies, id: '' }, 'species.id must be a non-empty string'],
  [
    { ...validSpecies, rarity: 11 } as unknown as MonsterSpecies,
    'species.rarity must be less than or equal to 10',
  ],
  [
    { ...validSpecies, attributeId: 'attribute.ice' } as unknown as MonsterSpecies,
    'attributeId is invalid: attribute.ice',
  ],
  [
    { ...validSpecies, stats: { ...validSpecies.stats, attack: -1 } },
    'species.stats.attack must be an integer greater than or equal to 0',
  ],
  [
    { ...validSpecies, stats: { ...validSpecies.stats, speed: 0 } },
    'species.stats.speed must be an integer greater than or equal to 1',
  ],
  [{ ...validSpecies, tagIds: [''] }, 'species.tagIds[] must be a non-empty string'],
  [
    {
      ...validSpecies,
      tagIds: [
        getStatusResistanceTagId('poison', 'STRONG'),
        getStatusResistanceTagId('poison', 'WEAK'),
      ],
    },
    'status resistance tags conflict for poison',
  ],
  [
    { ...validSpecies, innateSkillId: '' },
    'species.innateSkillId must be a non-empty string',
  ],
]

describe('monster species validation', () => {
  it('accepts the minimal valid master data', () => {
    expect(() => assertValidMonsterSpecies(validSpecies)).not.toThrow()
  })

  it('accepts the legacy air id as the wind attribute during migration', () => {
    expect(() =>
      assertValidMonsterSpecies({ ...validSpecies, attributeId: 'attribute.air' }),
    ).not.toThrow()
  })

  it.each(invalidCases)('rejects invalid master data', (invalidSpecies, message) => {
    expect(() => assertValidMonsterSpecies(invalidSpecies)).toThrow(message)
  })
})
