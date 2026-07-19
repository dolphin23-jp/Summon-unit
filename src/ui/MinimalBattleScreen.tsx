import { useEffect, useMemo, useState } from 'react'
import type { BattleOutcome } from '../battle/defeat-and-victory'
import type { Side } from '../battle/board'
import {
  createInteractiveBattleRunner,
  type InteractiveBattleRunner,
  type InteractiveBattleSnapshot,
  type InteractiveManualActionOption,
} from '../battle/headless-battle-runner'
import type { ManualActionCategory } from '../battle/manual-action-preview'
import { STANDARD_INTERACTIVE_BATTLE } from '../demo/standard-headless-battle'
import { BattleDecisionPanel } from './BattleDecisionPanel'
import { BattleTimelinePanel } from './BattleTimelinePanel'
import { BattleUnitCard } from './BattleUnitCard'
import { createBattleScreenView } from './battle-screen-view'

const STEP_MS = 420

type BattleSpeed = 1 | 2 | 4

function createRunner(): InteractiveBattleRunner {
  return createInteractiveBattleRunner(STANDARD_INTERACTIVE_BATTLE)
}

function outcomeLabel(outcome: BattleOutcome): string {
  if (outcome === 'ALLY_VICTORY') {
    return '味方勝利'
  }
  if (outcome === 'ALLY_DEFEAT') {
    return '味方敗北'
  }
  if (outcome === 'DRAW') {
    return '引き分け'
  }
  return '進行中'
}

function sideLabel(side: Side): string {
  return side === 'ALLY' ? '味方' : '相手'
}

function rowLabel(row: number): string {
  if (row === 0) {
    return '前列'
  }
  if (row === 1) {
    return '中列'
  }
  return '後列'
}

function columnLabel(column: number): string {
  return ['A', 'B', 'C'][column] ?? String(column)
}

function shortId(id: string): string {
  return id.split('.').at(-1) ?? id
}

function statusLabel(
  snapshot: InteractiveBattleSnapshot,
  autoRequested: boolean,
  speed: BattleSpeed,
): string {
  if (snapshot.status === 'AWAITING_MANUAL_ACTION') {
    return '手動入力待ち'
  }
  if (snapshot.status === 'BATTLE_ENDED') {
    return '完了'
  }
  if (snapshot.status === 'ACTION_LIMIT_REACHED') {
    return '行動上限'
  }
  return autoRequested ? `AUTO ×${speed}` : '停止中'
}

function actionKey(option: InteractiveManualActionOption): string {
  return option.kind === 'USE_SKILL'
    ? `skill:${option.skillId ?? option.candidateId}`
    : option.kind
}

function categoryLabel(category: ManualActionCategory): string {
  switch (category) {
    case 'INNATE':
      return '固有技'
    case 'GENERIC':
      return '汎用技'
    case 'BLOOM':
      return '開花技'
    case 'MOVE':
      return '移動'
    case 'WAIT':
      return '待機'
  }
}

function damageRoleLabel(
  role: InteractiveManualActionOption['preview']['damageResults'][number]['role'],
): string {
  if (role === 'PRIMARY') {
    return '主対象'
  }
  if (role === 'GUARD') {
    return '肩代わり'
  }
  return '範囲'
}

function ManualActionPreviewPanel({
  option,
  onConfirm,
}: {
  readonly option: InteractiveManualActionOption
  readonly onConfirm: () => void
}) {
  const preview = option.preview
  const hasArea = preview.affectedPositionIds.length > 1

  return (
    <section className="manual-preview" aria-labelledby="manual-preview-title">
      <div className="manual-preview__heading">
        <div>
          <p className="panel-heading__kicker">CONFIRMATION PREVIEW</p>
          <h3 id="manual-preview-title">確定前プレビュー</h3>
        </div>
        <span className="manual-preview__selection">
          {option.label} → {option.targetLabel}
        </span>
      </div>

      <dl className="manual-preview__metrics">
        <div><dt>行動コスト</dt><dd>{preview.actionCost}</dd></div>
        <div><dt>次回時刻</dt><dd>t={preview.nextActionTime}</dd></div>
        <div><dt>次回順位</dt><dd>{preview.nextActionRank}番目</dd></div>
        <div><dt>移動後</dt><dd>{preview.toPositionId}</dd></div>
      </dl>

      <div className="manual-preview__facts">
        <p>
          <strong>対象:</strong>{' '}
          {preview.selectedTargetBattleUnitId ?? preview.selectedTargetPositionId ?? 'なし'}
          {preview.actualTargetBattleUnitId !== null &&
            preview.actualTargetBattleUnitId !== preview.selectedTargetBattleUnitId && (
              <> → 実対象 {preview.actualTargetBattleUnitId}</>
            )}
        </p>
        <p>
          <strong>遮蔽:</strong>{' '}
          {preview.blockedByBattleUnitId === null
            ? '停止なし'
            : `${preview.blockedByBattleUnitId} で停止`}
        </p>
        <p>
          <strong>{hasArea ? 'AoE範囲' : '影響マス'}:</strong>{' '}
          {preview.affectedPositionIds.length === 0
            ? 'なし'
            : preview.affectedPositionIds.join(' / ')}
        </p>
      </div>

      <div className="manual-preview__resolution-grid">
        <section>
          <h4>ダメージ・撃破</h4>
          {preview.damageResults.length === 0 ? (
            <p className="panel-empty">HP・障壁への変化はありません。</p>
          ) : (
            <div className="manual-damage-list">
              {preview.damageResults.map((result, index) => (
                <article
                  key={`${result.battleUnitId}:${result.role}:${index}`}
                  className={`manual-damage manual-damage--${result.role.toLowerCase()}`}
                >
                  <div className="manual-damage__title">
                    <strong>{shortId(result.battleUnitId)}</strong>
                    <span>{damageRoleLabel(result.role)}</span>
                  </div>
                  <dl>
                    <div><dt>計算値</dt><dd>{result.calculatedDamage}</dd></div>
                    <div><dt>障壁</dt><dd>{result.barrierBefore} → {result.barrierAfter}</dd></div>
                    <div><dt>HP</dt><dd>{result.hpBefore} → {result.hpAfter}</dd></div>
                    <div><dt>結果</dt><dd>{result.defeated ? '撃破' : `HP-${result.hpDamage}`}</dd></div>
                  </dl>
                  {result.guardedForBattleUnitId !== null && (
                    <small>{shortId(result.guardedForBattleUnitId)} の肩代わり</small>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h4>状態・強制移動</h4>
          <p className="manual-preview__secondary">
            状態: {preview.statusChanges.length === 0 ? '変化なし' : preview.statusChanges.join(' / ')}
          </p>
          <p className="manual-preview__secondary">
            強制移動:{' '}
            {preview.forcedMovements.length === 0
              ? 'なし'
              : preview.forcedMovements
                  .map((movement) =>
                    `${movement.targetBattleUnitId}: ${movement.fromPositionId} → ${movement.toPositionId ?? movement.failureReason ?? '失敗'}`,
                  )
                  .join(' / ')}
          </p>
        </section>
      </div>

      <div className="manual-preview__confirm-row">
        <p>この表示は戦闘カーネルと同じ障壁・肩代わり・行動順計算を使用します。</p>
        <button
          type="button"
          className="control-button control-button--confirm"
          onClick={onConfirm}
        >
          この行動を確定
        </button>
      </div>
    </section>
  )
}

export function MinimalBattleScreen() {
  const [runner, setRunner] = useState(createRunner)
  const [snapshot, setSnapshot] = useState(() => runner.getSnapshot())
  const [autoRequested, setAutoRequested] = useState(false)
  const [speed, setSpeed] = useState<BattleSpeed>(1)
  const [detailedLog, setDetailedLog] = useState(false)
  const [selectedActionKey, setSelectedActionKey] = useState<string | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  useEffect(() => {
    setSnapshot(runner.getSnapshot())
    return runner.subscribe(setSnapshot)
  }, [runner])

  const isTerminal =
    snapshot.status === 'BATTLE_ENDED' || snapshot.status === 'ACTION_LIMIT_REACHED'
  const isPlaying = autoRequested && snapshot.status === 'READY'

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }
    const timer = window.setTimeout(() => runner.step(), STEP_MS / speed)
    return () => window.clearTimeout(timer)
  }, [isPlaying, runner, snapshot.totalActions, speed])

  const pending = snapshot.pendingManualAction
  useEffect(() => {
    const initial =
      pending?.options.find((option) => option.recommended) ?? pending?.options[0] ?? null
    setSelectedActionKey(initial === null ? null : actionKey(initial))
    setSelectedCandidateId(initial?.candidateId ?? null)
  }, [pending])

  const actionChoices = useMemo(() => {
    if (pending === null) {
      return []
    }
    const seen = new Set<string>()
    return pending.options.filter((option) => {
      const key = actionKey(option)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }, [pending])

  const targetOptions = useMemo(
    () =>
      pending?.options.filter(
        (option) => selectedActionKey !== null && actionKey(option) === selectedActionKey,
      ) ?? [],
    [pending, selectedActionKey],
  )

  const previewOption = useMemo(
    () =>
      pending?.options.find((option) => option.candidateId === selectedCandidateId) ?? null,
    [pending, selectedCandidateId],
  )
  const view = useMemo(
    () => createBattleScreenView(STANDARD_INTERACTIVE_BATTLE, snapshot, previewOption),
    [previewOption, snapshot],
  )

  const reset = () => {
    setAutoRequested(false)
    setDetailedLog(false)
    setSelectedActionKey(null)
    setSelectedCandidateId(null)
    setRunner(createRunner())
  }

  const selectAction = (option: InteractiveManualActionOption) => {
    const key = actionKey(option)
    setSelectedActionKey(key)
    const candidates = pending?.options.filter((candidate) => actionKey(candidate) === key) ?? []
    const selected = candidates.find((candidate) => candidate.recommended) ?? candidates[0] ?? option
    setSelectedCandidateId(selected.candidateId)
  }

  const toggleManualInterrupt = () => {
    if (pending !== null) {
      runner.resumeRecommendedAction()
      return
    }
    if (snapshot.manualAllyActionRequested) {
      runner.cancelManualAllyActionRequest()
    } else {
      runner.requestManualAllyAction()
    }
  }

  const confirmManualAction = () => {
    if (selectedCandidateId !== null) {
      runner.submitManualAction(selectedCandidateId)
    }
  }

  return (
    <main className="battle-app">
      <header className="battle-header">
        <div>
          <p className="eyebrow">TACTICAL BATTLE VIEW</p>
          <h1>Monster Research Tactics</h1>
          <p className="battle-header__description">
            盤面状態、確定前プレビュー、予約イベント、AI判断理由を同じ戦闘状態から表示します。
          </p>
        </div>
        <div className="battle-metrics" aria-label="現在の状態">
          <div><span>仮想時刻</span><strong>{snapshot.currentVirtualTime}</strong></div>
          <div><span>行動</span><strong>{snapshot.totalActions}</strong></div>
          <div><span>結果</span><strong>{outcomeLabel(snapshot.battle.outcome)}</strong></div>
        </div>
      </header>

      <nav className="battle-controls" aria-label="戦闘操作">
        <button
          type="button"
          className="control-button control-button--primary"
          onClick={() => setAutoRequested((current) => !current)}
          disabled={isTerminal || pending !== null}
          aria-pressed={isPlaying}
        >
          {isTerminal ? '戦闘完了' : isPlaying ? '一時停止' : 'AUTO開始'}
        </button>
        <button
          type="button"
          className="control-button"
          onClick={() => runner.step()}
          disabled={snapshot.status !== 'READY'}
        >
          1行動進める
        </button>
        <button
          type="button"
          className="control-button"
          onClick={toggleManualInterrupt}
          disabled={isTerminal}
          aria-pressed={snapshot.manualAllyActionRequested || pending !== null}
        >
          {pending !== null
            ? 'AI推奨で再開'
            : snapshot.manualAllyActionRequested
              ? '手動割込を取消'
              : '次の味方を手動'}
        </button>
        <div className="speed-control" aria-label="AUTO速度">
          <span>速度</span>
          {([1, 2, 4] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="control-button control-button--speed"
              aria-pressed={speed === candidate}
              onClick={() => setSpeed(candidate)}
            >
              ×{candidate}
            </button>
          ))}
        </div>
        <button type="button" className="control-button" onClick={reset}>
          リセット
        </button>
      </nav>

      {pending !== null && (
        <section className="manual-panel" aria-labelledby="manual-action-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__kicker">MANUAL INTERRUPT</p>
              <h2 id="manual-action-title">{pending.actorBattleUnitId} の行動</h2>
            </div>
            <span className="manual-panel__hint">選択だけでは実行されません。最後に確定してください。</span>
          </div>

          <div className="manual-step">
            <h3><span>1</span> 行動を選択</h3>
            <div className="manual-options">
              {actionChoices.map((option) => (
                <button
                  key={actionKey(option)}
                  type="button"
                  className={`control-button${selectedActionKey === actionKey(option) ? ' control-button--previewing' : ''}`}
                  aria-pressed={selectedActionKey === actionKey(option)}
                  onClick={() => selectAction(option)}
                >
                  <small>{categoryLabel(option.category)}</small>
                  {option.skillId === null ? option.label : shortId(option.skillId)}
                </button>
              ))}
            </div>
          </div>

          <div className="manual-step">
            <h3><span>2</span> 対象・移動先を指定</h3>
            <div className="manual-options">
              {targetOptions.map((option) => (
                <button
                  key={option.candidateId}
                  type="button"
                  className={`control-button${selectedCandidateId === option.candidateId ? ' control-button--previewing' : ''}`}
                  aria-pressed={selectedCandidateId === option.candidateId}
                  onPointerEnter={() => setSelectedCandidateId(option.candidateId)}
                  onFocus={() => setSelectedCandidateId(option.candidateId)}
                  onClick={() => setSelectedCandidateId(option.candidateId)}
                >
                  {option.targetLabel}{option.recommended ? '（AI推奨）' : ''}
                </button>
              ))}
            </div>
          </div>

          {previewOption !== null && (
            <ManualActionPreviewPanel
              option={previewOption}
              onConfirm={confirmManualAction}
            />
          )}

          {pending.reasonLog !== null && (
            <p className="manual-panel__reason">AI参考: {pending.reasonLog.oneLine}</p>
          )}
        </section>
      )}

      <div className="battle-workspace">
        <section className="board-panel" aria-labelledby="board-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__kicker">BATTLEFIELD</p>
              <h2 id="board-title">6×3 盤面</h2>
            </div>
            <div className="side-legend" aria-label="陣営凡例">
              <span><b>A</b> 味方</span>
              <span><b>E</b> 相手</span>
              <span><i>!</i> 予兆</span>
            </div>
          </div>

          <div className="battle-board">
            {view.cells.map((cell) => {
              const side = cell.position.side
              const frontDivider = side === 'ALLY' && cell.position.row === 0
              const coordinate = `${sideLabel(side)} ${rowLabel(cell.position.row)} ${columnLabel(cell.position.column)}`
              const isAffected = previewOption?.preview.affectedPositionIds.includes(cell.positionId) ?? false
              const isSelected = previewOption?.targetPositionId === cell.positionId
              return (
                <div
                  key={cell.positionId}
                  className={`board-cell board-cell--${side.toLowerCase()}${frontDivider ? ' board-cell--front-divider' : ''}${cell.telegraphCount > 0 ? ' board-cell--telegraph' : ''}${isAffected ? ' board-cell--preview-affected' : ''}${isSelected ? ' board-cell--preview-selected' : ''}`}
                  aria-label={`${coordinate}${cell.telegraphCount > 0 ? `、予兆${cell.telegraphCount}件` : ''}${isAffected ? '、確定前プレビュー影響範囲' : ''}`}
                >
                  <span className="board-cell__coordinate">{coordinate}</span>
                  {cell.telegraphCount > 0 && (
                    <span className="telegraph-marker" aria-hidden="true">! {cell.telegraphCount}</span>
                  )}
                  {cell.unit === null ? (
                    <span className="board-cell__empty">空き</span>
                  ) : (
                    <BattleUnitCard unit={cell.unit} />
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <BattleTimelinePanel entries={view.timeline} />

        <BattleDecisionPanel
          events={snapshot.log.events}
          decisionLog={view.lastDecisionLog}
          detailed={detailedLog}
          onDetailedChange={setDetailedLog}
          statusText={statusLabel(snapshot, autoRequested, speed)}
        />
      </div>
    </main>
  )
}
