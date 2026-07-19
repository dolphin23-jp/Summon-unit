import { describe, expect, it } from 'vitest'
import { getTotalBarrierCapacity } from './barrier'
import { createInteractiveBattleRunner, type HeadlessBattleDefinition } from './headless-battle-runner'
import {
  T039_FOREST_BOSS,
  T039_FOREST_ELITE,
  T039_FOREST_NORMAL,
  T039_INITIAL_PLAYER_DATA,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import { createStageBattleDefinition } from '../progression/stage-battle'

function createBossBattleDefinition(): HeadlessBattleDefinition {
  const boss = T039_FOREST_BOSS.boss
  const enemy = T039_FOREST_BOSS.enemyFormation.units[0]
  if (boss === null || enemy === undefined) {
    throw new Error('T039 boss stage must define a boss enemy')
  }
  return Object.freeze({
    species: T039_PLAYER_CATALOG.species,
    skills: T039_PLAYER_CATALOG.skills,
    units: Object.freeze([
      Object.freeze({
        battleUnitId: 'ally.phase-test',
        speciesId: 'species.demo-alpha',
        position: Object.freeze({ side: 'ALLY' as const, row: 0 as const, column: 0 as const }),
        tiePriority: 0,
      }),
      Object.freeze({ ...enemy, initialHp: 70, tiePriority: 1 }),
    ]),
    aiConfigurations: T039_FOREST_BOSS.enemyFormation.aiConfigurations,
    boss,
    initialActionCost: 100,
    maxActions: 100,
  })
}

describe('boss phase runner integration', () => {
  it('reserves and resolves PHASE_CHANGE before the next unit turn', () => {
    const runner = createInteractiveBattleRunner(createBossBattleDefinition())
    expect(runner.getSnapshot().bossPhase).toMatchObject({
      currentPhaseIndex: 0,
      pendingPhaseIndex: null,
      actionSkillIds: ['skill.demo-delta'],
    })

    let sawScheduledPhase = false
    for (let step = 0; step < 100; step += 1) {
      const snapshot = runner.getSnapshot()
      if (snapshot.battle.timeline.events[0]?.kind === 'PHASE_CHANGE') {
        sawScheduledPhase = true
        const transitioned = runner.step()
        expect(transitioned.bossPhase).toMatchObject({
          currentPhaseIndex: 1,
          pendingPhaseIndex: null,
          actionSkillIds: ['skill.demo-delta', 'skill.demo-generic'],
        })
        const boss = transitioned.battle.units.find(
          (unit) => unit.battleUnitId === T039_FOREST_BOSS.boss?.bossBattleUnitId,
        )
        expect(boss).toBeDefined()
        expect(getTotalBarrierCapacity(boss?.barriers ?? [])).toBe(60)
        expect(transitioned.battle.timeline.events[0]?.kind).toBe('UNIT_TURN')
        break
      }
      expect(snapshot.status).toBe('READY')
      runner.step()
    }
    expect(sawScheduledPhase).toBe(true)
  })

  it('propagates the selected stage boss definition through formation battle generation', () => {
    const playerData = Object.freeze({
      ...T039_INITIAL_PLAYER_DATA,
      stageProgress: Object.freeze({
        completedStageIds: Object.freeze([
          T039_FOREST_NORMAL.stageId,
          T039_FOREST_ELITE.stageId,
        ]),
        settledBattleIds: Object.freeze([]),
        regionalPoints: Object.freeze([]),
      }),
    })
    const definition = createStageBattleDefinition(
      playerData,
      T039_FOREST_BOSS.stageId,
      'formation.main',
      T039_PLAYER_CATALOG,
    )
    expect(definition.boss).toEqual(T039_FOREST_BOSS.boss)
  })
})
