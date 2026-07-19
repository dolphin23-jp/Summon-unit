import type { MonsterRarity } from '../content/monster-species'

export interface ResearchFacilityStageDefinition {
  readonly stage: number
  readonly maxResearchableRarity: MonsterRarity
  readonly upgradeCurrencyCost: number
  readonly upgradeResearchDataCost: number
}

export interface PlayerFacilityState {
  readonly researchFacilityStage: number
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

export function normalizeResearchFacilityStages(
  definitions: readonly ResearchFacilityStageDefinition[],
): readonly ResearchFacilityStageDefinition[] {
  if (definitions.length === 0) return Object.freeze([])
  const normalized = [...definitions].sort((left, right) => left.stage - right.stage)
  for (let index = 0; index < normalized.length; index += 1) {
    const definition = normalized[index]
    const expectedStage = index + 1
    if (definition.stage !== expectedStage) {
      throw new Error(`research facility stages must be contiguous from 1: expected ${expectedStage}`)
    }
    assertSafeIntegerInRange(
      definition.maxResearchableRarity,
      1,
      10,
      'researchFacility.maxResearchableRarity',
    )
    assertSafeIntegerInRange(
      definition.upgradeCurrencyCost,
      0,
      Number.MAX_SAFE_INTEGER,
      'researchFacility.upgradeCurrencyCost',
    )
    assertSafeIntegerInRange(
      definition.upgradeResearchDataCost,
      0,
      Number.MAX_SAFE_INTEGER,
      'researchFacility.upgradeResearchDataCost',
    )
    if (index === 0 && (definition.upgradeCurrencyCost !== 0 || definition.upgradeResearchDataCost !== 0)) {
      throw new Error('research facility stage 1 must not have an upgrade cost')
    }
    const previous = normalized[index - 1]
    if (
      previous !== undefined &&
      definition.maxResearchableRarity < previous.maxResearchableRarity
    ) {
      throw new Error('research facility maximum rarity must not decrease')
    }
  }
  return Object.freeze(normalized.map((definition) => Object.freeze({ ...definition })))
}

export function createPlayerFacilityState(
  input: PlayerFacilityState | undefined,
  definitions: readonly ResearchFacilityStageDefinition[],
): PlayerFacilityState | undefined {
  const normalizedDefinitions = normalizeResearchFacilityStages(definitions)
  if (normalizedDefinitions.length === 0) {
    if (input !== undefined) {
      throw new Error('player facility state requires research facility stage definitions')
    }
    return undefined
  }
  const stage = input?.researchFacilityStage ?? normalizedDefinitions[0].stage
  assertSafeIntegerInRange(stage, 1, normalizedDefinitions.length, 'facilities.researchFacilityStage')
  return Object.freeze({ researchFacilityStage: stage })
}

export function getResearchFacilityStageDefinition(
  state: PlayerFacilityState | undefined,
  definitions: readonly ResearchFacilityStageDefinition[],
): ResearchFacilityStageDefinition | null {
  const normalized = normalizeResearchFacilityStages(definitions)
  if (normalized.length === 0) return null
  const stage = state?.researchFacilityStage ?? normalized[0].stage
  const definition = normalized.find((candidate) => candidate.stage === stage)
  if (definition === undefined) {
    throw new Error(`research facility stage does not exist: ${stage}`)
  }
  return definition
}

export function assertResearchFacilityAllowsRarity(
  state: PlayerFacilityState | undefined,
  definitions: readonly ResearchFacilityStageDefinition[],
  rarity: MonsterRarity,
): void {
  const stage = getResearchFacilityStageDefinition(state, definitions)
  if (stage === null) return
  if (rarity > stage.maxResearchableRarity) {
    throw new Error(
      `research facility stage ${stage.stage} allows rarity ${stage.maxResearchableRarity} or lower`,
    )
  }
}
