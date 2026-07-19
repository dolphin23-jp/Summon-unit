import type { SkillId } from './skill-definition'
import { assertValidAttributeId, type AttributeInputId } from './attribute'
import { assertValidStatusResistanceTags } from './status-resistance'

export type SpeciesId = string

export type MonsterRarity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export interface MonsterStats {
  readonly hp: number
  readonly attack: number
  readonly defense: number
  readonly speed: number
}

export interface MonsterSpecies {
  readonly id: SpeciesId
  readonly rarity: MonsterRarity
  readonly attributeId: AttributeInputId
  readonly primarySpeciesId: string
  readonly tagIds: readonly string[]
  readonly stats: MonsterStats
  readonly innateSkillId: SkillId
  readonly bloomSkillIds?: readonly SkillId[]
  readonly passiveTraitIds?: readonly string[]
}

function assertNonEmptyString(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
}

function assertIntegerAtLeast(value: number, minimum: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${fieldName} must be an integer greater than or equal to ${minimum}`)
  }
}

function assertUniqueIds(ids: readonly string[], fieldName: string): void {
  const seen = new Set<string>()
  for (const id of ids) {
    assertNonEmptyString(id, `${fieldName}[]`)
    if (seen.has(id)) {
      throw new Error(`${fieldName} must not contain duplicates: ${id}`)
    }
    seen.add(id)
  }
}

export function assertValidMonsterSpecies(species: MonsterSpecies): void {
  assertNonEmptyString(species.id, 'species.id')
  assertValidAttributeId(species.attributeId)
  assertNonEmptyString(species.primarySpeciesId, 'species.primarySpeciesId')
  assertNonEmptyString(species.innateSkillId, 'species.innateSkillId')
  assertIntegerAtLeast(species.rarity, 1, 'species.rarity')

  if (species.rarity > 10) {
    throw new Error('species.rarity must be less than or equal to 10')
  }

  assertIntegerAtLeast(species.stats.hp, 1, 'species.stats.hp')
  assertIntegerAtLeast(species.stats.attack, 0, 'species.stats.attack')
  assertIntegerAtLeast(species.stats.defense, 0, 'species.stats.defense')
  assertIntegerAtLeast(species.stats.speed, 1, 'species.stats.speed')

  for (const tagId of species.tagIds) {
    assertNonEmptyString(tagId, 'species.tagIds[]')
  }
  assertValidStatusResistanceTags(species.tagIds)
  assertUniqueIds(species.bloomSkillIds ?? [], 'species.bloomSkillIds')
  assertUniqueIds(species.passiveTraitIds ?? [], 'species.passiveTraitIds')
}
