import { describe, expect, it } from 'vitest'
import {
  VERTICAL_SLICE_ONBOARDING_CUES,
  VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA,
  VERTICAL_SLICE_T046_STAGE_RECORDS,
  VERTICAL_SLICE_T046_VALIDATION,
} from './vertical-slice-t046'

describe('T046 onboarding cues', () => {
  it('adds one concise cue to each introductory battle', () => {
    expect(VERTICAL_SLICE_ONBOARDING_CUES.map((cue) => cue.stageId)).toEqual([
      'stage.slice.a-01-order',
      'stage.slice.a-02-cover',
      'stage.slice.a-03-movement',
    ])
    for (const cue of VERTICAL_SLICE_ONBOARDING_CUES) {
      expect(cue.headline.length).toBeGreaterThan(0)
      expect(cue.prompt.length).toBeGreaterThan(0)
      expect(cue.tip.length).toBeGreaterThan(0)
      expect(cue.prompt.length).toBeLessThanOrEqual(60)
      expect(cue.tip.length).toBeLessThanOrEqual(50)
    }
  })
})

describe('T046 data-only balance pass', () => {
  it('keeps all content counts while adjusting three outlier stages and both bosses', () => {
    expect(VERTICAL_SLICE_T046_VALIDATION).toMatchObject({
      species: 16,
      skills: 42,
      researchNodes: 10,
      regions: 2,
      stages: 17,
      bossStages: 2,
      onboardingCues: 3,
      balancedBossStages: 2,
      adjustedStages: 3,
      initialUnits: 5,
      initialFormationMembers: 3,
    })
    expect(VERTICAL_SLICE_T046_STAGE_RECORDS).toHaveLength(17)
  })

  it('starts with three AUTO-usable attackers and keeps reserve units owned', () => {
    expect(VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA.collection.unitInstances).toHaveLength(5)
    const formation = VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA.formations.formations[0]
    expect(formation?.members.map((member) => member.instanceId)).toEqual([
      'unit.slice.grassfang-01',
      'unit.slice.ember-01',
      'unit.slice.windwing-01',
    ])
    expect(
      VERTICAL_SLICE_T046_INITIAL_PLAYER_DATA.collection.unitInstances.map(
        (instance) => instance.instanceId,
      ),
    ).toEqual(
      expect.arrayContaining(['unit.slice.mudshell-01', 'unit.slice.moss-01']),
    )
  })

  it('retains each boss innate skill in every phase action table', () => {
    for (const record of VERTICAL_SLICE_T046_STAGE_RECORDS.filter(
      (candidate) => candidate.definition.boss !== null,
    )) {
      const boss = record.definition.boss
      const bossUnit = record.definition.enemyFormation.units.find(
        (unit) => unit.battleUnitId === boss?.bossBattleUnitId,
      )
      expect(bossUnit).toBeDefined()
      const expectedInnate =
        bossUnit?.speciesId === 'species.slice.molten-carapace'
          ? 'skill.slice.molten-guard'
          : 'skill.slice.disaster-assault'
      for (const phase of boss?.phases ?? []) {
        expect(phase.actionSkillIds).toContain(expectedInnate)
      }
    }
  })
})
