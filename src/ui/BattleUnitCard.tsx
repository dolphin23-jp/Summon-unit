import { formatUnitDisplayName, resolveSpeciesName } from '../content/display-masters'
import type { BattleScreenUnitView } from './battle-screen-view'

export function BattleUnitCard({ unit }: { readonly unit: BattleScreenUnitView }) {
  const hpPercent = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))
  const sideLabel = unit.side === 'ALLY' ? '味方' : '相手'
  const unitName = formatUnitDisplayName(unit.speciesId, unit.battleUnitId)

  return (
    <article
      className={`unit-card unit-card--${unit.side.toLowerCase()}${unit.telegraphCount > 0 ? ' unit-card--telegraphed' : ''}`}
    >
      <div className="unit-card__header">
        <span className="unit-card__side" aria-label={sideLabel}>
          {unit.side === 'ALLY' ? 'A' : 'E'}
        </span>
        <strong>{unitName}</strong>
        <span
          className={`attribute-badge attribute-badge--${unit.attributeId.split('.').at(-1) ?? 'neutral'}`}
          title={`${unit.attributeLabel}属性`}
        >
          {unit.attributeLabel}
        </span>
      </div>
      <span className="unit-card__species">{resolveSpeciesName(unit.speciesId)}</span>
      <div
        className="hp-meter"
        role="progressbar"
        aria-label={`${unitName} HP`}
        aria-valuemin={0}
        aria-valuemax={unit.maxHp}
        aria-valuenow={unit.hp}
      >
        <span className="hp-meter__fill" style={{ width: `${hpPercent}%` }} />
      </div>
      <div className="unit-card__resources">
        <span className="unit-card__hp">
          HP {unit.hp} / {unit.maxHp}
        </span>
        {unit.barrierTotal > 0 && <span className="unit-card__barrier">◇ {unit.barrierTotal}</span>}
      </div>
      <div className="unit-card__status-row" aria-label="主要状態">
        {unit.effects.length === 0 ? (
          <span className="status-chip status-chip--empty">状態なし</span>
        ) : (
          unit.effects.map((effect) => (
            <span
              key={effect.activeEffectId}
              className="status-chip"
              title={`${effect.label} / ${effect.durationLabel}`}
            >
              {effect.label}
              {effect.stacks > 1 ? `×${effect.stacks}` : ''}
            </span>
          ))
        )}
        {unit.hiddenEffectCount > 0 && (
          <span className="status-chip status-chip--more">+{unit.hiddenEffectCount}</span>
        )}
      </div>
      <div className="unit-card__timing">
        <span>次</span>
        <strong>{unit.nextActionTime === null ? '—' : `+${unit.nextActionDelta}t`}</strong>
      </div>
    </article>
  )
}
