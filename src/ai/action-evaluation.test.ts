import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { createBattleState } from '../battle/defeat-and-victory'
import { createOccupyingBoardObjectState } from '../battle/occupying-board-object'
import { createBattleUnitState } from '../battle/unit-state'
import {
  composeAiScore,
  enumerateAiActionCandidates,
  evaluateAiActionCandidates,
  evaluateAiActionPreview,
  previewAiActionCandidate,
  selectBestAiActionEvaluation,
  type AiActionResultPreview,
  type AiEvaluationInput,
  type AiPreviewScorer,
  type AiSkillActionCandidate,
} from './action-evaluation'

const SKILLS: readonly SkillDefinition[] = Object.freeze([
  Object.freeze({
    id: 'skill.ai.direct',
    slotType: 'INNATE',
    actionCost: 80,
    targetType: 'SINGLE_ENEMY',
    reachMethod: 'DIRECT',
    areaMask: 'SINGLE',
    damageMultiplierPermille: 1000,
  }),
  Object.freeze({
    id: 'skill.ai.arc-cross',
    slotType: 'GENERIC',
    actionCost: 120,
    telegraphDelay: 25,
    targetType: 'SINGLE_ENEMY',
    reachMethod: 'ARC',
    areaMask: 'CROSS',
    damageMultiplierPermille: 900,
  }),
  Object.freeze({
    id: 'skill.ai.self',
    slotType: 'GENERIC',
    actionCost: 60,
    targetType: 'SELF',
    damageMultiplierPermille: 1000,
  }),
])

const SPECIES: readonly MonsterSpecies[] = Object.freeze([
  Object.freeze({
    id: 'species.ai.actor',
    rarity: 2,
    attributeId: 'attribute.fire',
    primarySpeciesId: 'species-group.ai.actor',
    tagIds: Object.freeze(['tag.ai']),
    innateSkillId: 'skill.ai.direct',
    stats: Object.freeze({ hp: 100, attack: 40, defense: 10, speed: 5 }),
  }),
  Object.freeze({
    id: 'species.ai.ally',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'species-group.ai.ally',
    tagIds: Object.freeze(['tag.ai']),
    innateSkillId: 'skill.ai.self',
    stats: Object.freeze({ hp: 80, attack: 10, defense: 15, speed: 3 }),
  }),
  Object.freeze({
    id: 'species.ai.front',
    rarity: 2,
    attributeId: 'attribute.wind',
    primarySpeciesId: 'species-group.ai.front',
    tagIds: Object.freeze(['tag.ai']),
    innateSkillId: 'skill.ai.direct',
    stats: Object.freeze({ hp: 60, attack: 22, defense: 10, speed: 3 }),
  }),
  Object.freeze({
    id: 'species.ai.back',
    rarity: 1,
    attributeId: 'attribute.earth',
    primarySpeciesId: 'species-group.ai.back',
    tagIds: Object.freeze(['tag.ai']),
    innateSkillId: 'skill.ai.direct',
    stats: Object.freeze({ hp: 50, attack: 18, defense: 0, speed: 2 }),
  }),
  Object.freeze({
    id: 'species.ai.side',
    rarity: 1,
    attributeId: 'attribute.neutral',
    primarySpeciesId: 'species-group.ai.side',
    tagIds: Object.freeze(['tag.ai']),
    innateSkillId: 'skill.ai.direct',
    stats: Object.freeze({ hp: 55, attack: 18, defense: 5, speed: 2 }),
  }),
])

const SPECIES_BY_ID: Readonly<Record<string, MonsterSpecies>> = Object.freeze(
  Object.fromEntries(SPECIES.map((species) => [species.id, species])),
)

function getSpecies(id: string): MonsterSpecies {
  const species = SPECIES_BY_ID[id]
  if (species === undefined) {
    throw new Error(`missing test species: ${id}`)
  }
  return species
}

function createInput(
  availableSkills: readonly SkillDefinition[] = SKILLS,
): AiEvaluationInput {
  const units = [
    createBattleUnitState(getSpecies('species.ai.actor'), {
      battleUnitId: 'ally.actor',
      position: { side: 'ALLY', row: 0, column: 1 },
    }),
    createBattleUnitState(getSpecies('species.ai.ally'), {
      battleUnitId: 'ally.blocker',
      position: { side: 'ALLY', row: 1, column: 1 },
    }),
    createBattleUnitState(getSpecies('species.ai.front'), {
      battleUnitId: 'enemy.front',
      position: { side: 'ENEMY', row: 0, column: 1 },
    }),
    createBattleUnitState(getSpecies('species.ai.back'), {
      battleUnitId: 'enemy.back',
      position: { side: 'ENEMY', row: 2, column: 1 },
    }),
    createBattleUnitState(getSpecies('species.ai.side'), {
      battleUnitId: 'enemy.side',
      position: { side: 'ENEMY', row: 1, column: 0 },
    }),
  ]
  const battle = createBattleState({ units })
  const occupyingObjects = Object.freeze([
    createOccupyingBoardObjectState({
      boardObjectId: 'object.ai.wall',
      objectTypeId: 'object-type.ai.wall',
      position: { side: 'ALLY', row: 1, column: 0 },
      maxHp: 20,
    }),
  ])
  return Object.freeze({
    battle,
    actorBattleUnitId: 'ally.actor',
    speciesById: SPECIES_BY_ID,
    availableSkills,
    occupyingObjects,
  })
}

function findSkillCandidate(
  input: AiEvaluationInput,
  skillId: string,
  targetBattleUnitId: string | null,
  positionId?: string,
): AiSkillActionCandidate {
  const candidate = enumerateAiActionCandidates(input).find(
    (value) =>
      value.kind === 'USE_SKILL' &&
      value.skillId === skillId &&
      value.selectedTargetBattleUnitId === targetBattleUnitId &&
      (positionId === undefined ||
        (value.selectedTargetPosition !== null &&
          `${value.selectedTargetPosition.side}:${value.selectedTargetPosition.row}:${value.selectedTargetPosition.column}` ===
            positionId)),
  )
  if (candidate === undefined || candidate.kind !== 'USE_SKILL') {
    throw new Error('missing test skill candidate')
  }
  return candidate
}

describe('AI action evaluation foundation', () => {
  it('enumerates skill-target and movement candidates in a stable order', () => {
    const input = createInput()
    const candidates = enumerateAiActionCandidates(input)

    expect(candidates).toHaveLength(15)
    expect(candidates.filter((candidate) => candidate.kind === 'USE_SKILL')).toHaveLength(12)
    expect(candidates.filter((candidate) => candidate.kind === 'MOVE')).toHaveLength(3)
    expect(
      candidates
        .filter((candidate) => candidate.kind === 'MOVE')
        .map((candidate) => candidate.candidateId),
    ).toEqual(['move:ALLY:0:0', 'move:ALLY:0:2', 'move:ALLY:1:2'])

    const reversed = createInput([...SKILLS].reverse())
    expect(
      enumerateAiActionCandidates(reversed).map((candidate) => candidate.candidateId),
    ).toEqual(candidates.map((candidate) => candidate.candidateId))
  })

  it('previews DIRECT cover using the actual front target without mutating battle state', () => {
    const input = createInput()
    const before = structuredClone(input.battle)
    const candidate = findSkillCandidate(input, 'skill.ai.direct', 'enemy.back')
    const preview = previewAiActionCandidate(input, candidate)

    expect(preview.kind).toBe('USE_SKILL')
    if (preview.kind !== 'USE_SKILL') {
      throw new Error('expected skill preview')
    }
    expect(preview.reach).toMatchObject({
      selectedTargetBattleUnitId: 'enemy.back',
      actualTargetBattleUnitId: 'enemy.front',
      blockedByBattleUnitId: 'enemy.front',
    })
    expect(preview.targetResults).toHaveLength(1)
    expect(preview.targetResults[0]).toMatchObject({
      battleUnitId: 'enemy.front',
      hpBefore: 60,
    })
    expect(preview.targetResults[0].appliedDamage).toBeGreaterThan(0)
    expect(input.battle).toEqual(before)
  })

  it('previews ARC area targets, telegraph timing, and aggregate damage', () => {
    const input = createInput()
    const candidate = findSkillCandidate(
      input,
      'skill.ai.arc-cross',
      null,
      'ENEMY:1:1',
    )
    const preview = previewAiActionCandidate(input, candidate)

    expect(preview.kind).toBe('USE_SKILL')
    if (preview.kind !== 'USE_SKILL') {
      throw new Error('expected skill preview')
    }
    expect(preview.telegraphDelay).toBe(25)
    expect(preview.affectedPositionIds).toEqual([
      'ENEMY:2:1',
      'ENEMY:1:0',
      'ENEMY:1:1',
      'ENEMY:1:2',
      'ENEMY:0:1',
    ])
    expect(preview.targetResults.map((result) => result.battleUnitId)).toEqual([
      'enemy.back',
      'enemy.side',
      'enemy.front',
    ])
    expect(preview.totalAppliedDamage).toBe(
      preview.targetResults.reduce((sum, result) => sum + result.appliedDamage, 0),
    )
  })

  it('previews movement as a pure position delta', () => {
    const input = createInput()
    const before = structuredClone(input.battle)
    const candidate = enumerateAiActionCandidates(input).find(
      (value) => value.kind === 'MOVE' && value.candidateId === 'move:ALLY:0:0',
    )
    if (candidate === undefined) {
      throw new Error('missing move candidate')
    }

    expect(previewAiActionCandidate(input, candidate)).toMatchObject({
      kind: 'MOVE',
      actionCost: 75,
      fromPositionId: 'ALLY:0:1',
      toPositionId: 'ALLY:0:0',
      targetResults: [],
    })
    expect(input.battle).toEqual(before)
  })

  it('composes score components by stable priority and id order', () => {
    expect(
      composeAiScore([
        { id: 'damage', priority: 20, value: 400 },
        { id: 'cost', priority: 10, value: -80 },
        { id: 'defeat', priority: 20, value: 1000 },
      ]),
    ).toEqual({
      components: [
        { id: 'cost', priority: 10, value: -80 },
        { id: 'damage', priority: 20, value: 400 },
        { id: 'defeat', priority: 20, value: 1000 },
      ],
      total: 1320,
    })
  })

  it('evaluates pluggable scorers and uses fixed candidate tie rules', () => {
    const input = createInput()
    const scorers: readonly AiPreviewScorer[] = Object.freeze([
      Object.freeze({
        id: 'immediate-damage',
        priority: 20,
        score: (preview: AiActionResultPreview) =>
          preview.kind === 'USE_SKILL' ? preview.totalAppliedDamage : 0,
      }),
      Object.freeze({
        id: 'action-cost',
        priority: 10,
        score: (preview: AiActionResultPreview) => -preview.actionCost,
      }),
    ])
    const best = selectBestAiActionEvaluation(input, scorers)

    expect(best).not.toBeNull()
    expect(best?.score.components.map((component) => component.id)).toEqual([
      'action-cost',
      'immediate-damage',
    ])

    const tied = evaluateAiActionCandidates(input, [])
    expect(tied[0]?.preview.kind).toBe('USE_SKILL')
    expect(tied.map((evaluation) => evaluation.tieBreakKey)).toEqual(
      [...tied.map((evaluation) => evaluation.tieBreakKey)].sort((left, right) => {
        const leftKind = left.startsWith('skill:') ? 0 : 1
        const rightKind = right.startsWith('skill:') ? 0 : 1
        return leftKind !== rightKind
          ? leftKind - rightKind
          : left.localeCompare(right)
      }),
    )
  })

  it('returns byte-identical candidates, previews, and evaluations for 100 runs', () => {
    const input = createInput()
    const scorer: AiPreviewScorer = Object.freeze({
      id: 'damage-minus-cost',
      priority: 0,
      score: (preview: AiActionResultPreview) =>
        (preview.kind === 'USE_SKILL' ? preview.totalAppliedDamage : 0) -
        preview.actionCost,
    })
    const run = () =>
      JSON.stringify(
        evaluateAiActionCandidates(input, [scorer]).map((evaluation) => ({
          candidateId: evaluation.preview.candidate.candidateId,
          preview: evaluation.preview,
          score: evaluation.score,
        })),
      )
    const expected = run()

    for (let index = 0; index < 100; index += 1) {
      expect(run()).toBe(expected)
    }
  })

  it('rejects duplicate skills, scorer ids, and unsafe scorer outputs', () => {
    const duplicateSkillInput = createInput([SKILLS[0], SKILLS[0]])
    expect(() => enumerateAiActionCandidates(duplicateSkillInput)).toThrow(
      'availableSkills must not repeat skill id',
    )

    const input = createInput()
    const preview = previewAiActionCandidate(
      input,
      enumerateAiActionCandidates(input)[0],
    )
    expect(() =>
      evaluateAiActionPreview(preview, [
        { id: 'same', priority: 0, score: () => 1 },
        { id: 'same', priority: 1, score: () => 2 },
      ]),
    ).toThrow('scorer id must be unique')
    expect(() =>
      evaluateAiActionPreview(preview, [
        { id: 'unsafe', priority: 0, score: () => Number.POSITIVE_INFINITY },
      ]),
    ).toThrow('must be a safe integer')
  })
})
