import type { AiDecisionReasonLog } from '../ai/configured-decision'
import type { BattleEvent } from '../battle/event-log'
import { formatBattleEventForDisplay } from './battle-replay'
import { MonsterIcon } from './MonsterIcon'

const LOG_LIMIT = 12

function nonZeroComponents(log: AiDecisionReasonLog) {
  return log.components.filter((component) => component.value !== 0)
}

function getBattleEventActorId(event: BattleEvent): string | null {
  switch (event.kind) {
    case 'battle_started':
    case 'battle_ended':
      return null
    case 'turn_started':
    case 'unit_moved':
      return event.payload.battleUnitId
    case 'skill_used':
      return event.payload.actorBattleUnitId
    case 'guard_shared':
      return event.payload.sourceBattleUnitId
    case 'barrier_absorbed':
    case 'damage_applied':
    case 'effect_applied':
    case 'effect_merged':
    case 'effect_removed':
      return event.payload.sourceBattleUnitId
    case 'healing_applied':
      return event.payload.sourceBattleUnitId
    case 'unit_defeated':
      return event.payload.killerBattleUnitId ?? event.payload.defeatedBattleUnitId
  }
}

export function BattleDecisionPanel({
  events,
  decisionLog,
  detailed,
  onDetailedChange,
  statusText,
  speciesIdByBattleUnitId,
}: {
  readonly events: readonly BattleEvent[]
  readonly decisionLog: AiDecisionReasonLog | null
  readonly detailed: boolean
  readonly onDetailedChange: (detailed: boolean) => void
  readonly statusText: string
  readonly speciesIdByBattleUnitId: Readonly<Record<string, string>>
}) {
  const recentEvents = events.slice(-LOG_LIMIT).reverse()
  const components = decisionLog === null ? [] : nonZeroComponents(decisionLog)

  return (
    <section className="decision-panel" aria-labelledby="decision-title">
      <div className="panel-heading decision-panel__heading">
        <div>
          <p className="panel-heading__kicker">EVENTS & AI REASONS</p>
          <h2 id="decision-title">ログ・行動理由</h2>
        </div>
        <div className="decision-panel__controls">
          <span className="play-state">{statusText}</span>
          <button
            type="button"
            className="detail-toggle"
            aria-pressed={detailed}
            onClick={() => onDetailedChange(!detailed)}
          >
            {detailed ? '通常表示' : '詳細表示'}
          </button>
        </div>
      </div>

      <div className="decision-layout">
        <div className="decision-events">
          {recentEvents.length === 0 ? (
            <p className="panel-empty">AUTO開始または1行動進めるを押してください。</p>
          ) : (
            <ol className="event-log" aria-live="polite">
              {recentEvents.map((event) => {
                const actorBattleUnitId = getBattleEventActorId(event)
                const actorSpeciesId =
                  actorBattleUnitId === null
                    ? null
                    : (speciesIdByBattleUnitId[actorBattleUnitId] ?? null)
                return (
                  <li key={event.id}>
                    <span className="event-log__time">t={event.virtualTime}</span>
                    {actorSpeciesId === null ? (
                      <span className="monster-mini-placeholder" aria-hidden="true">
                        •
                      </span>
                    ) : (
                      <MonsterIcon speciesId={actorSpeciesId} size="sm" variant="frameless" />
                    )}
                    <span>{formatBattleEventForDisplay(event)}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="decision-reason" aria-live="polite">
          {decisionLog === null ? (
            <p className="panel-empty">まだAI判断はありません。</p>
          ) : (
            <>
              <p className="decision-reason__one-line">{decisionLog.oneLine}</p>
              <dl className="decision-summary">
                <div>
                  <dt>総合点</dt>
                  <dd>{decisionLog.totalScore}</dd>
                </div>
                <div>
                  <dt>2位差</dt>
                  <dd>{decisionLog.scoreMargin ?? '—'}</dd>
                </div>
                <div>
                  <dt>個体</dt>
                  <dd>{decisionLog.individualStrategy}</dd>
                </div>
                <div>
                  <dt>チーム</dt>
                  <dd>{decisionLog.teamStrategy}</dd>
                </div>
              </dl>
              {detailed && (
                <div className="decision-details">
                  <section>
                    <h3>スコア内訳</h3>
                    {components.length === 0 ? (
                      <p className="detail-empty">非0の項目はありません。</p>
                    ) : (
                      <ul className="score-list">
                        {components.map((component) => (
                          <li key={component.id}>
                            <span>{component.id}</span>
                            <strong>
                              {component.value > 0 ? '+' : ''}
                              {component.value}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section>
                    <h3>候補順位</h3>
                    <ol className="candidate-list">
                      {decisionLog.candidates.slice(0, 6).map((candidate) => (
                        <li key={candidate.candidateId}>
                          <span>
                            {candidate.rank}. {candidate.candidateId}
                          </span>
                          <strong>{candidate.totalScore}</strong>
                        </li>
                      ))}
                    </ol>
                    {decisionLog.excludedCandidates.length > 0 && (
                      <p className="excluded-note">
                        除外:{' '}
                        {decisionLog.excludedCandidates
                          .map((candidate) => `${candidate.candidateId}(${candidate.reason})`)
                          .join(' / ')}
                      </p>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
