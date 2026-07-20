const GLOSSARY = Object.freeze([
  ['行動コスト', '技や移動の重さです。小さいほど次の行動が早く回ってきます。'],
  ['タイムライン', '各個体が次に行動する順番と仮想時刻を並べたものです。'],
  ['遮蔽', '前列の個体が後列への直線攻撃を受け止める仕組みです。'],
  ['直線・曲射', '直線は遮蔽の影響を受け、曲射は前列を越えて後列を狙えます。'],
  ['障壁', 'HPより先にダメージを吸収する一時的な耐久値です。'],
  ['肩代わり', '守護役が周囲の味方への攻撃を代わりに受ける効果です。'],
  ['予兆', '一定時間後に発動する攻撃の危険範囲です。発動前に移動できます。'],
  ['解析度', '敵種を観測した蓄積です。増えるほど図鑑と研究情報が開示されます。'],
  ['研究データ', '試験研究、確定研究、施設強化に使う共通資源です。'],
  ['設計図', 'その種を召喚できる恒久的な解放状態です。'],
  ['開花技', '研究完了後に個体へ追加装備できる種固有の発展技です。'],
  ['地域ポイント', '地域内の勝利で得る進行値です。一定値で追加報酬を受け取れます。'],
  ['即時シミュレーション', 'クリア済みステージを現在の編成で自動解決し、正式に報酬を精算します。'],
] as const)

export interface HelpScreenProps {
  readonly onBack: () => void
  readonly onOpenCollection: () => void
  readonly onOpenRegion: () => void
  readonly onOpenResearch: () => void
}

export function HelpScreen({ onBack, onOpenCollection, onOpenRegion, onOpenResearch }: HelpScreenProps) {
  return (
    <main className="collection-app help-app">
      <header className="collection-header">
        <div>
          <p className="eyebrow">FIELD MANUAL</p>
          <h1>遊び方・用語ヘルプ</h1>
          <p>迷ったときは、編成を確認し、地域へ出撃し、解析結果を研究へつなげます。</p>
        </div>
        <button type="button" className="collection-button" onClick={onBack}>
          前の画面へ戻る
        </button>
      </header>

      <section className="collection-panel" aria-labelledby="help-loop-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">CORE LOOP</p>
            <h2 id="help-loop-title">基本の進め方</h2>
          </div>
        </div>
        <ol className="guidance-step-list">
          <li><strong>編成</strong><span>個体を3×3盤面へ配置し、技と作戦を整えます。</span></li>
          <li><strong>出撃</strong><span>地域ごとの仕組みを学びながらステージを攻略します。</span></li>
          <li><strong>研究</strong><span>解析度と研究データで情報を開示し、設計図や開花技を解放します。</span></li>
          <li><strong>召喚</strong><span>解放済み設計図と基本通貨から新しい個体を獲得します。</span></li>
        </ol>
        <nav className="region-global-actions" aria-label="ヘルプから主要画面へ移動">
          <button type="button" className="collection-button" onClick={onOpenCollection}>編成を確認</button>
          <button type="button" className="collection-button collection-button--primary" onClick={onOpenRegion}>地域へ出撃</button>
          <button type="button" className="collection-button" onClick={onOpenResearch}>研究網を見る</button>
        </nav>
      </section>

      <section className="collection-panel" aria-labelledby="glossary-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">GLOSSARY</p>
            <h2 id="glossary-title">用語集</h2>
          </div>
        </div>
        <dl className="glossary-grid">
          {GLOSSARY.map(([term, description]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  )
}
