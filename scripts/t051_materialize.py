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
    content = read(path)
    if new in content:
        return
    if old not in content:
        raise RuntimeError(f"expected text was not found in {path}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


def append_once(path: str, marker: str, addition: str) -> None:
    content = read(path)
    if marker in content:
        return
    write(path, content.rstrip() + "\n\n" + addition.strip() + "\n")


write(
    "src/ui/monster-image-presentation.ts",
    """function shortId(id: string): string {
  return id.split('.').at(-1) ?? id
}

function displayName(id: string): string {
  return shortId(id)
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export interface MonsterImagePresentation {
  readonly imageSrc: string
  readonly showImage: boolean
  readonly placeholder: string
  readonly ariaLabel: string
}

export function getMonsterImagePresentation(
  speciesId: string,
  concealed: boolean,
  failedImageSrc: string | null,
  displayLabel?: string,
): MonsterImagePresentation {
  const imageSrc = `/monsters/${speciesId}.png`
  const resolvedDisplayLabel = displayLabel?.trim() || displayName(speciesId)
  return Object.freeze({
    imageSrc,
    showImage: !concealed && failedImageSrc !== imageSrc,
    placeholder: concealed ? '?' : shortId(speciesId).slice(0, 2).toUpperCase(),
    ariaLabel: concealed
      ? '未開示のモンスター画像領域'
      : `${resolvedDisplayLabel}の画像領域`,
  })
}
""",
)

write(
    "src/ui/MonsterIcon.tsx",
    """import { useState } from 'react'
import type { MonsterSpecies } from '../content/monster-species'
import { getMonsterImagePresentation } from './monster-image-presentation'

export type MonsterIconSize = 'sm' | 'md' | 'lg'
export type MonsterIconVariant = 'framed' | 'frameless'

export interface MonsterIconProps {
  readonly species?: MonsterSpecies
  readonly speciesId?: string
  readonly label?: string
  readonly concealed?: boolean
  readonly size?: MonsterIconSize
  readonly variant?: MonsterIconVariant
  readonly decorative?: boolean
}

export function MonsterIcon({
  species,
  speciesId,
  label,
  concealed = false,
  size = 'md',
  variant = 'framed',
  decorative = false,
}: MonsterIconProps) {
  const resolvedSpeciesId = species?.id ?? speciesId
  if (resolvedSpeciesId === undefined || resolvedSpeciesId.trim().length === 0) {
    throw new Error('MonsterIcon requires species or speciesId')
  }

  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null)
  const presentation = getMonsterImagePresentation(
    resolvedSpeciesId,
    concealed,
    failedImageSrc,
    label,
  )
  const className = [
    'collection-icon',
    `collection-icon--${size}`,
    `collection-icon--${variant}`,
    concealed ? 'collection-icon--concealed' : null,
  ]
    .filter((value): value is string => value !== null)
    .join(' ')

  return (
    <div
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : presentation.ariaLabel}
      aria-hidden={decorative ? true : undefined}
      data-monster-species-id={resolvedSpeciesId}
    >
      {presentation.showImage ? (
        <img
          className="collection-icon__image"
          src={presentation.imageSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={() => setFailedImageSrc(presentation.imageSrc)}
        />
      ) : (
        <>
          <span className="collection-icon__placeholder">{presentation.placeholder}</span>
          {variant === 'framed' && <small>IMAGE SLOT</small>}
        </>
      )}
    </div>
  )
}
""",
)

write(
    "src/ui/BattleUnitCard.tsx",
    """import { formatUnitDisplayName } from '../content/display-masters'
import type { BattleScreenUnitView } from './battle-screen-view'
import { MonsterIcon } from './MonsterIcon'

export function BattleUnitCard({ unit }: { readonly unit: BattleScreenUnitView }) {
  const hpPercent = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))
  const sideLabel = unit.side === 'ALLY' ? '味方' : '相手'
  const unitName = formatUnitDisplayName(unit.speciesId, unit.battleUnitId)
  const statusLabel =
    unit.effects.length === 0
      ? '状態異常なし'
      : unit.effects.map((effect) => effect.label).join('、')

  return (
    <article
      className={`unit-sprite unit-sprite--${unit.side.toLowerCase()}${unit.telegraphCount > 0 ? ' unit-sprite--telegraphed' : ''}${unit.defeated ? ' unit-sprite--defeated' : ''}`}
      role="img"
      aria-label={`${unitName}、${sideLabel}、${unit.attributeLabel}属性、HP ${unit.hp}/${unit.maxHp}、${statusLabel}`}
    >
      <div className="unit-sprite__status-row" aria-hidden="true">
        {unit.effects.map((effect) => (
          <span
            key={effect.activeEffectId}
            className="status-chip unit-sprite__status-chip"
            title={`${effect.label} / ${effect.durationLabel}`}
          >
            {effect.label}
            {effect.stacks > 1 ? `×${effect.stacks}` : ''}
          </span>
        ))}
        {unit.hiddenEffectCount > 0 && (
          <span className="status-chip status-chip--more">+{unit.hiddenEffectCount}</span>
        )}
      </div>

      <span
        className={`attribute-badge unit-sprite__attribute attribute-badge--${unit.attributeId.split('.').at(-1) ?? 'neutral'}`}
        title={`${unit.attributeLabel}属性`}
        aria-hidden="true"
      >
        {unit.attributeLabel}
      </span>

      <div className="unit-sprite__visual" aria-hidden="true">
        <span className="unit-sprite__shadow" />
        <MonsterIcon
          speciesId={unit.speciesId}
          label={unitName}
          size="lg"
          variant="frameless"
          decorative
        />
      </div>

      <div
        className="hp-meter unit-sprite__hp-meter"
        role="progressbar"
        aria-label={`${unitName} HP`}
        aria-valuemin={0}
        aria-valuemax={unit.maxHp}
        aria-valuenow={unit.hp}
      >
        <span className="hp-meter__fill" style={{ width: `${hpPercent}%` }} />
      </div>

      <div className="unit-sprite__caption" aria-hidden="true">
        <strong>{unitName}</strong>
        <span>
          HP {unit.hp}/{unit.maxHp}
          {unit.barrierTotal > 0 ? `　◇${unit.barrierTotal}` : ''}
          {unit.nextActionDelta === null ? '' : `　次+${unit.nextActionDelta}t`}
        </span>
      </div>
    </article>
  )
}
""",
)

write(
    "src/ui/BattleTimelinePanel.tsx",
    """import type { BattleTimelineEntryView } from './battle-screen-view'
import { MonsterIcon } from './MonsterIcon'

function kindLabel(entry: BattleTimelineEntryView): string {
  if (entry.provisional) {
    return '仮'
  }
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
}: {
  readonly entries: readonly BattleTimelineEntryView[]
  readonly speciesIdByBattleUnitId: Readonly<Record<string, string>>
}) {
  return (
    <aside className="timeline-panel" aria-labelledby="timeline-title">
      <div className="panel-heading">
        <div>
          <p className="panel-heading__kicker">UPCOMING EVENTS</p>
          <h2 id="timeline-title">タイムライン</h2>
        </div>
        <span className="timeline-count">未来 {entries.length}件</span>
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
                  <span className="monster-mini-placeholder" aria-hidden="true">•</span>
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
                  <strong>+{entry.delta}</strong>
                  <small>t={entry.time}</small>
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
""",
)

write(
    "src/ui/BattleDecisionPanel.tsx",
    """import type { AiDecisionReasonLog } from '../ai/configured-decision'
import type { BattleEvent } from '../battle/event-log'
import { formatBattleEventForDisplay } from './battle-replay'
import { MonsterIcon } from './MonsterIcon'

const LOG_LIMIT = 12

function nonZeroComponents(log: AiDecisionReasonLog) {
  return log.components.filter((component) => component.value !== 0)
}

export function getBattleEventActorId(event: BattleEvent): string | null {
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
                      <span className="monster-mini-placeholder" aria-hidden="true">•</span>
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
                <div><dt>総合点</dt><dd>{decisionLog.totalScore}</dd></div>
                <div><dt>2位差</dt><dd>{decisionLog.scoreMargin ?? '—'}</dd></div>
                <div><dt>個体</dt><dd>{decisionLog.individualStrategy}</dd></div>
                <div><dt>チーム</dt><dd>{decisionLog.teamStrategy}</dd></div>
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
                            <strong>{component.value > 0 ? '+' : ''}{component.value}</strong>
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
                          <span>{candidate.rank}. {candidate.candidateId}</span>
                          <strong>{candidate.totalScore}</strong>
                        </li>
                      ))}
                    </ol>
                    {decisionLog.excludedCandidates.length > 0 && (
                      <p className="excluded-note">
                        除外: {decisionLog.excludedCandidates.map((candidate) => `${candidate.candidateId}(${candidate.reason})`).join(' / ')}
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
""",
)

write(
    "src/ui/MonsterIcon.test.ts",
    """import { describe, expect, it } from 'vitest'
import { getMonsterImagePresentation } from './monster-image-presentation'

describe('monster image fallback', () => {
  it('falls back to the existing initials for demo and extension species without assets', () => {
    const cases = [
      {
        speciesId: 'species.demo-alpha',
        placeholder: 'DE',
        ariaLabel: 'Demo Alphaの画像領域',
      },
      {
        speciesId: 'species.extension.storm-hare',
        placeholder: 'ST',
        ariaLabel: 'Storm Hareの画像領域',
      },
    ] as const

    for (const testCase of cases) {
      const initial = getMonsterImagePresentation(testCase.speciesId, false, null)
      expect(initial).toMatchObject({
        imageSrc: `/monsters/${testCase.speciesId}.png`,
        showImage: true,
      })
      expect(
        getMonsterImagePresentation(testCase.speciesId, false, initial.imageSrc),
      ).toEqual({
        imageSrc: `/monsters/${testCase.speciesId}.png`,
        showImage: false,
        placeholder: testCase.placeholder,
        ariaLabel: testCase.ariaLabel,
      })
    }
  })

  it('does not request concealed art and uses the supplied display label', () => {
    expect(getMonsterImagePresentation('species.slice.cinder-fox', true, null, '燼狐')).toEqual({
      imageSrc: '/monsters/species.slice.cinder-fox.png',
      showImage: false,
      placeholder: '?',
      ariaLabel: '未開示のモンスター画像領域',
    })
    expect(getMonsterImagePresentation('species.slice.cinder-fox', false, null, '燼狐').ariaLabel).toBe(
      '燼狐の画像領域',
    )
  })
})
""",
)

write(
    "src/ui/MonsterIconMarkup.test.tsx",
    """import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { formatUnitDisplayName } from '../content/display-masters'
import type { BattleScreenUnitView } from './battle-screen-view'
import { BattleUnitCard } from './BattleUnitCard'
import { MonsterIcon } from './MonsterIcon'

describe('MonsterIcon presentation variants', () => {
  it('renders the requested size and frameless variant while preserving lazy loading', () => {
    const html = renderToStaticMarkup(
      <MonsterIcon
        speciesId="species.slice.cinder-fox"
        label="燼狐"
        size="sm"
        variant="frameless"
      />,
    )

    expect(html).toContain('collection-icon--sm')
    expect(html).toContain('collection-icon--frameless')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('aria-label="燼狐の画像領域"')
  })

  it('keeps the existing framed medium presentation as the default', () => {
    const html = renderToStaticMarkup(<MonsterIcon speciesId="species.demo-alpha" />)
    expect(html).toContain('collection-icon--md')
    expect(html).toContain('collection-icon--framed')
  })
})

describe('BattleUnitCard accessibility', () => {
  it('exposes the player-facing unit name and battle state in its accessible label', () => {
    const unit: BattleScreenUnitView = {
      battleUnitId: 'unit.test-001',
      speciesId: 'species.demo-alpha',
      side: 'ALLY',
      position: { side: 'ALLY', row: 0, column: 0 },
      positionId: 'ALLY:0:0',
      hp: 75,
      maxHp: 100,
      barrierTotal: 12,
      attributeId: 'attribute.fire',
      attributeLabel: '火',
      nextActionTime: 10,
      nextActionDelta: 4,
      effects: [],
      hiddenEffectCount: 0,
      telegraphCount: 0,
      defeated: false,
    }
    const unitName = formatUnitDisplayName(unit.speciesId, unit.battleUnitId)
    const html = renderToStaticMarkup(<BattleUnitCard unit={unit} />)

    expect(html).toContain('role="img"')
    expect(html).toContain(`aria-label="${unitName}、味方、火属性、HP 75/100、状態異常なし"`)
    expect(html).toContain('unit-sprite')
    expect(html).toContain('collection-icon--frameless')
  })
})
""",
)

write(
    "src/t051.css",
    """/* T051 monster art everywhere */
.collection-icon--sm {
  width: 2.25rem;
  min-width: 2.25rem;
  height: 2.25rem;
  font-size: 0.72rem;
}

.collection-icon--md {
  width: 3.8rem;
  min-width: 3.8rem;
  height: 3.8rem;
}

.collection-icon--lg {
  width: 6.4rem;
  min-width: 0;
  height: 6.4rem;
  font-size: 1rem;
}

.collection-icon--frameless {
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.collection-icon--frameless .collection-icon__image {
  object-fit: contain;
  filter: drop-shadow(0 0.35rem 0.28rem rgba(0, 0, 0, 0.34));
}

.collection-icon__placeholder {
  position: relative;
  z-index: 1;
}

.collection-icon--frameless .collection-icon__placeholder {
  display: grid;
  width: 82%;
  aspect-ratio: 1;
  place-items: center;
  border: 1px dashed rgba(159, 202, 224, 0.5);
  border-radius: 50%;
  color: #d7edf5;
  background: rgba(17, 45, 56, 0.68);
}

.monster-mini-placeholder {
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  color: #637b89;
  font-size: 0.8rem;
}

.board-cell {
  min-height: 8.4rem;
  align-items: stretch;
  padding: 1.25rem 0.25rem 0.25rem;
}

.board-cell--preview-selected,
.board-cell--preview-affected {
  outline: none;
}

.board-cell--preview-selected .unit-sprite {
  filter: drop-shadow(0 0 0.45rem rgba(116, 206, 241, 0.95));
}

.board-cell--preview-selected .unit-sprite::after {
  position: absolute;
  inset: 0.1rem;
  border: 3px solid rgba(116, 206, 241, 0.92);
  border-radius: 50%;
  content: '';
  pointer-events: none;
}

.board-cell--preview-affected:not(.board-cell--preview-selected) .unit-sprite::after {
  position: absolute;
  inset: 0.25rem;
  border: 2px dashed rgba(244, 193, 92, 0.92);
  border-radius: 50%;
  content: '';
  pointer-events: none;
}

.board-cell__state-marker {
  position: absolute;
  right: 0.35rem;
  bottom: 0.3rem;
  z-index: 5;
  display: grid;
  min-width: 1.35rem;
  min-height: 1.35rem;
  place-items: center;
  border-radius: 999px;
  color: #061922;
  background: #9edcf3;
  font-size: 0.72rem;
  font-weight: 900;
}

.board-cell__state-marker--affected {
  color: #281b00;
  background: #f3c66f;
}

.unit-sprite {
  position: relative;
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  align-items: end;
  padding: 0.15rem 0.2rem 0.18rem;
  isolation: isolate;
}

.unit-sprite--telegraphed {
  filter: drop-shadow(0 0 0.42rem rgba(255, 209, 122, 0.86));
}

.unit-sprite--defeated {
  opacity: 0.48;
  filter: grayscale(1);
}

.unit-sprite__visual {
  position: relative;
  min-height: 0;
  display: grid;
  place-items: end center;
}

.unit-sprite__visual .collection-icon--lg {
  width: min(6.2rem, 92%);
  height: min(6.2rem, 100%);
  z-index: 1;
}

.unit-sprite--enemy .collection-icon__image {
  transform: scaleX(-1);
}

.unit-sprite__shadow {
  position: absolute;
  bottom: 0.05rem;
  left: 18%;
  width: 64%;
  height: 0.72rem;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.42);
  filter: blur(0.18rem);
}

.unit-sprite__status-row {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 4;
  max-width: calc(100% - 1.8rem);
  display: flex;
  flex-wrap: wrap;
  gap: 0.12rem;
}

.unit-sprite__status-chip {
  max-width: 4rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unit-sprite__attribute {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 4;
}

.unit-sprite__hp-meter {
  position: relative;
  z-index: 3;
  height: 0.34rem;
  margin: -0.1rem 0.2rem 0;
  border: 1px solid rgba(5, 13, 18, 0.72);
  background: rgba(5, 13, 18, 0.78);
}

.unit-sprite__caption {
  position: relative;
  z-index: 3;
  min-width: 0;
  display: grid;
  gap: 0.04rem;
  margin-top: 0.1rem;
  padding: 0.12rem 0.22rem;
  border-radius: 0.28rem;
  text-align: center;
  background: rgba(3, 11, 17, 0.72);
}

.unit-sprite__caption strong {
  overflow: hidden;
  color: #edf5fa;
  font-size: 0.58rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unit-sprite__caption span {
  color: #a8bbc7;
  font-size: 0.48rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.timeline-entry {
  grid-template-columns: 1.4rem 2.25rem minmax(0, 1fr) 4.2rem;
}

.event-log li {
  grid-template-columns: 4.4rem 2.25rem minmax(0, 1fr);
  align-items: center;
}

.result-unit-identity {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  min-width: 12rem;
}

.result-unit-identity > span {
  min-width: 0;
  display: grid;
  gap: 0.12rem;
}

.result-unit-identity strong,
.result-unit-identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-formation-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-formation-list li {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: center;
  padding: 0.55rem;
  border: 1px solid rgba(158, 188, 208, 0.16);
  border-radius: 0.65rem;
  background: rgba(19, 38, 50, 0.7);
}

.home-formation-list li > span {
  min-width: 0;
  display: grid;
}

.home-formation-list strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-formation-list small,
.home-formation-position {
  color: #8fa7b5;
  font-size: 0.62rem;
}

.summon-species-option {
  grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  align-items: center;
}

.summon-species-option .research-node__stage {
  grid-column: 3;
  grid-row: 1 / span 2;
}

.summon-species-option .collection-icon {
  grid-row: 1 / span 2;
}

.research-specimen-option {
  display: grid !important;
  grid-template-columns: auto 2.25rem minmax(0, 1fr);
  gap: 0.5rem !important;
  align-items: center;
}

.member-editor__identity {
  display: flex;
  gap: 0.65rem;
  align-items: center;
}

.member-editor__identity > div {
  min-width: 0;
}

@media (max-width: 620px) {
  .board-cell {
    min-height: 6.9rem;
    padding: 1.05rem 0.12rem 0.12rem;
  }

  .unit-sprite__visual .collection-icon--lg {
    width: min(4.8rem, 94%);
    height: min(4.8rem, 100%);
  }

  .unit-sprite__status-chip {
    max-width: 2.8rem;
    padding: 0.08rem 0.18rem;
    font-size: 0.42rem;
  }

  .unit-sprite__caption strong {
    font-size: 0.5rem;
  }

  .unit-sprite__caption span {
    font-size: 0.42rem;
  }

  .timeline-entry {
    grid-template-columns: 1.2rem 2.25rem minmax(0, 1fr) 3.6rem;
  }

  .event-log li {
    grid-template-columns: 3.7rem 2.25rem minmax(0, 1fr);
  }
}
""",
)

write(
    "tasks/T051_MONSTER_ART_EVERYWHERE.md",
    """# Task 051: モンスター画像の全面活用（枠なし盤面スプライト・ミニアイコン統一）

## 目的

`public/monsters/`の16枚の画像を図鑑カード以外でも活用し、盤面・タイムライン・ログ・結果・召喚・標本選択・ホーム編成で個体を一目で識別できるようにする。戦闘盤面では四角いテキストカードを廃止し、透過画像スプライトとして表示する。

## 実装範囲

- `MonsterIcon` に `size`（`sm` / `md` / `lg`）と `variant`（`framed` / `frameless`）を追加する。
- 既存呼び出しは既定値 `md` / `framed` で後方互換を維持する。
- 戦闘盤面を枠なしスプライト、足元影、HPバー、状態バッジ、属性チップ、表示名へ置き換える。
- 敵画像を左右反転し、両陣営が向かい合う表示にする。
- 予兆、対象選択、影響範囲はマス背景・リング・記号で識別できるようにする。
- タイムライン、行動ログ、結果個体戦績、ホーム現在編成、召喚設計図、研究標本、編成メンバー設定へミニアイコンを追加する。
- 画像未配置種は頭文字、未開示種は `?` へフォールバックする。
- 画像は `loading="lazy"` と `decoding="async"` を維持する。

## 対象外

- 新規画像制作・画像差し替え
- アニメーション・攻撃エフェクト（T053）
- 画面全体のテーマ刷新（T052）

## 不変条件

- 戦闘カーネル、決定論、stable snapshot、セーブ形式を変更しない。
- `import.meta.glob` を使わない。
- タッチのみで操作でき、モバイル盤面の高さを悪化させない。
- 色だけに依存せず、選択・影響範囲・予兆を記号とaria-labelでも示す。

## 完了条件

- [x] 盤面が枠なしスプライト表示となり、HP・状態・属性・予兆・選択状態を判別できる。
- [x] 指定7箇所すべてにミニアイコンが表示される。
- [x] 画像未配置種・未開示種のフォールバックを維持する。
- [x] `MonsterIcon` のサイズ・variant・遅延読込をテストする。
- [x] 盤面ユニットのアクセシブルな表示名・状態をテストする。

## 検証

- `pnpm validate:content`
- `pnpm test`
- `pnpm demo:headless`
- `pnpm benchmark:ai`
- `pnpm benchmark:balance`
- `pnpm lint`
- `pnpm build`

## 次のタスク

- T052（ビジュアルテーマ・戦闘レイアウト）
""",
)

replace_once("src/main.tsx", "import './t040.css'\n", "import './t040.css'\nimport './t051.css'\n")

replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    """  const resultView = useMemo(
    () => (isTerminal ? createBattleResultView(definition, runner.getResult(), settlement) : null),
    [definition, isTerminal, runner, settlement, snapshot.totalActions],
  )
""",
    """  const resultView = useMemo(
    () => (isTerminal ? createBattleResultView(definition, runner.getResult(), settlement) : null),
    [definition, isTerminal, runner, settlement, snapshot.totalActions],
  )
  const speciesIdByBattleUnitId = useMemo(
    () =>
      Object.freeze(
        Object.fromEntries(
          snapshot.battle.units.map((unit) => [unit.battleUnitId, unit.speciesId]),
        ),
      ),
    [snapshot.battle.units],
  )
""",
)

replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    """                  {cell.unit === null ? (
                    <span className="board-cell__empty">空き</span>
                  ) : (
                    <BattleUnitCard unit={cell.unit} />
                  )}
""",
    """                  {isSelected && (
                    <span className="board-cell__state-marker" aria-hidden="true">
                      ◎
                    </span>
                  )}
                  {!isSelected && isAffected && (
                    <span
                      className="board-cell__state-marker board-cell__state-marker--affected"
                      aria-hidden="true"
                    >
                      ◇
                    </span>
                  )}
                  {cell.unit !== null && <BattleUnitCard unit={cell.unit} />}
""",
)

replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    "<BattleTimelinePanel entries={view.timeline} />",
    """<BattleTimelinePanel
            entries={view.timeline}
            speciesIdByBattleUnitId={speciesIdByBattleUnitId}
          />""",
)

replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    """            statusText={statusLabel(snapshot, autoRequested, speed)}
          />""",
    """            statusText={statusLabel(snapshot, autoRequested, speed)}
            speciesIdByBattleUnitId={speciesIdByBattleUnitId}
          />""",
)

replace_once(
    "src/ui/HomeScreen.tsx",
    "import { useState } from 'react'\n",
    """import { useState } from 'react'
import { formatUnitDisplayName, resolveSpeciesName } from '../content/display-masters'
""",
)
replace_once(
    "src/ui/HomeScreen.tsx",
    "import { FirstRunGuide } from './FirstRunGuide'\n",
    """import { FirstRunGuide } from './FirstRunGuide'
import { MonsterIcon } from './MonsterIcon'
""",
)
replace_once(
    "src/ui/HomeScreen.tsx",
    """  const unlockedBlueprints = playerData.collection.speciesStates.filter(
    (state) => state.blueprintUnlocked,
  ).length
""",
    """  const unlockedBlueprints = playerData.collection.speciesStates.filter(
    (state) => state.blueprintUnlocked,
  ).length
  const activeFormation =
    playerData.formations.formations.find(
      (formation) => formation.formationId === playerData.formations.activeFormationId,
    ) ??
    playerData.formations.formations[0] ??
    null
  const activeFormationMembers =
    activeFormation === null
      ? []
      : activeFormation.members
          .flatMap((member) => {
            const instance = playerData.collection.unitInstances.find(
              (candidate) => candidate.instanceId === member.instanceId,
            )
            return instance === undefined ? [] : [{ member, instance }]
          })
          .sort((left, right) => left.member.tiePriority - right.member.tiePriority)
""",
)
replace_once(
    "src/ui/HomeScreen.tsx",
    """      <section className="collection-panel" aria-labelledby="home-actions-title">
""",
    """      <section className="collection-panel" aria-labelledby="home-formation-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">ACTIVE FORMATION</p>
            <h2 id="home-formation-title">現在の編成</h2>
          </div>
          <strong>{activeFormationMembers.length}/9体</strong>
        </div>
        {activeFormationMembers.length === 0 ? (
          <p>編成中の個体はいません。編成・図鑑から個体を配置してください。</p>
        ) : (
          <ul className="home-formation-list">
            {activeFormationMembers.map(({ member, instance }) => (
              <li key={instance.instanceId}>
                <MonsterIcon
                  speciesId={instance.speciesId}
                  label={resolveSpeciesName(instance.speciesId)}
                  size="sm"
                  variant="frameless"
                />
                <span>
                  <strong>
                    {instance.nickname ??
                      formatUnitDisplayName(instance.speciesId, instance.instanceId)}
                  </strong>
                  <small>{resolveSpeciesName(instance.speciesId)}</small>
                </span>
                <span className="home-formation-position">
                  {['前', '中', '後'][member.position.row]}
                  {['A', 'B', 'C'][member.position.column]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="collection-panel" aria-labelledby="home-actions-title">
""",
)

replace_once(
    "src/ui/SummonScreen.tsx",
    "import { ConfirmDialog } from './ConfirmDialog'\n",
    """import { ConfirmDialog } from './ConfirmDialog'
import { MonsterIcon } from './MonsterIcon'
""",
)
replace_once(
    "src/ui/SummonScreen.tsx",
    "className=\"research-node research-node--completed\"",
    "className=\"research-node research-node--completed summon-species-option\"",
)
replace_once(
    "src/ui/SummonScreen.tsx",
    """                  <span className="research-node__stage">R{species.rarity}</span>
                  <strong>{resolveDisplayName(species.id)}</strong>
""",
    """                  <MonsterIcon
                    species={species}
                    label={resolveDisplayName(species.id)}
                    size="sm"
                    variant="frameless"
                  />
                  <span className="research-node__stage">R{species.rarity}</span>
                  <strong>{resolveDisplayName(species.id)}</strong>
""",
)

replace_once(
    "src/ui/ResearchScreen.tsx",
    "import { ConfirmDialog } from './ConfirmDialog'\n",
    """import { ConfirmDialog } from './ConfirmDialog'
import { MonsterIcon } from './MonsterIcon'
""",
)
replace_once(
    "src/ui/ResearchScreen.tsx",
    """            <label key={instance.instanceId}>
              <input
                type="checkbox"
                checked={specimenInstanceIds.includes(instance.instanceId)}
                onChange={() =>
                  setSpecimenInstanceIds(toggleId(specimenInstanceIds, instance.instanceId))
                }
              />
              {instance.nickname ?? formatUnitDisplayName(instance.speciesId, instance.instanceId)}
            </label>
""",
    """            <label key={instance.instanceId} className="research-specimen-option">
              <input
                type="checkbox"
                checked={specimenInstanceIds.includes(instance.instanceId)}
                onChange={() =>
                  setSpecimenInstanceIds(toggleId(specimenInstanceIds, instance.instanceId))
                }
              />
              <MonsterIcon
                speciesId={instance.speciesId}
                label={resolveDisplayName(instance.speciesId)}
                size="sm"
                variant="frameless"
              />
              <span>
                {instance.nickname ??
                  formatUnitDisplayName(instance.speciesId, instance.instanceId)}
              </span>
            </label>
""",
)

replace_once(
    "src/ui/CollectionScreen.tsx",
    """      <div className="collection-section-heading">
        <div>
          <p className="panel-heading__kicker">MEMBER SETTINGS</p>
          <h2 id="member-editor-title">
            {instance.nickname ?? formatUnitDisplayName(species.id, instance.instanceId)}
          </h2>
        </div>
        <span>状態 {basisPointsLabel(instance.conditionBasisPoints)}</span>
      </div>
""",
    """      <div className="collection-section-heading">
        <div className="member-editor__identity">
          <MonsterIcon
            species={species}
            label={resolveDisplayName(species.id)}
            size="sm"
            variant="frameless"
          />
          <div>
            <p className="panel-heading__kicker">MEMBER SETTINGS</p>
            <h2 id="member-editor-title">
              {instance.nickname ?? formatUnitDisplayName(species.id, instance.instanceId)}
            </h2>
          </div>
        </div>
        <span>状態 {basisPointsLabel(instance.conditionBasisPoints)}</span>
      </div>
""",
)

replace_once(
    "src/ui/BattleResultScreen.tsx",
    "import type { BattleResultView } from './battle-result-view'\n",
    """import type { BattleResultView } from './battle-result-view'
import { MonsterIcon } from './MonsterIcon'
""",
)
replace_once(
    "src/ui/BattleResultScreen.tsx",
    """                  <th scope="row">
                    <strong>{formatUnitDisplayName(unit.speciesId, unit.battleUnitId)}</strong>
                    <small>{resolveSpeciesName(unit.speciesId)}</small>
                  </th>
""",
    """                  <th scope="row">
                    <span className="result-unit-identity">
                      <MonsterIcon
                        speciesId={unit.speciesId}
                        label={resolveSpeciesName(unit.speciesId)}
                        size="sm"
                        variant="frameless"
                      />
                      <span>
                        <strong>
                          {formatUnitDisplayName(unit.speciesId, unit.battleUnitId)}
                        </strong>
                        <small>{resolveSpeciesName(unit.speciesId)}</small>
                      </span>
                    </span>
                  </th>
""",
)

replace_once(
    "tasks/STATUS.md",
    "- [ ] T051 — [モンスター画像の全面活用](T051_MONSTER_ART_EVERYWHERE.md)",
    "- [x] T051 — [モンスター画像の全面活用](T051_MONSTER_ART_EVERYWHERE.md)",
)
replace_once(
    "tasks/STATUS.md",
    "T001～T047 complete. T048 external production verification remains. T049～T050 complete; next T051.",
    "T001～T047 complete. T048 external production verification remains. T049～T051 complete; next T052.",
)

append_once(
    "docs/12_UI_UX.md",
    "## モンスター画像の共通表示（T051）",
    """## モンスター画像の共通表示（T051）

- モンスター画像は `MonsterIcon` を唯一の表示入口とし、`sm` / `md` / `lg` と `framed` / `frameless` を用途で使い分ける。
- 一覧・ログ・タイムラインには `sm`、既存カードには既定の `md`、戦闘盤面には `lg` + `frameless` を用いる。
- 未配置画像は種ID由来の頭文字、未開示種は `?` を表示する。画像パスの動的globは使わない。
- 戦闘盤面ではスプライトを直接置き、HP・状態・属性をオーバーレイする。選択、影響範囲、予兆は色に加えて `◎` / `◇` / `!` とaria-labelで区別する。
- 画像は遅延読込と非同期デコードを維持し、敵側のみ画像を左右反転する。
""",
)

print("T051 materialization complete")
