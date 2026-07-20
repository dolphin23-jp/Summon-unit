import { renderToStaticMarkup } from 'react-dom/server'
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
