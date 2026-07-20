import type { MonsterSpecies } from '../content/monster-species'
import { applyHealingReceivedModifier } from './stat-modifiers'
import { assertValidBattleUnitState, type BattleUnitState } from './unit-state'

export interface HealingResolution {
  readonly before: BattleUnitState
  readonly after: BattleUnitState
  readonly baseHealing: number
  readonly modifiedHealing: number
  readonly appliedHealing: number
  readonly overheal: number
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

export function resolveUnitHealing(
  target: BattleUnitState,
  targetSpecies: MonsterSpecies,
  baseHealing: number,
): HealingResolution {
  assertValidBattleUnitState(target, targetSpecies)
  assertSafeIntegerAtLeast(baseHealing, 1, 'baseHealing')
  if (target.defeated) throw new Error('defeated unit cannot receive healing')
  const modifiedHealing = applyHealingReceivedModifier(baseHealing, target.effects)
  const missingHp = Math.max(0, targetSpecies.stats.hp - target.hp)
  const appliedHealing = Math.min(modifiedHealing, missingHp)
  const after = Object.freeze({ ...target, hp: target.hp + appliedHealing })
  assertValidBattleUnitState(after, targetSpecies)
  return Object.freeze({
    before: target,
    after,
    baseHealing,
    modifiedHealing,
    appliedHealing,
    overheal: modifiedHealing - appliedHealing,
  })
}
