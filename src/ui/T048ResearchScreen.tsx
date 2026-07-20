import { useMemo, useState } from 'react'
import { unlockBloomSkill } from '../progression/bloom-research'
import type { PlayerData } from '../progression/player-data'
import type { T037ProgressionCatalog } from '../progression/research-facility'
import { ResearchScreen } from './ResearchScreen'

function displayName(id: string): string {
  const tail = id.split('.').at(-1) ?? id
  return tail
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export interface T048ResearchScreenProps {
  readonly playerData: PlayerData
  readonly catalog: T037ProgressionCatalog
  readonly onPlayerDataChange: (next: PlayerData) => void
  readonly onOpenCollection: () => void
}

export function T048ResearchScreen({
  playerData,
  catalog,
  onPlayerDataChange,
  onOpenCollection,
}: T048ResearchScreenProps) {
  const [notice, setNotice] = useState<string | null>(null)
  const definitions = useMemo(
    () =>
      [...catalog.bloomResearchDefinitions].sort((left, right) => {
        const leftRarity =
          catalog.species.find((species) => species.id === left.speciesId)?.rarity ?? 0
        const rightRarity =
          catalog.species.find((species) => species.id === right.speciesId)?.rarity ?? 0
        return (
          leftRarity - rightRarity ||
          left.speciesId.localeCompare(right.speciesId, 'en') ||
          left.skillId.localeCompare(right.skillId, 'en')
        )
      }),
    [catalog],
  )

  return (
    <>
      <ResearchScreen
        playerData={playerData}
        catalog={catalog}
        onPlayerDataChange={onPlayerDataChange}
        onOpenCollection={onOpenCollection}
      />
      <main className="collection-app research-app">
        <section className="collection-panel" aria-labelledby="bloom-research-title">
          <div className="collection-section-heading">
            <div>
              <p className="panel-heading__kicker">BLOOM RESEARCH</p>
              <h2 id="bloom-research-title">開花研究</h2>
            </div>
            <span>解析度と資源を満たすと、同種すべての個体へ開花技を解放します。</span>
          </div>

          {notice !== null && (
            <p className="collection-notice research-notice" role="status">
              {notice}
            </p>
          )}

          <div className="research-node-grid">
            {definitions.map((definition) => {
              const species = catalog.species.find(
                (candidate) => candidate.id === definition.speciesId,
              )
              const state = playerData.collection.speciesStates.find(
                (candidate) => candidate.speciesId === definition.speciesId,
              )
              const blueprintUnlocked = state?.blueprintUnlocked === true
              const alreadyUnlocked = state?.bloomSkillIds.includes(definition.skillId) === true
              const analysis = state?.analysisBasisPoints ?? 0
              const analysisReady = analysis >= definition.analysisThresholdBasisPoints
              const currencyReady = playerData.economy.currency >= definition.currencyCost
              const researchDataReady =
                playerData.economy.researchData >= definition.researchDataCost
              const canUnlock =
                blueprintUnlocked &&
                !alreadyUnlocked &&
                analysisReady &&
                currencyReady &&
                researchDataReady

              const unlock = () => {
                try {
                  const result = unlockBloomSkill(
                    playerData,
                    definition.speciesId,
                    definition.skillId,
                    catalog,
                  )
                  onPlayerDataChange(result.playerData)
                  setNotice(
                    `${displayName(result.speciesId)}の開花技${displayName(result.skillId)}を解放しました。`,
                  )
                } catch (error) {
                  setNotice(error instanceof Error ? error.message : '開花研究に失敗しました。')
                }
              }

              let status = '開花研究可能'
              if (!blueprintUnlocked) status = '設計図未解放'
              else if (alreadyUnlocked) status = '開花技解放済み'
              else if (!analysisReady) {
                status = `解析度 ${analysis}/${definition.analysisThresholdBasisPoints}`
              } else if (!currencyReady || !researchDataReady) status = '研究資源不足'

              return (
                <article key={`${definition.speciesId}:${definition.skillId}`} className="research-node">
                  <span className="research-node__stage">R{species?.rarity ?? '—'}</span>
                  <strong>{displayName(definition.speciesId)}</strong>
                  <small>{displayName(definition.skillId)}</small>
                  <dl className="research-requirements">
                    <div>
                      <dt>解析度</dt>
                      <dd>
                        {analysis}/{definition.analysisThresholdBasisPoints}
                      </dd>
                    </div>
                    <div>
                      <dt>基本通貨</dt>
                      <dd>{definition.currencyCost}</dd>
                    </div>
                    <div>
                      <dt>研究データ</dt>
                      <dd>{definition.researchDataCost}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="collection-button collection-button--primary"
                    disabled={!canUnlock}
                    onClick={unlock}
                  >
                    {status}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </>
  )
}
