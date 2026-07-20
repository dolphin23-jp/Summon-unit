import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BattleMobileTabs, BattleTabPanel } from './BattleMobileTabs'

describe('battle mobile tabs', () => {
  it('marks the selected tab and keeps inactive panels mounted but hidden', () => {
    const tabs = renderToStaticMarkup(
      <BattleMobileTabs activeTab="TIMELINE" onChange={() => undefined} />,
    )
    expect(tabs).toContain('battle-tab-timeline')
    expect(tabs).toContain('aria-selected="true"')
    expect(tabs).toContain('aria-controls="battle-panel-timeline"')

    const active = renderToStaticMarkup(
      <BattleTabPanel tab="TIMELINE" activeTab="TIMELINE">
        予定
      </BattleTabPanel>,
    )
    const inactive = renderToStaticMarkup(
      <BattleTabPanel tab="LOG" activeTab="TIMELINE">
        記録
      </BattleTabPanel>,
    )
    expect(active).toContain('is-active')
    expect(active).toContain('aria-hidden="false"')
    expect(inactive).toContain('aria-hidden="true"')
    expect(inactive).toContain('記録')
  })
})
