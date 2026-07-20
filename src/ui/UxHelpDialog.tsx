import { useEffect, useRef, useState } from 'react'
import {
  GLOSSARY_ENTRIES,
  SCREEN_HELP,
  type UxHelpContext,
} from '../ux/ux-guidance'

export interface UxHelpButtonProps {
  readonly context: UxHelpContext
  readonly buttonClassName?: string
  readonly onRestartGuide?: () => void
}

export function UxHelpButton({
  context,
  buttonClassName = 'collection-button',
  onRestartGuide,
}: UxHelpButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={`${buttonClassName} ux-help-button`} onClick={() => setOpen(true)}>
        ヘルプ・用語
      </button>
      <UxHelpDialog
        open={open}
        context={context}
        onClose={() => setOpen(false)}
        onRestartGuide={onRestartGuide}
      />
    </>
  )
}

export interface UxHelpDialogProps {
  readonly open: boolean
  readonly context: UxHelpContext
  readonly onClose: () => void
  readonly onRestartGuide?: () => void
}

export function UxHelpDialog({ open, context, onClose, onRestartGuide }: UxHelpDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const screenHelp = SCREEN_HELP[context]

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="ux-modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        className="ux-dialog ux-help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ux-help-title"
      >
        <header className="ux-dialog-header">
          <div>
            <p className="panel-heading__kicker">GUIDE & GLOSSARY</p>
            <h2 id="ux-help-title">{screenHelp.title}の使い方</h2>
          </div>
          <button ref={closeRef} type="button" className="collection-button" onClick={onClose}>
            閉じる
          </button>
        </header>
        <p>{screenHelp.summary}</p>
        <ol className="ux-screen-actions">
          {screenHelp.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
        {onRestartGuide !== undefined && (
          <button
            type="button"
            className="collection-button ux-restart-guide"
            onClick={() => {
              onClose()
              onRestartGuide()
            }}
          >
            初回ガイドをもう一度見る
          </button>
        )}
        <div className="ux-glossary" aria-label="ゲーム用語集">
          {(['進行', '研究', '戦闘'] as const).map((category) => (
            <section key={category}>
              <h3>{category}用語</h3>
              <dl>
                {GLOSSARY_ENTRIES.filter((entry) => entry.category === category).map((entry) => (
                  <div key={entry.term}>
                    <dt>{entry.term}</dt>
                    <dd>{entry.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}
