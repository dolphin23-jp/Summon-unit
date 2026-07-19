import type { SpeciesId } from '../content/monster-species'
import { applyEconomyTransaction, getCatalystAmount } from './economy'
import {
  createPlayerData,
  type PlayerData,
  type PlayerDataContentCatalog,
  type PlayerSpeciesState,
} from './player-data'
import {
  RESEARCH_METHODS,
  createPlayerResearchState,
  researchStatusForDisclosureStage,
  researchStatusRank,
  type PlayerResearchNodeState,
  type ResearchDisclosureStage,
  type ResearchHintDefinition,
  type ResearchMethod,
  type ResearchNodeDefinition,
} from './research-model'

export interface ResearchDisclosureContext {
  readonly completedProgressIds?: readonly string[]
}

export interface ResearchDisclosureChange {
  readonly nodeId: string
  readonly beforeStage: ResearchDisclosureStage
  readonly afterStage: ResearchDisclosureStage
  readonly unlockedHintIds: readonly string[]
}

export interface ResearchDisclosureResult {
  readonly playerData: PlayerData
  readonly changes: readonly ResearchDisclosureChange[]
}

export interface TrialResearchSubmission {
  readonly nodeId: string
  readonly method: ResearchMethod
  readonly materialSpeciesIds: readonly SpeciesId[]
  readonly catalystIds: readonly string[]
}

export interface TrialElementEvaluation {
  readonly elementId: string
  readonly matched: boolean
}

export interface TrialResearchEvaluation {
  readonly methodMatched: boolean
  readonly materialSpecies: readonly TrialElementEvaluation[]
  readonly catalysts: readonly TrialElementEvaluation[]
  readonly materialCountMatched: boolean
  readonly catalystCountMatched: boolean
  readonly exactMatch: boolean
}

export interface TrialResearchResult {
  readonly playerData: PlayerData
  readonly nodeId: string
  readonly researchDataSpent: number
  readonly incorrectSignature: string | null
  readonly evaluation: TrialResearchEvaluation
  readonly disclosureChanges: readonly ResearchDisclosureChange[]
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function normalizeUniqueIds(values: readonly string[], field: string): readonly string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of values) {
    if (value.trim().length === 0) {
      throw new Error(`${field} must contain non-empty IDs`)
    }
    if (seen.has(value)) {
      throw new Error(`${field} must not contain duplicates: ${value}`)
    }
    seen.add(value)
    normalized.push(value)
  }
  normalized.sort(compareIds)
  return Object.freeze(normalized)
}

function getResearchDefinitions(catalog: PlayerDataContentCatalog): readonly ResearchNodeDefinition[] {
  return catalog.researchNodes ?? []
}

function getNormalizedResearch(playerData: PlayerData, catalog: PlayerDataContentCatalog) {
  const normalized = createPlayerData(playerData, catalog)
  const speciesIds = new Set(catalog.species.map((species) => species.id))
  return {
    playerData: normalized,
    research: createPlayerResearchState(
      normalized.research ?? { nodes: [] },
      getResearchDefinitions(catalog),
      speciesIds,
    ),
  }
}

function getNodeDefinition(
  catalog: PlayerDataContentCatalog,
  nodeId: string,
): ResearchNodeDefinition {
  const definition = getResearchDefinitions(catalog).find((candidate) => candidate.nodeId === nodeId)
  if (definition === undefined) {
    throw new Error(`unknown research node: ${nodeId}`)
  }
  return definition
}

function stageFromEncyclopediaId(value: string): number | null {
  const match = /(?:^|[.-])([0-5])$/.exec(value)
  return match === null ? null : Number(match[1])
}

function updateEncyclopediaStages(
  speciesStates: readonly PlayerSpeciesState[],
  nodeStates: readonly PlayerResearchNodeState[],
  definitions: readonly ResearchNodeDefinition[],
): readonly PlayerSpeciesState[] {
  const maximumBySpecies = new Map<SpeciesId, number>()
  const stateByNodeId = new Map(nodeStates.map((state) => [state.nodeId, state]))
  for (const definition of definitions) {
    const stage = stateByNodeId.get(definition.nodeId)?.disclosureStage ?? 0
    maximumBySpecies.set(
      definition.targetSpeciesId,
      Math.max(maximumBySpecies.get(definition.targetSpeciesId) ?? 0, stage),
    )
  }
  return Object.freeze(
    speciesStates.map((state) => {
      const researchStage = maximumBySpecies.get(state.speciesId)
      if (researchStage === undefined) return state
      const currentStage = stageFromEncyclopediaId(state.encyclopediaStageId) ?? 0
      const nextStage = Math.max(currentStage, researchStage)
      return Object.freeze({
        ...state,
        encyclopediaStageId: `encyclopedia-stage.${nextStage}`,
      })
    }),
  )
}

function hintIsSatisfied(
  hint: ResearchHintDefinition,
  nodeState: PlayerResearchNodeState,
  playerData: PlayerData,
  stateByNodeId: ReadonlyMap<string, PlayerResearchNodeState>,
  completedProgressIds: ReadonlySet<string>,
): boolean {
  const trigger = hint.trigger
  switch (trigger.type) {
    case 'ANALYSIS':
      return (
        playerData.collection.speciesStates.find(
          (state) => state.speciesId === trigger.speciesId,
        )?.analysisBasisPoints ?? 0
      ) >= trigger.minimumBasisPoints
    case 'CATALYST':
      return getCatalystAmount(playerData.economy, trigger.catalystId) > 0
    case 'PROGRESS':
      return completedProgressIds.has(trigger.progressId)
    case 'ADJACENT': {
      const adjacent = stateByNodeId.get(trigger.nodeId)
      if (adjacent === undefined) return false
      const minimumStatus = trigger.minimumStatus ?? 'known'
      return researchStatusRank(adjacent.status) >= researchStatusRank(minimumStatus)
    }
    case 'TRIAL':
      return nodeState.incorrectTrialSignatures.length >= trigger.minimumIncorrectTrials
  }
}

function buildPlayerDataWithResearch(
  playerData: PlayerData,
  nodeStates: readonly PlayerResearchNodeState[],
  catalog: PlayerDataContentCatalog,
): PlayerData {
  const research = { nodes: nodeStates }
  const collection = {
    ...playerData.collection,
    speciesStates: updateEncyclopediaStages(
      playerData.collection.speciesStates,
      nodeStates,
      getResearchDefinitions(catalog),
    ),
  }
  return createPlayerData({ ...playerData, research, collection }, catalog)
}

export function applyResearchHintTriggers(
  playerData: PlayerData,
  context: ResearchDisclosureContext,
  catalog: PlayerDataContentCatalog,
): ResearchDisclosureResult {
  const normalized = getNormalizedResearch(playerData, catalog)
  const definitions = [...getResearchDefinitions(catalog)].sort((left, right) =>
    compareIds(left.nodeId, right.nodeId),
  )
  const completedProgressIds = new Set(
    normalizeUniqueIds(context.completedProgressIds ?? [], 'completedProgressIds'),
  )
  const mutableByNodeId = new Map(
    normalized.research.nodes.map((state) => [state.nodeId, { ...state }]),
  )
  const changeByNodeId = new Map<string, ResearchDisclosureChange>()

  let changed = true
  while (changed) {
    changed = false
    const snapshot = new Map(
      [...mutableByNodeId].map(([nodeId, state]) => [
        nodeId,
        Object.freeze({
          ...state,
          unlockedHintIds: Object.freeze([...state.unlockedHintIds]),
          incorrectTrialSignatures: Object.freeze([...state.incorrectTrialSignatures]),
        }),
      ]),
    )

    for (const definition of definitions) {
      const current = mutableByNodeId.get(definition.nodeId)
      const snapshotState = snapshot.get(definition.nodeId)
      if (current === undefined || snapshotState === undefined || current.status === 'completed') {
        continue
      }
      const newlyUnlocked = definition.hints
        .filter((hint) => !current.unlockedHintIds.includes(hint.hintId))
        .filter((hint) =>
          hintIsSatisfied(
            hint,
            snapshotState,
            normalized.playerData,
            snapshot,
            completedProgressIds,
          ),
        )
        .sort((left, right) => {
          const byStage = left.disclosureStage - right.disclosureStage
          return byStage !== 0 ? byStage : compareIds(left.hintId, right.hintId)
        })
      if (newlyUnlocked.length === 0) continue

      const beforeStage = current.disclosureStage
      const nextHintIds = normalizeUniqueIds(
        [...current.unlockedHintIds, ...newlyUnlocked.map((hint) => hint.hintId)],
        'research unlocked hints',
      )
      const afterStage = Math.max(
        beforeStage,
        ...newlyUnlocked.map((hint) => hint.disclosureStage),
      ) as ResearchDisclosureStage
      mutableByNodeId.set(definition.nodeId, {
        ...current,
        status: researchStatusForDisclosureStage(afterStage),
        disclosureStage: afterStage,
        unlockedHintIds: nextHintIds,
      })
      const existingChange = changeByNodeId.get(definition.nodeId)
      changeByNodeId.set(
        definition.nodeId,
        Object.freeze({
          nodeId: definition.nodeId,
          beforeStage: existingChange?.beforeStage ?? beforeStage,
          afterStage,
          unlockedHintIds: nextHintIds,
        }),
      )
      changed = true
    }
  }

  const nodeStates = Object.freeze(
    [...mutableByNodeId.values()]
      .sort((left, right) => compareIds(left.nodeId, right.nodeId))
      .map((state) =>
        Object.freeze({
          ...state,
          unlockedHintIds: Object.freeze([...state.unlockedHintIds]),
          incorrectTrialSignatures: Object.freeze([...state.incorrectTrialSignatures]),
        }),
      ),
  )
  const nextPlayerData = buildPlayerDataWithResearch(normalized.playerData, nodeStates, catalog)
  return Object.freeze({
    playerData: nextPlayerData,
    changes: Object.freeze(
      [...changeByNodeId.values()].sort((left, right) => compareIds(left.nodeId, right.nodeId)),
    ),
  })
}

function assertSubmissionInsideCandidateRange(
  submission: TrialResearchSubmission,
  definition: ResearchNodeDefinition,
  materialSpeciesIds: readonly SpeciesId[],
  catalystIds: readonly string[],
): void {
  if (!RESEARCH_METHODS.includes(submission.method)) {
    throw new Error(`trial research method is invalid: ${submission.method}`)
  }
  if (!definition.candidateRange.methods.includes(submission.method)) {
    throw new Error(`trial research method is outside the candidate range: ${submission.method}`)
  }
  if (
    materialSpeciesIds.length < definition.candidateRange.minimumMaterialCount ||
    materialSpeciesIds.length > definition.candidateRange.maximumMaterialCount
  ) {
    throw new Error(`trial research material count is outside the candidate range`)
  }
  if (
    catalystIds.length < definition.candidateRange.minimumCatalystCount ||
    catalystIds.length > definition.candidateRange.maximumCatalystCount
  ) {
    throw new Error(`trial research catalyst count is outside the candidate range`)
  }
  for (const speciesId of materialSpeciesIds) {
    if (!definition.candidateRange.materialSpeciesIds.includes(speciesId)) {
      throw new Error(`trial research species is outside the candidate range: ${speciesId}`)
    }
  }
  for (const catalystId of catalystIds) {
    if (!definition.candidateRange.catalystIds.includes(catalystId)) {
      throw new Error(`trial research catalyst is outside the candidate range: ${catalystId}`)
    }
  }
}

export function createTrialResearchSignature(
  submission: TrialResearchSubmission,
): string {
  const materialSpeciesIds = normalizeUniqueIds(
    submission.materialSpeciesIds,
    'trialResearch.materialSpeciesIds',
  )
  const catalystIds = normalizeUniqueIds(submission.catalystIds, 'trialResearch.catalystIds')
  return `${submission.nodeId}|${submission.method}|${materialSpeciesIds.join(',')}|${catalystIds.join(',')}`
}

function evaluateTrial(
  submission: TrialResearchSubmission,
  definition: ResearchNodeDefinition,
  materialSpeciesIds: readonly SpeciesId[],
  catalystIds: readonly string[],
): TrialResearchEvaluation {
  const recipeSpeciesIds = normalizeUniqueIds(
    definition.recipe.materialSpeciesIds,
    'research recipe materialSpeciesIds',
  )
  const recipeCatalystIds = normalizeUniqueIds(
    definition.recipe.catalystIds,
    'research recipe catalystIds',
  )
  const methodMatched = submission.method === definition.recipe.method
  const materialSpecies = Object.freeze(
    materialSpeciesIds.map((elementId) =>
      Object.freeze({ elementId, matched: recipeSpeciesIds.includes(elementId) }),
    ),
  )
  const catalysts = Object.freeze(
    catalystIds.map((elementId) =>
      Object.freeze({ elementId, matched: recipeCatalystIds.includes(elementId) }),
    ),
  )
  const materialCountMatched = materialSpeciesIds.length === recipeSpeciesIds.length
  const catalystCountMatched = catalystIds.length === recipeCatalystIds.length
  const exactMatch =
    methodMatched &&
    materialCountMatched &&
    catalystCountMatched &&
    materialSpecies.every((result) => result.matched) &&
    catalysts.every((result) => result.matched)
  return Object.freeze({
    methodMatched,
    materialSpecies,
    catalysts,
    materialCountMatched,
    catalystCountMatched,
    exactMatch,
  })
}

export function performTrialResearch(
  playerData: PlayerData,
  submission: TrialResearchSubmission,
  context: ResearchDisclosureContext,
  catalog: PlayerDataContentCatalog,
): TrialResearchResult {
  const normalized = getNormalizedResearch(playerData, catalog)
  const definition = getNodeDefinition(catalog, submission.nodeId)
  const nodeState = normalized.research.nodes.find((state) => state.nodeId === submission.nodeId)
  if (nodeState === undefined) {
    throw new Error(`research node state does not exist: ${submission.nodeId}`)
  }
  if (nodeState.status !== 'candidate') {
    throw new Error(`trial research requires candidate status: ${submission.nodeId}`)
  }

  const materialSpeciesIds = normalizeUniqueIds(
    submission.materialSpeciesIds,
    'trialResearch.materialSpeciesIds',
  )
  const catalystIds = normalizeUniqueIds(submission.catalystIds, 'trialResearch.catalystIds')
  assertSubmissionInsideCandidateRange(
    submission,
    definition,
    materialSpeciesIds,
    catalystIds,
  )

  const signature = createTrialResearchSignature({
    ...submission,
    materialSpeciesIds,
    catalystIds,
  })
  if (nodeState.incorrectTrialSignatures.includes(signature)) {
    throw new Error(`trial research signature was already attempted: ${signature}`)
  }

  const evaluation = evaluateTrial(submission, definition, materialSpeciesIds, catalystIds)
  const economy = applyEconomyTransaction(normalized.playerData.economy, {
    researchDataDelta: -definition.trialResearchDataCost,
  })
  const nextNodeStates = normalized.research.nodes.map((state) => {
    if (state.nodeId !== submission.nodeId) return state
    if (evaluation.exactMatch) {
      return Object.freeze({
        ...state,
        status: 'known' as const,
        disclosureStage: 4 as const,
      })
    }
    return Object.freeze({
      ...state,
      incorrectTrialSignatures: Object.freeze(
        [...state.incorrectTrialSignatures, signature].sort(compareIds),
      ),
    })
  })
  const withTrial = buildPlayerDataWithResearch(
    createPlayerData({ ...normalized.playerData, economy }, catalog),
    nextNodeStates,
    catalog,
  )
  const disclosure = applyResearchHintTriggers(withTrial, context, catalog)
  return Object.freeze({
    playerData: disclosure.playerData,
    nodeId: submission.nodeId,
    researchDataSpent: definition.trialResearchDataCost,
    incorrectSignature: evaluation.exactMatch ? null : signature,
    evaluation,
    disclosureChanges: disclosure.changes,
  })
}
