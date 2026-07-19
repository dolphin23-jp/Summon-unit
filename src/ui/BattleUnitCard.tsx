import type { BattleScreenUnitView } from './battle-screen-view'

function shortName(id: string): string {
  const name = id.split('.').at(-1) ?? id
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function BattleUnitCard({
  unit,
  previewDamage = 0,
  previewDefeated = false,
}: {
  readonly unit: BattleScreenUnitView
  readonly previewDamage?: number
  readonly previewDefeated?: boolean
}) {
  const hpPercent = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))
  const previewHp = Math.max(0, unit.hp - previewDamage)
  const previewHpPercent = Math.max(0, Math.min(100, (previewHp / unit.maxHp) * 100))
  const sideLabel = unit.side === 'ALLY' ? '味方' : '相手'

  return (
    <article
      className={`unit-card unit-card--${unit.side.toLowerCase()}${unit.telegraphCount > 0 ? ' unit-card--telegraphed' : ''}${previewDamage > 0 ? ' unit-card--preview-damage' : ''}${previewDefeated ? ' unit-card--preview-defeat' : ''}`}
    >
      <div className="unit-card__header">
        <span className="unit-card__side" aria-label={sideLabel}>
          {unit.side === 'ALLY' ? 'A' : 'E'}
        </span>
        <strong>{shortName(unit.battleUnitId)}</strong>
        <span
          className={`attribute-badge attribute-badge--${unit.attributeId.split('.').at(-1) ?? 'neutral'}`}
          title={`${unit.attributeLabel}属性`}
        >
          {unit.attributeLabel}
        </span>
      </div>
      <span className="unit-card__species">{shortName(unit.speciesId)}</span>
      <div
        className="hp-meter"
        role="progressbar"
        aria-label={`${shortName(unit.battleUnitId)} HP`}
        aria-valuemin={0}
        aria-valuemax={unit.maxHp}
        aria-valuenow={unit.hp}
      >
        <span className="hp-meter__fill" style={{ width: `${hpPercent}%` }} />
        {previewDamage > 0 && (
          <span className="hp-meter__preview" style={{ width: `${previewHpPercent}%` }} />
        )}
      </div>
      <div className="unit-card__resources">
        <span className="unit-card__hp">HP {unit.hp} / {unit.maxHp}</span>
        {unit.barrierTotal > 0 && (
          <span className="unit-card__barrier">◇ {unit.barrierTotal}</span>
        )}
      </div>
      {previewDamage > 0 && (
        <span className="unit-card__preview-label">
          確定時 HP {previewHp}{previewDefeated ? '・戦闘不能' : ''}
        </span>
      )}
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
              {effect.label}{effect.stacks > 1 ? `×${effect.stacks}` : ''}
            </span>
          ))
        )}
        {unit.hiddenEffectCount > 0 && (
          <span className="status-chip status-chip--more">+{unit.hiddenEffectCount}</span>
        )}
      </div>
      <div className="unit-card__timing">
        <span>次</span>
        <strong>
          {unit.nextActionTime === null ? '—' : `+${unit.nextActionDelta}t`}
        </strong>
      </div>
    </article>
  )
}
