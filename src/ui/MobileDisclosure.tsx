import { useState, type ReactNode } from 'react'

export function MobileDisclosure({
  title,
  kicker,
  defaultOpen = true,
  className = '',
  children,
}: {
  readonly title: string
  readonly kicker: string
  readonly defaultOpen?: boolean
  readonly className?: string
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className={`mobile-disclosure ${className}`.trim()}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="mobile-disclosure__summary">
        <span>
          <small>{kicker}</small>
          <strong>{title}</strong>
        </span>
        <span className="mobile-disclosure__state" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </summary>
      <div className="mobile-disclosure__content">{children}</div>
    </details>
  )
}
