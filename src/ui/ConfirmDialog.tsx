import { useEffect, useRef } from 'react'

export interface ConfirmDialogProps {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly details?: readonly string[]
  readonly confirmLabel: string
  readonly cancelLabel?: string
  readonly tone?: 'default' | 'danger'
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  details = [],
  confirmLabel,
  cancelLabel = 'キャンセル',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return undefined
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, open])

  if (!open) return null

  return (
    <div
      className="ux-modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel()
      }}
    >
      <section
        className={`ux-dialog ux-confirm-dialog ux-confirm-dialog--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ux-confirm-title"
        aria-describedby="ux-confirm-description"
      >
        <p className="panel-heading__kicker">CONFIRM ACTION</p>
        <h2 id="ux-confirm-title">{title}</h2>
        <p id="ux-confirm-description">{description}</p>
        {details.length > 0 && (
          <ul className="ux-confirm-details">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
        <div className="ux-dialog-actions">
          <button ref={cancelRef} type="button" className="collection-button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`collection-button ${tone === 'danger' ? 'collection-button--danger' : 'collection-button--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
