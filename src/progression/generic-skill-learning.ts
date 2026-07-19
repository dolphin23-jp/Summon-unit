import type { SkillId } from '../content/skill-definition'
import { applyEconomyTransaction } from './economy'
import {
  createPlayerData,
  type PlayerData,
  type PlayerDataContentCatalog,
  type UnitInstanceId,
} from './player-data'

export interface LearnGenericSkillResult {
  readonly playerData: PlayerData
  readonly spentCurrency: number
}

function assertPositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive safe integer`)
  }
}

export function learnGenericSkill(
  playerData: PlayerData,
  instanceId: UnitInstanceId,
  skillId: SkillId,
  cost: number,
  catalog: PlayerDataContentCatalog,
): LearnGenericSkillResult {
  assertPositiveSafeInteger(cost, 'generic skill learning cost')
  const normalized = createPlayerData(playerData, catalog)
  const instance = normalized.collection.unitInstances.find(
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
  if (normalized.economy.currency < cost) {
    throw new Error('insufficient basic currency for generic skill learning')
  }

  const economy = applyEconomyTransaction(normalized.economy, {
    currencyDelta: -cost,
  })
  const nextPlayerData = createPlayerData(
    {
      ...normalized,
      economy,
      collection: {
        ...normalized.collection,
        unitInstances: normalized.collection.unitInstances.map((candidate) =>
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

  return Object.freeze({ playerData: nextPlayerData, spentCurrency: cost })
}
