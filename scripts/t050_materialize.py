from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


write(
    "src/ux/ux-guidance.ts",
    r'''export const UX_GUIDANCE_STORAGE_KEY = 'summon-unit.ux-guidance.v1'
export const UX_GUIDANCE_VERSION = 1

export type UxHelpContext =
  | 'HOME'
  | 'REGION'
  | 'COLLECTION'
  | 'RESEARCH'
  | 'SUMMON'
  | 'SAVE'
  | 'BATTLE'

export interface UxGuidanceState {
  readonly version: number
  readonly firstRunCompleted: boolean
}

export interface UxGuidanceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface FirstRunStep {
  readonly title: string
  readonly summary: string
  readonly detail: string
}

export interface GlossaryEntry {
  readonly term: string
  readonly category: '進行' | '研究' | '戦闘'
  readonly definition: string
}

export interface ScreenHelp {
  readonly title: string
  readonly summary: string
  readonly actions: readonly string[]
}

export const DEFAULT_UX_GUIDANCE_STATE: UxGuidanceState = Object.freeze({
  version: UX_GUIDANCE_VERSION,
  firstRunCompleted: false,
})

export const FIRST_RUN_STEPS: readonly FirstRunStep[] = Object.freeze([
  Object.freeze({
    title: '観測拠点から準備する',
    summary: '編成、出撃、研究、召喚を一つの循環として進めます。',
    detail: '最初は「編成・図鑑」で3体まで配置し、行動方針と装備技を確認します。',
  }),
  Object.freeze({
    title: '地域で課題を選ぶ',
    summary: '各ステージは一つずつ戦術を教える順番になっています。',
    detail: 'ロック条件とFIELD GUIDANCEを読み、クリア済みなら高速化や即時シミュレーションも使えます。',
  }),
  Object.freeze({
    title: '戦闘はAUTOから始めてよい',
    summary: 'AUTO、1行動進行、手動割込をいつでも切り替えられます。',
    detail: '予兆、遮蔽、障壁、次回行動を見ながら、必要な場面だけ手動で介入してください。',
  }),
  Object.freeze({
    title: '観測結果を研究と召喚へ戻す',
    summary: '解析度と研究データで研究を進め、設計図から新しい個体を召喚します。',
    detail: '資源や標本を消費する操作は、実行前に共通の確認画面が表示されます。',
  }),
])

export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = Object.freeze([
  Object.freeze({ term: '基本通貨', category: '進行', definition: '召喚、技習得、施設更新、開花研究に使う共通資源です。' }),
  Object.freeze({ term: '研究データ', category: '研究', definition: '試験研究、確定研究、施設更新、開花研究に使う研究資源です。' }),
  Object.freeze({ term: '触媒', category: '研究', definition: '研究条件や確定研究で要求される属性・特殊素材です。' }),
  Object.freeze({ term: '解析度', category: '研究', definition: '敵の観測や戦闘結果などで増え、図鑑開示と開花研究条件に使われます。0〜10000で管理します。' }),
  Object.freeze({ term: '開示段階', category: '研究', definition: '研究ノードや図鑑情報がどこまで判明しているかを0〜5で示します。' }),
  Object.freeze({ term: '設計図', category: '研究', definition: '確定研究で永久解放され、同じ種を何度でも召喚できるようになります。' }),
  Object.freeze({ term: '開花技', category: '研究', definition: '高い解析度と資源を使う開花研究で、同種すべての個体へ解放する特別技です。' }),
  Object.freeze({ term: '行動コスト', category: '戦闘', definition: '技や移動の重さです。大きいほど、そのユニットの次の行動が遅くなります。' }),
  Object.freeze({ term: '次回行動', category: '戦闘', definition: 'タイムライン上で次に行動できる仮想時刻と順位です。' }),
  Object.freeze({ term: '遮蔽', category: '戦闘', definition: '直線攻撃が前列のユニットで止まり、後方の対象へ届かない仕組みです。' }),
  Object.freeze({ term: '障壁', category: '戦闘', definition: 'HPより先にダメージを受ける一時的な耐久値です。' }),
  Object.freeze({ term: '肩代わり', category: '戦闘', definition: '守護役が味方へのダメージの一部を受け持つ効果です。' }),
  Object.freeze({ term: '予兆', category: '戦闘', definition: '後の時刻に発動する攻撃や危険範囲の予約表示です。' }),
  Object.freeze({ term: '即時シミュレーション', category: '進行', definition: 'クリア済みステージを画面内戦闘なしで決定論的に精算する機能です。' }),
])

export const SCREEN_HELP: Readonly<Record<UxHelpContext, ScreenHelp>> = Object.freeze({
  HOME: Object.freeze({
    title: '観測拠点',
    summary: '現在資源を確認し、次に行う準備・出撃・研究を選ぶ起点です。',
    actions: Object.freeze(['初回は編成を確認する', '地域観測で最初の課題へ進む', '進行はセーブスロットで管理する']),
  }),
  REGION: Object.freeze({
    title: '地域・ステージ',
    summary: '解放条件、報酬、敵編成、学習テーマを確認して出撃します。',
    actions: Object.freeze(['FIELD GUIDANCEを読む', '出撃編成を確認する', 'クリア後は高速化を利用する']),
  }),
  COLLECTION: Object.freeze({
    title: '編成・技習得・図鑑',
    summary: '所持個体の配置、AI方針、技装備、図鑑情報を管理します。',
    actions: Object.freeze(['3×3盤面へ配置する', '固有・汎用・開花技を確認する', '解析度で図鑑情報を開く']),
  }),
  RESEARCH: Object.freeze({
    title: '研究網・施設',
    summary: 'ヒントを集め、試験研究で条件を照合し、確定研究で設計図を解放します。',
    actions: Object.freeze(['開示段階を確認する', '試験研究は標本と触媒を消費しない', '確定研究の消費物を確認する']),
  }),
  SUMMON: Object.freeze({
    title: '設計図召喚',
    summary: '解放済み設計図から、抽選や待機なしで新しい個体を追加します。',
    actions: Object.freeze(['所持数と召喚費を比較する', '確認画面で消費通貨を確認する', '召喚後は編成へ戻る']),
  }),
  SAVE: Object.freeze({
    title: 'セーブ管理',
    summary: 'IndexedDBの3スロット、バックアップ、JSON移送を管理します。',
    actions: Object.freeze(['上書き・ロード・削除は確認後に実行する', '使用中スロットは削除できない', 'JSON読込は使用中スロットを置換する']),
  }),
  BATTLE: Object.freeze({
    title: '戦闘画面',
    summary: '6×3盤面、タイムライン、予兆、確定前プレビュー、AI理由を同時に確認します。',
    actions: Object.freeze(['まずAUTOで流れを見る', '危険な行動前だけ手動割込する', 'リセットや途中離脱は確認して実行する']),
  }),
})

export function loadUxGuidanceState(storage: UxGuidanceStorage): UxGuidanceState {
  let raw: string | null
  try {
    raw = storage.getItem(UX_GUIDANCE_STORAGE_KEY)
  } catch {
    return DEFAULT_UX_GUIDANCE_STATE
  }
  if (raw === null) return DEFAULT_UX_GUIDANCE_STATE
  try {
    const parsed = JSON.parse(raw) as Partial<UxGuidanceState>
    if (parsed.version !== UX_GUIDANCE_VERSION || typeof parsed.firstRunCompleted !== 'boolean') {
      return DEFAULT_UX_GUIDANCE_STATE
    }
    return Object.freeze({ version: UX_GUIDANCE_VERSION, firstRunCompleted: parsed.firstRunCompleted })
  } catch {
    return DEFAULT_UX_GUIDANCE_STATE
  }
}

export function storeUxGuidanceState(
  storage: UxGuidanceStorage,
  state: UxGuidanceState,
): void {
  if (state.version !== UX_GUIDANCE_VERSION || typeof state.firstRunCompleted !== 'boolean') {
    throw new Error('UX guidance state is invalid')
  }
  storage.setItem(UX_GUIDANCE_STORAGE_KEY, JSON.stringify(state))
}

export function completeFirstRunGuide(storage: UxGuidanceStorage): UxGuidanceState {
  const next = Object.freeze({ version: UX_GUIDANCE_VERSION, firstRunCompleted: true })
  storeUxGuidanceState(storage, next)
  return next
}

export function createBrowserUxGuidanceStorage(): UxGuidanceStorage | null {
  if (typeof window === 'undefined') return null
  return Object.freeze({
    getItem(key: string): string | null {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem(key: string, value: string): void {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // The guide still works for the current session when storage is unavailable.
      }
    },
  })
}

export interface UxGuidanceValidationSummary {
  readonly steps: number
  readonly glossaryEntries: number
  readonly contexts: number
}

export function validateUxGuidanceContent(): UxGuidanceValidationSummary {
  if (FIRST_RUN_STEPS.length < 3) throw new Error('first-run guidance requires at least three steps')
  const terms = new Set<string>()
  for (const entry of GLOSSARY_ENTRIES) {
    if (entry.term.trim().length === 0 || entry.definition.trim().length === 0) {
      throw new Error('glossary terms and definitions must be non-empty')
    }
    if (terms.has(entry.term)) throw new Error(`glossary term must be unique: ${entry.term}`)
    terms.add(entry.term)
  }
  const contexts = Object.keys(SCREEN_HELP) as UxHelpContext[]
  if (contexts.length !== 7) throw new Error('all seven UX help contexts must be authored')
  for (const context of contexts) {
    const help = SCREEN_HELP[context]
    if (help.title.trim().length === 0 || help.summary.trim().length === 0 || help.actions.length === 0) {
      throw new Error(`screen help must be complete: ${context}`)
    }
  }
  return Object.freeze({
    steps: FIRST_RUN_STEPS.length,
    glossaryEntries: GLOSSARY_ENTRIES.length,
    contexts: contexts.length,
  })
}

export const UX_GUIDANCE_VALIDATION = validateUxGuidanceContent()
''',
)

write(
    "src/ux/ux-guidance.test.ts",
    r'''import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UX_GUIDANCE_STATE,
  GLOSSARY_ENTRIES,
  UX_GUIDANCE_STORAGE_KEY,
  UX_GUIDANCE_VALIDATION,
  completeFirstRunGuide,
  loadUxGuidanceState,
  storeUxGuidanceState,
  type UxGuidanceStorage,
} from './ux-guidance'

function createMemoryStorage(initial: string | null = null): UxGuidanceStorage & { value: string | null } {
  return {
    value: initial,
    getItem(key) {
      return key === UX_GUIDANCE_STORAGE_KEY ? this.value : null
    },
    setItem(key, value) {
      if (key === UX_GUIDANCE_STORAGE_KEY) this.value = value
    },
  }
}

describe('UX guidance state', () => {
  it('uses a safe default for missing or invalid storage', () => {
    expect(loadUxGuidanceState(createMemoryStorage())).toEqual(DEFAULT_UX_GUIDANCE_STATE)
    expect(loadUxGuidanceState(createMemoryStorage('{bad json'))).toEqual(DEFAULT_UX_GUIDANCE_STATE)
    expect(loadUxGuidanceState(createMemoryStorage('{"version":1,"firstRunCompleted":"yes"}'))).toEqual(
      DEFAULT_UX_GUIDANCE_STATE,
    )
  })

  it('persists and completes the first-run guide', () => {
    const storage = createMemoryStorage()
    storeUxGuidanceState(storage, { version: 1, firstRunCompleted: false })
    expect(loadUxGuidanceState(storage).firstRunCompleted).toBe(false)
    completeFirstRunGuide(storage)
    expect(loadUxGuidanceState(storage).firstRunCompleted).toBe(true)
  })

  it('authors complete and unique guidance content', () => {
    expect(UX_GUIDANCE_VALIDATION.steps).toBeGreaterThanOrEqual(3)
    expect(UX_GUIDANCE_VALIDATION.contexts).toBe(7)
    expect(new Set(GLOSSARY_ENTRIES.map((entry) => entry.term)).size).toBe(
      GLOSSARY_ENTRIES.length,
    )
  })
})
''',
)

write(
    "src/ui/ConfirmDialog.tsx",
    r'''import { useEffect, useRef } from 'react'

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
''',
)

write(
    "src/ui/UxHelpDialog.tsx",
    r'''import { useEffect, useRef, useState } from 'react'
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
''',
)

write(
    "src/ui/FirstRunGuide.tsx",
    r'''import { useEffect, useRef, useState } from 'react'
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
    if (!open) return
    setStepIndex(0)
    window.setTimeout(() => firstButtonRef.current?.focus(), 0)
  }, [open])

  if (!open || step === undefined) return null

  return (
    <div className="ux-modal-backdrop">
      <section
        className="ux-dialog ux-first-run-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
      >
        <p className="panel-heading__kicker">FIRST EXPEDITION GUIDE</p>
        <div className="ux-step-count">{stepIndex + 1} / {FIRST_RUN_STEPS.length}</div>
        <h2 id="first-run-title">{step.title}</h2>
        <strong className="ux-first-run-summary">{step.summary}</strong>
        <p>{step.detail}</p>
        <div className="ux-step-track" aria-label={`初回ガイド ${stepIndex + 1}/${FIRST_RUN_STEPS.length}`}>
          {FIRST_RUN_STEPS.map((candidate, index) => (
            <span key={candidate.title} className={index <= stepIndex ? 'is-active' : ''} />
          ))}
        </div>
        {!last ? (
          <div className="ux-dialog-actions">
            <button ref={firstButtonRef} type="button" className="collection-button" onClick={onDismiss}>
              後で見る
            </button>
            {stepIndex > 0 && (
              <button type="button" className="collection-button" onClick={() => setStepIndex((current) => current - 1)}>
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
            <button ref={firstButtonRef} type="button" className="collection-button" onClick={onOpenCollection}>
              編成から始める
            </button>
            <button type="button" className="collection-button collection-button--primary" onClick={onOpenRegion}>
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
''',
)

write(
    "src/ui/HomeScreen.tsx",
    r'''import { useState } from 'react'
import type { PlayerData } from '../progression/player-data'
import {
  completeFirstRunGuide,
  createBrowserUxGuidanceStorage,
  loadUxGuidanceState,
} from '../ux/ux-guidance'
import { FirstRunGuide } from './FirstRunGuide'
import { UxHelpButton } from './UxHelpDialog'

export interface HomeScreenProps {
  readonly playerData: PlayerData
  readonly notice: string | null
  readonly persistenceAvailable: boolean
  readonly onOpenRegion: () => void
  readonly onOpenCollection: () => void
  readonly onOpenResearch: () => void
  readonly onOpenSummon: () => void
  readonly onOpenSave: () => void
}

function initialGuideOpen(): boolean {
  const storage = createBrowserUxGuidanceStorage()
  return storage === null || !loadUxGuidanceState(storage).firstRunCompleted
}

export function HomeScreen({
  playerData,
  notice,
  persistenceAvailable,
  onOpenRegion,
  onOpenCollection,
  onOpenResearch,
  onOpenSummon,
  onOpenSave,
}: HomeScreenProps) {
  const [guideOpen, setGuideOpen] = useState(initialGuideOpen)
  const completedStages = playerData.stageProgress?.completedStageIds.length ?? 0
  const unlockedBlueprints = playerData.collection.speciesStates.filter(
    (state) => state.blueprintUnlocked,
  ).length

  const finishGuide = () => {
    const storage = createBrowserUxGuidanceStorage()
    if (storage !== null) completeFirstRunGuide(storage)
    setGuideOpen(false)
  }

  const finishAndOpen = (open: () => void) => {
    finishGuide()
    open()
  }

  return (
    <main className="collection-app">
      <header className="collection-header">
        <div>
          <p className="eyebrow">MONSTER RESEARCH TACTICS</p>
          <h1>観測拠点</h1>
          <p>編成、出撃、研究、召喚、セーブを一つの循環として進めます。</p>
        </div>
        <div className="ux-header-actions">
          <UxHelpButton context="HOME" onRestartGuide={() => setGuideOpen(true)} />
          <button
            type="button"
            className="collection-button collection-button--primary"
            onClick={onOpenRegion}
          >
            地域観測へ出る
          </button>
        </div>
      </header>

      {notice !== null && (
        <p className="collection-notice" role="status">
          {notice}
        </p>
      )}

      {!persistenceAvailable && (
        <p className="collection-notice" role="status">
          永続化を利用できません。このセッション中はプレイできますが、再読込後の進行は保証されません。
        </p>
      )}

      <section className="collection-panel" aria-labelledby="home-progress-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">CURRENT EXPEDITION</p>
            <h2 id="home-progress-title">現在の進行</h2>
          </div>
          <strong>{playerData.contentVersion}</strong>
        </div>
        <div className="region-resource-bar" aria-label="現在の資源と進行">
          <div><span>基本通貨</span><strong>{playerData.economy.currency}</strong></div>
          <div><span>研究データ</span><strong>{playerData.economy.researchData}</strong></div>
          <div><span>所持個体</span><strong>{playerData.collection.unitInstances.length}</strong></div>
          <div><span>設計図</span><strong>{unlockedBlueprints}</strong></div>
          <div><span>クリア</span><strong>{completedStages}</strong></div>
        </div>
      </section>

      <section className="collection-panel" aria-labelledby="home-actions-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">OPERATIONS</p>
            <h2 id="home-actions-title">拠点メニュー</h2>
          </div>
        </div>
        <nav className="region-global-actions" aria-label="拠点メニュー">
          <button type="button" className="collection-button" onClick={onOpenCollection}>
            編成・図鑑
          </button>
          <button type="button" className="collection-button" onClick={onOpenResearch}>
            研究網・施設
          </button>
          <button type="button" className="collection-button" onClick={onOpenSummon}>
            召喚
          </button>
          <button type="button" className="collection-button" onClick={onOpenSave}>
            セーブスロット
          </button>
        </nav>
      </section>

      <FirstRunGuide
        open={guideOpen}
        onDismiss={finishGuide}
        onOpenCollection={() => finishAndOpen(onOpenCollection)}
        onOpenRegion={() => finishAndOpen(onOpenRegion)}
        onOpenResearch={() => finishAndOpen(onOpenResearch)}
      />
    </main>
  )
}
''',
)

write(
    "src/ui/T040RegionScreen.tsx",
    r'''import { RegionScreen, type RegionScreenProps } from './RegionScreen'
import { UxHelpButton } from './UxHelpDialog'

export interface T040RegionScreenProps extends RegionScreenProps {
  readonly onOpenSave: () => void
}

export function T040RegionScreen({
  onOpenSave,
  ...regionProps
}: T040RegionScreenProps) {
  return (
    <div className="t040-region-shell">
      <nav className="t040-region-save-entry" aria-label="セーブ管理とヘルプ">
        <UxHelpButton context="REGION" />
        <button type="button" className="collection-button" onClick={onOpenSave}>
          セーブスロット
        </button>
      </nav>
      <RegionScreen {...regionProps} />
    </div>
  )
}
''',
)

write(
    "src/ui/SaveSlotScreen.tsx",
    r'''import { useState } from 'react'
import { SAVE_SLOT_IDS, type SaveSlotId, type SaveSlotSummary } from '../save/save-model'
import { ConfirmDialog } from './ConfirmDialog'
import { UxHelpButton } from './UxHelpDialog'

function formatSavedAt(epochMs: number | null): string {
  if (epochMs === null) return '未保存'
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(epochMs))
}

function slotNumber(slotId: SaveSlotId): string {
  return slotId.split('-').at(-1) ?? slotId
}

type PendingSaveAction =
  | { readonly kind: 'OVERWRITE' | 'LOAD' | 'DELETE'; readonly slotId: SaveSlotId }
  | { readonly kind: 'IMPORT'; readonly json: string }

export interface SaveSlotScreenProps {
  readonly summaries: readonly SaveSlotSummary[]
  readonly activeSlotId: SaveSlotId
  readonly autosaveEnabled: boolean
  readonly busy: boolean
  readonly notice: string | null
  readonly onSaveToSlot: (slotId: SaveSlotId) => void
  readonly onLoadSlot: (slotId: SaveSlotId) => void
  readonly onDeleteSlot: (slotId: SaveSlotId) => void
  readonly onAutosaveChange: (enabled: boolean) => void
  readonly onExportJson: () => void
  readonly onImportJson: (json: string) => void
  readonly onBack: () => void
}

export function SaveSlotScreen({
  summaries,
  activeSlotId,
  autosaveEnabled,
  busy,
  notice,
  onSaveToSlot,
  onLoadSlot,
  onDeleteSlot,
  onAutosaveChange,
  onExportJson,
  onImportJson,
  onBack,
}: SaveSlotScreenProps) {
  const [pendingAction, setPendingAction] = useState<PendingSaveAction | null>(null)
  const summaryBySlot = new Map(summaries.map((summary) => [summary.slotId, summary]))

  const confirmPendingAction = () => {
    const action = pendingAction
    setPendingAction(null)
    if (action === null) return
    if (action.kind === 'OVERWRITE') onSaveToSlot(action.slotId)
    else if (action.kind === 'LOAD') onLoadSlot(action.slotId)
    else if (action.kind === 'DELETE') onDeleteSlot(action.slotId)
    else onImportJson(action.json)
  }

  const pendingSlot =
    pendingAction !== null && pendingAction.kind !== 'IMPORT'
      ? summaryBySlot.get(pendingAction.slotId)
      : undefined
  const confirmation = (() => {
    if (pendingAction === null) return null
    if (pendingAction.kind === 'IMPORT') {
      return {
        title: `スロット ${slotNumber(activeSlotId)}をJSONで置き換えますか？`,
        description: '現在の使用中スロットへ検証済みJSONを保存し、現在の進行を置き換えます。',
        confirmLabel: 'JSONを読込む',
        tone: 'danger' as const,
        details: [`対象: スロット ${slotNumber(activeSlotId)}`, '現在世代はバックアップ対象になります'],
      }
    }
    const number = slotNumber(pendingAction.slotId)
    if (pendingAction.kind === 'OVERWRITE') {
      return {
        title: `スロット ${number}を上書きしますか？`,
        description: '保存済みの現在世代を、今の進行で置き換えます。',
        confirmLabel: '上書き保存',
        tone: 'danger' as const,
        details: [`既存保存: ${formatSavedAt(pendingSlot?.savedAtEpochMs ?? null)}`, '既存世代はバックアップへ移動します'],
      }
    }
    if (pendingAction.kind === 'LOAD') {
      return {
        title: `スロット ${number}をロードしますか？`,
        description: '画面上の現在進行と中断戦闘を、選択した保存データへ切り替えます。',
        confirmLabel: 'ロードする',
        tone: 'default' as const,
        details: [`保存日時: ${formatSavedAt(pendingSlot?.savedAtEpochMs ?? null)}`, `クリア: ${pendingSlot?.completedStageCount ?? 0}ステージ`],
      }
    }
    return {
      title: `スロット ${number}を削除しますか？`,
      description: '現在世代と保持中のバックアップをすべて削除します。この操作は取り消せません。',
      confirmLabel: '完全に削除',
      tone: 'danger' as const,
      details: [`バックアップ: ${pendingSlot?.backupCount ?? 0}世代`, 'JSONエクスポート済みデータは削除されません'],
    }
  })()

  return (
    <main className="save-app">
      <header className="save-header collection-header">
        <div>
          <p className="eyebrow">SAVE REPOSITORY</p>
          <h1>セーブスロット管理</h1>
          <p>PlayerDataはIndexedDBへ保存し、現在世代と最大3件のバックアップを保持します。</p>
        </div>
        <div className="ux-header-actions">
          <UxHelpButton context="SAVE" />
          <button type="button" className="collection-button" onClick={onBack} disabled={busy}>
            ゲームへ戻る
          </button>
        </div>
      </header>

      <section className="save-settings collection-panel" aria-labelledby="save-settings-title">
        <div>
          <p className="panel-heading__kicker">DEVICE SETTINGS</p>
          <h2 id="save-settings-title">端末設定</h2>
        </div>
        <label className="save-autosave-toggle">
          <input
            type="checkbox"
            checked={autosaveEnabled}
            disabled={busy}
            onChange={(event) => onAutosaveChange(event.target.checked)}
          />
          <span>
            <strong>進行変更時に自動保存</strong>
            <small>この設定と使用中スロットだけをlocalStorageへ保存します。</small>
          </span>
        </label>
      </section>

      <section className="save-transfer collection-panel" aria-labelledby="save-transfer-title">
        <div>
          <p className="panel-heading__kicker">PORTABLE JSON</p>
          <h2 id="save-transfer-title">エクスポート・インポート</h2>
          <p>使用中スロットの進行とstable戦闘スナップショットを、整合性チェック付きJSONで移動できます。</p>
        </div>
        <div className="save-transfer__actions">
          <button type="button" className="collection-button" disabled={busy} onClick={onExportJson}>
            使用中スロットをJSON保存
          </button>
          <label className={`collection-button save-import-button${busy ? ' is-disabled' : ''}`}>
            JSONを使用中スロットへ読込
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file !== undefined) void file.text().then((json) => setPendingAction({ kind: 'IMPORT', json }))
              }}
            />
          </label>
        </div>
      </section>

      {notice !== null && (
        <p className="collection-notice save-notice" role="status">
          {notice}
        </p>
      )}

      <section className="save-slot-grid" aria-label="セーブスロット一覧">
        {SAVE_SLOT_IDS.map((slotId) => {
          const summary = summaryBySlot.get(slotId)
          const empty = summary?.empty ?? true
          const active = slotId === activeSlotId
          return (
            <article
              key={slotId}
              className={`save-slot-card collection-panel${active ? ' is-active' : ''}${empty ? ' is-empty' : ''}`}
            >
              <header className="save-slot-card__header">
                <div>
                  <p className="panel-heading__kicker">SAVE SLOT {slotNumber(slotId)}</p>
                  <h2>スロット {slotNumber(slotId)}</h2>
                </div>
                <span className="save-slot-card__state">{active ? '使用中' : empty ? '空き' : '保存済み'}</span>
              </header>

              {empty || summary === undefined ? (
                <div className="save-slot-card__empty">
                  <strong>保存データなし</strong>
                  <p>現在の進行を保存すると、このスロットが使用中になります。</p>
                </div>
              ) : (
                <>
                  <dl className="save-slot-metadata">
                    <div><dt>保存日時</dt><dd>{formatSavedAt(summary.savedAtEpochMs)}</dd></div>
                    <div><dt>基本通貨</dt><dd>{summary.currency}</dd></div>
                    <div><dt>研究データ</dt><dd>{summary.researchData}</dd></div>
                    <div><dt>所持個体</dt><dd>{summary.ownedUnitCount}</dd></div>
                    <div><dt>クリア</dt><dd>{summary.completedStageCount}ステージ</dd></div>
                    <div><dt>バックアップ</dt><dd>{summary.backupCount}世代</dd></div>
                    <div><dt>schema</dt><dd>{summary.schemaVersion}</dd></div>
                    <div><dt>content</dt><dd>{summary.contentVersion}</dd></div>
                    <div><dt>中断戦闘</dt><dd>{summary.resumableBattleStageId ?? 'なし'}</dd></div>
                  </dl>
                  {summary.recoveredFromBackup && (
                    <p className="save-recovery-warning" role="status">
                      現在世代を検証できなかったため、バックアップ世代を表示しています。
                    </p>
                  )}
                </>
              )}

              <div className="save-slot-card__actions">
                <button
                  type="button"
                  className="collection-button collection-button--primary"
                  disabled={busy}
                  onClick={() =>
                    empty ? onSaveToSlot(slotId) : setPendingAction({ kind: 'OVERWRITE', slotId })
                  }
                >
                  {empty ? '現在の進行を保存' : '現在の進行で上書き'}
                </button>
                <button
                  type="button"
                  className="collection-button"
                  disabled={busy || empty || active}
                  onClick={() => setPendingAction({ kind: 'LOAD', slotId })}
                >
                  {active ? '現在使用中' : 'このスロットをロード'}
                </button>
                <button
                  type="button"
                  className="collection-button collection-button--danger"
                  disabled={busy || empty || active}
                  onClick={() => setPendingAction({ kind: 'DELETE', slotId })}
                >
                  {active ? '使用中は削除不可' : 'スロットを削除'}
                </button>
              </div>
            </article>
          )
        })}
      </section>

      <ConfirmDialog
        open={confirmation !== null}
        title={confirmation?.title ?? ''}
        description={confirmation?.description ?? ''}
        details={confirmation?.details}
        confirmLabel={confirmation?.confirmLabel ?? '実行'}
        tone={confirmation?.tone}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
      />
    </main>
  )
}
''',
)

write(
    "src/ui/SummonScreen.tsx",
    r'''import { resolveDisplayName } from '../content/display-masters'
import { useMemo, useState } from 'react'
import type { SpeciesId } from '../content/monster-species'
import type { PlayerData } from '../progression/player-data'
import type { T036ProgressionCatalog } from '../progression/t036-progression-model'
import { calculateSummonCurrencyCost, summonUnit } from '../progression/unit-economy'
import { ConfirmDialog } from './ConfirmDialog'
import { UxHelpButton } from './UxHelpDialog'

function instanceSlug(speciesId: SpeciesId): string {
  return speciesId.split('.').at(-1) ?? speciesId
}

export function createNextSummonInstanceId(playerData: PlayerData, speciesId: SpeciesId): string {
  const existing = new Set(playerData.collection.unitInstances.map((instance) => instance.instanceId))
  const slug = instanceSlug(speciesId)
  for (let serial = 1; serial <= Number.MAX_SAFE_INTEGER; serial += 1) {
    const candidate = `unit.summoned.${slug}-${String(serial).padStart(3, '0')}`
    if (!existing.has(candidate)) return candidate
  }
  throw new Error(`召喚個体IDを確保できません: ${speciesId}`)
}

export interface SummonScreenProps {
  readonly playerData: PlayerData
  readonly catalog: T036ProgressionCatalog
  readonly onPlayerDataChange: (next: PlayerData) => void
  readonly onOpenHome: () => void
  readonly onOpenCollection: () => void
  readonly onOpenResearch: () => void
}

export function SummonScreen({
  playerData,
  catalog,
  onPlayerDataChange,
  onOpenHome,
  onOpenCollection,
  onOpenResearch,
}: SummonScreenProps) {
  const unlockedSpecies = useMemo(
    () =>
      playerData.collection.speciesStates
        .filter((state) => state.blueprintUnlocked)
        .map((state) => catalog.species.find((species) => species.id === state.speciesId))
        .filter((species): species is NonNullable<typeof species> => species !== undefined)
        .sort((left, right) => left.rarity - right.rarity || left.id.localeCompare(right.id, 'en')),
    [catalog.species, playerData.collection.speciesStates],
  )
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<SpeciesId | null>(unlockedSpecies[0]?.id ?? null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const selectedSpecies =
    unlockedSpecies.find((species) => species.id === selectedSpeciesId) ?? unlockedSpecies[0] ?? null
  const summonCost = selectedSpecies === null ? null : calculateSummonCurrencyCost(selectedSpecies.rarity)
  const canAfford = summonCost !== null && playerData.economy.currency >= summonCost

  const summon = () => {
    setConfirmOpen(false)
    if (selectedSpecies === null) {
      setNotice('召喚可能な設計図がありません。')
      return
    }
    try {
      const instanceId = createNextSummonInstanceId(playerData, selectedSpecies.id)
      const result = summonUnit(playerData, { instanceId, speciesId: selectedSpecies.id }, catalog)
      onPlayerDataChange(result.playerData)
      setNotice(`${resolveDisplayName(result.speciesId)}を召喚しました。基本通貨を${result.currencySpent}消費しました。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '召喚に失敗しました。')
    }
  }

  return (
    <main className="collection-app">
      <header className="collection-header">
        <div>
          <p className="eyebrow">SUMMON FACILITY</p>
          <h1>設計図召喚</h1>
          <p>研究で永久解放した設計図から、抽選や待機なしで個体を召喚します。</p>
        </div>
        <nav className="region-global-actions" aria-label="召喚画面の移動">
          <UxHelpButton context="SUMMON" />
          <button type="button" className="collection-button" onClick={onOpenHome}>ホーム</button>
          <button type="button" className="collection-button" onClick={onOpenResearch}>研究網</button>
          <button type="button" className="collection-button" onClick={onOpenCollection}>編成・図鑑</button>
        </nav>
      </header>

      {notice !== null && <p className="collection-notice" role="status">{notice}</p>}

      <section className="collection-panel" aria-labelledby="summon-resource-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">AVAILABLE BLUEPRINTS</p>
            <h2 id="summon-resource-title">召喚可能な設計図</h2>
          </div>
          <strong>基本通貨 {playerData.economy.currency}</strong>
        </div>

        {unlockedSpecies.length === 0 ? (
          <p>解放済み設計図がありません。研究網で確定研究を完了してください。</p>
        ) : (
          <div className="research-node-grid">
            {unlockedSpecies.map((species) => {
              const cost = calculateSummonCurrencyCost(species.rarity)
              const owned = playerData.collection.unitInstances.filter((instance) => instance.speciesId === species.id).length
              return (
                <button
                  key={species.id}
                  type="button"
                  className="research-node research-node--completed"
                  aria-pressed={selectedSpecies?.id === species.id}
                  onClick={() => setSelectedSpeciesId(species.id)}
                >
                  <span className="research-node__stage">R{species.rarity}</span>
                  <strong>{resolveDisplayName(species.id)}</strong>
                  <small>所持 {owned} / 通貨 {cost}</small>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {selectedSpecies !== null && summonCost !== null && (
        <section className="collection-panel" aria-labelledby="summon-confirm-title">
          <div className="collection-section-heading">
            <div>
              <p className="panel-heading__kicker">CONFIRM SUMMON</p>
              <h2 id="summon-confirm-title">{resolveDisplayName(selectedSpecies.id)}</h2>
            </div>
            <strong>R{selectedSpecies.rarity}</strong>
          </div>
          <p>基本通貨を{summonCost}消費し、condition 100%の新しい個体を追加します。</p>
          <button
            type="button"
            className="collection-button collection-button--primary"
            disabled={!canAfford}
            onClick={() => setConfirmOpen(true)}
          >
            {canAfford ? `基本通貨 ${summonCost} で召喚` : '基本通貨が不足しています'}
          </button>
        </section>
      )}

      <ConfirmDialog
        open={confirmOpen && selectedSpecies !== null && summonCost !== null}
        title={`${selectedSpecies === null ? '' : resolveDisplayName(selectedSpecies.id)}を召喚しますか？`}
        description="設計図は失われませんが、基本通貨を消費して新しい個体を追加します。"
        details={summonCost === null ? [] : [`消費: 基本通貨 ${summonCost}`, `実行後: 基本通貨 ${playerData.economy.currency - summonCost}`]}
        confirmLabel="召喚する"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={summon}
      />
    </main>
  )
}
''',
)

# Collection screen: help entry and confirmation before permanent skill purchase.
path = "src/ui/CollectionScreen.tsx"
text = read(path)
text = text.replace("import { MonsterIcon } from './MonsterIcon'", "import { ConfirmDialog } from './ConfirmDialog'\nimport { MonsterIcon } from './MonsterIcon'\nimport { UxHelpButton } from './UxHelpDialog'")
text = text.replace(
    "  const [notice, setNotice] = useState<string | null>(null)\n",
    "  const [notice, setNotice] = useState<string | null>(null)\n  const [pendingSkill, setPendingSkill] = useState<SkillDefinition | null>(null)\n",
)
text = text.replace("  const learnSkill = (skill: SkillDefinition) => {", "  const learnSkill = (skill: SkillDefinition) => {\n    setPendingSkill(null)")
text = text.replace(
    "        <dl className=\"collection-header__metrics\">",
    "        <div className=\"ux-header-actions ux-header-actions--metrics\">\n          <UxHelpButton context=\"COLLECTION\" />\n          <dl className=\"collection-header__metrics\">",
)
text = text.replace("        </dl>\n      </header>", "          </dl>\n        </div>\n      </header>", 1)
text = text.replace("onClick={() => learnSkill(skill)}", "onClick={() => setPendingSkill(skill)}")
text = text.replace(
    "      {tab === 'ENCYCLOPEDIA' && (",
    "      <ConfirmDialog\n        open={pendingSkill !== null && selectedInstance !== null}\n        title={`${pendingSkill === null ? '' : resolveDisplayName(pendingSkill.id)}を習得しますか？`}\n        description=\"選択中の個体へ汎用技を永久習得させ、基本通貨を消費します。\"\n        details={\n          pendingSkill === null || selectedInstance === null\n            ? []\n            : [\n                `対象: ${selectedInstance.nickname ?? formatUnitDisplayName(selectedInstance.speciesId, selectedInstance.instanceId)}`,\n                `消費: 基本通貨 ${genericSkillCosts[pendingSkill.id] ?? '—'}`,\n              ]\n        }\n        confirmLabel=\"習得する\"\n        onCancel={() => setPendingSkill(null)}\n        onConfirm={() => {\n          if (pendingSkill !== null) learnSkill(pendingSkill)\n        }}\n      />\n\n      {tab === 'ENCYCLOPEDIA' && (",
)
write(path, text)

# Research screen: help plus confirmations for facility upgrades and final research consumption.
path = "src/ui/ResearchScreen.tsx"
text = read(path)
text = text.replace("import { getResearchFacilityStageDefinition } from '../progression/research-facility-model'", "import { getResearchFacilityStageDefinition } from '../progression/research-facility-model'\nimport { ConfirmDialog } from './ConfirmDialog'\nimport { UxHelpButton } from './UxHelpDialog'")
text = text.replace(
    "  const [specimenInstanceIds, setSpecimenInstanceIds] = useState<readonly string[]>([])\n",
    "  const [specimenInstanceIds, setSpecimenInstanceIds] = useState<readonly string[]>([])\n  const [confirmOpen, setConfirmOpen] = useState(false)\n",
)
text = text.replace("  const submit = () => {\n    try {\n      const result = completeFacilityFinalResearch(", "  const submit = () => {\n    setConfirmOpen(false)\n    try {\n      const result = completeFacilityFinalResearch(", 1)
text = text.replace(
    "        onClick={submit}\n      >\n        資源を消費して設計図解放\n      </button>\n    </section>",
    "        onClick={() => setConfirmOpen(true)}\n      >\n        資源を消費して設計図解放\n      </button>\n      <ConfirmDialog\n        open={confirmOpen}\n        title={`${resolveDisplayName(definition.targetSpeciesId)}の設計図を解放しますか？`}\n        description=\"研究データ、触媒、選択した標本個体を消費します。標本消費は取り消せません。\"\n        details={[\n          `研究データ ${finalDefinition.researchDataCost}`,\n          `触媒: ${finalDefinition.catalysts.length === 0 ? 'なし' : finalDefinition.catalysts.map((entry) => `${resolveDisplayName(entry.catalystId)} ×${entry.amount}`).join(' / ')}`,\n          `標本個体: ${specimenInstanceIds.length}体`,\n        ]}\n        confirmLabel=\"消費して設計図解放\"\n        tone={specimenInstanceIds.length > 0 ? 'danger' : 'default'}\n        onCancel={() => setConfirmOpen(false)}\n        onConfirm={submit}\n      />\n    </section>",
)
text = text.replace(
    "  const [notice, setNotice] = useState<string | null>(null)\n  const selectedState =",
    "  const [notice, setNotice] = useState<string | null>(null)\n  const [upgradeConfirmOpen, setUpgradeConfirmOpen] = useState(false)\n  const selectedState =",
)
text = text.replace("  const upgrade = () => {\n    try {", "  const upgrade = () => {\n    setUpgradeConfirmOpen(false)\n    try {")
text = text.replace(
    "        <button type=\"button\" className=\"collection-button\" onClick={onOpenCollection}>\n          編成・図鑑へ戻る\n        </button>",
    "        <div className=\"ux-header-actions\">\n          <UxHelpButton context=\"RESEARCH\" />\n          <button type=\"button\" className=\"collection-button\" onClick={onOpenCollection}>\n            編成・図鑑へ戻る\n          </button>\n        </div>",
)
text = text.replace("                onClick={upgrade}", "                onClick={() => setUpgradeConfirmOpen(true)}")
text = text.replace(
    "      </section>\n\n      {notice !== null && (",
    "      </section>\n\n      <ConfirmDialog\n        open={upgradeConfirmOpen && nextFacility !== undefined}\n        title={`研究施設を段階${nextFacility?.stage ?? ''}へ更新しますか？`}\n        description=\"施設更新は基本通貨と研究データを消費し、研究可能レア度を拡張します。\"\n        details={\n          nextFacility === undefined\n            ? []\n            : [\n                `基本通貨 ${nextFacility.upgradeCurrencyCost}`,\n                `研究データ ${nextFacility.upgradeResearchDataCost}`,\n                `更新後: R${nextFacility.maxResearchableRarity}まで`,\n              ]\n        }\n        confirmLabel=\"施設を更新\"\n        onCancel={() => setUpgradeConfirmOpen(false)}\n        onConfirm={upgrade}\n      />\n\n      {notice !== null && (",
    1,
)
write(path, text)

# Bloom research confirmation.
path = "src/ui/T048ResearchScreen.tsx"
text = read(path)
text = text.replace("import type { T037ProgressionCatalog } from '../progression/research-facility'", "import type { T037ProgressionCatalog } from '../progression/research-facility'\nimport type { BloomResearchDefinition } from '../progression/t036-progression-model'")
text = text.replace("import { ResearchScreen } from './ResearchScreen'", "import { ConfirmDialog } from './ConfirmDialog'\nimport { ResearchScreen } from './ResearchScreen'")
text = text.replace(
    "  const [notice, setNotice] = useState<string | null>(null)\n",
    "  const [notice, setNotice] = useState<string | null>(null)\n  const [pendingDefinition, setPendingDefinition] = useState<BloomResearchDefinition | null>(null)\n",
)
insert_after = "    [catalog],\n  )\n"
if text.count(insert_after) != 1:
    raise SystemExit("could not find T048 definitions memo end")
text = text.replace(
    insert_after,
    insert_after + r'''

  const unlock = (definition: BloomResearchDefinition) => {
    setPendingDefinition(null)
    try {
      const result = unlockBloomSkill(
        playerData,
        definition.speciesId,
        definition.skillId,
        catalog,
      )
      onPlayerDataChange(result.playerData)
      setNotice(
        `${resolveDisplayName(result.speciesId)}の開花技${resolveDisplayName(result.skillId)}を解放しました。`,
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '開花研究に失敗しました。')
    }
  }
''',
    1,
)
start = text.find("              const unlock = () => {")
end = text.find("\n\n              let status", start)
if start == -1 or end == -1:
    raise SystemExit("could not remove inline bloom unlock")
text = text[:start] + text[end + 2 :]
text = text.replace("onClick={unlock}", "onClick={() => setPendingDefinition(definition)}")
text = text.replace(
    "      </main>\n    </>",
    "      </main>\n      <ConfirmDialog\n        open={pendingDefinition !== null}\n        title={`${pendingDefinition === null ? '' : resolveDisplayName(pendingDefinition.skillId)}を開花解放しますか？`}\n        description=\"同種すべての個体へ開花技を永久解放し、基本通貨と研究データを消費します。\"\n        details={\n          pendingDefinition === null\n            ? []\n            : [\n                `対象種: ${resolveDisplayName(pendingDefinition.speciesId)}`,\n                `基本通貨 ${pendingDefinition.currencyCost}`,\n                `研究データ ${pendingDefinition.researchDataCost}`,\n              ]\n        }\n        confirmLabel=\"開花技を解放\"\n        onCancel={() => setPendingDefinition(null)}\n        onConfirm={() => {\n          if (pendingDefinition !== null) unlock(pendingDefinition)\n        }}\n      />\n    </>",
)
write(path, text)

# Battle help and confirmation before resetting or abandoning an active battle.
path = "src/ui/MinimalBattleScreen.tsx"
text = read(path)
text = text.replace("import { MobileDisclosure } from './MobileDisclosure'", "import { ConfirmDialog } from './ConfirmDialog'\nimport { MobileDisclosure } from './MobileDisclosure'\nimport { UxHelpButton } from './UxHelpDialog'")
text = text.replace(
    "  const [attempt, setAttempt] = useState(initialAttempt)\n",
    "  const [attempt, setAttempt] = useState(initialAttempt)\n  const [pendingBattleAction, setPendingBattleAction] = useState<'RESET' | 'FORMATION' | null>(null)\n",
)
text = text.replace("        <button type=\"button\" className=\"control-button\" onClick={reset}>", "        <UxHelpButton context=\"BATTLE\" buttonClassName=\"control-button\" />\n        <button type=\"button\" className=\"control-button\" onClick={() => setPendingBattleAction('RESET')}>")
text = text.replace(
    "          <button type=\"button\" className=\"control-button\" onClick={onOpenFormation}>\n            編成へ戻る\n          </button>",
    "          <button\n            type=\"button\"\n            className=\"control-button\"\n            onClick={() => (isTerminal ? onOpenFormation() : setPendingBattleAction('FORMATION'))}\n          >\n            編成へ戻る\n          </button>",
)
text = text.replace(
    "      </nav>\n\n      {resultView !== null && (",
    "      </nav>\n\n      <ConfirmDialog\n        open={pendingBattleAction !== null}\n        title={pendingBattleAction === 'FORMATION' ? '戦闘を中断して編成へ戻りますか？' : 'この戦闘を最初からやり直しますか？'}\n        description={\n          pendingBattleAction === 'FORMATION'\n            ? '現在の戦闘スナップショットを破棄して、編成画面へ移動します。'\n            : '現在の試行内容を破棄し、同じステージを初期状態から開始します。'\n        }\n        details={[`現在の行動数: ${snapshot.totalActions}`, `現在の状態: ${statusLabel(snapshot, autoRequested, speed)}`]}\n        confirmLabel={pendingBattleAction === 'FORMATION' ? '中断して編成へ' : '最初から再開'}\n        tone=\"danger\"\n        onCancel={() => setPendingBattleAction(null)}\n        onConfirm={() => {\n          const action = pendingBattleAction\n          setPendingBattleAction(null)\n          if (action === 'RESET') reset()\n          else if (action === 'FORMATION') onOpenFormation?.()\n        }}\n      />\n\n      {resultView !== null && (",
)
write(path, text)

# Append modal/help styles.
css_path = "src/index.css"
css = read(css_path)
marker = "/* T050 UX guidance and confirmation */"
if marker not in css:
    css += r'''

/* T050 UX guidance and confirmation */
.ux-header-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; justify-content: flex-end; }
.ux-header-actions--metrics { align-items: flex-start; }
.ux-help-button { white-space: nowrap; }
.ux-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 1rem; background: rgba(1, 7, 12, 0.78); backdrop-filter: blur(0.45rem); }
.ux-dialog { width: min(46rem, 100%); max-height: min(88vh, 54rem); overflow: auto; padding: clamp(1rem, 3vw, 1.5rem); border: 1px solid rgba(170, 207, 232, 0.3); border-radius: 1rem; color: #edf5fa; background: #0b1924; box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, 0.55); }
.ux-dialog h2 { margin-bottom: 0.75rem; font-size: clamp(1.2rem, 3vw, 1.65rem); }
.ux-dialog p { color: #b8c7d4; line-height: 1.65; }
.ux-dialog-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
.ux-dialog-actions, .ux-first-run-destinations { display: flex; flex-wrap: wrap; gap: 0.65rem; justify-content: flex-end; margin-top: 1.15rem; }
.ux-confirm-dialog--danger { border-color: rgba(231, 132, 151, 0.52); }
.ux-confirm-details { display: grid; gap: 0.45rem; margin: 1rem 0; padding: 0.85rem 1rem 0.85rem 2rem; border-radius: 0.75rem; color: #cedbe4; background: rgba(26, 48, 63, 0.72); }
.ux-screen-actions { display: grid; gap: 0.45rem; padding-left: 1.4rem; color: #d6e1e8; }
.ux-restart-guide { margin-block: 0.3rem 1rem; }
.ux-glossary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; margin-top: 1rem; }
.ux-glossary section { padding: 0.85rem; border: 1px solid rgba(170, 207, 232, 0.16); border-radius: 0.75rem; background: rgba(17, 36, 49, 0.72); }
.ux-glossary dl { display: grid; gap: 0.75rem; margin: 0; }
.ux-glossary dl div { display: grid; gap: 0.2rem; }
.ux-glossary dt { font-weight: 800; color: #dff2fb; }
.ux-glossary dd { margin: 0; color: #aebfcb; font-size: 0.78rem; line-height: 1.55; }
.ux-step-count { float: right; color: #8fb9d7; font-size: 0.78rem; font-weight: 800; }
.ux-first-run-summary { display: block; margin-bottom: 0.65rem; color: #dcebf3; line-height: 1.55; }
.ux-step-track { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; margin-top: 1rem; }
.ux-step-track span { height: 0.28rem; border-radius: 999px; background: rgba(160, 190, 210, 0.2); }
.ux-step-track span.is-active { background: #79c4d8; }

@media (max-width: 760px) {
  .ux-dialog-header { flex-direction: column; }
  .ux-glossary { grid-template-columns: 1fr; }
  .ux-dialog-actions, .ux-first-run-destinations { display: grid; }
  .ux-dialog-actions .collection-button, .ux-first-run-destinations .collection-button { width: 100%; }
  .ux-header-actions { width: 100%; justify-content: stretch; }
  .ux-header-actions > * { flex: 1; }
}
'''
write(css_path, css)

# Add guidance validation to the existing validation report.
path = "scripts/validate-content.ts"
text = read(path)
text = "import { UX_GUIDANCE_VALIDATION } from '../src/ux/ux-guidance'\n" + text
text = text.replace(
    "      displayMasters: DISPLAY_MASTER_VALIDATION,",
    "      displayMasters: DISPLAY_MASTER_VALIDATION,\n      uxGuidance: UX_GUIDANCE_VALIDATION,",
)
write(path, text)

write(
    "tasks/T050_UX_GUIDANCE_AND_CONFIRM.md",
    r'''# T050 — 初回導線・用語ヘルプ・確認統一

## 目的

初見プレイヤーが「何をすればよいか」「画面上の用語が何を意味するか」「押した操作が何を消費・破棄するか」を、外部文書なしで理解できる状態にする。

## 実装範囲

- 初回起動時に4段階のゲーム循環ガイドを表示し、完了状態をlocalStorageへ保存する。
- ホーム、地域、編成、研究、召喚、セーブ、戦闘の全主要画面から共通ヘルプ・用語集を開けるようにする。
- 上書き、ロード、削除、JSON読込、召喚、技習得、施設更新、確定研究、開花研究、戦闘リセット・途中離脱へ共通確認ダイアログを接続する。
- Escape、背景クリック、初期フォーカス、`role="dialog"` / `role="alertdialog"`を備える。

## 不変条件

- PlayerData、セーブschema、戦闘イベント、決定論ロジックを変更しない。
- `window.confirm()`へ依存しない。
- 初回ガイドのlocalStorageが壊れていてもゲーム起動を妨げない。

## 完了条件

- [x] 初回ガイドが初回のみ自動表示され、ヘルプから再表示できる。
- [x] 全7主要画面から画面別ヘルプと共通用語集を開ける。
- [x] 破壊的・高影響操作が共通確認ダイアログを経由する。
- [x] ガイド状態と用語マスターの単体テストがある。
- [x] `pnpm validate:content`、`pnpm test`、各ベンチマーク、`pnpm lint`、`pnpm build`が通る。

## 次のタスク

- T051（モンスター画像の全面活用）
''',
)

status_path = "tasks/STATUS.md"
status = read(status_path).replace("- [ ] T050 —", "- [x] T050 —")
status = status.replace(
    "T001～T047 complete. T048 external production verification remains. T049 complete; next T050.",
    "T001～T047 complete. T048 external production verification remains. T049～T050 complete; next T051.",
)
write(status_path, status)

# Guard against partial materialization.
for path, fragments in {
    "src/ui/HomeScreen.tsx": ["FirstRunGuide", 'context="HOME"'],
    "src/ui/SaveSlotScreen.tsx": ["PendingSaveAction", "ConfirmDialog", 'context="SAVE"'],
    "src/ui/CollectionScreen.tsx": ["pendingSkill", 'context="COLLECTION"'],
    "src/ui/ResearchScreen.tsx": ["upgradeConfirmOpen", "confirmOpen", 'context="RESEARCH"'],
    "src/ui/SummonScreen.tsx": ["confirmOpen", 'context="SUMMON"'],
    "src/ui/MinimalBattleScreen.tsx": ["pendingBattleAction", 'context="BATTLE"'],
    "src/ui/T040RegionScreen.tsx": ['context="REGION"'],
}.items():
    text = read(path)
    for fragment in fragments:
        if fragment not in text:
            raise SystemExit(f"T050 materialization missing {fragment!r} in {path}")

print("T050 UX guidance and confirmation materialized")
