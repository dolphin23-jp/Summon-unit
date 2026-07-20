import type { BattleTimelineEntryView } from './battle-screen-view'
import { MonsterIcon } from './MonsterIcon'

function kindLabel(entry: BattleTimelineEntryView): string {
  if (entry.provisional) return '仮'
  switch (entry.kind) {
    case 'UNIT_TURN':
      return '行動'
    case 'TELEGRAPH_RESOLVE':
      return '予兆'
    case 'SUMMON':
      return '召喚'
    case 'TERRAIN_TRIGGER':
      return '領域'
    case 'PHASE_CHANGE':
      return '段階'
  }
}

export function BattleTimelinePanel({
  entries,
  speciesIdByBattleUnitId,
  detailed,
  onDetailedChange,
}: {
  readonly entries: readonly BattleTimelineEntryView[]
  readonly speciesIdByBattleUnitId: Readonly<Record<string, string>>
  readonly detailed: boolean
  readonly onDetailedChange: (detailed: boolean) => void
}) {
  return (
    <aside className="timeline-panel" aria-labelledby="timeline-title">
      <div className="panel-heading">
        <div>
          <p className="panel-heading__kicker">UPCOMING EVENTS</p>
          <h2 id="timeline-title">タイムライン</h2>
        </div>
        <button
          type="button"
          className="detail-toggle"
          aria-pressed={detailed}
          onClick={() => onDetailedChange(!detailed)}
        >
          {detailed ? '相対表示' : '詳細時刻'}
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="panel-empty">予定されたイベントはありません。</p>
      ) : (
        <ol className="timeline-list">
          {entries.map((entry, index) => {
            const actorSpeciesId =
              entry.actorBattleUnitId === null
                ? null
                : (speciesIdByBattleUnitId[entry.actorBattleUnitId] ?? null)
            return (
              <li
                key={entry.id}
                className={`${entry.reservation ? 'timeline-entry timeline-entry--reservation' : 'timeline-entry'}${entry.provisional ? ' timeline-entry--provisional' : ''}`}
              >
                <span className="timeline-entry__rank">{index + 1}</span>
                {actorSpeciesId === null ? (
                  <span className="monster-mini-placeholder" aria-hidden="true">
                    •
                  </span>
                ) : (
                  <MonsterIcon speciesId={actorSpeciesId} size="sm" variant="frameless" />
                )}
                <div className="timeline-entry__body">
                  <div className="timeline-entry__headline">
                    <span className="timeline-entry__kind">{kindLabel(entry)}</span>
                    <strong>{entry.label}</strong>
                  </div>
                  {entry.detail !== null && <small>{entry.detail}</small>}
                </div>
                <div className="timeline-entry__time">
                  <strong>{entry.relativeLabel}</strong>
                  {detailed && (
                    <small>
                      +{entry.delta} / t={entry.time}
                    </small>
                  )}
                </div>
                {entry.provisional && entry.positionId !== null && (
                  <span className="timeline-entry__ghost-position" aria-label="仮位置">
                    {entry.positionId}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}
