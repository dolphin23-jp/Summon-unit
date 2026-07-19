import type { BattleReplayUnit } from './battle-replay'

function shortName(id: string): string {
  const name = id.split('.').at(-1) ?? id
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function BattleUnitCard({ unit }: { readonly unit: BattleReplayUnit }) {
  const hpPercent = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))
  const sideLabel = unit.side === 'ALLY' ? '味方' : '相手'

  return (
    <article className={`unit-card unit-card--${unit.side.toLowerCase()}`}>
      <div className="unit-card__header">
        <span className="unit-card__side" aria-label={sideLabel}>
          {unit.side === 'ALLY' ? 'A' : 'E'}
        </span>
        <strong>{shortName(unit.battleUnitId)}</strong>
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
      </div>
      <span className="unit-card__hp">
        HP {unit.hp} / {unit.maxHp}
      </span>
      {unit.barrierTotal > 0 && (
        <span className="unit-card__barrier">障壁 {unit.barrierTotal}</span>
      )}
    </article>
  )
}
