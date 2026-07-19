import { useMemo, useState } from 'react'
import type { MonsterSpecies } from '../content/monster-species'
import type { PlayerData } from '../progression/player-data'
import {
  completeFacilityFinalResearch,
  performFacilityTrialResearch,
  upgradeResearchFacility,
  type T037ProgressionCatalog,
} from '../progression/research-facility'
import {
  RESEARCH_METHODS,
  type PlayerResearchNodeState,
  type ResearchMethod,
  type ResearchNodeDefinition,
} from '../progression/research-model'
import { getResearchFacilityStageDefinition } from '../progression/research-facility-model'

const METHOD_LABELS: Readonly<Record<ResearchMethod, string>> = Object.freeze({
  FUSION: '融合研究',
  LINEAGE: '系譜研究',
  CONVERGENCE: '収束研究',
  TRANSCENDENCE: '超越研究',
})

const STATUS_LABELS = Object.freeze({
  hidden: '未検出',
  hinted: '兆候',
  candidate: '候補研究',
  known: 'レシピ確定',
  completed: '研究完了',
})

function shortId(id: string): string {
  return id.split('.').at(-1) ?? id
}

function displayName(id: string): string {
  return shortId(id)
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function speciesForNode(
  definition: ResearchNodeDefinition,
  catalog: T037ProgressionCatalog,
): MonsterSpecies {
  const species = catalog.species.find((candidate) => candidate.id === definition.targetSpeciesId)
  if (species === undefined) throw new Error(`unknown research target species: ${definition.targetSpeciesId}`)
  return species
}

function toggleId(values: readonly string[], id: string): readonly string[] {
  return values.includes(id)
    ? values.filter((candidate) => candidate !== id)
    : [...values, id].sort((left, right) => left.localeCompare(right, 'en'))
}

function ResourceCost({ currency, researchData }: { currency: number; researchData: number }) {
  return (
    <span className="research-cost">
      <span>基本通貨 {currency}</span>
      <span>研究データ {researchData}</span>
    </span>
  )
}

function TrialResearchForm({
  playerData,
  definition,
  catalog,
  onPlayerDataChange,
  onNotice,
}: {
  playerData: PlayerData
  definition: ResearchNodeDefinition
  catalog: T037ProgressionCatalog
  onPlayerDataChange: (next: PlayerData) => void
  onNotice: (notice: string) => void
}) {
  const [method, setMethod] = useState<ResearchMethod>(
    definition.candidateRange.methods[0] ?? RESEARCH_METHODS[0],
  )
  const [materialSpeciesIds, setMaterialSpeciesIds] = useState<readonly string[]>(
    definition.candidateRange.materialSpeciesIds.slice(
      0,
      definition.candidateRange.minimumMaterialCount,
    ),
  )
  const [catalystIds, setCatalystIds] = useState<readonly string[]>(
    definition.candidateRange.catalystIds.slice(
      0,
      definition.candidateRange.minimumCatalystCount,
    ),
  )

  const submit = () => {
    try {
      const result = performFacilityTrialResearch(
        playerData,
        {
          nodeId: definition.nodeId,
          method,
          materialSpeciesIds,
          catalystIds,
        },
        {},
        catalog,
      )
      onPlayerDataChange(result.playerData)
      if (result.evaluation.exactMatch) {
        onNotice('試験研究が完全一致しました。正確なレシピを開示しました。')
        return
      }
      const matchedMaterials = result.evaluation.materialSpecies.filter((entry) => entry.matched).length
      const matchedCatalysts = result.evaluation.catalysts.filter((entry) => entry.matched).length
      onNotice(
        `試験結果: 方式${result.evaluation.methodMatched ? '適合' : '不適合'} / 素材${matchedMaterials}/${result.evaluation.materialSpecies.length} / 触媒${matchedCatalysts}/${result.evaluation.catalysts.length}`,
      )
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '試験研究に失敗しました。')
    }
  }

  return (
    <section className="research-operation" aria-labelledby="trial-research-title">
      <div className="research-operation__heading">
        <div>
          <p className="panel-heading__kicker">TRIAL RESEARCH</p>
          <h3 id="trial-research-title">試験研究</h3>
        </div>
        <strong>研究データ {definition.trialResearchDataCost}</strong>
      </div>
      <p>触媒と個体は消費せず、選択要素ごとの適合結果を返します。</p>
      <label className="research-method-select">
        研究方式
        <select value={method} onChange={(event) => setMethod(event.target.value as ResearchMethod)}>
          {definition.candidateRange.methods.map((candidate) => (
            <option key={candidate} value={candidate}>{METHOD_LABELS[candidate]}</option>
          ))}
        </select>
      </label>
      <div className="research-choice-columns">
        <fieldset>
          <legend>
            素材種 {definition.candidateRange.minimumMaterialCount}～{definition.candidateRange.maximumMaterialCount}
          </legend>
          {definition.candidateRange.materialSpeciesIds.map((speciesId) => (
            <label key={speciesId}>
              <input
                type="checkbox"
                checked={materialSpeciesIds.includes(speciesId)}
                onChange={() => setMaterialSpeciesIds(toggleId(materialSpeciesIds, speciesId))}
              />
              {displayName(speciesId)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>
            触媒 {definition.candidateRange.minimumCatalystCount}～{definition.candidateRange.maximumCatalystCount}
          </legend>
          {definition.candidateRange.catalystIds.map((catalystId) => (
            <label key={catalystId}>
              <input
                type="checkbox"
                checked={catalystIds.includes(catalystId)}
                onChange={() => setCatalystIds(toggleId(catalystIds, catalystId))}
              />
              {displayName(catalystId)}
            </label>
          ))}
        </fieldset>
      </div>
      <button type="button" className="collection-button collection-button--primary" onClick={submit}>
        この条件で試験
      </button>
    </section>
  )
}

function FinalResearchForm({
  playerData,
  definition,
  catalog,
  onPlayerDataChange,
  onNotice,
}: {
  playerData: PlayerData
  definition: ResearchNodeDefinition
  catalog: T037ProgressionCatalog
  onPlayerDataChange: (next: PlayerData) => void
  onNotice: (notice: string) => void
}) {
  const [specimenInstanceIds, setSpecimenInstanceIds] = useState<readonly string[]>([])
  const finalDefinition = catalog.finalResearchDefinitions.find(
    (candidate) => candidate.nodeId === definition.nodeId,
  )
  if (finalDefinition === undefined) {
    return <p className="research-warning">確定研究マスターがありません。</p>
  }
  const requiredSpeciesIds = new Set(
    finalDefinition.specimenRequirements.map((requirement) => requirement.speciesId),
  )
  const assignedIds = new Set(
    playerData.formations.formations.flatMap((formation) =>
      formation.members.map((member) => member.instanceId),
    ),
  )
  const eligibleSpecimens = playerData.collection.unitInstances.filter(
    (instance) =>
      requiredSpeciesIds.has(instance.speciesId) &&
      !instance.locked &&
      !assignedIds.has(instance.instanceId),
  )

  const submit = () => {
    try {
      const result = completeFacilityFinalResearch(
        playerData,
        { nodeId: definition.nodeId, specimenInstanceIds },
        catalog,
      )
      onPlayerDataChange(result.playerData)
      onNotice(`${displayName(result.targetSpeciesId)}の設計図を永久解放しました。`)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '確定研究に失敗しました。')
    }
  }

  return (
    <section className="research-operation" aria-labelledby="final-research-title">
      <div className="research-operation__heading">
        <div>
          <p className="panel-heading__kicker">FINAL RESEARCH</p>
          <h3 id="final-research-title">確定研究</h3>
        </div>
        <strong>成功率 100%</strong>
      </div>
      <dl className="research-requirements">
        <div><dt>研究データ</dt><dd>{finalDefinition.researchDataCost}</dd></div>
        <div>
          <dt>触媒</dt>
          <dd>{finalDefinition.catalysts.length === 0 ? 'なし' : finalDefinition.catalysts.map((entry) => `${displayName(entry.catalystId)} ×${entry.amount}`).join(' / ')}</dd>
        </div>
        <div>
          <dt>標本</dt>
          <dd>{finalDefinition.specimenRequirements.length === 0 ? 'なし' : finalDefinition.specimenRequirements.map((entry) => `${displayName(entry.speciesId)} ×${entry.amount}`).join(' / ')}</dd>
        </div>
      </dl>
      {finalDefinition.specimenRequirements.length > 0 && (
        <fieldset className="research-specimens">
          <legend>消費する標本個体</legend>
          {eligibleSpecimens.length === 0 && <p>使用可能な標本がありません。locked・編成中個体は表示されません。</p>}
          {eligibleSpecimens.map((instance) => (
            <label key={instance.instanceId}>
              <input
                type="checkbox"
                checked={specimenInstanceIds.includes(instance.instanceId)}
                onChange={() => setSpecimenInstanceIds(toggleId(specimenInstanceIds, instance.instanceId))}
              />
              {instance.nickname ?? displayName(instance.speciesId)} <small>{instance.instanceId}</small>
            </label>
          ))}
        </fieldset>
      )}
      <button type="button" className="collection-button collection-button--primary" onClick={submit}>
        資源を消費して設計図解放
      </button>
    </section>
  )
}

function ResearchNodeDetail({
  playerData,
  state,
  definition,
  catalog,
  onPlayerDataChange,
  onNotice,
}: {
  playerData: PlayerData
  state: PlayerResearchNodeState
  definition: ResearchNodeDefinition
  catalog: T037ProgressionCatalog
  onPlayerDataChange: (next: PlayerData) => void
  onNotice: (notice: string) => void
}) {
  const species = speciesForNode(definition, catalog)
  const facility = getResearchFacilityStageDefinition(
    playerData.facilities,
    catalog.researchFacilityStages,
  )
  const facilityLocked = facility !== null && species.rarity > facility.maxResearchableRarity

  return (
    <section className="collection-panel research-detail" aria-labelledby="research-detail-title">
      <div className="research-detail__hero">
        <div className={`research-orb research-orb--stage-${state.disclosureStage}`} aria-hidden="true">
          {state.disclosureStage < 2 ? '?' : shortId(species.id).slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="panel-heading__kicker">RESEARCH NODE</p>
          <h2 id="research-detail-title">
            {state.disclosureStage < 2 ? '未解析ノード' : displayName(species.id)}
          </h2>
          <p>{STATUS_LABELS[state.status]} / 開示 {state.disclosureStage}/5</p>
        </div>
      </div>

      <div className="research-stage-track" aria-label={`開示段階 ${state.disclosureStage}/5`}>
        {[1, 2, 3, 4, 5].map((stage) => (
          <span key={stage} className={stage <= state.disclosureStage ? 'is-open' : ''}>{stage}</span>
        ))}
      </div>

      {state.disclosureStage >= 2 && (
        <dl className="research-facts">
          <div><dt>対象種</dt><dd>{displayName(species.id)}</dd></div>
          <div><dt>属性</dt><dd>{displayName(species.attributeId)}</dd></div>
          <div><dt>レア度</dt><dd>R{species.rarity}</dd></div>
          <div><dt>隣接</dt><dd>{definition.adjacentNodeIds.map(displayName).join(' / ') || 'なし'}</dd></div>
        </dl>
      )}

      {state.disclosureStage === 1 && (
        <p className="research-rumor">輪郭だけが研究網に浮かんでいます。解析度・触媒・地域進行・隣接研究から情報を集めてください。</p>
      )}

      {facilityLocked && (
        <p className="research-warning" role="status">
          この研究にはR{species.rarity}を扱える研究施設が必要です。現在は段階{facility?.stage}・R{facility?.maxResearchableRarity}までです。
        </p>
      )}

      {state.status === 'candidate' && !facilityLocked && (
        <TrialResearchForm
          playerData={playerData}
          definition={definition}
          catalog={catalog}
          onPlayerDataChange={onPlayerDataChange}
          onNotice={onNotice}
        />
      )}

      {state.status === 'known' && !facilityLocked && (
        <FinalResearchForm
          playerData={playerData}
          definition={definition}
          catalog={catalog}
          onPlayerDataChange={onPlayerDataChange}
          onNotice={onNotice}
        />
      )}

      {state.status === 'completed' && (
        <section className="research-completed">
          <strong>設計図解放済み</strong>
          <p>この研究は完了しています。設計図は個体の還元や標本消費で失われません。</p>
        </section>
      )}
    </section>
  )
}

export interface ResearchScreenProps {
  readonly playerData: PlayerData
  readonly catalog: T037ProgressionCatalog
  readonly onPlayerDataChange: (next: PlayerData) => void
  readonly onOpenCollection: () => void
}

export function ResearchScreen({
  playerData,
  catalog,
  onPlayerDataChange,
  onOpenCollection,
}: ResearchScreenProps) {
  const visibleStates = useMemo(
    () =>
      (playerData.research?.nodes ?? [])
        .filter((state) => state.disclosureStage > 0)
        .sort((left, right) => left.nodeId.localeCompare(right.nodeId, 'en')),
    [playerData.research],
  )
  const [selectedNodeId, setSelectedNodeId] = useState(visibleStates[0]?.nodeId ?? null)
  const [notice, setNotice] = useState<string | null>(null)
  const selectedState =
    visibleStates.find((state) => state.nodeId === selectedNodeId) ?? visibleStates[0] ?? null
  const selectedDefinition =
    selectedState === null
      ? null
      : catalog.researchNodes.find((definition) => definition.nodeId === selectedState.nodeId) ?? null
  const currentFacility = getResearchFacilityStageDefinition(
    playerData.facilities,
    catalog.researchFacilityStages,
  )
  const nextFacility = catalog.researchFacilityStages.find(
    (stage) => stage.stage === (currentFacility?.stage ?? 0) + 1,
  )
  const canAffordUpgrade =
    nextFacility !== undefined &&
    playerData.economy.currency >= nextFacility.upgradeCurrencyCost &&
    playerData.economy.researchData >= nextFacility.upgradeResearchDataCost

  const upgrade = () => {
    try {
      const result = upgradeResearchFacility(playerData, catalog)
      onPlayerDataChange(result.playerData)
      setNotice(`研究施設を段階${result.afterStage}へ更新しました。R${result.maxResearchableRarity}まで研究できます。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '研究施設の更新に失敗しました。')
    }
  }

  return (
    <main className="collection-app research-app">
      <header className="collection-header research-header">
        <div>
          <p className="eyebrow">RESEARCH NETWORK</p>
          <h1>研究網・研究施設</h1>
          <p>ヒントから候補を絞り、試験研究で照合し、確定研究で設計図を永久解放します。</p>
        </div>
        <button type="button" className="collection-button" onClick={onOpenCollection}>編成・図鑑へ戻る</button>
      </header>

      <section className="research-facility collection-panel" aria-labelledby="facility-title">
        <div className="collection-section-heading">
          <div>
            <p className="panel-heading__kicker">RESEARCH FACILITY</p>
            <h2 id="facility-title">研究施設 段階{currentFacility?.stage ?? '—'}</h2>
          </div>
          <strong>研究可能 R{currentFacility?.maxResearchableRarity ?? '—'}まで</strong>
        </div>
        <div className="facility-stage-list">
          {catalog.researchFacilityStages.map((stage) => (
            <div key={stage.stage} className={stage.stage <= (currentFacility?.stage ?? 0) ? 'is-active' : ''}>
              <span>段階 {stage.stage}</span>
              <strong>R{stage.maxResearchableRarity}</strong>
            </div>
          ))}
        </div>
        <div className="facility-upgrade-row">
          {nextFacility === undefined ? (
            <strong>スライス内の最高段階です。</strong>
          ) : (
            <>
              <ResourceCost
                currency={nextFacility.upgradeCurrencyCost}
                researchData={nextFacility.upgradeResearchDataCost}
              />
              <button
                type="button"
                className="collection-button collection-button--primary"
                disabled={!canAffordUpgrade}
                onClick={upgrade}
              >
                {canAffordUpgrade ? `段階${nextFacility.stage}へ更新` : '施設更新資源が不足'}
              </button>
            </>
          )}
        </div>
      </section>

      {notice !== null && <p className="collection-notice research-notice" role="status">{notice}</p>}

      <div className="research-layout">
        <section className="collection-panel research-network" aria-labelledby="network-title">
          <div className="collection-section-heading">
            <div>
              <p className="panel-heading__kicker">DISCLOSURE MAP</p>
              <h2 id="network-title">研究網</h2>
            </div>
            <span>未開示段階0のノードは表示しません</span>
          </div>
          <div className="research-node-grid">
            {visibleStates.map((state) => {
              const definition = catalog.researchNodes.find((candidate) => candidate.nodeId === state.nodeId)
              if (definition === undefined) return null
              const species = speciesForNode(definition, catalog)
              return (
                <button
                  key={state.nodeId}
                  type="button"
                  className={`research-node research-node--${state.status}`}
                  aria-pressed={selectedState?.nodeId === state.nodeId}
                  onClick={() => setSelectedNodeId(state.nodeId)}
                >
                  <span className="research-node__stage">{state.disclosureStage}/5</span>
                  <strong>{state.disclosureStage < 2 ? '?' : displayName(species.id)}</strong>
                  <small>{STATUS_LABELS[state.status]}</small>
                  <span className="research-node__links">↔ {definition.adjacentNodeIds.length}</span>
                </button>
              )
            })}
          </div>
        </section>

        {selectedState !== null && selectedDefinition !== null && (
          <ResearchNodeDetail
            key={selectedState.nodeId}
            playerData={playerData}
            state={selectedState}
            definition={selectedDefinition}
            catalog={catalog}
            onPlayerDataChange={onPlayerDataChange}
            onNotice={setNotice}
          />
        )}
      </div>
    </main>
  )
}
