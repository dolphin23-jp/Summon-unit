import type { BattleUnitId } from './unit-state'

export type GuardShareId = string

export interface GuardShareState {
  readonly guardShareId: GuardShareId
  readonly protectedBattleUnitId: BattleUnitId
  readonly guardBattleUnitId: BattleUnitId
  readonly sharePermille: number
  readonly applicationSequence: number
}

export interface CreateGuardShareInput {
  readonly guardShareId?: GuardShareId
  readonly protectedBattleUnitId: BattleUnitId
  readonly guardBattleUnitId: BattleUnitId
  readonly sharePermille: number
  readonly applicationSequence: number
}

function assertNonEmptyId(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

export function getGuardShareId(
  protectedBattleUnitId: BattleUnitId,
  applicationSequence: number,
): GuardShareId {
  assertNonEmptyId(protectedBattleUnitId, 'protectedBattleUnitId')
  assertSafeIntegerAtLeast(applicationSequence, 0, 'applicationSequence')
  return `guard-share:${protectedBattleUnitId}:${applicationSequence}`
}

export function assertValidGuardShareState(guardShare: GuardShareState): void {
  assertNonEmptyId(guardShare.guardShareId, 'guardShare.guardShareId')
  assertNonEmptyId(
    guardShare.protectedBattleUnitId,
    'guardShare.protectedBattleUnitId',
  )
  assertNonEmptyId(guardShare.guardBattleUnitId, 'guardShare.guardBattleUnitId')
  if (guardShare.protectedBattleUnitId === guardShare.guardBattleUnitId) {
    throw new Error('guard share must use different protected and guard units')
  }
  assertSafeIntegerAtLeast(guardShare.sharePermille, 1, 'guardShare.sharePermille')
  if (guardShare.sharePermille > 1000) {
    throw new Error('guardShare.sharePermille must not exceed 1000')
  }
  assertSafeIntegerAtLeast(
    guardShare.applicationSequence,
    0,
    'guardShare.applicationSequence',
  )
}

export function freezeGuardShareState(guardShare: GuardShareState): GuardShareState {
  assertValidGuardShareState(guardShare)
  return Object.freeze({ ...guardShare })
}

export function createGuardShare(input: CreateGuardShareInput): GuardShareState {
  return freezeGuardShareState({
    guardShareId:
      input.guardShareId ??
      getGuardShareId(input.protectedBattleUnitId, input.applicationSequence),
    protectedBattleUnitId: input.protectedBattleUnitId,
    guardBattleUnitId: input.guardBattleUnitId,
    sharePermille: input.sharePermille,
    applicationSequence: input.applicationSequence,
  })
}

export function assertValidGuardShareCollection(
  guardShares: readonly GuardShareState[],
): void {
  const ids = new Set<string>()
  const protectedIds = new Set<string>()
  for (const guardShare of guardShares) {
    assertValidGuardShareState(guardShare)
    if (ids.has(guardShare.guardShareId)) {
      throw new Error(`guardShareId must be unique: ${guardShare.guardShareId}`)
    }
    if (protectedIds.has(guardShare.protectedBattleUnitId)) {
      throw new Error(
        `protected unit must have at most one guard share: ${guardShare.protectedBattleUnitId}`,
      )
    }
    ids.add(guardShare.guardShareId)
    protectedIds.add(guardShare.protectedBattleUnitId)
  }
}

export function freezeGuardShareCollection(
  guardShares: readonly GuardShareState[],
): readonly GuardShareState[] {
  const frozen = guardShares.map(freezeGuardShareState).sort((left, right) => {
    if (left.applicationSequence !== right.applicationSequence) {
      return left.applicationSequence - right.applicationSequence
    }
    return left.guardShareId < right.guardShareId
      ? -1
      : left.guardShareId > right.guardShareId
        ? 1
        : 0
  })
  assertValidGuardShareCollection(frozen)
  return Object.freeze(frozen)
}

export function getGuardShareForProtectedUnit(
  guardShares: readonly GuardShareState[],
  protectedBattleUnitId: BattleUnitId,
): GuardShareState | null {
  assertValidGuardShareCollection(guardShares)
  assertNonEmptyId(protectedBattleUnitId, 'protectedBattleUnitId')
  return (
    guardShares.find(
      (guardShare) => guardShare.protectedBattleUnitId === protectedBattleUnitId,
    ) ?? null
  )
}

export function calculateGuardRedirectedDamage(
  finalDamage: number,
  sharePermille: number,
): number {
  assertSafeIntegerAtLeast(finalDamage, 0, 'finalDamage')
  assertSafeIntegerAtLeast(sharePermille, 1, 'sharePermille')
  if (sharePermille > 1000) {
    throw new Error('sharePermille must not exceed 1000')
  }
  const redirected =
    (BigInt(finalDamage) * BigInt(sharePermille) + 500n) / 1000n
  return Number(redirected > BigInt(finalDamage) ? BigInt(finalDamage) : redirected)
}
