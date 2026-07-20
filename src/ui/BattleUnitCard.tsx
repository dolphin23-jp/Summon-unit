import { formatUnitDisplayName } from '../content/display-masters'
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
