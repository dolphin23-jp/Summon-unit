import { resolveDisplayName } from '../content/display-masters'
import { useMemo, useState } from 'react'
import type { PlayerData } from '../progression/player-data'
import type { ProgressionNotification } from '../progression/progression-notifications'
import {
  getRegionAccessState,
  getRegionPoints,
  getStageAccessState,
  normalizeRegionProgression,
  type T039ProgressionCatalog,
} from '../progression/region-progression'
import type { InstantStageSimulationResult } from '../progression/stage-battle'
import type {
  RegionalPointRewardDefinition,
  StageDefinition,
  StageKind,
} from '../progression/stage-model'

const STAGE_KIND_LABELS: Readonly<Record<StageKind, string>> = Object.freeze({
  NORMAL: '通常戦',
  ELITE: '強敵戦',
  BOSS: '地域ボス',
  HIDDEN: '隠し戦闘',
})

function displayName(id: string): string {
  return resolveDisplayName(id)
}

function regionalRewardsForStages(
  stages: readonly StageDefinition[],
): readonly RegionalPointRewardDefinition[] {
  const rewards = new Map<string, RegionalPointRewardDefinition>()
  for (const stage of stages) {
    for (const reward of stage.rewards.regionalPointRewards) {
      const existing = rewards.get(reward.rewardId)
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(reward)) {
        throw new Error(`regional reward definition disagrees: ${reward.rewardId}`)
      }
      rewards.set(reward.rewardId, reward)
    }
  }
  return Object.freeze(
    [...rewards.values()].sort(
      (left, right) =>
        left.requiredPoints - right.requiredPoints ||
        left.rewardId.localeCompare(right.rewardId, 'en'),
    ),
  )
}

function outcomeLabel(result: InstantStageSimulationResult): string {
  switch (result.battleResult.summary.outcome) {
    case 'ALLY_VICTORY':
      return '勝利'
    case 'ALLY_DEFEAT':
      return '敗北'
    case 'DRAW':
      return '引き分け'
    case 'ONGOING':
      return '行動上限'
  }
}

function notificationActionLabel(notification: ProgressionNotification): string | null {
  switch (notification.target) {
    case 'RESEARCH':
      return '研究画面へ'
    case 'COLLECTION':
      return '編成・図鑑へ'
    case 'REGION':
      return null
  }
}

export interface RegionScreenProps {
  readonly playerData: PlayerData
  readonly catalog: T039ProgressionCatalog
  readonly selectedStageId: string | null
  readonly notifications: readonly ProgressionNotification[]
  readonly onSelectStage: (stageId: string) => void
  readonly onStartBattle: (stageId: string, formationId: string) => void
  readonly onInstantSimulate: (stageId: string, formationId: string) => InstantStageSimulationResult
  readonly onOpenCollection: () => void
  readonly onOpenResearch: () => void
  readonly onDismissNotification: (notificationId: string) => void
  readonly onDismissAllNotifications: () => void
}

export function RegionScreen({
  playerData,
  catalog,
  selectedStageId,
  notifications,
  onSelectStage,
  onStartBattle,
  onInstantSimulate,
  onOpenCollection,
  onOpenResearch,
  onDismissNotification,
  onDismissAllNotifications,
}: RegionScreenProps) {
  const progression = useMemo(() => normalizeRegionProgression(catalog), [catalog])
  const selectedStage = progression.stages.find((stage) => stage.stageId === selectedStageId)
  const initialRegionId =
    selectedStage?.regionId ??
    progression.regions.find((region) => getRegionAccessState(playerData, region).visible)
      ?.regionId ??
    null
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialRegionId)
  const [notice, setNotice] = useState<string | null>(null)
  const visibleRegions = progression.regions.filter(
    (region) => getRegionAccessState(playerData, region).visible,
  )
  const selectedRegion =
    visibleRegions.find((region) => region.regionId === selectedRegionId) ??
    visibleRegions[0] ??
    null
  const regionStages =
    selectedRegion === null
      ? []
      : progression.stages.filter((stage) => stage.regionId === selectedRegion.regionId)
  const visibleStages = regionStages.filter(
    (stage) => getStageAccessState(playerData, stage).visible,
  )
  const undiscoveredCount = regionStages.length - visibleStages.length
  const completedStageIds = new Set(playerData.stageProgress?.completedStageIds ?? [])
  const activeFormationId = playerData.formations.activeFormationId
  const activeFormation = playerData.formations.formations.find(
    (formation) => formation.formationId === activeFormationId,
  )
  const regionalState =
    selectedRegion === null
      ? null
      : (playerData.stageProgress?.regionalPoints.find(
          (state) => state.regionId === selectedRegion.regionId,
        ) ?? null)
  const regionalRewards = regionalRewardsForStages(regionStages)

  const simulate = (stageId: string) => {
    if (activeFormationId === null) {
      setNotice('即時シミュレーションには有効な編成が必要です。')
      return
    }
    try {
      const result = onInstantSimulate(stageId, activeFormationId)
      setNotice(
        `即時シミュレーション: ${outcomeLabel(result)} / 基本通貨 +${result.settlement.rewards.total.currency} / 研究データ +${result.settlement.rewards.total.researchData}`,
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '即時シミュレーションに失敗しました。')
    }
  }

  const openNotificationTarget = (notification: ProgressionNotification) => {
    if (notification.target === 'RESEARCH') onOpenResearch()
    if (notification.target === 'COLLECTION') onOpenCollection()
  }

  return (
    <main className="region-app">
      <header className="region-header">
        <div>
          <p className="eyebrow">REGION OPERATIONS</p>
          <h1>地域観測・ステージ選択</h1>
          <p>地域進行、解放条件、周回報酬を確認し、現在の編成で出撃します。</p>
        </div>
        <nav className="region-global-actions" aria-label="主要画面">
          <button type="button" className="collection-button" onClick={onOpenCollection}>
            編成・図鑑
          </button>
          <button type="button" className="collection-button" onClick={onOpenResearch}>
            研究網・施設
          </button>
        </nav>
      </header>

      <section className="region-resource-bar" aria-label="現在の資源と編成">
        <div>
          <span>基本通貨</span>
          <strong>{playerData.economy.currency}</strong>
        </div>
        <div>
          <span>研究データ</span>
          <strong>{playerData.economy.researchData}</strong>
        </div>
        <div>
          <span>触媒種</span>
          <strong>{playerData.economy.catalysts.length}</strong>
        </div>
        <div>
          <span>出撃編成</span>
          <strong>{activeFormation?.name ?? '未設定'}</strong>
        </div>
      </section>

      {notifications.length > 0 && (
        <section className="progress-notifications" aria-labelledby="progress-notifications-title">
          <div className="collection-section-heading">
            <div>
              <p className="panel-heading__kicker">PROGRESSION UPDATES</p>
              <h2 id="progress-notifications-title">進行通知</h2>
            </div>
            <button
              type="button"
              className="collection-button collection-button--compact"
              onClick={onDismissAllNotifications}
            >
              すべて確認済みにする
            </button>
          </div>
          <div className="progress-notification-list">
            {notifications.map((notification) => {
              const actionLabel = notificationActionLabel(notification)
              return (
                <article
                  key={notification.id}
                  className={`progress-notification progress-notification--${notification.kind.toLowerCase()}`}
                >
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.detail}</p>
                  </div>
                  <div className="progress-notification__actions">
                    {actionLabel !== null && (
                      <button
                        type="button"
                        className="collection-button collection-button--compact"
                        onClick={() => openNotificationTarget(notification)}
                      >
                        {actionLabel}
                      </button>
                    )}
                    <button
                      type="button"
                      className="collection-button collection-button--compact"
                      onClick={() => onDismissNotification(notification.id)}
                    >
                      確認済み
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {notice !== null && (
        <p className="collection-notice region-notice" role="status">
          {notice}
        </p>
      )}

      <div className="region-layout">
        <aside className="region-selector collection-panel" aria-labelledby="region-list-title">
          <div className="collection-section-heading">
            <div>
              <p className="panel-heading__kicker">REGIONS</p>
              <h2 id="region-list-title">観測地域</h2>
            </div>
            <span>{visibleRegions.length}地域</span>
          </div>
          <div className="region-list">
            {visibleRegions.map((region) => {
              const access = getRegionAccessState(playerData, region)
              const points = getRegionPoints(playerData, region.regionId)
              const completed = progression.stages.filter(
                (stage) =>
                  stage.regionId === region.regionId && completedStageIds.has(stage.stageId),
              ).length
              const total = progression.stages.filter(
                (stage) =>
                  stage.regionId === region.regionId &&
                  getStageAccessState(playerData, stage).visible,
              ).length
              return (
                <button
                  key={region.regionId}
                  type="button"
                  className="region-select-button"
                  aria-pressed={selectedRegion?.regionId === region.regionId}
                  onClick={() => setSelectedRegionId(region.regionId)}
                >
                  <span className="region-select-button__order">REGION {region.order}</span>
                  <strong>{region.name}</strong>
                  <small>{access.unlocked ? `${completed}/${total}クリア` : '未解放'}</small>
                  <span>地域P {points}</span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="region-detail collection-panel" aria-labelledby="region-detail-title">
          {selectedRegion === null ? (
            <p>表示できる地域がありません。</p>
          ) : (
            <>
              <header className="region-detail__header">
                <div>
                  <p className="panel-heading__kicker">ACTIVE REGION</p>
                  <h2 id="region-detail-title">{selectedRegion.name}</h2>
                  <p>{selectedRegion.summary}</p>
                </div>
                <strong>地域ポイント {regionalState?.points ?? 0}</strong>
              </header>

              <section className="regional-reward-track" aria-labelledby="regional-reward-title">
                <h3 id="regional-reward-title">地域ポイント天井</h3>
                <div className="regional-reward-list">
                  {regionalRewards.map((reward) => {
                    const claimed =
                      regionalState?.claimedRewardIds.includes(reward.rewardId) ?? false
                    const reached = (regionalState?.points ?? 0) >= reward.requiredPoints
                    return (
                      <div
                        key={reward.rewardId}
                        className={`regional-reward${claimed ? ' is-claimed' : reached ? ' is-reached' : ''}`}
                      >
                        <span>{reward.requiredPoints}P</span>
                        <strong>{displayName(reward.rewardId)}</strong>
                        <small>
                          {claimed ? '受取済み' : reached ? '次回精算で受取' : '未到達'}
                        </small>
                      </div>
                    )
                  })}
                </div>
              </section>

              <div className="stage-card-grid">
                {visibleStages.map((stage) => {
                  const access = getStageAccessState(playerData, stage)
                  const completed = completedStageIds.has(stage.stageId)
                  const selected = selectedStageId === stage.stageId
                  return (
                    <article
                      key={stage.stageId}
                      className={`stage-card stage-card--${stage.kind.toLowerCase()}${selected ? ' is-selected' : ''}${!access.unlocked ? ' is-locked' : ''}`}
                    >
                      <button
                        type="button"
                        className="stage-card__select"
                        aria-pressed={selected}
                        onClick={() => onSelectStage(stage.stageId)}
                      >
                        <span className="stage-card__kind">{STAGE_KIND_LABELS[stage.kind]}</span>
                        <strong>{displayName(stage.stageId)}</strong>
                        <small>{completed ? 'CLEAR' : access.unlocked ? 'OPEN' : 'LOCKED'}</small>
                      </button>
                      <div className="stage-card__body">
                        <h3>{stage.theme}</h3>
                        {stage.secondaryTheme !== null && <p>{stage.secondaryTheme}</p>}
                        <dl>
                          <div>
                            <dt>敵数</dt>
                            <dd>{stage.enemyFormation.units.length}</dd>
                          </div>
                          <div>
                            <dt>確定通貨</dt>
                            <dd>{stage.rewards.guaranteed.currency}</dd>
                          </div>
                          <div>
                            <dt>研究データ</dt>
                            <dd>{stage.rewards.guaranteed.researchData}</dd>
                          </div>
                          <div>
                            <dt>地域P</dt>
                            <dd>{stage.rewards.regionalPointGain}</dd>
                          </div>
                        </dl>
                        {!access.unlocked && (
                          <p className="stage-card__lock" role="status">
                            {access.reason}
                          </p>
                        )}
                        {completed && (
                          <p className="stage-card__fast">
                            クリア済み: ×8戦闘と即時シミュレーションを利用可能
                          </p>
                        )}
                      </div>
                      <div className="stage-card__actions">
                        <button
                          type="button"
                          className="collection-button collection-button--primary"
                          disabled={!access.unlocked || activeFormationId === null}
                          onClick={() => {
                            if (activeFormationId !== null) {
                              onSelectStage(stage.stageId)
                              onStartBattle(stage.stageId, activeFormationId)
                            }
                          }}
                        >
                          {activeFormationId === null ? '編成未設定' : 'このステージへ出撃'}
                        </button>
                        {completed && (
                          <button
                            type="button"
                            className="collection-button"
                            disabled={activeFormationId === null}
                            onClick={() => simulate(stage.stageId)}
                          >
                            即時シミュレーション
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>

              {undiscoveredCount > 0 && (
                <p className="region-secret-summary">
                  未発見のステージが{undiscoveredCount}
                  件あります。地域進行を進めて兆候を探してください。
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
