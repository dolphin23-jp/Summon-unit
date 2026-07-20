import { useMemo, useState } from 'react'
import type { SpeciesId } from '../content/monster-species'
import type { PlayerData } from '../progression/player-data'
import type { T036ProgressionCatalog } from '../progression/t036-progression-model'
import { calculateSummonCurrencyCost, summonUnit } from '../progression/unit-economy'

function displayName(id: string): string {
  const tail = id.split('.').at(-1) ?? id
  return tail
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function instanceSlug(speciesId: SpeciesId): string {
  return speciesId.split('.').at(-1) ?? speciesId
}

export function createNextSummonInstanceId(
  playerData: PlayerData,
  speciesId: SpeciesId,
): string {
  const existing = new Set(
    playerData.collection.unitInstances.map((instance) => instance.instanceId),
  )
  const slug = instanceSlug(speciesId)
  for (let serial = 1; serial <= Number.MAX_SAFE_INTEGER; serial += 1) {
    const candidate = `unit.summoned.${slug}-${String(serial).padStart(3, '0')}`
    if (!existing.has(candidate)) return candidate
  }
  throw new Error(`召喚個体IDを確保できません: ${speciesId}`)
}

export interface SummonScreenProps {
  readonly playerData: PlayerData
  readonly catalog: T036ProgressionCatalog
  readonly onPlayerDataChange: (next: PlayerData) => void
  readonly onOpenHome: () => void
  readonly onOpenCollection: () => void
  readonly onOpenResearch: () => void
}

export function SummonScreen({
  playerData,
  catalog,
  onPlayerDataChange,
  onOpenHome,
  onOpenCollection,
  onOpenResearch,
}: SummonScreenProps) {
  const unlockedSpecies = useMemo(
    () =>
      playerData.collection.speciesStates
        .filter((state) => state.blueprintUnlocked)
        .map((state) => catalog.species.find((species) => species.id === state.speciesId))
        .filter((species): species is NonNullable<typeof species> => species !== undefined)
        .sort(
          (left, right) =>
            left.rarity - right.rarity || left.id.localeCompare(right.id, 'en'),
        ),
    [catalog.species, playerData.collection.speciesStates],
  )
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<SpeciesId | null>(
    unlockedSpecies[0]?.id ?? null,
  )
  const [notice, setNotice] = useState<string | null>(null)
  const selectedSpecies =
    unlockedSpecies.find((species) => species.id === selectedSpeciesId) ??
    unlockedSpecies[0] ??
    null
  const summonCost =
    selectedSpecies === null ? null : calculateSummonCurrencyCost(selectedSpecies.rarity)
  const canAfford = summonCost !== null && playerData.economy.currency >= summonCost

  const summon = () => {
    if (selectedSpecies === null) {
      setNotice('召喚可能な設計図がありません。')
      return
    }
    try {
      const instanceId = createNextSummonInstanceId(playerData, selectedSpecies.id)
      const result = summonUnit(
        playerData,
        { instanceId, speciesId: selectedSpecies.id },
        catalog,
      )
      onPlayerDataChange(result.playerData)
      setNotice(
        `${displayName(result.speciesId)}を召喚しました。基本通貨を${result.currencySpent}消費しました。`,
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '召喚に失敗しました。')
    }
  }

  return (
    <main className="collection-app">
      <header className="collection-header">
        <div>
          <p className="eyebrow">SUMMON FACILITY</p>
          <h1>設計図召喚</h1>
          <p>研究で永久解放した設計図から、抽選や待機なしで個体を召喚します。</p>
        </div>
        <nav className="region-global-actions" aria-label="召喚画面の移動">
          <button type="button" className="collection-button" onClick={onOpenHome}>
            ホーム
          </button>
          <button type="button" className="collection-button" onClick={onOpenResearch}>
            研究網
          </button>
          <button type="button" className="collection-button" onClick={onOpenCollection}>
            編成・図鑑
          </button>
        </nav>
      </header>

      {notice !== null && (
        <p className="collection-notice" role="status">
          {notice}
        </p>
      )}

      <section className="collection-panel" aria-labelledby="summon-resource-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">AVAILABLE BLUEPRINTS</p>
            <h2 id="summon-resource-title">召喚可能な設計図</h2>
          </div>
          <strong>基本通貨 {playerData.economy.currency}</strong>
        </div>

        {unlockedSpecies.length === 0 ? (
          <p>解放済み設計図がありません。研究網で確定研究を完了してください。</p>
        ) : (
          <div className="research-node-grid">
            {unlockedSpecies.map((species) => {
              const cost = calculateSummonCurrencyCost(species.rarity)
              const owned = playerData.collection.unitInstances.filter(
                (instance) => instance.speciesId === species.id,
              ).length
              return (
                <button
                  key={species.id}
                  type="button"
                  className="research-node research-node--completed"
                  aria-pressed={selectedSpecies?.id === species.id}
                  onClick={() => setSelectedSpeciesId(species.id)}
                >
                  <span className="research-node__stage">R{species.rarity}</span>
                  <strong>{displayName(species.id)}</strong>
                  <small>所持 {owned} / 通貨 {cost}</small>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {selectedSpecies !== null && summonCost !== null && (
        <section className="collection-panel" aria-labelledby="summon-confirm-title">
          <div className="collection-section-heading">
            <div>
              <p className="panel-heading__kicker">CONFIRM SUMMON</p>
              <h2 id="summon-confirm-title">{displayName(selectedSpecies.id)}</h2>
            </div>
            <strong>R{selectedSpecies.rarity}</strong>
          </div>
          <p>
            基本通貨を{summonCost}消費し、condition 100%の新しい個体を追加します。
            個体IDは既存データと衝突しない固定規則で発行します。
          </p>
          <button
            type="button"
            className="collection-button collection-button--primary"
            disabled={!canAfford}
            onClick={summon}
          >
            {canAfford ? `基本通貨 ${summonCost} で召喚` : '基本通貨が不足しています'}
          </button>
        </section>
      )}
    </main>
  )
}
