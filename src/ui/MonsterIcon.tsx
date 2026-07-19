import { useState } from 'react'
import type { MonsterSpecies } from '../content/monster-species'
import { getMonsterImagePresentation } from './monster-image-presentation'

export function MonsterIcon({ species, concealed = false }: { readonly species: MonsterSpecies; readonly concealed?: boolean }) {
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null)
  const presentation = getMonsterImagePresentation(species.id, concealed, failedImageSrc)
  return (
    <div className={`collection-icon${concealed ? ' collection-icon--concealed' : ''}`} role="img" aria-label={presentation.ariaLabel}>
      {presentation.showImage ? (
        <img className="collection-icon__image" src={presentation.imageSrc} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={() => setFailedImageSrc(presentation.imageSrc)} />
      ) : (<>
        <span>{presentation.placeholder}</span><small>IMAGE SLOT</small>
      </>)}
    </div>
  )
}
