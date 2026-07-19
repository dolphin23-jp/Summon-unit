import { describe, expect, it } from 'vitest'
import { getMonsterImagePresentation } from './monster-image-presentation'

describe('monster image fallback', () => {
  it('falls back to the existing initials for demo and extension species without assets', () => {
    const cases = [
      {
        speciesId: 'species.demo-alpha',
        placeholder: 'DE',
        ariaLabel: 'Demo Alphaの画像領域',
      },
      {
        speciesId: 'species.extension.storm-hare',
        placeholder: 'ST',
        ariaLabel: 'Storm Hareの画像領域',
      },
    ] as const

    for (const testCase of cases) {
      const initial = getMonsterImagePresentation(testCase.speciesId, false, null)
      expect(initial).toMatchObject({
        imageSrc: `/monsters/${testCase.speciesId}.png`,
        showImage: true,
      })
      expect(
        getMonsterImagePresentation(testCase.speciesId, false, initial.imageSrc),
      ).toEqual({
        imageSrc: `/monsters/${testCase.speciesId}.png`,
        showImage: false,
        placeholder: testCase.placeholder,
        ariaLabel: testCase.ariaLabel,
      })
    }
  })
})
