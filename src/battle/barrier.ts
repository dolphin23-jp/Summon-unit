import type { BattleUnitId } from './unit-state'

export type BarrierLayerId = string

export interface BarrierLayerState {
  readonly barrierLayerId: BarrierLayerId
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly initialCapacity: number
  readonly remainingCapacity: number
  readonly applicationSequence: number
}

export interface CreateBarrierLayerInput {
  readonly barrierLayerId?: BarrierLayerId
  readonly sourceBattleUnitId?: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly capacity: number
  readonly applicationSequence: number
}

export interface BarrierLayerConsumption {
  readonly before: BarrierLayerState
  readonly after: BarrierLayerState | null
  readonly absorbedDamage: number
  readonly broken: boolean
}

export interface BarrierConsumptionResult {
  readonly barriers: readonly BarrierLayerState[]
  readonly consumptions: readonly BarrierLayerConsumption[]
  readonly incomingDamage: number
  readonly absorbedDamage: number
  readonly remainingDamage: number
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

function compareBarrierLayers(left: BarrierLayerState, right: BarrierLayerState): number {
  if (left.applicationSequence !== right.applicationSequence) {
    return left.applicationSequence - right.applicationSequence
  }
  if (left.barrierLayerId === right.barrierLayerId) {
    return 0
  }
  return left.barrierLayerId < right.barrierLayerId ? -1 : 1
}

export function getBarrierLayerId(
  targetBattleUnitId: BattleUnitId,
  applicationSequence: number,
): BarrierLayerId {
  assertNonEmptyId(targetBattleUnitId, 'targetBattleUnitId')
  assertSafeIntegerAtLeast(applicationSequence, 0, 'applicationSequence')
  return `barrier-layer:${targetBattleUnitId}:${applicationSequence}`
}

export function assertValidBarrierLayerState(layer: BarrierLayerState): void {
  assertNonEmptyId(layer.barrierLayerId, 'barrier.barrierLayerId')
  assertNonEmptyId(layer.targetBattleUnitId, 'barrier.targetBattleUnitId')
  if (layer.sourceBattleUnitId !== null) {
    assertNonEmptyId(layer.sourceBattleUnitId, 'barrier.sourceBattleUnitId')
  }
  assertSafeIntegerAtLeast(layer.initialCapacity, 1, 'barrier.initialCapacity')
  assertSafeIntegerAtLeast(layer.remainingCapacity, 1, 'barrier.remainingCapacity')
  assertSafeIntegerAtLeast(layer.applicationSequence, 0, 'barrier.applicationSequence')
  if (layer.remainingCapacity > layer.initialCapacity) {
    throw new Error('barrier.remainingCapacity must not exceed barrier.initialCapacity')
  }
}

export function freezeBarrierLayerState(layer: BarrierLayerState): BarrierLayerState {
  assertValidBarrierLayerState(layer)
  return Object.freeze({ ...layer })
}

export function assertValidBarrierLayerCollection(
  barriers: readonly BarrierLayerState[],
  targetBattleUnitId?: BattleUnitId,
): void {
  const ids = new Set<string>()
  let previous: BarrierLayerState | null = null
  for (const barrier of barriers) {
    assertValidBarrierLayerState(barrier)
    if (targetBattleUnitId !== undefined && barrier.targetBattleUnitId !== targetBattleUnitId) {
      throw new Error('barrier target must match the owning battle unit')
    }
    if (ids.has(barrier.barrierLayerId)) {
      throw new Error(`barrierLayerId must be unique: ${barrier.barrierLayerId}`)
    }
    ids.add(barrier.barrierLayerId)
    if (previous !== null && compareBarrierLayers(previous, barrier) > 0) {
      throw new Error('barrier layers must use stable application order')
    }
    previous = barrier
  }
}

export function freezeBarrierLayerCollection(
  barriers: readonly BarrierLayerState[],
  targetBattleUnitId?: BattleUnitId,
): readonly BarrierLayerState[] {
  const ordered = [...barriers].map(freezeBarrierLayerState).sort(compareBarrierLayers)
  assertValidBarrierLayerCollection(ordered, targetBattleUnitId)
  return Object.freeze(ordered)
}

export function createBarrierLayer(input: CreateBarrierLayerInput): BarrierLayerState {
  assertNonEmptyId(input.targetBattleUnitId, 'targetBattleUnitId')
  assertSafeIntegerAtLeast(input.capacity, 1, 'capacity')
  assertSafeIntegerAtLeast(input.applicationSequence, 0, 'applicationSequence')
  const sourceBattleUnitId = input.sourceBattleUnitId ?? null
  if (sourceBattleUnitId !== null) {
    assertNonEmptyId(sourceBattleUnitId, 'sourceBattleUnitId')
  }
  return freezeBarrierLayerState({
    barrierLayerId:
      input.barrierLayerId ??
      getBarrierLayerId(input.targetBattleUnitId, input.applicationSequence),
    sourceBattleUnitId,
    targetBattleUnitId: input.targetBattleUnitId,
    initialCapacity: input.capacity,
    remainingCapacity: input.capacity,
    applicationSequence: input.applicationSequence,
  })
}

export function addBarrierLayer(
  barriers: readonly BarrierLayerState[],
  input: CreateBarrierLayerInput,
): readonly BarrierLayerState[] {
  assertValidBarrierLayerCollection(barriers)
  const layer = createBarrierLayer(input)
  if (barriers.some((barrier) => barrier.barrierLayerId === layer.barrierLayerId)) {
    throw new Error(`barrierLayerId must be unique: ${layer.barrierLayerId}`)
  }
  return freezeBarrierLayerCollection([...barriers, layer])
}

export function getTotalBarrierCapacity(barriers: readonly BarrierLayerState[]): number {
  assertValidBarrierLayerCollection(barriers)
  const total = barriers.reduce((sum, barrier) => sum + BigInt(barrier.remainingCapacity), 0n)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('total barrier capacity must be a safe integer')
  }
  return Number(total)
}

export function consumeBarrierLayers(
  barriers: readonly BarrierLayerState[],
  incomingDamage: number,
): BarrierConsumptionResult {
  assertValidBarrierLayerCollection(barriers)
  assertSafeIntegerAtLeast(incomingDamage, 0, 'incomingDamage')

  let remainingDamage = incomingDamage
  const nextBarriers: BarrierLayerState[] = []
  const consumptions: BarrierLayerConsumption[] = []

  for (const barrier of barriers) {
    if (remainingDamage === 0) {
      nextBarriers.push(barrier)
      continue
    }

    const absorbedDamage = Math.min(barrier.remainingCapacity, remainingDamage)
    remainingDamage -= absorbedDamage
    const remainingCapacity = barrier.remainingCapacity - absorbedDamage
    const after =
      remainingCapacity === 0
        ? null
        : freezeBarrierLayerState({ ...barrier, remainingCapacity })
    consumptions.push(
      Object.freeze({
        before: barrier,
        after,
        absorbedDamage,
        broken: after === null,
      }),
    )
    if (after !== null) {
      nextBarriers.push(after)
    }
  }

  return Object.freeze({
    barriers: freezeBarrierLayerCollection(nextBarriers),
    consumptions: Object.freeze(consumptions),
    incomingDamage,
    absorbedDamage: incomingDamage - remainingDamage,
    remainingDamage,
  })
}
