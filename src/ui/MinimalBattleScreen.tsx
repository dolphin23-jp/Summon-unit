import { useEffect, useMemo, useState } from 'react'
import type { BattleOutcome } from '../battle/defeat-and-victory'
import type { Side } from '../battle/board'
import {
  createInteractiveBattleRunner,
  type HeadlessBattleDefinition,
  type InteractiveBattleRunner,
  type InteractiveBattleSnapshot,
  type InteractiveManualActionOption,
} from '../battle/headless-battle-runner'
import { STANDARD_INTERACTIVE_BATTLE } from '../demo/standard-headless-battle'
import { BattleDecisionPanel } from './BattleDecisionPanel'
import {
  BattleResultScreen,
  type BattleResultNavigationAction,
} from './BattleResultScreen'
import { BattleTimelinePanel } from './BattleTimelinePanel'
import { BattleUnitCard } from './BattleUnitCard'
import {
  BATTLE_MOTION_STORAGE_KEY,
  BATTLE_MOTION_LEVELS,
  resolveInitialBattleMotionLevel,
  type BattleMotionLevel,
} from './battle-accessibility'
import { createBattleResultView } from './battle-result-view'
import { createBattleScreenView } from './battle-screen-view'
import { getManualActionKey, ManualActionPanel } from './ManualActionPanel'
import { MobileDisclosure } from './MobileDisclosure'

const STEP_MS = 420

type BattleSpeed = 1 | 2 | 4

const MOTION_LABELS: Readonly<Record<BattleMotionLevel, string>> = Object.freeze({
  STANDARD: '標準',
  REDUCED: '簡略',
  MINIMAL: '最小',
})

function createRunner(definition: HeadlessBattleDefinition): InteractiveBattleRunner {
  return createInteractiveBattleRunner(definition)
}

function getInitialMotionLevel(): BattleMotionLevel {
  if (typeof window === 'undefined') {
    return 'STANDARD'
  }
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(BATTLE_MOTION_STORAGE_KEY)
  } catch {
    stored = null
  }
  return resolveInitialBattleMotionLevel(
    stored,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
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

export interface MinimalBattleScreenProps {
  readonly definition?: HeadlessBattleDefinition
  readonly onOpenFormation?: () => void
}

export function MinimalBattleScreen({
  definition = STANDARD_INTERACTIVE_BATTLE,
  onOpenFormation,
}: MinimalBattleScreenProps) {
  const [runner, setRunner] = useState(() => createRunner(definition))
  const [snapshot, setSnapshot] = useState(() => runner.getSnapshot())
  const [autoRequested, setAutoRequested] = useState(false)
  const [speed, setSpeed] = useState<BattleSpeed>(1)
  const [detailedLog, setDetailedLog] = useState(false)
  const [selectedActionKey, setSelectedActionKey] = useState<string | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [motionLevel, setMotionLevel] = useState<BattleMotionLevel>(getInitialMotionLevel)
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null)

  useEffect(() => {
    setSnapshot(runner.getSnapshot())
    return runner.subscribe(setSnapshot)
  }, [runner])

  const isTerminal =
    snapshot.status === 'BATTLE_ENDED' || snapshot.status === 'ACTION_LIMIT_REACHED'
  const isPlaying = autoRequested && snapshot.status === 'READY'

  useEffect(() => {
    if (isTerminal) {
      setAutoRequested(false)
    }
  }, [isTerminal])

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
    setSelectedActionKey(initial === null ? null : getManualActionKey(initial))
    setSelectedCandidateId(initial?.candidateId ?? null)
  }, [pending])

  const previewOption = useMemo(
    () => pending?.options.find((option) => option.candidateId === selectedCandidateId) ?? null,
    [pending, selectedCandidateId],
  )
  const view = useMemo(
    () => createBattleScreenView(definition, snapshot, previewOption),
    [definition, previewOption, snapshot],
  )
  const resultView = useMemo(
    () => (isTerminal ? createBattleResultView(definition, runner.getResult()) : null),
    [definition, isTerminal, runner, snapshot.totalActions],
  )

  const reset = () => {
    setAutoRequested(false)
    setDetailedLog(false)
    setSelectedActionKey(null)
    setSelectedCandidateId(null)
    setNavigationNotice(null)
    setRunner(createRunner(definition))
  }

  const selectAction = (option: InteractiveManualActionOption) => {
    const key = getManualActionKey(option)
    setSelectedActionKey(key)
    const candidates =
      pending?.options.filter((candidate) => getManualActionKey(candidate) === key) ?? []
    const selected =
      candidates.find((candidate) => candidate.recommended) ?? candidates[0] ?? option
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

  const changeMotionLevel = (level: BattleMotionLevel) => {
    setMotionLevel(level)
    try {
      window.localStorage.setItem(BATTLE_MOTION_STORAGE_KEY, level)
    } catch {
      // The preference still applies for this session when storage is unavailable.
    }
  }

  const handleResultNavigation = (action: BattleResultNavigationAction) => {
    if (action === 'RETRY') {
      reset()
      return
    }
    if (action === 'FORMATION' && onOpenFormation !== undefined) {
      onOpenFormation()
      return
    }
    const message: Readonly<Record<Exclude<BattleResultNavigationAction, 'RETRY'>, string>> = {
      FORMATION: '編成画面への導線が設定されていません。',
      RESEARCH: '研究画面はT034以降で接続します。報酬・解析度はまだ保存されません。',
      NEXT_STAGE: '次ステージ導線はT038で接続します。現在は結果確認のみです。',
    }
    setNavigationNotice(message[action])
  }

  return (
    <main className="battle-app" data-motion={motionLevel.toLowerCase()}>
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
        <div className="motion-control" role="group" aria-label="演出レベル">
          <span>演出</span>
          {BATTLE_MOTION_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              className="control-button control-button--motion"
              aria-pressed={motionLevel === level}
              onClick={() => changeMotionLevel(level)}
            >
              {MOTION_LABELS[level]}
            </button>
          ))}
        </div>
        <button type="button" className="control-button" onClick={reset}>
          リセット
        </button>
        {onOpenFormation !== undefined && (
          <button type="button" className="control-button" onClick={onOpenFormation}>
            編成へ戻る
          </button>
        )}
      </nav>

      {resultView !== null && (
        <BattleResultScreen
          view={resultView}
          navigationNotice={navigationNotice}
          onNavigate={handleResultNavigation}
        />
      )}

      {pending !== null && (
        <ManualActionPanel
          pending={pending}
          selectedActionKey={selectedActionKey}
          selectedCandidateId={selectedCandidateId}
          onSelectAction={selectAction}
          onSelectCandidate={setSelectedCandidateId}
          onConfirm={confirmManualAction}
        />
      )}

      <div className={`battle-workspace${isTerminal ? ' battle-workspace--result-detail' : ''}`}>
        <section className="board-panel" aria-labelledby="board-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__kicker">BATTLEFIELD</p>
              <h2 id="board-title">6×3 盤面</h2>
            </div>
            <div className="side-legend" aria-label="陣営と警告の凡例">
              <span><b aria-hidden="true">A</b> 味方</span>
              <span><b aria-hidden="true">E</b> 相手</span>
              <span><i aria-hidden="true">!</i> 予兆</span>
            </div>
          </div>

          <div className="battle-board">
            {view.cells.map((cell) => {
              const side = cell.position.side
              const frontDivider = side === 'ALLY' && cell.position.row === 0
              const coordinate = `${sideLabel(side)} ${rowLabel(cell.position.row)} ${columnLabel(cell.position.column)}`
              const isAffected =
                previewOption?.preview.affectedPositionIds.includes(cell.positionId) ?? false
              const isSelected = previewOption?.targetPositionId === cell.positionId
              return (
                <div
                  key={cell.positionId}
                  className={`board-cell board-cell--${side.toLowerCase()}${frontDivider ? ' board-cell--front-divider' : ''}${cell.telegraphCount > 0 ? ' board-cell--telegraph' : ''}${isAffected ? ' board-cell--preview-affected' : ''}${isSelected ? ' board-cell--preview-selected' : ''}`}
                  aria-label={`${coordinate}${cell.telegraphCount > 0 ? `、予兆${cell.telegraphCount}件` : ''}${isAffected ? '、確定前プレビュー影響範囲' : ''}${isSelected ? '、選択対象' : ''}`}
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

        <MobileDisclosure
          title="タイムライン"
          kicker="UPCOMING EVENTS"
          defaultOpen={!isTerminal}
          className="battle-disclosure battle-disclosure--timeline"
        >
          <BattleTimelinePanel entries={view.timeline} />
        </MobileDisclosure>

        <MobileDisclosure
          title="ログ・行動理由"
          kicker="EVENTS & AI REASONS"
          defaultOpen={!isTerminal}
          className="battle-disclosure battle-disclosure--decision"
        >
          <BattleDecisionPanel
            events={snapshot.log.events}
            decisionLog={view.lastDecisionLog}
            detailed={detailedLog}
            onDetailedChange={setDetailedLog}
            statusText={statusLabel(snapshot, autoRequested, speed)}
          />
        </MobileDisclosure>
      </div>
    </main>
  )
}
