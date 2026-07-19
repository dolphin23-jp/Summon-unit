import { describe, expect, it } from 'vitest'
import { T038_BOSS_STAGE, T038_PLAYER_CATALOG } from '../demo/stage-reward-demo'
import { getTotalBarrierCapacity } from './barrier'
import {
  createBossPhaseRuntimeState,
  reserveBossPhaseChange,
  resolveBossPhaseChange,
} from './boss-phase'
import { createBattleState } from './defeat-and-victory'
import { createTimelineQueue, popTimelineEvent } from './timeline-queue'
import { createBattleUnitState } from './unit-state'

function speciesById() {
  return Object.freeze(
    Object.fromEntries(T038_PLAYER_CATALOG.species.map((species) => [species.id, species])),
  )
}

describe('boss phase changes', () => {
  it('reserves PHASE_CHANGE ahead of unit turns and applies the phase action table and barrier', () => {
    const bossDefinition = T038_BOSS_STAGE.boss
    if (bossDefinition === null) throw new Error('boss demo must define phases')
    const species = speciesById()
    const allySpecies = species['species.demo-alpha']
    const bossSpecies = species['species.demo-delta']
    if (allySpecies === undefined || bossSpecies === undefined) {
      throw new Error('demo species are missing')
    }
    const battle = createBattleState({
      units: [
        createBattleUnitState(allySpecies, {
          battleUnitId: 'ally.test',
          position: { side: 'ALLY', row: 0, column: 0 },
        }),
        createBattleUnitState(bossSpecies, {
          battleUnitId: bossDefinition.bossBattleUnitId,
          position: { side: 'ENEMY', row: 0, column: 0 },
          initialHp: 60,
        }),
      ],
      timeline: createTimelineQueue([
        {
          id: 'unit-turn:ally.test:1',
          time: 50,
          priority: 0,
          sequence: 1,
          kind: 'UNIT_TURN',
          payload: { battleUnitId: 'ally.test' },
        },
      ]),
    })
    const knownSkillIds = new Set(T038_PLAYER_CATALOG.skills.map((skill) => skill.id))
    const initial = createBossPhaseRuntimeState(bossDefinition, battle, knownSkillIds)
    expect(initial.actionSkillIds).toEqual(['skill.demo-delta'])

    const reserved = reserveBossPhaseChange({
      battle,
      state: initial,
      definition: bossDefinition,
      speciesById: species,
      knownSkillIds,
      currentTime: 50,
      sequence: 2,
    })
    expect(reserved.event?.kind).toBe('PHASE_CHANGE')
    expect(reserved.state.pendingPhaseIndex).toBe(1)
    const popped = popTimelineEvent(reserved.battle.timeline)
    expect(popped.event?.kind).toBe('PHASE_CHANGE')
    if (popped.event === null) throw new Error('phase event must be scheduled')

    const resolved = resolveBossPhaseChange({
      battle: Object.freeze({ ...reserved.battle, timeline: popped.queue }),
      state: reserved.state,
      definition: bossDefinition,
      event: popped.event,
      speciesById: species,
      knownSkillIds,
      barrierApplicationSequence: 10,
    })
    expect(resolved.fromPhaseId).toBe('forest-boss.phase-1')
    expect(resolved.toPhaseId).toBe('forest-boss.phase-2')
    expect(resolved.state.currentPhaseIndex).toBe(1)
    expect(resolved.state.pendingPhaseIndex).toBeNull()
    expect(resolved.actionSkillIds).toEqual(['skill.demo-delta', 'skill.demo-generic'])
    const boss = resolved.battle.units.find(
      (unit) => unit.battleUnitId === bossDefinition.bossBattleUnitId,
    )
    expect(boss).toBeDefined()
    expect(getTotalBarrierCapacity(boss?.barriers ?? [])).toBe(60)
    expect(popTimelineEvent(resolved.battle.timeline).event?.kind).toBe('UNIT_TURN')
  })

  it('does not reserve a phase before its HP threshold', () => {
    const bossDefinition = T038_BOSS_STAGE.boss
    if (bossDefinition === null) throw new Error('boss demo must define phases')
    const species = speciesById()
    const allySpecies = species['species.demo-alpha']
    const bossSpecies = species['species.demo-delta']
    if (allySpecies === undefined || bossSpecies === undefined) {
      throw new Error('demo species are missing')
    }
    const battle = createBattleState({
      units: [
        createBattleUnitState(allySpecies, {
          battleUnitId: 'ally.test',
          position: { side: 'ALLY', row: 0, column: 0 },
        }),
        createBattleUnitState(bossSpecies, {
          battleUnitId: bossDefinition.bossBattleUnitId,
          position: { side: 'ENEMY', row: 0, column: 0 },
          initialHp: 100,
        }),
      ],
    })
    const knownSkillIds = new Set(T038_PLAYER_CATALOG.skills.map((skill) => skill.id))
    const initial = createBossPhaseRuntimeState(bossDefinition, battle, knownSkillIds)
    const reserved = reserveBossPhaseChange({
      battle,
      state: initial,
      definition: bossDefinition,
      speciesById: species,
      knownSkillIds,
      currentTime: 10,
      sequence: 0,
    })
    expect(reserved.event).toBeNull()
    expect(reserved.battle).toBe(battle)
  })
})
