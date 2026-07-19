import type { PlayerData } from '../progression/player-data'
import { createStagePlayerData } from '../progression/stage-reward'
import { validateContentCatalog, type ContentValidationSummary } from './content-validation'
import type { MonsterSpecies } from './monster-species'
import type { SkillDefinition } from './skill-definition'
import { VERTICAL_SLICE_GENERIC_SKILL_COSTS } from './vertical-slice-content'
import {
  VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA,
  VERTICAL_SLICE_T046_WORLD_CATALOG,
} from './vertical-slice-t046'

const WYVERN_SPECIES_ID = 'species.slice.disaster-flame-wyvern'
const WYVERN_INNATE_SKILL_ID = 'skill.slice.disaster-assault'
const WYVERN_BLOOM_SKILL_ID = 'skill.slice.disaster-wingstorm'

function tuneSpecies(species: MonsterSpecies): MonsterSpecies {
  if (species.id !== WYVERN_SPECIES_ID) return species
  return Object.freeze({
    ...species,
    stats: Object.freeze({
      hp: 240,
      attack: 55,
      defense: 48,
      speed: 5,
    }),
  })
}

function tuneSkill(skill: SkillDefinition): SkillDefinition {
  if (skill.id === WYVERN_INNATE_SKILL_ID) {
    return Object.freeze({
      ...skill,
      actionCost: 185,
      damageMultiplierPermille: 1150,
    })
  }
  if (skill.id === WYVERN_BLOOM_SKILL_ID) {
    return Object.freeze({
      ...skill,
      damageMultiplierPermille: 1000,
    })
  }
  return skill
}

export const VERTICAL_SLICE_T046_BALANCED_SPECIES: readonly MonsterSpecies[] = Object.freeze(
  VERTICAL_SLICE_T046_WORLD_CATALOG.species.map(tuneSpecies),
)

export const VERTICAL_SLICE_T046_BALANCED_SKILLS: readonly SkillDefinition[] = Object.freeze(
  VERTICAL_SLICE_T046_WORLD_CATALOG.skills.map(tuneSkill),
)

export const VERTICAL_SLICE_T046_BALANCED_CATALOG = Object.freeze({
  ...VERTICAL_SLICE_T046_WORLD_CATALOG,
  species: VERTICAL_SLICE_T046_BALANCED_SPECIES,
  skills: VERTICAL_SLICE_T046_BALANCED_SKILLS,
})

export const VERTICAL_SLICE_T046_BALANCED_INITIAL_PLAYER_DATA: PlayerData = createStagePlayerData(
  VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA,
  VERTICAL_SLICE_T046_BALANCED_CATALOG,
)

export interface VerticalSliceT046BalancedValidationSummary extends ContentValidationSummary {
  readonly tunedSpecies: number
  readonly tunedSkills: number
}

export function validateVerticalSliceT046BalancedMaster(): VerticalSliceT046BalancedValidationSummary {
  const base = validateContentCatalog(VERTICAL_SLICE_T046_BALANCED_CATALOG, {
    genericSkillCosts: VERTICAL_SLICE_GENERIC_SKILL_COSTS,
  })
  const wyvern = VERTICAL_SLICE_T046_BALANCED_SPECIES.find(
    (species) => species.id === WYVERN_SPECIES_ID,
  )
  if (wyvern === undefined || wyvern.stats.attack !== 55 || wyvern.stats.defense !== 48) {
    throw new Error('T046 balanced wyvern species master is not applied')
  }
  const innate = VERTICAL_SLICE_T046_BALANCED_SKILLS.find(
    (skill) => skill.id === WYVERN_INNATE_SKILL_ID,
  )
  const bloom = VERTICAL_SLICE_T046_BALANCED_SKILLS.find(
    (skill) => skill.id === WYVERN_BLOOM_SKILL_ID,
  )
  if (innate?.damageMultiplierPermille !== 1150 || bloom?.damageMultiplierPermille !== 1000) {
    throw new Error('T046 balanced wyvern skill master is not applied')
  }
  return Object.freeze({
    ...base,
    tunedSpecies: 1,
    tunedSkills: 2,
  })
}

export const VERTICAL_SLICE_T046_BALANCED_VALIDATION =
  validateVerticalSliceT046BalancedMaster()
