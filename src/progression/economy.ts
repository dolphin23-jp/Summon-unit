export type CatalystId = string

export interface CatalystBalance {
  readonly catalystId: CatalystId
  readonly amount: number
}

export interface EconomyState {
  readonly currency: number
  readonly researchData: number
  readonly catalysts: readonly CatalystBalance[]
}

export interface CatalystDelta {
  readonly catalystId: CatalystId
  readonly amount: number
}

export interface EconomyTransaction {
  readonly currencyDelta?: number
  readonly researchDataDelta?: number
  readonly catalystDeltas?: readonly CatalystDelta[]
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function assertNonEmptyString(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function assertSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer`)
  }
}

function assertSafeNonNegative(value: number, field: string): void {
  assertSafeInteger(value, field)
  if (value < 0) {
    throw new Error(`${field} must be non-negative`)
  }
}

function addSafe(left: number, right: number, field: string): number {
  const result = left + right
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${field} must remain a safe integer`)
  }
  return result
}

export function createEconomyState(input: EconomyState): EconomyState {
  assertSafeNonNegative(input.currency, 'economy.currency')
  assertSafeNonNegative(input.researchData, 'economy.researchData')

  const seen = new Set<CatalystId>()
  const catalysts: CatalystBalance[] = []
  for (const balance of input.catalysts) {
    assertNonEmptyString(balance.catalystId, 'economy.catalysts[].catalystId')
    if (seen.has(balance.catalystId)) {
      throw new Error(`economy catalyst id must be unique: ${balance.catalystId}`)
    }
    seen.add(balance.catalystId)
    assertSafeNonNegative(balance.amount, `economy catalyst amount: ${balance.catalystId}`)
    if (balance.amount > 0) {
      catalysts.push(Object.freeze({ ...balance }))
    }
  }
  catalysts.sort((left, right) => compareIds(left.catalystId, right.catalystId))

  return Object.freeze({
    currency: input.currency,
    researchData: input.researchData,
    catalysts: Object.freeze(catalysts),
  })
}

export function getCatalystAmount(state: EconomyState, catalystId: CatalystId): number {
  assertNonEmptyString(catalystId, 'catalystId')
  return state.catalysts.find((balance) => balance.catalystId === catalystId)?.amount ?? 0
}

export function applyEconomyTransaction(
  state: EconomyState,
  transaction: EconomyTransaction,
): EconomyState {
  const normalized = createEconomyState(state)
  const currencyDelta = transaction.currencyDelta ?? 0
  const researchDataDelta = transaction.researchDataDelta ?? 0
  assertSafeInteger(currencyDelta, 'economy transaction currencyDelta')
  assertSafeInteger(researchDataDelta, 'economy transaction researchDataDelta')

  const catalystDeltaById = new Map<CatalystId, number>()
  for (const delta of transaction.catalystDeltas ?? []) {
    assertNonEmptyString(delta.catalystId, 'economy transaction catalystId')
    assertSafeInteger(delta.amount, `economy transaction catalyst delta: ${delta.catalystId}`)
    const total = addSafe(
      catalystDeltaById.get(delta.catalystId) ?? 0,
      delta.amount,
      `economy transaction catalyst delta total: ${delta.catalystId}`,
    )
    catalystDeltaById.set(delta.catalystId, total)
  }

  const nextCurrency = addSafe(
    normalized.currency,
    currencyDelta,
    'economy transaction currency result',
  )
  const nextResearchData = addSafe(
    normalized.researchData,
    researchDataDelta,
    'economy transaction research data result',
  )
  if (nextCurrency < 0) {
    throw new Error('economy transaction would make currency negative')
  }
  if (nextResearchData < 0) {
    throw new Error('economy transaction would make research data negative')
  }

  const catalystIds = new Set<CatalystId>([
    ...normalized.catalysts.map((balance) => balance.catalystId),
    ...catalystDeltaById.keys(),
  ])
  const nextCatalysts: CatalystBalance[] = []
  for (const catalystId of [...catalystIds].sort(compareIds)) {
    const nextAmount = addSafe(
      getCatalystAmount(normalized, catalystId),
      catalystDeltaById.get(catalystId) ?? 0,
      `economy transaction catalyst result: ${catalystId}`,
    )
    if (nextAmount < 0) {
      throw new Error(`economy transaction would make catalyst negative: ${catalystId}`)
    }
    if (nextAmount > 0) {
      nextCatalysts.push(Object.freeze({ catalystId, amount: nextAmount }))
    }
  }

  return createEconomyState({
    currency: nextCurrency,
    researchData: nextResearchData,
    catalysts: nextCatalysts,
  })
}
