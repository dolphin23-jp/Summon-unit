import { useState } from 'react'
import { formatUnitDisplayName, resolveSpeciesName } from '../content/display-masters'
import type { PlayerData } from '../progression/player-data'
import {
  completeFirstRunGuide,
  createBrowserUxGuidanceStorage,
  loadUxGuidanceState,
} from '../ux/ux-guidance'
import { FirstRunGuide } from './FirstRunGuide'
import { MonsterIcon } from './MonsterIcon'
import { UxHelpButton } from './UxHelpDialog'

export interface HomeScreenProps {
  readonly playerData: PlayerData
  readonly notice: string | null
  readonly persistenceAvailable: boolean
  readonly onOpenRegion: () => void
  readonly onOpenCollection: () => void
  readonly onOpenResearch: () => void
  readonly onOpenSummon: () => void
  readonly onOpenSave: () => void
}

function initialGuideOpen(): boolean {
  const storage = createBrowserUxGuidanceStorage()
  return storage === null || !loadUxGuidanceState(storage).firstRunCompleted
}

export function HomeScreen({
  playerData,
  notice,
  persistenceAvailable,
  onOpenRegion,
  onOpenCollection,
  onOpenResearch,
  onOpenSummon,
  onOpenSave,
}: HomeScreenProps) {
  const [guideOpen, setGuideOpen] = useState(initialGuideOpen)
  const completedStages = playerData.stageProgress?.completedStageIds.length ?? 0
  const unlockedBlueprints = playerData.collection.speciesStates.filter(
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

  const finishGuide = () => {
    const storage = createBrowserUxGuidanceStorage()
    if (storage !== null) completeFirstRunGuide(storage)
    setGuideOpen(false)
  }

  const finishAndOpen = (open: () => void) => {
    finishGuide()
    open()
  }

  return (
    <main className="collection-app">
      <header className="collection-header">
        <div>
          <p className="eyebrow">MONSTER RESEARCH TACTICS</p>
          <h1>観測拠点</h1>
          <p>編成、出撃、研究、召喚、セーブを一つの循環として進めます。</p>
        </div>
        <div className="ux-header-actions">
          <UxHelpButton context="HOME" onRestartGuide={() => setGuideOpen(true)} />
          <button
            type="button"
            className="collection-button collection-button--primary"
            onClick={onOpenRegion}
          >
            地域観測へ出る
          </button>
        </div>
      </header>

      {notice !== null && (
        <p className="collection-notice" role="status">
          {notice}
        </p>
      )}

      {!persistenceAvailable && (
        <p className="collection-notice" role="status">
          永続化を利用できません。このセッション中はプレイできますが、再読込後の進行は保証されません。
        </p>
      )}

      <section className="collection-panel" aria-labelledby="home-progress-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">CURRENT EXPEDITION</p>
            <h2 id="home-progress-title">現在の進行</h2>
          </div>
          <strong>{playerData.contentVersion}</strong>
        </div>
        <div className="region-resource-bar" aria-label="現在の資源と進行">
          <div>
            <span>基本通貨</span>
            <strong>{playerData.economy.currency}</strong>
          </div>
          <div>
            <span>研究データ</span>
            <strong>{playerData.economy.researchData}</strong>
          </div>
          <div>
            <span>所持個体</span>
            <strong>{playerData.collection.unitInstances.length}</strong>
          </div>
          <div>
            <span>設計図</span>
            <strong>{unlockedBlueprints}</strong>
          </div>
          <div>
            <span>クリア</span>
            <strong>{completedStages}</strong>
          </div>
        </div>
      </section>

      <section className="collection-panel" aria-labelledby="home-formation-title">
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
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">OPERATIONS</p>
            <h2 id="home-actions-title">拠点メニュー</h2>
          </div>
        </div>
        <nav className="region-global-actions" aria-label="拠点メニュー">
          <button type="button" className="collection-button" onClick={onOpenCollection}>
            編成・図鑑
          </button>
          <button type="button" className="collection-button" onClick={onOpenResearch}>
            研究網・施設
          </button>
          <button type="button" className="collection-button" onClick={onOpenSummon}>
            召喚
          </button>
          <button type="button" className="collection-button" onClick={onOpenSave}>
            セーブスロット
          </button>
        </nav>
      </section>

      <FirstRunGuide
        open={guideOpen}
        onDismiss={finishGuide}
        onOpenCollection={() => finishAndOpen(onOpenCollection)}
        onOpenRegion={() => finishAndOpen(onOpenRegion)}
        onOpenResearch={() => finishAndOpen(onOpenResearch)}
      />
    </main>
  )
}
