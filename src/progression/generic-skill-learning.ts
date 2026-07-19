import type { SkillId } from '../content/skill-definition'
import {
  createPlayerData,
  type PlayerData,
  type PlayerDataContentCatalog,
  type UnitInstanceId,
} from './player-data'

export interface GenericSkillLearningBalance {
  readonly instanceId: UnitInstanceId
  readonly currency: number
}

export interface GenericSkillLearningState {
  readonly balances: readonly GenericSkillLearningBalance[]
}

export interface LearnGenericSkillResult {
  readonly playerData: PlayerData
  readonly learningState: GenericSkillLearningState
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function assertSafeNonNegative(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`)
  }
}

export function createGenericSkillLearningState(
  balances: readonly GenericSkillLearningBalance[],
  playerData: PlayerData,
): GenericSkillLearningState {
  const owned = new Set(playerData.collection.unitInstances.map((instance) => instance.instanceId))
  const seen = new Set<UnitInstanceId>()
  const normalized = balances.map((balance) => {
    if (!owned.has(balance.instanceId)) {
      throw new Error(`learning balance references unowned instance: ${balance.instanceId}`)
    }
    if (seen.has(balance.instanceId)) {
      throw new Error(`learning balance instance must be unique: ${balance.instanceId}`)
    }
    seen.add(balance.instanceId)
    assertSafeNonNegative(balance.currency, 'learning balance currency')
    return Object.freeze({ ...balance })
  })
  normalized.sort((left, right) => compareIds(left.instanceId, right.instanceId))
  return Object.freeze({ balances: Object.freeze(normalized) })
}

export function getGenericSkillLearningBalance(
  state: GenericSkillLearningState,
  instanceId: UnitInstanceId,
): number {
  return state.balances.find((balance) => balance.instanceId === instanceId)?.currency ?? 0
}

export function learnGenericSkill(
  playerData: PlayerData,
  learningState: GenericSkillLearningState,
  instanceId: UnitInstanceId,
  skillId: SkillId,
  cost: number,
  catalog: PlayerDataContentCatalog,
): LearnGenericSkillResult {
  assertSafeNonNegative(cost, 'generic skill learning cost')
  if (cost === 0) {
    throw new Error('generic skill learning cost must be greater than zero')
  }
  const normalizedPlayerData = createPlayerData(playerData, catalog)
  const normalizedLearningState = createGenericSkillLearningState(
    learningState.balances,
    normalizedPlayerData,
  )
  const instance = normalizedPlayerData.collection.unitInstances.find(
    (candidate) => candidate.instanceId === instanceId,
  )
  if (instance === undefined) {
    throw new Error(`unit instance does not exist: ${instanceId}`)
  }
  const skill = catalog.skills.find((candidate) => candidate.id === skillId)
  if (skill === undefined) {
    throw new Error(`unknown skill id: ${skillId}`)
  }
  if (skill.slotType !== 'GENERIC') {
    throw new Error(`learned skill must use the GENERIC slot: ${skillId}`)
  }
  if (instance.learnedGenericSkillIds.includes(skillId)) {
    throw new Error(`generic skill is already learned: ${skillId}`)
  }
  const balance = getGenericSkillLearningBalance(normalizedLearningState, instanceId)
  if (balance < cost) {
    throw new Error(`insufficient generic skill currency: ${instanceId}`)
  }
  const nextPlayerData = createPlayerData(
    {
      ...normalizedPlayerData,
      collection: {
        ...normalizedPlayerData.collection,
        unitInstances: normalizedPlayerData.collection.unitInstances.map((candidate) =>
          candidate.instanceId === instanceId
            ? {
                ...candidate,
                learnedGenericSkillIds: [...candidate.learnedGenericSkillIds, skillId],
              }
            : candidate,
        ),
      },
    },
    catalog,
  )
  const nextLearningState = createGenericSkillLearningState(
    normalizedLearningState.balances.map((candidate) =>
      candidate.instanceId === instanceId
        ? { ...candidate, currency: candidate.currency - cost }
        : candidate,
    ),
    nextPlayerData,
  )
  return Object.freeze({ playerData: nextPlayerData, learningState: nextLearningState })
}
