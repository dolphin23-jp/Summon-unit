export const STATUS_RESISTANCE_STAGES = [
  'IMMUNE',
  'STRONG',
  'LIGHT',
  'NORMAL',
  'WEAK',
] as const

export type StatusResistanceStage = (typeof STATUS_RESISTANCE_STAGES)[number]

export const STATUS_RESISTANCE_MULTIPLIER_SCALE = 1000

export const STATUS_RESISTANCE_MULTIPLIERS: Readonly<Record<StatusResistanceStage, number>> =
  Object.freeze({
    IMMUNE: 0,
    STRONG: 500,
    LIGHT: 750,
    NORMAL: 1000,
    WEAK: 1250,
  })

const STAGE_SLUGS: Readonly<Record<StatusResistanceStage, string>> = Object.freeze({
  IMMUNE: 'immune',
  STRONG: 'strong',
  LIGHT: 'light',
  NORMAL: 'normal',
  WEAK: 'weak',
})

function assertNonEmptyStatusId(statusId: string): void {
  if (statusId.trim().length === 0) {
    throw new Error('statusId must be a non-empty string')
  }
  if (statusId !== statusId.trim() || /\s/.test(statusId)) {
    throw new Error('statusId must not contain whitespace')
  }
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

export function getStatusResistanceTagId(
  statusId: string,
  stage: StatusResistanceStage,
): string {
  assertNonEmptyStatusId(statusId)
  if (!STATUS_RESISTANCE_STAGES.includes(stage)) {
    throw new Error(`status resistance stage is invalid: ${stage}`)
  }
  return `tag.resistance.${statusId}.${STAGE_SLUGS[stage]}`
}

function getMatchedResistanceStages(
  tagIds: readonly string[],
  statusId: string,
): readonly StatusResistanceStage[] {
  assertNonEmptyStatusId(statusId)
  return STATUS_RESISTANCE_STAGES.filter((stage) =>
    tagIds.includes(getStatusResistanceTagId(statusId, stage)),
  )
}

export function resolveStatusResistanceStage(
  tagIds: readonly string[],
  statusId: string,
): StatusResistanceStage {
  const matches = getMatchedResistanceStages(tagIds, statusId)
  if (matches.length > 1) {
    throw new Error(`status resistance tags conflict for ${statusId}`)
  }
  return matches[0] ?? 'NORMAL'
}

export function getStatusResistanceMultiplierPermille(
  tagIds: readonly string[],
  statusId: string,
): number {
  return STATUS_RESISTANCE_MULTIPLIERS[resolveStatusResistanceStage(tagIds, statusId)]
}

export function applyStatusResistanceMagnitude(
  baseMagnitude: number,
  stage: StatusResistanceStage,
): number {
  assertSafeIntegerAtLeast(baseMagnitude, 0, 'baseMagnitude')
  if (!STATUS_RESISTANCE_STAGES.includes(stage)) {
    throw new Error(`status resistance stage is invalid: ${stage}`)
  }
  if (baseMagnitude === 0 || stage === 'IMMUNE') {
    return 0
  }

  const multiplier = STATUS_RESISTANCE_MULTIPLIERS[stage]
  const numerator = BigInt(baseMagnitude) * BigInt(multiplier)
  const rounded =
    (numerator + BigInt(STATUS_RESISTANCE_MULTIPLIER_SCALE / 2)) /
    BigInt(STATUS_RESISTANCE_MULTIPLIER_SCALE)
  const result = rounded < 1n ? 1n : rounded
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('status magnitude after resistance must be a safe integer')
  }
  return Number(result)
}

export function assertValidStatusResistanceTags(tagIds: readonly string[]): void {
  const seenTags = new Set<string>()
  const stageByStatusId = new Map<string, StatusResistanceStage>()
  const prefix = 'tag.resistance.'
  const suffixToStage = new Map<string, StatusResistanceStage>(
    STATUS_RESISTANCE_STAGES.map((stage) => [`.${STAGE_SLUGS[stage]}`, stage]),
  )

  for (const tagId of tagIds) {
    if (seenTags.has(tagId)) {
      throw new Error(`tagIds must not contain duplicates: ${tagId}`)
    }
    seenTags.add(tagId)

    if (!tagId.startsWith(prefix)) {
      continue
    }

    const matchingSuffix = [...suffixToStage.keys()].find((suffix) => tagId.endsWith(suffix))
    if (matchingSuffix === undefined) {
      throw new Error(`status resistance tag is invalid: ${tagId}`)
    }

    const statusId = tagId.slice(prefix.length, -matchingSuffix.length)
    assertNonEmptyStatusId(statusId)
    const stage = suffixToStage.get(matchingSuffix)
    if (stage === undefined) {
      throw new Error(`status resistance tag is invalid: ${tagId}`)
    }

    const existing = stageByStatusId.get(statusId)
    if (existing !== undefined) {
      throw new Error(`status resistance tags conflict for ${statusId}`)
    }
    stageByStatusId.set(statusId, stage)
  }
}
