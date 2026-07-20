export type GameIconName =
  | 'currency'
  | 'research'
  | 'catalyst'
  | 'region'
  | 'blueprint'
  | 'repair'
  | 'units'
  | 'stages'
  | 'formation'
  | 'discovery'
  | 'bloom'
  | 'info'

function IconGlyph({ name }: { readonly name: GameIconName }) {
  switch (name) {
    case 'currency':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 10h7M8.5 14h7M12 7v10" />
        </>
      )
    case 'research':
      return (
        <>
          <path d="M9 3h6M10 3v5l-4.5 8a3 3 0 0 0 2.6 4.5h7.8a3 3 0 0 0 2.6-4.5L14 8V3" />
          <path d="M7.5 15h9" />
        </>
      )
    case 'catalyst':
      return (
        <>
          <path d="m12 3 7 7-7 11-7-11 7-7Z" />
          <path d="m8 10 4 4 4-4" />
        </>
      )
    case 'region':
      return (
        <>
          <path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20V6.5Z" />
          <path d="M9 4v13.5M15 6.5V20" />
        </>
      )
    case 'blueprint':
      return (
        <>
          <path d="M6 3h9l3 3v15H6V3Z" />
          <path d="M15 3v4h4M9 11h6M9 15h6" />
        </>
      )
    case 'repair':
      return (
        <>
          <path d="m14.5 6.5 3-3a4 4 0 0 1-5 5L6 15l-2 5 5-2 6.5-6.5a4 4 0 0 1-1-5Z" />
        </>
      )
    case 'units':
      return (
        <>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 20a4 4 0 0 1 7 0" />
        </>
      )
    case 'stages':
      return (
        <>
          <path d="M5 20V4l14 4-14 4" />
          <path d="M5 12h12v8" />
        </>
      )
    case 'formation':
      return (
        <>
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <rect x="9" y="15" width="6" height="6" rx="1" />
          <path d="M9 6h6M6 9l5 6M18 9l-5 6" />
        </>
      )
    case 'discovery':
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 5 5M11 7v8M7 11h8" />
        </>
      )
    case 'bloom':
      return (
        <>
          <circle cx="12" cy="12" r="2" />
          <path d="M12 10c-3-5 2-7 2-7s3 5-2 7ZM14 12c5-3 7 2 7 2s-5 3-7-2ZM12 14c3 5-2 7-2 7s-3-5 2-7ZM10 12c-5 3-7-2-7-2s5-3 7 2Z" />
        </>
      )
    case 'info':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v7M12 7h.01" />
        </>
      )
  }
}

export function GameIcon({
  name,
  label,
  className = '',
}: {
  readonly name: GameIconName
  readonly label?: string
  readonly className?: string
}) {
  return (
    <svg
      className={`game-icon game-icon--${name}${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      focusable="false"
    >
      <IconGlyph name={name} />
    </svg>
  )
}
