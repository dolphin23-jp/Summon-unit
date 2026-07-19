export const ATTRIBUTE_IDS = [
  'attribute.neutral',
  'attribute.fire',
  'attribute.water',
  'attribute.wind',
  'attribute.earth',
  'attribute.light',
  'attribute.dark',
] as const

export type AttributeId = (typeof ATTRIBUTE_IDS)[number]
export type LegacyAttributeId = 'attribute.air'
export type AttributeInputId = AttributeId | LegacyAttributeId

export const ATTRIBUTE_MULTIPLIER_SCALE = 1000
export const ATTRIBUTE_ADVANTAGE_MULTIPLIER = 1250
export const ATTRIBUTE_DISADVANTAGE_MULTIPLIER = 800
export const ATTRIBUTE_NEUTRAL_MULTIPLIER = ATTRIBUTE_MULTIPLIER_SCALE

export type AttributeEffectiveness = 'ADVANTAGE' | 'DISADVANTAGE' | 'NEUTRAL'

const FOUR_ATTRIBUTE_ADVANTAGE_TARGET: Readonly<Partial<Record<AttributeId, AttributeId>>> =
  Object.freeze({
    'attribute.fire': 'attribute.wind',
    'attribute.wind': 'attribute.earth',
    'attribute.earth': 'attribute.water',
    'attribute.water': 'attribute.fire',
  })

export function normalizeAttributeId(attributeId: string): AttributeId {
  if (attributeId === 'attribute.air') {
    return 'attribute.wind'
  }
  if (!ATTRIBUTE_IDS.includes(attributeId as AttributeId)) {
    throw new Error(`attributeId is invalid: ${attributeId}`)
  }
  return attributeId as AttributeId
}

export function assertValidAttributeId(attributeId: string): void {
  normalizeAttributeId(attributeId)
}

export function getAttributeEffectiveness(
  attackingAttributeId: string,
  defendingAttributeId: string,
): AttributeEffectiveness {
  const attacking = normalizeAttributeId(attackingAttributeId)
  const defending = normalizeAttributeId(defendingAttributeId)

  if (attacking === 'attribute.neutral' || defending === 'attribute.neutral') {
    return 'NEUTRAL'
  }

  const isLightDarkPair =
    (attacking === 'attribute.light' && defending === 'attribute.dark') ||
    (attacking === 'attribute.dark' && defending === 'attribute.light')
  if (isLightDarkPair) {
    return 'ADVANTAGE'
  }

  if (FOUR_ATTRIBUTE_ADVANTAGE_TARGET[attacking] === defending) {
    return 'ADVANTAGE'
  }
  if (FOUR_ATTRIBUTE_ADVANTAGE_TARGET[defending] === attacking) {
    return 'DISADVANTAGE'
  }
  return 'NEUTRAL'
}

export function getAttributeMultiplierPermille(
  attackingAttributeId: string,
  defendingAttributeId: string,
): number {
  switch (getAttributeEffectiveness(attackingAttributeId, defendingAttributeId)) {
    case 'ADVANTAGE':
      return ATTRIBUTE_ADVANTAGE_MULTIPLIER
    case 'DISADVANTAGE':
      return ATTRIBUTE_DISADVANTAGE_MULTIPLIER
    case 'NEUTRAL':
      return ATTRIBUTE_NEUTRAL_MULTIPLIER
  }
}
