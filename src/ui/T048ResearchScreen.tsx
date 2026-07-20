import { resolveDisplayName } from '../content/display-masters'
import { useMemo, useState } from 'react'
import { unlockBloomSkill } from '../progression/bloom-research'
import type { PlayerData } from '../progression/player-data'
import type { T037ProgressionCatalog } from '../progression/research-facility'
import type { BloomResearchDefinition } from '../progression/t036-progression-model'
import { ConfirmDialog } from './ConfirmDialog'
import { ResearchScreen } from './ResearchScreen'

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
  const [pendingDefinition, setPendingDefinition] = useState<BloomResearchDefinition | null>(null)
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

  const unlock = (definition: BloomResearchDefinition) => {
    setPendingDefinition(null)
    try {
      const result = unlockBloomSkill(playerData, definition.speciesId, definition.skillId, catalog)
      onPlayerDataChange(result.playerData)
      setNotice(
        `${resolveDisplayName(result.speciesId)}の開花技${resolveDisplayName(result.skillId)}を解放しました。`,
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '開花研究に失敗しました。')
    }
  }

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

              let status = '開花研究可能'
              if (!blueprintUnlocked) status = '設計図未解放'
              else if (alreadyUnlocked) status = '開花技解放済み'
              else if (!analysisReady) {
                status = `解析度 ${analysis}/${definition.analysisThresholdBasisPoints}`
              } else if (!currencyReady || !researchDataReady) status = '研究資源不足'

              return (
                <article
                  key={`${definition.speciesId}:${definition.skillId}`}
                  className="research-node"
                >
                  <span className="research-node__stage">R{species?.rarity ?? '—'}</span>
                  <strong>{resolveDisplayName(definition.speciesId)}</strong>
                  <small>{resolveDisplayName(definition.skillId)}</small>
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
                    onClick={() => setPendingDefinition(definition)}
                  >
                    {status}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      </main>
      <ConfirmDialog
        open={pendingDefinition !== null}
        title={`${pendingDefinition === null ? '' : resolveDisplayName(pendingDefinition.skillId)}を開花解放しますか？`}
        description="同種すべての個体へ開花技を永久解放し、基本通貨と研究データを消費します。"
        details={
          pendingDefinition === null
            ? []
            : [
                `対象種: ${resolveDisplayName(pendingDefinition.speciesId)}`,
                `基本通貨 ${pendingDefinition.currencyCost}`,
                `研究データ ${pendingDefinition.researchDataCost}`,
              ]
        }
        confirmLabel="開花技を解放"
        onCancel={() => setPendingDefinition(null)}
        onConfirm={() => {
          if (pendingDefinition !== null) unlock(pendingDefinition)
        }}
      />
    </>
  )
}
