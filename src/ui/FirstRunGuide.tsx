import { useEffect, useRef, useState } from 'react'
import { FIRST_RUN_STEPS } from '../ux/ux-guidance'

export interface FirstRunGuideProps {
  readonly open: boolean
  readonly onDismiss: () => void
  readonly onOpenCollection: () => void
  readonly onOpenRegion: () => void
  readonly onOpenResearch: () => void
}

export function FirstRunGuide({
  open,
  onDismiss,
  onOpenCollection,
  onOpenRegion,
  onOpenResearch,
}: FirstRunGuideProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const firstButtonRef = useRef<HTMLButtonElement>(null)
  const step = FIRST_RUN_STEPS[stepIndex]
  const last = stepIndex === FIRST_RUN_STEPS.length - 1

  useEffect(() => {
    if (!open) return undefined
    setStepIndex(0)
    const focusTimer = window.setTimeout(() => firstButtonRef.current?.focus(), 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onDismiss, open])

  if (!open || step === undefined) return null

  return (
    <div
      className="ux-modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onDismiss()
      }}
    >
      <section
        className="ux-dialog ux-first-run-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
      >
        <p className="panel-heading__kicker">FIRST EXPEDITION GUIDE</p>
        <div className="ux-step-count">
          {stepIndex + 1} / {FIRST_RUN_STEPS.length}
        </div>
        <h2 id="first-run-title">{step.title}</h2>
        <strong className="ux-first-run-summary">{step.summary}</strong>
        <p>{step.detail}</p>
        <div
          className="ux-step-track"
          aria-label={`初回ガイド ${stepIndex + 1}/${FIRST_RUN_STEPS.length}`}
        >
          {FIRST_RUN_STEPS.map((candidate, index) => (
            <span key={candidate.title} className={index <= stepIndex ? 'is-active' : ''} />
          ))}
        </div>
        {!last ? (
          <div className="ux-dialog-actions">
            <button
              ref={firstButtonRef}
              type="button"
              className="collection-button"
              onClick={onDismiss}
            >
              閉じる
            </button>
            {stepIndex > 0 && (
              <button
                type="button"
                className="collection-button"
                onClick={() => setStepIndex((current) => current - 1)}
              >
                戻る
              </button>
            )}
            <button
              type="button"
              className="collection-button collection-button--primary"
              onClick={() => setStepIndex((current) => current + 1)}
            >
              次へ
            </button>
          </div>
        ) : (
          <div className="ux-first-run-destinations">
            <button
              ref={firstButtonRef}
              type="button"
              className="collection-button"
              onClick={onOpenCollection}
            >
              編成から始める
            </button>
            <button
              type="button"
              className="collection-button collection-button--primary"
              onClick={onOpenRegion}
            >
              地域観測へ出る
            </button>
            <button type="button" className="collection-button" onClick={onOpenResearch}>
              研究網を見る
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
