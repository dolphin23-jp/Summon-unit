import { describe, expect, it } from 'vitest'
import {
  ATTRIBUTE_IDS,
  getAttributeEffectiveness,
  getAttributeMultiplierPermille,
  normalizeAttributeId,
} from './attribute'

describe('attribute model', () => {
  it('defines exactly the seven canonical attributes', () => {
    expect(ATTRIBUTE_IDS).toEqual([
      'attribute.neutral',
      'attribute.fire',
      'attribute.water',
      'attribute.wind',
      'attribute.earth',
      'attribute.light',
      'attribute.dark',
    ])
  })

  it.each([
    ['attribute.fire', 'attribute.wind'],
    ['attribute.wind', 'attribute.earth'],
    ['attribute.earth', 'attribute.water'],
    ['attribute.water', 'attribute.fire'],
  ] as const)('%s has advantage over %s in the four-attribute cycle', (attacking, defending) => {
    expect(getAttributeEffectiveness(attacking, defending)).toBe('ADVANTAGE')
    expect(getAttributeMultiplierPermille(attacking, defending)).toBe(1250)
    expect(getAttributeEffectiveness(defending, attacking)).toBe('DISADVANTAGE')
    expect(getAttributeMultiplierPermille(defending, attacking)).toBe(800)
  })

  it('makes light and dark mutually advantageous', () => {
    expect(getAttributeMultiplierPermille('attribute.light', 'attribute.dark')).toBe(1250)
    expect(getAttributeMultiplierPermille('attribute.dark', 'attribute.light')).toBe(1250)
  })

  it('keeps neutral and unrelated matchups at 1.00', () => {
    expect(getAttributeMultiplierPermille('attribute.neutral', 'attribute.fire')).toBe(1000)
    expect(getAttributeMultiplierPermille('attribute.fire', 'attribute.neutral')).toBe(1000)
    expect(getAttributeMultiplierPermille('attribute.fire', 'attribute.earth')).toBe(1000)
    expect(getAttributeMultiplierPermille('attribute.light', 'attribute.fire')).toBe(1000)
  })

  it('normalizes the legacy air id to wind without creating an eighth attribute', () => {
    expect(normalizeAttributeId('attribute.air')).toBe('attribute.wind')
    expect(getAttributeMultiplierPermille('attribute.fire', 'attribute.air')).toBe(1250)
  })

  it('rejects unknown attribute ids', () => {
    expect(() => normalizeAttributeId('attribute.ice')).toThrow(
      'attributeId is invalid: attribute.ice',
    )
  })
})
