export const BATTLE_MOTION_LEVELS = ['STANDARD', 'REDUCED', 'MINIMAL'] as const

export type BattleMotionLevel = (typeof BATTLE_MOTION_LEVELS)[number]

export const BATTLE_MOTION_STORAGE_KEY = 'summon-unit:battle-motion-level'

export function isBattleMotionLevel(value: unknown): value is BattleMotionLevel {
  return typeof value === 'string' && BATTLE_MOTION_LEVELS.includes(value as BattleMotionLevel)
}

export function resolveInitialBattleMotionLevel(
  storedValue: unknown,
  prefersReducedMotion: boolean,
): BattleMotionLevel {
  if (isBattleMotionLevel(storedValue)) {
    return storedValue
  }
  return prefersReducedMotion ? 'REDUCED' : 'STANDARD'
}
