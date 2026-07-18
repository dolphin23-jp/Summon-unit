import { useEffect, useMemo, useState } from 'react'
import type { BattleOutcome } from '../battle/defeat-and-victory'
import type { Side } from '../battle/board'
import {
  STANDARD_HEADLESS_BATTLE,
  runStandardHeadlessBattle,
} from '../demo/standard-headless-battle'
import { BattleUnitCard } from './BattleUnitCard'
import {
  createBattleReplay,
  formatBattleEventForDisplay,
  getBattleReplayBoardCells,
} from './battle-replay'

const STEP_MS = 420
const LOG_LIMIT = 8

type ReplaySpeed = 1 | 2

function outcomeLabel(outcome: BattleOutcome): string {
  if (outcome === 'ALLY_VICTORY') {
    return '味方勝利'
  }
  if (outcome === 'ALLY_DEFEAT') {
    return '味方敗北'
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

export function MinimalBattleScreen() {
  const result = useMemo(() => runStandardHeadlessBattle(), [])
  const replay = useMemo(
    () => createBattleReplay(STANDARD_HEADLESS_BATTLE, result),
    [result],
  )
  const lastFrameIndex = replay.frames.length - 1
  const [frameIndex, setFrameIndex] = useState(0)
  const [autoRequested, setAutoRequested] = useState(false)
  const [speed, setSpeed] = useState<ReplaySpeed>(1)
  const currentFrame = replay.frames[frameIndex] ?? replay.frames[0]
  const isComplete = frameIndex >= lastFrameIndex
  const isPlaying = autoRequested && !isComplete

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setFrameIndex((current) => Math.min(current + 1, lastFrameIndex))
    }, STEP_MS / speed)

    return () => window.clearTimeout(timer)
  }, [frameIndex, isPlaying, lastFrameIndex, speed])

  const boardCells = useMemo(
    () => getBattleReplayBoardCells(currentFrame),
    [currentFrame],
  )
  const recentEvents = replay.events
    .slice(0, currentFrame.eventIndex)
    .slice(-LOG_LIMIT)
    .reverse()

  const reset = () => {
    setAutoRequested(false)
    setFrameIndex(0)
  }

  return (
    <main className="battle-app">
      <header className="battle-header">
        <div>
          <p className="eyebrow">DETERMINISTIC AUTO DEMO</p>
          <h1>Monster Research Tactics</h1>
          <p className="battle-header__description">
            ヘッドレス実行の確定ログを、同じ順序のまま盤面へ再生します。
          </p>
        </div>
        <div className="battle-metrics" aria-label="現在の状態">
          <div><span>仮想時刻</span><strong>{currentFrame.virtualTime}</strong></div>
          <div><span>イベント</span><strong>{currentFrame.eventIndex} / {replay.events.length}</strong></div>
          <div><span>結果</span><strong>{outcomeLabel(currentFrame.outcome)}</strong></div>
        </div>
      </header>

      <nav className="battle-controls" aria-label="再生操作">
        <button
          type="button"
          className="control-button control-button--primary"
          onClick={() => setAutoRequested((current) => !current)}
          disabled={isComplete}
          aria-pressed={isPlaying}
        >
          {isComplete ? '再生完了' : isPlaying ? '一時停止' : 'AUTO開始'}
        </button>

        <div className="speed-control" aria-label="再生速度">
          <span>速度</span>
          {([1, 2] as const).map((candidate) => (
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
              <p className="panel-heading__kicker">RECENT EVENTS</p>
              <h2 id="log-title">直近ログ</h2>
            </div>
            <span className={`play-state${isPlaying ? ' play-state--active' : ''}`}>
              {isPlaying ? `AUTO ×${speed}` : isComplete ? '完了' : '停止中'}
            </span>
          </div>

          {recentEvents.length === 0 ? (
            <p className="log-empty">AUTO開始を押すと確定済みログを再生します。</p>
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

          <div className={`outcome-card outcome-card--${currentFrame.outcome.toLowerCase()}`}>
            <span>現在の判定</span>
            <strong>{outcomeLabel(currentFrame.outcome)}</strong>
            {isComplete && (
              <small>{result.summary.totalActions}行動・{result.summary.eventCount}イベント</small>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
