function shortId(id: string): string {
  return id.split('.').at(-1) ?? id
}

function displayName(id: string): string {
  return shortId(id)
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export interface MonsterImagePresentation {
  readonly imageSrc: string
  readonly showImage: boolean
  readonly placeholder: string
  readonly ariaLabel: string
}

export function getMonsterImagePresentation(
  speciesId: string,
  concealed: boolean,
  failedImageSrc: string | null,
  displayLabel?: string,
): MonsterImagePresentation {
  const imageSrc = `/monsters/${speciesId}.png`
  const resolvedDisplayLabel = displayLabel?.trim() || displayName(speciesId)
  return Object.freeze({
    imageSrc,
    showImage: !concealed && failedImageSrc !== imageSrc,
    placeholder: concealed ? '?' : shortId(speciesId).slice(0, 2).toUpperCase(),
    ariaLabel: concealed ? '未開示のモンスター画像領域' : `${resolvedDisplayLabel}の画像領域`,
  })
}
