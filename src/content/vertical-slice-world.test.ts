import { describe, expect, it } from 'vitest'
import {
  getRegionAccessState,
  getStageAccessState,
  normalizeRegionProgression,
} from '../progression/region-progression'
import {
  VERTICAL_SLICE_ENEMY_FORMATION_TICKETS,
  VERTICAL_SLICE_INITIAL_PLAYER_DATA,
  VERTICAL_SLICE_RESEARCH_HINT_COPIES,
  VERTICAL_SLICE_RESEARCH_RECORDS,
  VERTICAL_SLICE_STAGE_RECORDS,
  VERTICAL_SLICE_STAGES,
  VERTICAL_SLICE_WORLD_CATALOG,
  VERTICAL_SLICE_WORLD_VALIDATION,
  validateVerticalSliceWorld,
} from './vertical-slice-world'

describe('T045 vertical slice research network', () => {
  it('contains ten recipes, complete hint copy, and at most one hidden research node', () => {
    expect(VERTICAL_SLICE_RESEARCH_RECORDS).toHaveLength(10)
    expect(VERTICAL_SLICE_RESEARCH_HINT_COPIES).toHaveLength(40)
    expect(VERTICAL_SLICE_RESEARCH_RECORDS.filter((record) => record.hidden)).toHaveLength(1)

    for (const record of VERTICAL_SLICE_RESEARCH_RECORDS) {
      expect(record.definition.hints).toHaveLength(4)
      expect(record.hintCopies.map((copy) => copy.hintId)).toEqual(
        record.definition.hints.map((hint) => hint.hintId),
      )
      expect(record.hintCopies.every((copy) => copy.text.length > 0)).toBe(true)
    }
  })
})

describe('T045 regions A and B', () => {
  it('contains nine region A battles and six region B battles plus two bosses', () => {
    const regionA = VERTICAL_SLICE_STAGES.filter((stage) => stage.regionId === 'region.slice-a')
    const regionB = VERTICAL_SLICE_STAGES.filter((stage) => stage.regionId === 'region.slice-b')
    expect(regionA).toHaveLength(9)
    expect(regionB).toHaveLength(8)
    expect(regionB.filter((stage) => stage.kind === 'BOSS')).toHaveLength(2)
    expect(VERTICAL_SLICE_ENEMY_FORMATION_TICKETS).toHaveLength(17)
  })

  it('stages every required learning mechanic and gives every stage a complete enemy ticket', () => {
    const mechanics = new Set(
      VERTICAL_SLICE_STAGE_RECORDS.flatMap((record) => record.mechanicIds),
    )
    expect([...mechanics]).toEqual(
      expect.arrayContaining([
        'action-order',
        'cover',
        'movement',
        'direct-range',
        'healing',
        'poison',
        'force-move',
        'burn',
        'burning-terrain',
        'barrier',
        'pierce',
        'time-delay',
        'telegraph',
        'summon',
      ]),
    )
    for (const ticket of VERTICAL_SLICE_ENEMY_FORMATION_TICKETS) {
      expect(ticket.intent.length).toBeGreaterThan(0)
      expect(ticket.mostDangerousEnemy.length).toBeGreaterThan(0)
      expect(ticket.counterplay.length).toBeGreaterThan(0)
      expect(ticket.aiPlan.length).toBeGreaterThan(0)
      expect(ticket.lessonOnDefeat.length).toBeGreaterThan(0)
    }
  })

  it('starts at A-01, keeps later A stages locked, and locks region B behind A-09', () => {
    const normalized = normalizeRegionProgression(VERTICAL_SLICE_WORLD_CATALOG)
    const regionA = normalized.regions.find((region) => region.regionId === 'region.slice-a')
    const regionB = normalized.regions.find((region) => region.regionId === 'region.slice-b')
    const first = normalized.stages.find((stage) => stage.stageId === 'stage.slice.a-01-order')
    const second = normalized.stages.find((stage) => stage.stageId === 'stage.slice.a-02-cover')
    expect(regionA).toBeDefined()
    expect(regionB).toBeDefined()
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(getRegionAccessState(VERTICAL_SLICE_INITIAL_PLAYER_DATA, regionA!).unlocked).toBe(true)
    expect(getRegionAccessState(VERTICAL_SLICE_INITIAL_PLAYER_DATA, regionB!).unlocked).toBe(false)
    expect(getStageAccessState(VERTICAL_SLICE_INITIAL_PLAYER_DATA, first!).unlocked).toBe(true)
    expect(getStageAccessState(VERTICAL_SLICE_INITIAL_PLAYER_DATA, second!).unlocked).toBe(false)
  })
})

describe('T045 integrated catalog', () => {
  it('returns the fixed validation and initial-progression summary', () => {
    expect(VERTICAL_SLICE_WORLD_VALIDATION).toEqual({
      species: 16,
      skills: 42,
      genericSkillCosts: 10,
      researchNodes: 10,
      finalResearchDefinitions: 10,
      bloomResearchDefinitions: 16,
      researchFacilityStages: 3,
      regions: 2,
      stages: 17,
      bossStages: 2,
      authoredResearchNodes: 10,
      hintTexts: 40,
      hiddenResearchNodes: 1,
      stageTickets: 17,
      regionAStages: 9,
      regionBStages: 8,
      regionBBosses: 2,
      initialBlueprints: 6,
      initialUnits: 4,
    })
    expect(VERTICAL_SLICE_INITIAL_PLAYER_DATA.collection.unitInstances).toHaveLength(4)
    expect(VERTICAL_SLICE_INITIAL_PLAYER_DATA.formations.formations[0]?.members).toHaveLength(3)
    expect(VERTICAL_SLICE_INITIAL_PLAYER_DATA.research?.nodes).toHaveLength(10)
  })

  it('is byte-stable across 100 validations', () => {
    const expected = JSON.stringify(validateVerticalSliceWorld())
    for (let run = 0; run < 100; run += 1) {
      expect(JSON.stringify(validateVerticalSliceWorld())).toBe(expected)
    }
  })
})
