import { describe, expect, it } from 'vitest'
import { getMonsterImagePresentation } from './monster-image-presentation'

describe('monster image fallback', () => {
  it('falls back to the existing initials for a species without an image asset', () => {
    const initial = getMonsterImagePresentation('species.demo-alpha', false, null)
    expect(initial).toMatchObject({ imageSrc: '/monsters/species.demo-alpha.png', showImage: true })
    expect(getMonsterImagePresentation('species.demo-alpha', false, initial.imageSrc)).toEqual({
      imageSrc: '/monsters/species.demo-alpha.png', showImage: false, placeholder: 'DE', ariaLabel: 'Demo Alphaの画像領域',
    })
  })
})
