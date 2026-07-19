import { useEffect, useMemo, useState } from 'react'
import type { BattleOutcome } from '../battle/defeat-and-victory'
import type { Side } from '../battle/board'
import {
  createInteractiveBattleRunner,
  type InteractiveBattleRunner,
  type InteractiveBattleSnapshot,
} from '../battle/headless-battle-runner'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import { BattleUnitCard } from './BattleUnitCard'
import {
  applyBattleEventToReplayFrame,
  createInitialBattleReplayFrame,
  formatBattleEventForDisplay,
  getBattleReplayBoardCells,
} from './battle-replay'

const STEP_MS = 420
const LOG_LIMIT = 8

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

  const currentFrame = useMemo(() => {
    let frame = createInitialBattleReplayFrame(STANDARD_HEADLESS_BATTLE)
    for (const event of snapshot.log.events) {
      frame = applyBattleEventToReplayFrame(frame, event)
    }
    return frame
  }, [snapshot.log.events])

  const boardCells = useMemo(
    () => getBattleReplayBoardCells(currentFrame),
    [currentFrame],
  )
  const recentEvents = snapshot.log.events.slice(-LOG_LIMIT).reverse()
  const pending = snapshot.pendingManualAction

  const reset = () => {
    setAutoRequested(false)
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

  return (
    <main className="battle-app">
      <header className="battle-header">
        <div>
          <p className="eyebrow">INTERACTIVE DETERMINISTIC BATTLE</p>
          <h1>Monster Research Tactics</h1>
          <p className="battle-header__description">
            戦闘カーネルを1行動ずつ進め、AUTO観戦と次の味方行動への手動割込を切り替えます。
          </p>
        </div>
        <div className="battle-metrics" aria-label="現在の状態">
          <div><span>仮想時刻</span><strong>{snapshot.currentVirtualTime}</strong></div>
          <div><span>行動</span><strong>{snapshot.totalActions}</strong></div>
          <div><span>結果</span><strong>{outcomeLabel(currentFrame.outcome)}</strong></div>
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
            ? '推奨行動で再開'
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
        <section className="log-panel" aria-labelledby="manual-action-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__kicker">MANUAL INTERRUPT</p>
              <h2 id="manual-action-title">{pending.actorBattleUnitId} の行動</h2>
            </div>
          </div>
          <div className="battle-controls">
            {pending.options.map((option) => (
              <button
                key={option.candidateId}
                type="button"
                className={option.recommended
                  ? 'control-button control-button--primary'
                  : 'control-button'}
                onClick={() => runner.submitManualAction(option.candidateId)}
              >
                {option.label}{option.recommended ? '（推奨）' : ''}
              </button>
            ))}
          </div>
          {pending.reasonLog !== null && (
            <p className="log-empty">AI参考: {pending.reasonLog.oneLine}</p>
          )}
        </section>
      )}

      <div className="battle-layout">
        <section className="board-panel" aria-labelledby="board-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__kicker">BATTLEFIELD</p>
              <h2 id="board-title">6×3 盤面</h2>
            </div>
            <div className="side-legend" aria-label="陣営凡例">
              <span><b>A</b> 味方</span>
              <span><b>E</b> 相手</span>
            </div>
          </div>

          <div className="battle-board">
            {boardCells.map((cell) => {
              const side = cell.position.side
              const frontDivider = side === 'ALLY' && cell.position.row === 0
              const coordinate = `${sideLabel(side)} ${rowLabel(cell.position.row)} ${columnLabel(cell.position.column)}`

              return (
                <div
                  key={cell.positionId}
                  className={`board-cell board-cell--${side.toLowerCase()}${frontDivider ? ' board-cell--front-divider' : ''}`}
                  aria-label={coordinate}
                >
                  <span className="board-cell__coordinate">{coordinate}</span>
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

        <aside className="log-panel" aria-labelledby="log-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__kicker">LIVE EVENTS</p>
              <h2 id="log-title">直近ログ</h2>
            </div>
            <span className={`play-state${isPlaying ? ' play-state--active' : ''}`}>
              {statusLabel(snapshot, autoRequested, speed)}
            </span>
          </div>

          {recentEvents.length === 0 ? (
            <p className="log-empty">AUTO開始または1行動進めるを押してください。</p>
          ) : (
            <ol className="event-log" aria-live="polite">
              {recentEvents.map((event) => (
                <li key={event.id}>
                  <span className="event-log__time">t={event.virtualTime}</span>
                  <span>{formatBattleEventForDisplay(event)}</span>
                </li>
              ))}
            </ol>
          )}

          {snapshot.lastDecisionLog !== null && (
            <p className="log-empty">判断: {snapshot.lastDecisionLog.oneLine}</p>
          )}

          <div className={`outcome-card outcome-card--${currentFrame.outcome.toLowerCase()}`}>
            <span>現在の判定</span>
            <strong>{outcomeLabel(currentFrame.outcome)}</strong>
            <small>{snapshot.totalActions}行動・{snapshot.log.events.length}イベント</small>
          </div>
        </aside>
      </div>
    </main>
  )
}
