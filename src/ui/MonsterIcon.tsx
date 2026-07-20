import { useState } from 'react'
import type { MonsterSpecies } from '../content/monster-species'
import { getMonsterImagePresentation } from './monster-image-presentation'

export type MonsterIconSize = 'sm' | 'md' | 'lg'
export type MonsterIconVariant = 'framed' | 'frameless'

export interface MonsterIconProps {
  readonly species?: MonsterSpecies
  readonly speciesId?: string
  readonly label?: string
  readonly concealed?: boolean
  readonly size?: MonsterIconSize
  readonly variant?: MonsterIconVariant
  readonly decorative?: boolean
}

export function MonsterIcon({
  species,
  speciesId,
  label,
  concealed = false,
  size = 'md',
  variant = 'framed',
  decorative = false,
}: MonsterIconProps) {
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null)
  const resolvedSpeciesId = species?.id ?? speciesId
  if (resolvedSpeciesId === undefined || resolvedSpeciesId.trim().length === 0) {
    throw new Error('MonsterIcon requires species or speciesId')
  }

  const presentation = getMonsterImagePresentation(
    resolvedSpeciesId,
    concealed,
    failedImageSrc,
    label,
  )
  const className = [
    'collection-icon',
    `collection-icon--${size}`,
    `collection-icon--${variant}`,
    concealed ? 'collection-icon--concealed' : null,
  ]
    .filter((value): value is string => value !== null)
    .join(' ')

  return (
    <div
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : presentation.ariaLabel}
      aria-hidden={decorative ? true : undefined}
      data-monster-species-id={resolvedSpeciesId}
    >
      {presentation.showImage ? (
        <img
          className="collection-icon__image"
          src={presentation.imageSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={() => setFailedImageSrc(presentation.imageSrc)}
        />
      ) : (
        <>
          <span className="collection-icon__placeholder">{presentation.placeholder}</span>
          {variant === 'framed' && <small>IMAGE SLOT</small>}
        </>
      )}
    </div>
  )
}
