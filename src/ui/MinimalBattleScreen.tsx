import { useEffect, useMemo, useState } from 'react'
import type { BattleOutcome } from '../battle/defeat-and-victory'
import type { Side } from '../battle/board'
import {
  createInteractiveBattleRunner,
  type InteractiveBattleRunner,
  type InteractiveBattleSnapshot,
} from '../battle/headless-battle-runner'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import { BattleDecisionPanel } from './BattleDecisionPanel'
import { BattleTimelinePanel } from './BattleTimelinePanel'
import { BattleUnitCard } from './BattleUnitCard'
import { ManualActionPanel } from './ManualActionPanel'
import { createBattleScreenView } from './battle-screen-view'

const STEP_MS = 420

type BattleSpeed = 1 | 2 | 4

function createRunner(): InteractiveBattleRunner {
  return createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
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

export function MinimalBattleScreen() {
  const [runner, setRunner] = useState(createRunner)
  const [snapshot, setSnapshot] = useState(() => runner.getSnapshot())
  const [autoRequested, setAutoRequested] = useState(false)
  const [speed, setSpeed] = useState<BattleSpeed>(1)
  const [detailedLog, setDetailedLog] = useState(false)
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
    setSelectedCandidateId(pending?.recommendedCandidateId ?? null)
  }, [pending])

  const selectedOption = useMemo(
    () =>
      pending?.options.find((option) => option.candidateId === selectedCandidateId) ??
      null,
    [pending, selectedCandidateId],
  )
  const view = useMemo(
    () => createBattleScreenView(STANDARD_HEADLESS_BATTLE, snapshot, selectedOption),
    [selectedOption, snapshot],
  )

  const reset = () => {
    setAutoRequested(false)
    setDetailedLog(false)
    setSelectedCandidateId(null)
    setRunner(createRunner())
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

  const getCellCandidateId = (positionId: string): string | null => {
    if (pending === null || selectedOption === null) {
      return null
    }
    return (
      pending.options.find(
        (option) =>
          option.actionKey === selectedOption.actionKey &&
          option.selectedTargetPositionId === positionId,
      )?.candidateId ?? null
    )
  }

  return (
    <main className="battle-app">
      <header className="battle-header">
        <div>
          <p className="eyebrow">CONFIRMED TACTICAL PREVIEW</p>
          <h1>Monster Research Tactics</h1>
          <p className="battle-header__description">
            行動と対象を選択し、カーネルと同じ解決結果を確認してから一手を確定します。
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
            ? '手動を取消してAI推奨で再開'
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
        <ManualActionPanel
          pending={pending}
          selectedCandidateId={selectedCandidateId}
          onSelectedCandidateChange={setSelectedCandidateId}
          onConfirm={(candidateId) => runner.submitManualAction(candidateId)}
        />
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
              <span><em>◎</em> 選択対象</span>
            </div>
          </div>

          <div className="battle-board">
            {view.cells.map((cell) => {
              const side = cell.position.side
              const frontDivider = side === 'ALLY' && cell.position.row === 0
              const coordinate = `${sideLabel(side)} ${rowLabel(cell.position.row)} ${columnLabel(cell.position.column)}`
              const candidateId = getCellCandidateId(cell.positionId)
              return (
                <button
                  key={cell.positionId}
                  type="button"
                  className={`board-cell board-cell--${side.toLowerCase()}${frontDivider ? ' board-cell--front-divider' : ''}${cell.telegraphCount > 0 ? ' board-cell--telegraph' : ''}${cell.previewRole !== null ? ` board-cell--preview-${cell.previewRole.toLowerCase()}` : ''}${candidateId !== null ? ' board-cell--selectable' : ''}`}
                  aria-label={`${coordinate}${cell.telegraphCount > 0 ? `、予兆${cell.telegraphCount}件` : ''}${candidateId !== null ? '、手動対象として選択可能' : ''}`}
                  disabled={candidateId === null}
                  onClick={() => candidateId !== null && setSelectedCandidateId(candidateId)}
                >
                  <span className="board-cell__coordinate">{coordinate}</span>
                  {cell.telegraphCount > 0 && (
                    <span className="telegraph-marker" aria-hidden="true">! {cell.telegraphCount}</span>
                  )}
                  {cell.previewRole !== null && (
                    <span className="preview-marker" aria-hidden="true">
                      {cell.previewRole === 'SELECTED' ? '◎' : cell.previewRole === 'FORCED_DESTINATION' ? '↪' : '◇'}
                    </span>
                  )}
                  {cell.unit === null ? (
                    <span className="board-cell__empty">空き</span>
                  ) : (
                    <BattleUnitCard
                      unit={cell.unit}
                      previewDamage={cell.previewDamage}
                      previewDefeated={cell.previewDefeated}
                    />
                  )}
                </button>
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
