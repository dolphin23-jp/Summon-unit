import { resolveStageName } from '../content/display-masters'
import { useState } from 'react'
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
  | { readonly kind: 'OVERWRITE'; readonly slotId: SaveSlotId }
  | { readonly kind: 'LOAD'; readonly slotId: SaveSlotId }
  | { readonly kind: 'DELETE'; readonly slotId: SaveSlotId }
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
        details: [
          `対象: スロット ${slotNumber(activeSlotId)}`,
          '現在世代はバックアップ対象になります',
        ],
      }
    }
    const number = slotNumber(pendingAction.slotId)
    if (pendingAction.kind === 'OVERWRITE') {
      return {
        title: `スロット ${number}を上書きしますか？`,
        description: '保存済みの現在世代を、今の進行で置き換えます。',
        confirmLabel: '上書き保存',
        tone: 'danger' as const,
        details: [
          `既存保存: ${formatSavedAt(pendingSlot?.savedAtEpochMs ?? null)}`,
          '既存世代はバックアップへ移動します',
        ],
      }
    }
    if (pendingAction.kind === 'LOAD') {
      return {
        title: `スロット ${number}をロードしますか？`,
        description: '画面上の現在進行と中断戦闘を、選択した保存データへ切り替えます。',
        confirmLabel: 'ロードする',
        tone: 'default' as const,
        details: [
          `保存日時: ${formatSavedAt(pendingSlot?.savedAtEpochMs ?? null)}`,
          `クリア: ${pendingSlot?.completedStageCount ?? 0}ステージ`,
        ],
      }
    }
    return {
      title: `スロット ${number}を削除しますか？`,
      description: '現在世代と保持中のバックアップをすべて削除します。この操作は取り消せません。',
      confirmLabel: '完全に削除',
      tone: 'danger' as const,
      details: [
        `バックアップ: ${pendingSlot?.backupCount ?? 0}世代`,
        'JSONエクスポート済みデータは削除されません',
      ],
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
          <p>
            使用中スロットの進行とstable戦闘スナップショットを、整合性チェック付きJSONで移動できます。
          </p>
        </div>
        <div className="save-transfer__actions">
          <button
            type="button"
            className="collection-button"
            disabled={busy}
            onClick={onExportJson}
          >
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
                if (file !== undefined)
                  void file.text().then((json) => setPendingAction({ kind: 'IMPORT', json }))
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
                <span className="save-slot-card__state">
                  {active ? '使用中' : empty ? '空き' : '保存済み'}
                </span>
              </header>

              {empty || summary === undefined ? (
                <div className="save-slot-card__empty">
                  <strong>保存データなし</strong>
                  <p>現在の進行を保存すると、このスロットが使用中になります。</p>
                </div>
              ) : (
                <>
                  <dl className="save-slot-metadata">
                    <div>
                      <dt>保存日時</dt>
                      <dd>{formatSavedAt(summary.savedAtEpochMs)}</dd>
                    </div>
                    <div>
                      <dt>基本通貨</dt>
                      <dd>{summary.currency}</dd>
                    </div>
                    <div>
                      <dt>研究データ</dt>
                      <dd>{summary.researchData}</dd>
                    </div>
                    <div>
                      <dt>所持個体</dt>
                      <dd>{summary.ownedUnitCount}</dd>
                    </div>
                    <div>
                      <dt>クリア</dt>
                      <dd>{summary.completedStageCount}ステージ</dd>
                    </div>
                    <div>
                      <dt>バックアップ</dt>
                      <dd>{summary.backupCount}世代</dd>
                    </div>
                    <div>
                      <dt>schema</dt>
                      <dd>{summary.schemaVersion}</dd>
                    </div>
                    <div>
                      <dt>content</dt>
                      <dd>{summary.contentVersion}</dd>
                    </div>
                    <div>
                      <dt>中断戦闘</dt>
                      <dd>
                        {summary.resumableBattleStageId === null
                          ? 'なし'
                          : resolveStageName(summary.resumableBattleStageId)}
                      </dd>
                    </div>
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
