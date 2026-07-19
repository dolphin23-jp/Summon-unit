import type { SpeciesId } from '../content/monster-species'
import type { CatalystId } from './economy'

export type ResearchNodeId = string

export const RESEARCH_NODE_STATUSES = [
  'hidden',
  'hinted',
  'candidate',
  'known',
  'completed',
] as const
export type ResearchNodeStatus = (typeof RESEARCH_NODE_STATUSES)[number]
export type ResearchDisclosureStage = 0 | 1 | 2 | 3 | 4 | 5

export const RESEARCH_METHODS = [
  'FUSION',
  'LINEAGE',
  'CONVERGENCE',
  'TRANSCENDENCE',
] as const
export type ResearchMethod = (typeof RESEARCH_METHODS)[number]

export interface ResearchRecipe {
  readonly method: ResearchMethod
  readonly materialSpeciesIds: readonly SpeciesId[]
  readonly catalystIds: readonly CatalystId[]
}

export interface ResearchCandidateRange {
  readonly methods: readonly ResearchMethod[]
  readonly materialSpeciesIds: readonly SpeciesId[]
  readonly catalystIds: readonly CatalystId[]
  readonly minimumMaterialCount: number
  readonly maximumMaterialCount: number
  readonly minimumCatalystCount: number
  readonly maximumCatalystCount: number
}

export type ResearchHintTrigger =
  | {
      readonly type: 'ANALYSIS'
      readonly speciesId: SpeciesId
      readonly minimumBasisPoints: number
    }
  | { readonly type: 'CATALYST'; readonly catalystId: CatalystId }
  | { readonly type: 'PROGRESS'; readonly progressId: string }
  | {
      readonly type: 'ADJACENT'
      readonly nodeId: ResearchNodeId
      readonly minimumStatus?: 'known' | 'completed'
    }
  | { readonly type: 'TRIAL'; readonly minimumIncorrectTrials: number }

export interface ResearchHintDefinition {
  readonly hintId: string
  readonly disclosureStage: 1 | 2 | 3 | 4
  readonly trigger: ResearchHintTrigger
}

export interface ResearchNodeDefinition {
  readonly nodeId: ResearchNodeId
  readonly targetSpeciesId: SpeciesId
  readonly adjacentNodeIds: readonly ResearchNodeId[]
  readonly candidateRange: ResearchCandidateRange
  readonly recipe: ResearchRecipe
  readonly trialResearchDataCost: number
  readonly hints: readonly ResearchHintDefinition[]
}

export interface PlayerResearchNodeState {
  readonly nodeId: ResearchNodeId
  readonly status: ResearchNodeStatus
  readonly disclosureStage: ResearchDisclosureStage
  readonly unlockedHintIds: readonly string[]
  readonly incorrectTrialSignatures: readonly string[]
}

export interface PlayerResearchState {
  readonly nodes: readonly PlayerResearchNodeState[]
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

function normalizeUniqueStrings(values: readonly string[], field: string): readonly string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of values) {
    assertNonEmptyString(value, `${field}[]`)
    if (seen.has(value)) {
      throw new Error(`${field} must not contain duplicates: ${value}`)
    }
    seen.add(value)
    normalized.push(value)
  }
  normalized.sort(compareIds)
  return Object.freeze(normalized)
}

function normalizeMethods(methods: readonly ResearchMethod[]): readonly ResearchMethod[] {
  const seen = new Set<ResearchMethod>()
  const normalized: ResearchMethod[] = []
  for (const method of methods) {
    if (!RESEARCH_METHODS.includes(method)) {
      throw new Error(`research candidate method is invalid: ${method}`)
    }
    if (seen.has(method)) {
      throw new Error(`research candidate methods must not contain duplicates: ${method}`)
    }
    seen.add(method)
    normalized.push(method)
  }
  normalized.sort(
    (left, right) => RESEARCH_METHODS.indexOf(left) - RESEARCH_METHODS.indexOf(right),
  )
  return Object.freeze(normalized)
}

export function researchStatusForDisclosureStage(
  stage: ResearchDisclosureStage,
): ResearchNodeStatus {
  if (stage === 0) return 'hidden'
  if (stage === 1) return 'hinted'
  if (stage === 2 || stage === 3) return 'candidate'
  if (stage === 4) return 'known'
  return 'completed'
}

export function researchStatusRank(status: ResearchNodeStatus): number {
  return RESEARCH_NODE_STATUSES.indexOf(status)
}

export function assertValidResearchNetwork(
  definitions: readonly ResearchNodeDefinition[],
  knownSpeciesIds: ReadonlySet<SpeciesId>,
): void {
  const nodeIds = new Set<ResearchNodeId>()
  for (const definition of definitions) {
    assertNonEmptyString(definition.nodeId, 'researchNode.nodeId')
    if (nodeIds.has(definition.nodeId)) {
      throw new Error(`research node id must be unique: ${definition.nodeId}`)
    }
    nodeIds.add(definition.nodeId)
  }

  for (const definition of definitions) {
    if (!knownSpeciesIds.has(definition.targetSpeciesId)) {
      throw new Error(`research node target species is unknown: ${definition.targetSpeciesId}`)
    }
    if (!RESEARCH_METHODS.includes(definition.recipe.method)) {
      throw new Error(`research recipe method is invalid: ${definition.recipe.method}`)
    }
    assertSafeIntegerInRange(
      definition.trialResearchDataCost,
      1,
      Number.MAX_SAFE_INTEGER,
      'researchNode.trialResearchDataCost',
    )

    const adjacentNodeIds = normalizeUniqueStrings(
      definition.adjacentNodeIds,
      'researchNode.adjacentNodeIds',
    )
    for (const adjacentNodeId of adjacentNodeIds) {
      if (adjacentNodeId === definition.nodeId) {
        throw new Error(`research node must not reference itself: ${definition.nodeId}`)
      }
      if (!nodeIds.has(adjacentNodeId)) {
        throw new Error(`research node references unknown adjacent node: ${adjacentNodeId}`)
      }
    }

    const candidateMethods = normalizeMethods(definition.candidateRange.methods)
    if (!candidateMethods.includes(definition.recipe.method)) {
      throw new Error(`research recipe method must be inside candidate range: ${definition.nodeId}`)
    }

    const candidateSpeciesIds = normalizeUniqueStrings(
      definition.candidateRange.materialSpeciesIds,
      'researchNode.candidateRange.materialSpeciesIds',
    )
    const recipeSpeciesIds = normalizeUniqueStrings(
      definition.recipe.materialSpeciesIds,
      'researchNode.recipe.materialSpeciesIds',
    )
    for (const speciesId of [...candidateSpeciesIds, ...recipeSpeciesIds]) {
      if (!knownSpeciesIds.has(speciesId)) {
        throw new Error(`research node material species is unknown: ${speciesId}`)
      }
    }
    for (const speciesId of recipeSpeciesIds) {
      if (!candidateSpeciesIds.includes(speciesId)) {
        throw new Error(`research recipe species must be inside candidate range: ${speciesId}`)
      }
    }

    const candidateCatalystIds = normalizeUniqueStrings(
      definition.candidateRange.catalystIds,
      'researchNode.candidateRange.catalystIds',
    )
    const recipeCatalystIds = normalizeUniqueStrings(
      definition.recipe.catalystIds,
      'researchNode.recipe.catalystIds',
    )
    for (const catalystId of recipeCatalystIds) {
      if (!candidateCatalystIds.includes(catalystId)) {
        throw new Error(`research recipe catalyst must be inside candidate range: ${catalystId}`)
      }
    }

    assertSafeIntegerInRange(
      definition.candidateRange.minimumMaterialCount,
      0,
      Number.MAX_SAFE_INTEGER,
      'researchNode.candidateRange.minimumMaterialCount',
    )
    assertSafeIntegerInRange(
      definition.candidateRange.maximumMaterialCount,
      definition.candidateRange.minimumMaterialCount,
      Number.MAX_SAFE_INTEGER,
      'researchNode.candidateRange.maximumMaterialCount',
    )
    assertSafeIntegerInRange(
      definition.candidateRange.minimumCatalystCount,
      0,
      Number.MAX_SAFE_INTEGER,
      'researchNode.candidateRange.minimumCatalystCount',
    )
    assertSafeIntegerInRange(
      definition.candidateRange.maximumCatalystCount,
      definition.candidateRange.minimumCatalystCount,
      Number.MAX_SAFE_INTEGER,
      'researchNode.candidateRange.maximumCatalystCount',
    )
    if (
      recipeSpeciesIds.length < definition.candidateRange.minimumMaterialCount ||
      recipeSpeciesIds.length > definition.candidateRange.maximumMaterialCount
    ) {
      throw new Error(
        `research recipe material count must be inside candidate range: ${definition.nodeId}`,
      )
    }
    if (
      recipeCatalystIds.length < definition.candidateRange.minimumCatalystCount ||
      recipeCatalystIds.length > definition.candidateRange.maximumCatalystCount
    ) {
      throw new Error(
        `research recipe catalyst count must be inside candidate range: ${definition.nodeId}`,
      )
    }

    const hintIds = new Set<string>()
    for (const hint of definition.hints) {
      assertNonEmptyString(hint.hintId, 'researchHint.hintId')
      if (hintIds.has(hint.hintId)) {
        throw new Error(`research hint id must be unique inside node: ${hint.hintId}`)
      }
      hintIds.add(hint.hintId)
      assertSafeIntegerInRange(hint.disclosureStage, 1, 4, 'researchHint.disclosureStage')
      switch (hint.trigger.type) {
        case 'ANALYSIS':
          if (!knownSpeciesIds.has(hint.trigger.speciesId)) {
            throw new Error(
              `research analysis hint species is unknown: ${hint.trigger.speciesId}`,
            )
          }
          assertSafeIntegerInRange(
            hint.trigger.minimumBasisPoints,
            0,
            10_000,
            'researchHint.minimumBasisPoints',
          )
          break
        case 'CATALYST':
          assertNonEmptyString(hint.trigger.catalystId, 'researchHint.catalystId')
          break
        case 'PROGRESS':
          assertNonEmptyString(hint.trigger.progressId, 'researchHint.progressId')
          break
        case 'ADJACENT':
          if (!nodeIds.has(hint.trigger.nodeId)) {
            throw new Error(
              `research adjacent hint references unknown node: ${hint.trigger.nodeId}`,
            )
          }
          if (
            hint.trigger.minimumStatus !== undefined &&
            hint.trigger.minimumStatus !== 'known' &&
            hint.trigger.minimumStatus !== 'completed'
          ) {
            throw new Error('research adjacent hint minimum status is invalid')
          }
          break
        case 'TRIAL':
          assertSafeIntegerInRange(
            hint.trigger.minimumIncorrectTrials,
            1,
            Number.MAX_SAFE_INTEGER,
            'researchHint.minimumIncorrectTrials',
          )
          break
      }
    }
  }
}

export function createPlayerResearchState(
  input: PlayerResearchState,
  definitions: readonly ResearchNodeDefinition[],
  knownSpeciesIds: ReadonlySet<SpeciesId>,
): PlayerResearchState {
  assertValidResearchNetwork(definitions, knownSpeciesIds)
  const definitionById = new Map(
    definitions.map((definition) => [definition.nodeId, definition]),
  )
  const inputById = new Map<ResearchNodeId, PlayerResearchNodeState>()
  for (const state of input.nodes) {
    if (inputById.has(state.nodeId)) {
      throw new Error(`player research node state must be unique: ${state.nodeId}`)
    }
    if (!definitionById.has(state.nodeId)) {
      throw new Error(`player research state references unknown node: ${state.nodeId}`)
    }
    inputById.set(state.nodeId, state)
  }

  const nodes = [...definitions]
    .sort((left, right) => compareIds(left.nodeId, right.nodeId))
    .map((definition) => {
      const inputState = inputById.get(definition.nodeId)
      if (inputState === undefined) {
        return Object.freeze({
          nodeId: definition.nodeId,
          status: 'hidden' as const,
          disclosureStage: 0 as const,
          unlockedHintIds: Object.freeze([] as string[]),
          incorrectTrialSignatures: Object.freeze([] as string[]),
        })
      }
      if (!RESEARCH_NODE_STATUSES.includes(inputState.status)) {
        throw new Error(`research node status is invalid: ${inputState.status}`)
      }
      assertSafeIntegerInRange(
        inputState.disclosureStage,
        0,
        5,
        'playerResearchNode.disclosureStage',
      )
      if (researchStatusForDisclosureStage(inputState.disclosureStage) !== inputState.status) {
        throw new Error(
          `research node status and disclosure stage disagree: ${definition.nodeId}`,
        )
      }
      const unlockedHintIds = normalizeUniqueStrings(
        inputState.unlockedHintIds,
        'playerResearchNode.unlockedHintIds',
      )
      const validHintIds = new Set(definition.hints.map((hint) => hint.hintId))
      for (const hintId of unlockedHintIds) {
        if (!validHintIds.has(hintId)) {
          throw new Error(`player research node references unknown hint: ${hintId}`)
        }
      }
      const incorrectTrialSignatures = normalizeUniqueStrings(
        inputState.incorrectTrialSignatures,
        'playerResearchNode.incorrectTrialSignatures',
      )
      const highestHintStage = definition.hints.reduce(
        (maximum, hint) =>
          unlockedHintIds.includes(hint.hintId)
            ? Math.max(maximum, hint.disclosureStage)
            : maximum,
        0,
      )
      if (inputState.disclosureStage < highestHintStage) {
        throw new Error(
          `research node disclosure stage is below an unlocked hint: ${definition.nodeId}`,
        )
      }
      return Object.freeze({
        nodeId: definition.nodeId,
        status: inputState.status,
        disclosureStage: inputState.disclosureStage,
        unlockedHintIds,
        incorrectTrialSignatures,
      })
    })

  return Object.freeze({ nodes: Object.freeze(nodes) })
}
