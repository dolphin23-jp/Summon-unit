import type { PlayerData } from '../progression/player-data'
import { FIRST_EXPEDITION_STEPS, shouldShowFirstExpeditionGuide } from './ux-guidance'

export interface HomeScreenProps {
  readonly playerData: PlayerData
  readonly notice: string | null
  readonly persistenceAvailable: boolean
  readonly onOpenRegion: () => void
  readonly onOpenCollection: () => void
  readonly onOpenResearch: () => void
  readonly onOpenSummon: () => void
  readonly onOpenSave: () => void
  readonly onOpenHelp: () => void
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
  onOpenHelp,
}: HomeScreenProps) {
  const completedStages = playerData.stageProgress?.completedStageIds.length ?? 0
  const unlockedBlueprints = playerData.collection.speciesStates.filter(
    (state) => state.blueprintUnlocked,
  ).length
  const showFirstGuide = shouldShowFirstExpeditionGuide(completedStages)
  const openDestination = (destination: (typeof FIRST_EXPEDITION_STEPS)[number]['destination']) => {
    if (destination === 'COLLECTION') onOpenCollection()
    if (destination === 'REGION') onOpenRegion()
    if (destination === 'RESEARCH') onOpenResearch()
  }

  return (
    <main className="collection-app">
      <header className="collection-header">
        <div>
          <p className="eyebrow">MONSTER RESEARCH TACTICS</p>
          <h1>観測拠点</h1>
          <p>編成、出撃、研究、召喚、セーブを一つの循環として進めます。</p>
        </div>
        <div className="home-header-actions">
          <button type="button" className="collection-button" onClick={onOpenHelp}>
            遊び方・用語
          </button>
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

      {showFirstGuide && (
        <section className="collection-panel first-expedition-guide" aria-labelledby="first-guide-title">
          <div className="collection-section-heading">
            <div>
              <p className="panel-heading__kicker">FIRST EXPEDITION</p>
              <h2 id="first-guide-title">最初の3手</h2>
            </div>
            <span>初回クリアまで表示</span>
          </div>
          <p>この順番で進めれば、戦闘・解析・研究の基本ループを一度体験できます。</p>
          <ol className="guidance-step-list">
            {FIRST_EXPEDITION_STEPS.map((step) => (
              <li key={step.order}>
                <span className="guidance-step-list__number">{step.order}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </div>
                <button
                  type="button"
                  className={`collection-button${step.order === 1 ? ' collection-button--primary' : ''}`}
                  onClick={() => openDestination(step.destination)}
                >
                  開く
                </button>
              </li>
            ))}
          </ol>
        </section>
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
          <div><span>基本通貨</span><strong>{playerData.economy.currency}</strong></div>
          <div><span>研究データ</span><strong>{playerData.economy.researchData}</strong></div>
          <div><span>所持個体</span><strong>{playerData.collection.unitInstances.length}</strong></div>
          <div><span>設計図</span><strong>{unlockedBlueprints}</strong></div>
          <div><span>クリア</span><strong>{completedStages}</strong></div>
        </div>
      </section>

      <section className="collection-panel" aria-labelledby="home-actions-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">OPERATIONS</p>
            <h2 id="home-actions-title">拠点メニュー</h2>
          </div>
        </div>
        <nav className="region-global-actions" aria-label="拠点メニュー">
          <button type="button" className="collection-button" onClick={onOpenCollection}>編成・図鑑</button>
          <button type="button" className="collection-button" onClick={onOpenResearch}>研究網・施設</button>
          <button type="button" className="collection-button" onClick={onOpenSummon}>召喚</button>
          <button type="button" className="collection-button" onClick={onOpenSave}>セーブスロット</button>
          <button type="button" className="collection-button" onClick={onOpenHelp}>遊び方・用語</button>
        </nav>
      </section>
    </main>
  )
}
