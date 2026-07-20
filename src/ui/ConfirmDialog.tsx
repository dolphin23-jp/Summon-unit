import { useEffect, useRef } from 'react'
import type { ConfirmationCopy } from './ux-guidance'

export interface ConfirmDialogProps {
  readonly open: boolean
  readonly copy: ConfirmationCopy | null
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function ConfirmDialog({ open, copy, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="confirmation-dialog"
      aria-labelledby="confirmation-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClose={() => {
        if (open) onCancel()
      }}
    >
      {copy !== null && (
        <form method="dialog" className="confirmation-dialog__body">
          <p className="panel-heading__kicker">CONFIRM OPERATION</p>
          <h2 id="confirmation-dialog-title">{copy.title}</h2>
          <p>{copy.detail}</p>
          <div className="confirmation-dialog__actions">
            <button type="button" className="collection-button" onClick={onCancel}>
              キャンセル
            </button>
            <button
              type="button"
              className={`collection-button${copy.tone === 'DANGER' ? ' collection-button--danger' : ' collection-button--primary'}`}
              onClick={onConfirm}
            >
              {copy.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
