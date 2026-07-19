import {
  AI_INDIVIDUAL_STRATEGIES,
  AI_TEAM_STRATEGIES,
  validateAiSkillPolicies,
  type AiDecisionConfiguration,
  type AiSkillPolicySetting,
} from '../ai/strategy-presets'
import { COLUMNS, LOCAL_ROWS, type Column, type LocalRow } from '../battle/board'
import {
  assertValidMonsterSpecies,
  type MonsterSpecies,
  type SpeciesId,
} from '../content/monster-species'
import {
  assertValidSkillDefinition,
  type SkillDefinition,
  type SkillId,
} from '../content/skill-definition'
import { createEconomyState, type EconomyState } from './economy'

export type UnitInstanceId = string
export type FormationId = string
export type EncyclopediaStageId = string

export const ANALYSIS_MAX_BASIS_POINTS = 10_000
export const UNIT_CONDITION_MAX_BASIS_POINTS = 10_000
export const MAX_FORMATION_MEMBERS = 9

export interface SpeciesStatistics {
  readonly [statisticId: string]: number
}

export interface PlayerSpeciesState {
  readonly speciesId: SpeciesId
  readonly blueprintUnlocked: boolean
  readonly analysisBasisPoints: number
  readonly bloomSkillIds: readonly SkillId[]
  readonly encyclopediaStageId: EncyclopediaStageId
  readonly statistics: SpeciesStatistics
}

export interface PlayerUnitInstance {
  readonly instanceId: UnitInstanceId
  readonly speciesId: SpeciesId
  readonly learnedGenericSkillIds: readonly SkillId[]
  readonly nickname: string | null
  readonly favorite: boolean
  readonly locked: boolean
  readonly conditionBasisPoints: number
}

export interface PlayerCollectionState {
  readonly speciesStates: readonly PlayerSpeciesState[]
  readonly unitInstances: readonly PlayerUnitInstance[]
}

export interface FormationPosition {
  readonly row: LocalRow
  readonly column: Column
}

export interface FormationLoadout {
  readonly genericSkillId: SkillId | null
  readonly bloomSkillId: SkillId | null
}

export interface FormationMember {
  readonly instanceId: UnitInstanceId
  readonly position: FormationPosition
  readonly loadout: FormationLoadout
  readonly tiePriority: number
  readonly ai: AiDecisionConfiguration
}

export interface PlayerFormation {
  readonly formationId: FormationId
  readonly name: string
  readonly members: readonly FormationMember[]
}

export interface PlayerFormationState {
  readonly activeFormationId: FormationId | null
  readonly formations: readonly PlayerFormation[]
}

export interface PlayerData {
  readonly schemaVersion: number
  readonly gameVersion: string
  readonly contentVersion: string
  readonly economy: EconomyState
  readonly collection: PlayerCollectionState
  readonly formations: PlayerFormationState
}

export interface PlayerDataContentCatalog {
  readonly species: readonly MonsterSpecies[]
  readonly skills: readonly SkillDefinition[]
}

interface ResolvedCatalog {
  readonly speciesById: ReadonlyMap<SpeciesId, MonsterSpecies>
  readonly skillById: ReadonlyMap<SkillId, SkillDefinition>
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

function assertBoolean(value: boolean, field: string): void {
  if (typeof value !== 'boolean') {
    throw new Error(`${field} must be a boolean`)
  }
}

function assertUniqueStrings(ids: readonly string[], field: string): void {
  const seen = new Set<string>()
  for (const id of ids) {
    assertNonEmptyString(id, `${field}[]`)
    if (seen.has(id)) {
      throw new Error(`${field} must not contain duplicates: ${id}`)
    }
    seen.add(id)
  }
}

function freezeSortedStrings(ids: readonly string[]): readonly string[] {
  return Object.freeze([...ids].sort(compareIds))
}

function resolveCatalog(catalog: PlayerDataContentCatalog): ResolvedCatalog {
  const speciesById = new Map<SpeciesId, MonsterSpecies>()
  for (const species of catalog.species) {
    assertValidMonsterSpecies(species)
    if (speciesById.has(species.id)) {
      throw new Error(`catalog species id must be unique: ${species.id}`)
    }
    speciesById.set(species.id, species)
  }

  const skillById = new Map<SkillId, SkillDefinition>()
  for (const skill of catalog.skills) {
    assertValidSkillDefinition(skill)
    if (skillById.has(skill.id)) {
      throw new Error(`catalog skill id must be unique: ${skill.id}`)
    }
    skillById.set(skill.id, skill)
  }

  for (const species of speciesById.values()) {
    const innate = skillById.get(species.innateSkillId)
    if (innate === undefined || innate.slotType !== 'INNATE') {
      throw new Error(`species innate skill must exist in the INNATE slot: ${species.id}`)
    }
    for (const bloomSkillId of species.bloomSkillIds ?? []) {
      const bloom = skillById.get(bloomSkillId)
      if (bloom === undefined || bloom.slotType !== 'BLOOM') {
        throw new Error(`species bloom skill must exist in the BLOOM slot: ${bloomSkillId}`)
      }
    }
  }

  return Object.freeze({ speciesById, skillById })
}

function getRequiredSpecies(catalog: ResolvedCatalog, speciesId: SpeciesId): MonsterSpecies {
  const species = catalog.speciesById.get(speciesId)
  if (species === undefined) {
    throw new Error(`unknown species id: ${speciesId}`)
  }
  return species
}

function getRequiredSkill(catalog: ResolvedCatalog, skillId: SkillId): SkillDefinition {
  const skill = catalog.skillById.get(skillId)
  if (skill === undefined) {
    throw new Error(`unknown skill id: ${skillId}`)
  }
  return skill
}

function normalizeStatistics(statistics: SpeciesStatistics): SpeciesStatistics {
  const normalized: Record<string, number> = {}
  for (const [statisticId, value] of Object.entries(statistics).sort(([left], [right]) =>
    compareIds(left, right),
  )) {
    assertNonEmptyString(statisticId, 'speciesState.statistics key')
    assertSafeIntegerInRange(
      value,
      0,
      Number.MAX_SAFE_INTEGER,
      `speciesState.statistics.${statisticId}`,
    )
    normalized[statisticId] = value
  }
  return Object.freeze(normalized)
}

function normalizeSpeciesState(
  state: PlayerSpeciesState,
  catalog: ResolvedCatalog,
): PlayerSpeciesState {
  const species = getRequiredSpecies(catalog, state.speciesId)
  assertBoolean(state.blueprintUnlocked, 'speciesState.blueprintUnlocked')
  assertSafeIntegerInRange(
    state.analysisBasisPoints,
    0,
    ANALYSIS_MAX_BASIS_POINTS,
    'speciesState.analysisBasisPoints',
  )
  assertNonEmptyString(state.encyclopediaStageId, 'speciesState.encyclopediaStageId')
  assertUniqueStrings(state.bloomSkillIds, 'speciesState.bloomSkillIds')

  const speciesBloomSkillIds = new Set(species.bloomSkillIds ?? [])
  for (const skillId of state.bloomSkillIds) {
    const skill = getRequiredSkill(catalog, skillId)
    if (skill.slotType !== 'BLOOM' || !speciesBloomSkillIds.has(skillId)) {
      throw new Error(`unlocked bloom skill does not belong to species: ${skillId}`)
    }
  }

  return Object.freeze({
    speciesId: state.speciesId,
    blueprintUnlocked: state.blueprintUnlocked,
    analysisBasisPoints: state.analysisBasisPoints,
    bloomSkillIds: freezeSortedStrings(state.bloomSkillIds),
    encyclopediaStageId: state.encyclopediaStageId,
    statistics: normalizeStatistics(state.statistics),
  })
}

function normalizeUnitInstance(
  instance: PlayerUnitInstance,
  catalog: ResolvedCatalog,
): PlayerUnitInstance {
  assertNonEmptyString(instance.instanceId, 'unitInstance.instanceId')
  getRequiredSpecies(catalog, instance.speciesId)
  assertUniqueStrings(instance.learnedGenericSkillIds, 'unitInstance.learnedGenericSkillIds')
  for (const skillId of instance.learnedGenericSkillIds) {
    if (getRequiredSkill(catalog, skillId).slotType !== 'GENERIC') {
      throw new Error(`learned skill must use the GENERIC slot: ${skillId}`)
    }
  }
  if (instance.nickname !== null) {
    assertNonEmptyString(instance.nickname, 'unitInstance.nickname')
  }
  assertBoolean(instance.favorite, 'unitInstance.favorite')
  assertBoolean(instance.locked, 'unitInstance.locked')
  assertSafeIntegerInRange(
    instance.conditionBasisPoints,
    0,
    UNIT_CONDITION_MAX_BASIS_POINTS,
    'unitInstance.conditionBasisPoints',
  )

  return Object.freeze({
    instanceId: instance.instanceId,
    speciesId: instance.speciesId,
    learnedGenericSkillIds: freezeSortedStrings(instance.learnedGenericSkillIds),
    nickname: instance.nickname,
    favorite: instance.favorite,
    locked: instance.locked,
    conditionBasisPoints: instance.conditionBasisPoints,
  })
}

function normalizeAiConfiguration(
  configuration: AiDecisionConfiguration,
  availableSkillIds: ReadonlySet<SkillId>,
): AiDecisionConfiguration {
  if (!AI_INDIVIDUAL_STRATEGIES.includes(configuration.individualStrategy)) {
    throw new Error('formation member individualStrategy is invalid')
  }
  if (!AI_TEAM_STRATEGIES.includes(configuration.teamStrategy)) {
    throw new Error('formation member teamStrategy is invalid')
  }

  const settings = configuration.skillPolicies ?? []
  validateAiSkillPolicies(availableSkillIds, settings)
  const normalizedSettings: AiSkillPolicySetting[] = settings
    .map((setting) => {
      if (
        setting.conditionSatisfied !== undefined &&
        typeof setting.conditionSatisfied !== 'boolean'
      ) {
        throw new Error(`skill policy condition must be boolean: ${setting.skillId}`)
      }
      return Object.freeze({ ...setting })
    })
    .sort((left, right) => compareIds(left.skillId, right.skillId))

  return Object.freeze({
    individualStrategy: configuration.individualStrategy,
    teamStrategy: configuration.teamStrategy,
    skillPolicies: Object.freeze(normalizedSettings),
  })
}

function positionIndex(position: FormationPosition): number {
  return position.row * COLUMNS.length + position.column
}

function normalizeFormation(
  formation: PlayerFormation,
  catalog: ResolvedCatalog,
  instanceById: ReadonlyMap<UnitInstanceId, PlayerUnitInstance>,
  speciesStateById: ReadonlyMap<SpeciesId, PlayerSpeciesState>,
): PlayerFormation {
  assertNonEmptyString(formation.formationId, 'formation.formationId')
  assertNonEmptyString(formation.name, 'formation.name')
  assertSafeIntegerInRange(
    formation.members.length,
    0,
    MAX_FORMATION_MEMBERS,
    'formation.members.length',
  )

  const instanceIds = new Set<UnitInstanceId>()
  const positionIds = new Set<string>()
  const tiePriorities = new Set<number>()
  const members = formation.members.map((member) => {
    const instance = instanceById.get(member.instanceId)
    if (instance === undefined) {
      throw new Error(`formation references unowned instance: ${member.instanceId}`)
    }
    if (instanceIds.has(member.instanceId)) {
      throw new Error(`formation instance must be unique: ${member.instanceId}`)
    }
    instanceIds.add(member.instanceId)

    if (!LOCAL_ROWS.includes(member.position.row) || !COLUMNS.includes(member.position.column)) {
      throw new Error(`formation position is invalid: ${member.instanceId}`)
    }
    const positionId = `${member.position.row}:${member.position.column}`
    if (positionIds.has(positionId)) {
      throw new Error(`formation position must be unique: ${positionId}`)
    }
    positionIds.add(positionId)

    assertSafeIntegerInRange(
      member.tiePriority,
      0,
      Number.MAX_SAFE_INTEGER,
      'formationMember.tiePriority',
    )
    if (tiePriorities.has(member.tiePriority)) {
      throw new Error(`formation tiePriority must be unique: ${member.tiePriority}`)
    }
    tiePriorities.add(member.tiePriority)

    const species = getRequiredSpecies(catalog, instance.speciesId)
    const speciesState = speciesStateById.get(instance.speciesId)
    if (speciesState === undefined) {
      throw new Error(`owned instance requires species state: ${instance.speciesId}`)
    }

    const genericSkillId = member.loadout.genericSkillId
    if (genericSkillId !== null) {
      if (!instance.learnedGenericSkillIds.includes(genericSkillId)) {
        throw new Error(`equipped generic skill is not learned: ${genericSkillId}`)
      }
      if (getRequiredSkill(catalog, genericSkillId).slotType !== 'GENERIC') {
        throw new Error(`equipped generic skill must use the GENERIC slot: ${genericSkillId}`)
      }
    }

    const bloomSkillId = member.loadout.bloomSkillId
    if (bloomSkillId !== null) {
      if (!speciesState.bloomSkillIds.includes(bloomSkillId)) {
        throw new Error(`equipped bloom skill is not unlocked: ${bloomSkillId}`)
      }
      if (getRequiredSkill(catalog, bloomSkillId).slotType !== 'BLOOM') {
        throw new Error(`equipped bloom skill must use the BLOOM slot: ${bloomSkillId}`)
      }
    }

    const availableSkillIds = new Set<SkillId>([
      species.innateSkillId,
      ...(genericSkillId === null ? [] : [genericSkillId]),
      ...(bloomSkillId === null ? [] : [bloomSkillId]),
    ])

    return Object.freeze({
      instanceId: member.instanceId,
      position: Object.freeze({ ...member.position }),
      loadout: Object.freeze({ genericSkillId, bloomSkillId }),
      tiePriority: member.tiePriority,
      ai: normalizeAiConfiguration(member.ai, availableSkillIds),
    })
  })

  members.sort((left, right) => {
    const byPosition = positionIndex(left.position) - positionIndex(right.position)
    return byPosition !== 0 ? byPosition : compareIds(left.instanceId, right.instanceId)
  })

  return Object.freeze({
    formationId: formation.formationId,
    name: formation.name,
    members: Object.freeze(members),
  })
}

export function createPlayerData(
  input: PlayerData,
  contentCatalog: PlayerDataContentCatalog,
): PlayerData {
  assertSafeIntegerInRange(
    input.schemaVersion,
    1,
    Number.MAX_SAFE_INTEGER,
    'playerData.schemaVersion',
  )
  assertNonEmptyString(input.gameVersion, 'playerData.gameVersion')
  assertNonEmptyString(input.contentVersion, 'playerData.contentVersion')
  const economy = createEconomyState(input.economy)
  const catalog = resolveCatalog(contentCatalog)

  const speciesStates = input.collection.speciesStates.map((state) =>
    normalizeSpeciesState(state, catalog),
  )
  const speciesStateById = new Map<SpeciesId, PlayerSpeciesState>()
  for (const state of speciesStates) {
    if (speciesStateById.has(state.speciesId)) {
      throw new Error(`species state must be unique: ${state.speciesId}`)
    }
    speciesStateById.set(state.speciesId, state)
  }
  speciesStates.sort((left, right) => compareIds(left.speciesId, right.speciesId))

  const unitInstances = input.collection.unitInstances.map((instance) =>
    normalizeUnitInstance(instance, catalog),
  )
  const instanceById = new Map<UnitInstanceId, PlayerUnitInstance>()
  for (const instance of unitInstances) {
    if (instanceById.has(instance.instanceId)) {
      throw new Error(`unit instance id must be unique: ${instance.instanceId}`)
    }
    if (!speciesStateById.has(instance.speciesId)) {
      throw new Error(`owned instance requires species state: ${instance.speciesId}`)
    }
    instanceById.set(instance.instanceId, instance)
  }
  unitInstances.sort((left, right) => compareIds(left.instanceId, right.instanceId))

  const formations = input.formations.formations.map((formation) =>
    normalizeFormation(formation, catalog, instanceById, speciesStateById),
  )
  const formationIds = new Set<FormationId>()
  for (const formation of formations) {
    if (formationIds.has(formation.formationId)) {
      throw new Error(`formation id must be unique: ${formation.formationId}`)
    }
    formationIds.add(formation.formationId)
  }
  formations.sort((left, right) => compareIds(left.formationId, right.formationId))

  if (
    input.formations.activeFormationId !== null &&
    !formationIds.has(input.formations.activeFormationId)
  ) {
    throw new Error(`active formation does not exist: ${input.formations.activeFormationId}`)
  }

  return Object.freeze({
    schemaVersion: input.schemaVersion,
    gameVersion: input.gameVersion,
    contentVersion: input.contentVersion,
    economy,
    collection: Object.freeze({
      speciesStates: Object.freeze(speciesStates),
      unitInstances: Object.freeze(unitInstances),
    }),
    formations: Object.freeze({
      activeFormationId: input.formations.activeFormationId,
      formations: Object.freeze(formations),
    }),
  })
}

export function getFormationMemberEquippedSkillIds(
  playerData: PlayerData,
  formationId: FormationId,
  instanceId: UnitInstanceId,
  contentCatalog: PlayerDataContentCatalog,
): readonly SkillId[] {
  const normalized = createPlayerData(playerData, contentCatalog)
  const formation = normalized.formations.formations.find(
    (candidate) => candidate.formationId === formationId,
  )
  if (formation === undefined) {
    throw new Error(`formation does not exist: ${formationId}`)
  }
  const member = formation.members.find((candidate) => candidate.instanceId === instanceId)
  if (member === undefined) {
    throw new Error(`formation member does not exist: ${instanceId}`)
  }
  const instance = normalized.collection.unitInstances.find(
    (candidate) => candidate.instanceId === instanceId,
  )
  if (instance === undefined) {
    throw new Error(`unit instance does not exist: ${instanceId}`)
  }
  const species = contentCatalog.species.find(
    (candidate) => candidate.id === instance.speciesId,
  )
  if (species === undefined) {
    throw new Error(`unknown species id: ${instance.speciesId}`)
  }
  return Object.freeze([
    species.innateSkillId,
    ...(member.loadout.genericSkillId === null ? [] : [member.loadout.genericSkillId]),
    ...(member.loadout.bloomSkillId === null ? [] : [member.loadout.bloomSkillId]),
  ])
}
