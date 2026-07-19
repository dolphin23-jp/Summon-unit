import type {
  AiIndividualStrategy,
  AiSkillPolicy,
  AiTeamStrategy,
} from '../ai/strategy-presets'
import type {
  HeadlessBattleDefinition,
  HeadlessBattleUnitDefinition,
} from '../battle/headless-battle-runner'
import type { SkillId } from '../content/skill-definition'
import {
  createPlayerData,
  getFormationMemberEquippedSkillIds,
  type FormationId,
  type FormationLoadout,
  type FormationMember,
  type FormationPosition,
  type PlayerData,
  type PlayerDataContentCatalog,
  type PlayerFormation,
  type UnitInstanceId,
} from './player-data'

const DEFAULT_INDIVIDUAL_STRATEGY: AiIndividualStrategy = 'STANDARD'
const DEFAULT_TEAM_STRATEGY: AiTeamStrategy = 'STABLE_CLEAR'

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function samePosition(left: FormationPosition, right: FormationPosition): boolean {
  return left.row === right.row && left.column === right.column
}

function getRequiredFormation(playerData: PlayerData, formationId: FormationId): PlayerFormation {
  const formation = playerData.formations.formations.find(
    (candidate) => candidate.formationId === formationId,
  )
  if (formation === undefined) {
    throw new Error(`formation does not exist: ${formationId}`)
  }
  return formation
}

function getRequiredMember(
  formation: PlayerFormation,
  instanceId: UnitInstanceId,
): FormationMember {
  const member = formation.members.find((candidate) => candidate.instanceId === instanceId)
  if (member === undefined) {
    throw new Error(`formation member does not exist: ${instanceId}`)
  }
  return member
}

function replaceFormation(
  playerData: PlayerData,
  nextFormation: PlayerFormation,
  catalog: PlayerDataContentCatalog,
  activeFormationId: FormationId | null = playerData.formations.activeFormationId,
): PlayerData {
  return createPlayerData(
    {
      ...playerData,
      formations: {
        activeFormationId,
        formations: playerData.formations.formations.map((formation) =>
          formation.formationId === nextFormation.formationId ? nextFormation : formation,
        ),
      },
    },
    catalog,
  )
}

function firstAvailableTiePriority(members: readonly FormationMember[]): number {
  const used = new Set(members.map((member) => member.tiePriority))
  let candidate = 0
  while (used.has(candidate)) {
    candidate += 1
  }
  return candidate
}

function equippedSkillIdsForMember(
  playerData: PlayerData,
  formationId: FormationId,
  member: FormationMember,
  catalog: PlayerDataContentCatalog,
): readonly SkillId[] {
  return getFormationMemberEquippedSkillIds(
    playerData,
    formationId,
    member.instanceId,
    catalog,
  )
}

export function setActiveFormation(
  playerData: PlayerData,
  formationId: FormationId,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(playerData, catalog)
  getRequiredFormation(normalized, formationId)
  return createPlayerData(
    {
      ...normalized,
      formations: { ...normalized.formations, activeFormationId: formationId },
    },
    catalog,
  )
}

export function placeFormationMember(
  playerData: PlayerData,
  formationId: FormationId,
  instanceId: UnitInstanceId,
  position: FormationPosition,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(playerData, catalog)
  if (!normalized.collection.unitInstances.some((instance) => instance.instanceId === instanceId)) {
    throw new Error(`unit instance does not exist: ${instanceId}`)
  }
  const formation = getRequiredFormation(normalized, formationId)
  const existing = formation.members.find((member) => member.instanceId === instanceId)
  const retainedMembers = formation.members.filter(
    (member) => member.instanceId !== instanceId && !samePosition(member.position, position),
  )
  const member: FormationMember = existing ?? {
    instanceId,
    position,
    loadout: { genericSkillId: null, bloomSkillId: null },
    tiePriority: firstAvailableTiePriority(retainedMembers),
    ai: {
      individualStrategy: DEFAULT_INDIVIDUAL_STRATEGY,
      teamStrategy: DEFAULT_TEAM_STRATEGY,
      skillPolicies: [],
    },
  }
  const nextMember: FormationMember = { ...member, position: { ...position } }
  return replaceFormation(
    normalized,
    { ...formation, members: [...retainedMembers, nextMember] },
    catalog,
  )
}

export function removeFormationMember(
  playerData: PlayerData,
  formationId: FormationId,
  instanceId: UnitInstanceId,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(playerData, catalog)
  const formation = getRequiredFormation(normalized, formationId)
  getRequiredMember(formation, instanceId)
  return replaceFormation(
    normalized,
    {
      ...formation,
      members: formation.members.filter((member) => member.instanceId !== instanceId),
    },
    catalog,
  )
}

export function updateFormationMemberLoadout(
  playerData: PlayerData,
  formationId: FormationId,
  instanceId: UnitInstanceId,
  loadout: FormationLoadout,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(playerData, catalog)
  const formation = getRequiredFormation(normalized, formationId)
  const member = getRequiredMember(formation, instanceId)
  const nextMember: FormationMember = { ...member, loadout: { ...loadout } }
  const provisional = replaceFormation(
    normalized,
    {
      ...formation,
      members: formation.members.map((candidate) =>
        candidate.instanceId === instanceId ? nextMember : candidate,
      ),
    },
    catalog,
  )
  const provisionalFormation = getRequiredFormation(provisional, formationId)
  const provisionalMember = getRequiredMember(provisionalFormation, instanceId)
  const available = new Set(
    equippedSkillIdsForMember(provisional, formationId, provisionalMember, catalog),
  )
  const filteredPolicies = (provisionalMember.ai.skillPolicies ?? []).filter((setting) =>
    available.has(setting.skillId),
  )
  return replaceFormation(
    provisional,
    {
      ...provisionalFormation,
      members: provisionalFormation.members.map((candidate) =>
        candidate.instanceId === instanceId
          ? { ...candidate, ai: { ...candidate.ai, skillPolicies: filteredPolicies } }
          : candidate,
      ),
    },
    catalog,
  )
}

export function updateFormationMemberStrategies(
  playerData: PlayerData,
  formationId: FormationId,
  instanceId: UnitInstanceId,
  individualStrategy: AiIndividualStrategy,
  teamStrategy: AiTeamStrategy,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(playerData, catalog)
  const formation = getRequiredFormation(normalized, formationId)
  getRequiredMember(formation, instanceId)
  return replaceFormation(
    normalized,
    {
      ...formation,
      members: formation.members.map((member) =>
        member.instanceId === instanceId
          ? { ...member, ai: { ...member.ai, individualStrategy, teamStrategy } }
          : member,
      ),
    },
    catalog,
  )
}

export function updateFormationMemberSkillPolicy(
  playerData: PlayerData,
  formationId: FormationId,
  instanceId: UnitInstanceId,
  skillId: SkillId,
  policy: AiSkillPolicy,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(playerData, catalog)
  const formation = getRequiredFormation(normalized, formationId)
  const member = getRequiredMember(formation, instanceId)
  const available = new Set(equippedSkillIdsForMember(normalized, formationId, member, catalog))
  if (!available.has(skillId)) {
    throw new Error(`skill policy references unequipped skill: ${skillId}`)
  }
  const settings = [
    ...(member.ai.skillPolicies ?? []).filter((setting) => setting.skillId !== skillId),
    { skillId, policy },
  ].sort((left, right) => compareIds(left.skillId, right.skillId))
  return replaceFormation(
    normalized,
    {
      ...formation,
      members: formation.members.map((candidate) =>
        candidate.instanceId === instanceId
          ? { ...candidate, ai: { ...candidate.ai, skillPolicies: settings } }
          : candidate,
      ),
    },
    catalog,
  )
}

export function moveFormationMemberPriority(
  playerData: PlayerData,
  formationId: FormationId,
  instanceId: UnitInstanceId,
  direction: -1 | 1,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(playerData, catalog)
  const formation = getRequiredFormation(normalized, formationId)
  const ordered = [...formation.members].sort(
    (left, right) => left.tiePriority - right.tiePriority || compareIds(left.instanceId, right.instanceId),
  )
  const index = ordered.findIndex((member) => member.instanceId === instanceId)
  if (index < 0) {
    throw new Error(`formation member does not exist: ${instanceId}`)
  }
  const swapIndex = index + direction
  if (swapIndex < 0 || swapIndex >= ordered.length) {
    return normalized
  }
  const current = ordered[index]
  const swap = ordered[swapIndex]
  const priorityByInstance = new Map<UnitInstanceId, number>([
    [current.instanceId, swap.tiePriority],
    [swap.instanceId, current.tiePriority],
  ])
  return replaceFormation(
    normalized,
    {
      ...formation,
      members: formation.members.map((member) => ({
        ...member,
        tiePriority: priorityByInstance.get(member.instanceId) ?? member.tiePriority,
      })),
    },
    catalog,
  )
}

export function saveFormationPreset(
  playerData: PlayerData,
  sourceFormationId: FormationId,
  newFormationId: FormationId,
  name: string,
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const normalized = createPlayerData(playerData, catalog)
  const source = getRequiredFormation(normalized, sourceFormationId)
  if (normalized.formations.formations.some((formation) => formation.formationId === newFormationId)) {
    throw new Error(`formation id already exists: ${newFormationId}`)
  }
  return createPlayerData(
    {
      ...normalized,
      formations: {
        activeFormationId: newFormationId,
        formations: [
          ...normalized.formations.formations,
          {
            formationId: newFormationId,
            name,
            members: source.members.map((member) => ({
              ...member,
              position: { ...member.position },
              loadout: { ...member.loadout },
              ai: {
                ...member.ai,
                skillPolicies: (member.ai.skillPolicies ?? []).map((setting) => ({ ...setting })),
              },
            })),
          },
        ],
      },
    },
    catalog,
  )
}

export function createFormationBattleDefinition(
  playerData: PlayerData,
  formationId: FormationId,
  catalog: PlayerDataContentCatalog,
  baseBattle: HeadlessBattleDefinition,
): HeadlessBattleDefinition {
  const normalized = createPlayerData(playerData, catalog)
  const formation = getRequiredFormation(normalized, formationId)
  if (formation.members.length === 0) {
    throw new Error('cannot start a battle with an empty formation')
  }
  const instanceById = new Map(
    normalized.collection.unitInstances.map((instance) => [instance.instanceId, instance]),
  )
  const allyUnits: HeadlessBattleUnitDefinition[] = formation.members.map((member) => {
    const instance = instanceById.get(member.instanceId)
    if (instance === undefined) {
      throw new Error(`unit instance does not exist: ${member.instanceId}`)
    }
    return Object.freeze({
      battleUnitId: `ally:${member.instanceId}`,
      speciesId: instance.speciesId,
      position: Object.freeze({ side: 'ALLY' as const, ...member.position }),
      equippedSkillIds: Object.freeze(
        getFormationMemberEquippedSkillIds(normalized, formationId, member.instanceId, catalog).slice(1),
      ),
      tiePriority: member.tiePriority,
    })
  })
  const enemyUnits = baseBattle.units.filter((unit) => unit.position.side === 'ENEMY')
  if (enemyUnits.length === 0) {
    throw new Error('base battle must provide at least one enemy unit')
  }
  const enemyIds = new Set(enemyUnits.map((unit) => unit.battleUnitId))
  const aiConfigurations: Record<string, FormationMember['ai']> = {}
  for (const [battleUnitId, configuration] of Object.entries(baseBattle.aiConfigurations ?? {})) {
    if (enemyIds.has(battleUnitId)) {
      aiConfigurations[battleUnitId] = configuration
    }
  }
  for (const member of formation.members) {
    aiConfigurations[`ally:${member.instanceId}`] = member.ai
  }
  return Object.freeze({
    species: catalog.species,
    skills: catalog.skills,
    units: Object.freeze([...allyUnits, ...enemyUnits]),
    aiConfigurations: Object.freeze(aiConfigurations),
    initialActionCost: baseBattle.initialActionCost,
    maxActions: baseBattle.maxActions,
  })
}
