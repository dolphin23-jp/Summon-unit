import {
  formatUnitDisplayName,
  resolveCatalystName,
  resolveSpeciesName,
} from '../content/display-masters'
import type { BattleResultView } from './battle-result-view'
import { MonsterIcon } from './MonsterIcon'

export type BattleResultNavigationAction = 'RETRY' | 'FORMATION' | 'RESEARCH' | 'NEXT_STAGE'

function sideLabel(side: 'ALLY' | 'ENEMY'): string {
  return side === 'ALLY' ? '味方' : '相手'
}

export function BattleResultScreen({
  view,
  navigationNotice,
  onNavigate,
}: {
  readonly view: BattleResultView
  readonly navigationNotice: string | null
  readonly onNavigate: (action: BattleResultNavigationAction) => void
}) {
  return (
    <section
      className={`result-screen result-screen--${view.tone.toLowerCase()}`}
      aria-labelledby="battle-result-title"
      aria-live="polite"
    >
      <header className="result-screen__header">
        <span className="result-screen__mark" aria-hidden="true">
          {view.mark}
        </span>
        <div>
          <p className="panel-heading__kicker">BATTLE RESULT</p>
          <h2 id="battle-result-title">{view.title}</h2>
          <p>{view.summary}</p>
        </div>
        <dl className="result-screen__meta">
          <div>
            <dt>終了</dt>
            <dd>{view.terminationLabel}</dd>
          </div>
          <div>
            <dt>仮想時刻</dt>
            <dd>t={view.finalVirtualTime}</dd>
          </div>
          <div>
            <dt>総行動</dt>
            <dd>{view.totalActions}</dd>
          </div>
        </dl>
      </header>

      <div className="result-screen__summary-grid">
        <section className="result-card" aria-labelledby="result-reward-title">
          <h3 id="result-reward-title">報酬・修復費</h3>
          <dl className="result-reward-list">
            <div>
              <dt>
                <span aria-hidden="true">C</span> 基本通貨
              </dt>
              <dd>+{view.rewards.currency}</dd>
            </div>
            <div>
              <dt>
                <span aria-hidden="true">R</span> 研究データ
              </dt>
              <dd>+{view.rewards.researchData}</dd>
            </div>
            <div>
              <dt>
                <span aria-hidden="true">K</span> 触媒
              </dt>
              <dd>+{view.rewards.catalyst}</dd>
            </div>
            <div>
              <dt>
                <span aria-hidden="true">−</span> 修復費目安
              </dt>
              <dd>{view.repairCost}</dd>
            </div>
            {view.regionalPoints !== null && (
              <div>
                <dt>
                  <span aria-hidden="true">P</span> 地域ポイント
                </dt>
                <dd>
                  {view.regionalPoints.before} → {view.regionalPoints.after}
                </dd>
              </div>
            )}
          </dl>
          {view.rewards.catalysts.length > 0 && (
            <ul className="result-analysis-list" aria-label="獲得触媒内訳">
              {view.rewards.catalysts.map((catalyst) => (
                <li key={catalyst.catalystId}>
                  <span>{resolveCatalystName(catalyst.catalystId)}</span>
                  <strong>+{catalyst.amount}</strong>
                </li>
              ))}
            </ul>
          )}
          <p className="result-card__stub">
            {view.rewards.stub
              ? 'ステージ未指定戦闘の表示用スタブです。進行データは変更しません。'
              : 'ステージ報酬、地域ポイント、解析度、研究ヒントをPlayerDataへ精算済みです。'}
          </p>
        </section>

        <section className="result-card" aria-labelledby="result-analysis-title">
          <h3 id="result-analysis-title">解析度変化</h3>
          {view.analysisChanges.length === 0 ? (
            <p>今回適用された解析度変化はありません。</p>
          ) : (
            <ul className="result-analysis-list">
              {view.analysisChanges.map((change) => (
                <li key={change.speciesId}>
                  <span>{resolveSpeciesName(change.speciesId)}</span>
                  <strong>+{change.change}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="result-card" aria-labelledby="result-notification-title">
          <h3 id="result-notification-title">進行・研究通知</h3>
          <ul className="result-notification-list">
            {view.notifications.map((notification) => (
              <li key={notification}>
                <span aria-hidden="true">!</span>
                {notification}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="result-stats" aria-labelledby="result-stats-title">
        <div className="panel-heading">
          <div>
            <p className="panel-heading__kicker">UNIT RECORDS</p>
            <h3 id="result-stats-title">個体戦績</h3>
          </div>
          <span className="result-stats__hint">左右スクロール可能</span>
        </div>
        <div className="result-stats__scroll" tabIndex={0} aria-label="個体戦績表">
          <table>
            <thead>
              <tr>
                <th scope="col">陣営</th>
                <th scope="col">個体</th>
                <th scope="col">状態</th>
                <th scope="col">HP</th>
                <th scope="col">行動</th>
                <th scope="col">技</th>
                <th scope="col">与ダメ</th>
                <th scope="col">被ダメ</th>
                <th scope="col">障壁吸収</th>
                <th scope="col">撃破</th>
              </tr>
            </thead>
            <tbody>
              {view.unitStats.map((unit) => (
                <tr key={unit.battleUnitId}>
                  <td>
                    <span className={`result-side result-side--${unit.side.toLowerCase()}`}>
                      {unit.side === 'ALLY' ? 'A' : 'E'} {sideLabel(unit.side)}
                    </span>
                  </td>
                  <th scope="row">
                    <span className="result-unit-identity">
                      <MonsterIcon
                        speciesId={unit.speciesId}
                        label={resolveSpeciesName(unit.speciesId)}
                        size="sm"
                        variant="frameless"
                      />
                      <span>
                        <strong>{formatUnitDisplayName(unit.speciesId, unit.battleUnitId)}</strong>
                        <small>{resolveSpeciesName(unit.speciesId)}</small>
                      </span>
                    </span>
                  </th>
                  <td>{unit.defeated ? '戦闘不能' : '生存'}</td>
                  <td>
                    {unit.hp}/{unit.maxHp}
                  </td>
                  <td>{unit.actionCount}</td>
                  <td>{unit.skillUseCount}</td>
                  <td>{unit.damageDealt}</td>
                  <td>{unit.damageTaken}</td>
                  <td>{unit.barrierAbsorbed}</td>
                  <td>{unit.defeatCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="result-screen__footer">
        <div className="result-actions" aria-label="戦闘終了後の移動先">
          <button
            type="button"
            className="control-button control-button--primary"
            onClick={() => onNavigate('RETRY')}
          >
            再戦
          </button>
          <button type="button" className="control-button" onClick={() => onNavigate('FORMATION')}>
            編成
          </button>
          <button type="button" className="control-button" onClick={() => onNavigate('RESEARCH')}>
            研究
          </button>
          <button type="button" className="control-button" onClick={() => onNavigate('NEXT_STAGE')}>
            次ステージ
          </button>
        </div>
        {navigationNotice !== null && (
          <p className="result-navigation-notice" role="status">
            {navigationNotice}
          </p>
        )}
      </footer>
    </section>
  )
}
