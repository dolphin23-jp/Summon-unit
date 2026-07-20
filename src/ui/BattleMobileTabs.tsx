import type { ReactNode } from 'react'

export type BattlePanelTab = 'OPERATIONS' | 'TIMELINE' | 'LOG'

const TAB_LABELS: Readonly<Record<BattlePanelTab, string>> = Object.freeze({
  OPERATIONS: '操作',
  TIMELINE: 'タイムライン',
  LOG: 'ログ・AI',
})

export function BattleMobileTabs({
  activeTab,
  onChange,
}: {
  readonly activeTab: BattlePanelTab
  readonly onChange: (tab: BattlePanelTab) => void
}) {
  return (
    <nav className="battle-mobile-tabs" role="tablist" aria-label="戦闘情報パネル">
      {(Object.keys(TAB_LABELS) as BattlePanelTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={`battle-tab-${tab.toLowerCase()}`}
          aria-controls={`battle-panel-${tab.toLowerCase()}`}
          aria-selected={activeTab === tab}
          className="battle-mobile-tab"
          onClick={() => onChange(tab)}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </nav>
  )
}

export function BattleTabPanel({
  tab,
  activeTab,
  className = '',
  children,
}: {
  readonly tab: BattlePanelTab
  readonly activeTab: BattlePanelTab
  readonly className?: string
  readonly children: ReactNode
}) {
  const active = tab === activeTab
  return (
    <section
      id={`battle-panel-${tab.toLowerCase()}`}
      role="tabpanel"
      aria-labelledby={`battle-tab-${tab.toLowerCase()}`}
      aria-hidden={!active}
      className={`battle-tab-panel battle-tab-panel--${tab.toLowerCase()}${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </section>
  )
}
