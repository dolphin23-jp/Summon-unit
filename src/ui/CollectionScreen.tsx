import { useMemo, useState } from 'react'
import {
  AI_INDIVIDUAL_STRATEGIES,
  AI_SKILL_POLICIES,
  AI_TEAM_STRATEGIES,
  type AiIndividualStrategy,
  type AiSkillPolicy,
  type AiTeamStrategy,
} from '../ai/strategy-presets'
import { COLUMNS, LOCAL_ROWS } from '../battle/board'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  moveFormationMemberPriority,
  placeFormationMember,
  removeFormationMember,
  saveFormationPreset,
  setActiveFormation,
  updateFormationMemberLoadout,
  updateFormationMemberSkillPolicy,
  updateFormationMemberStrategies,
} from '../progression/formation-editor'
import {
  getGenericSkillLearningBalance,
  learnGenericSkill,
  type GenericSkillLearningState,
} from '../progression/generic-skill-learning'
import type {
  FormationMember,
  PlayerData,
  PlayerDataContentCatalog,
  PlayerSpeciesState,
  PlayerUnitInstance,
} from '../progression/player-data'

type CollectionTab = 'FORMATION' | 'LEARNING' | 'ENCYCLOPEDIA'

const INDIVIDUAL_LABELS: Readonly<Record<AiIndividualStrategy, string>> = Object.freeze({
  STANDARD: '標準',
  ASSAULT: '強襲',
  CAUTIOUS: '慎重',
  SUPPORT: '支援',
  POSITIONAL: '位置重視',
  FIXED_TURRET: '固定砲台',
  BLOOM_PRIORITY: '開花優先',
  BLOOM_CONSERVE: '開花温存',
})

const TEAM_LABELS: Readonly<Record<AiTeamStrategy, string>> = Object.freeze({
  FAST_KILL: '最速撃破',
  STABLE_CLEAR: '安定攻略',
  LOSS_MINIMIZATION: '損耗抑制',
  INDIVIDUAL_PRIORITY: '個体設定優先',
})

const POLICY_LABELS: Readonly<Record<AiSkillPolicy, string>> = Object.freeze({
  AGGRESSIVE_USE: '積極使用',
  STANDARD: '標準',
  CONDITIONAL: '条件付き',
  CONSERVE: '温存',
  AUTO_DISABLED: '自動禁止',
})

const TAB_LABELS: Readonly<Record<CollectionTab, string>> = Object.freeze({
  FORMATION: '編成',
  LEARNING: '技習得',
  ENCYCLOPEDIA: '図鑑',
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

function basisPointsLabel(value: number): string {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}%`
}

function encyclopediaStage(stageId: string): number {
  const parsed = Number(stageId.match(/(\d+)$/)?.[1] ?? 0)
  return Number.isSafeInteger(parsed) ? Math.max(0, Math.min(5, parsed)) : 0
}

function speciesForInstance(
  instance: PlayerUnitInstance,
  catalog: PlayerDataContentCatalog,
): MonsterSpecies {
  const species = catalog.species.find((candidate) => candidate.id === instance.speciesId)
  if (species === undefined) {
    throw new Error(`unknown species id: ${instance.speciesId}`)
  }
  return species
}

function speciesStateForInstance(
  instance: PlayerUnitInstance,
  playerData: PlayerData,
): PlayerSpeciesState {
  const state = playerData.collection.speciesStates.find(
    (candidate) => candidate.speciesId === instance.speciesId,
  )
  if (state === undefined) {
    throw new Error(`species state does not exist: ${instance.speciesId}`)
  }
  return state
}

function MonsterIcon({ species, concealed = false }: { species: MonsterSpecies; concealed?: boolean }) {
  const letters = concealed ? '?' : shortId(species.id).slice(0, 2).toUpperCase()
  return (
    <div
      className={`collection-icon${concealed ? ' collection-icon--concealed' : ''}`}
      role="img"
      aria-label={concealed ? '未開示のモンスター画像領域' : `${displayName(species.id)}の画像領域`}
    >
      <span>{letters}</span>
      <small>IMAGE SLOT</small>
    </div>
  )
}

function RosterCard({
  instance,
  member,
  species,
  selected,
  onSelect,
}: {
  instance: PlayerUnitInstance
  member: FormationMember | null
  species: MonsterSpecies
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`roster-card${selected ? ' roster-card--selected' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <MonsterIcon species={species} />
      <span className="roster-card__body">
        <strong>{instance.nickname ?? displayName(species.id)}</strong>
        <small>{instance.instanceId}</small>
        <span>
          {member === null
            ? '未配置'
            : `${['前列', '中列', '後列'][member.position.row]} ${['A', 'B', 'C'][member.position.column]} / 優先${member.tiePriority}`}
        </span>
      </span>
      <span className="roster-card__flags" aria-label="個体フラグ">
        {instance.favorite ? '★' : '☆'} {instance.locked ? 'LOCK' : 'OPEN'}
      </span>
    </button>
  )
}

function FormationMemberEditor({
  playerData,
  catalog,
  formationId,
  instance,
  member,
  onChange,
}: {
  playerData: PlayerData
  catalog: PlayerDataContentCatalog
  formationId: string
  instance: PlayerUnitInstance
  member: FormationMember
  onChange: (next: PlayerData) => void
}) {
  const species = speciesForInstance(instance, catalog)
  const speciesState = speciesStateForInstance(instance, playerData)
  const policySkillIds = [
    species.innateSkillId,
    ...(member.loadout.genericSkillId === null ? [] : [member.loadout.genericSkillId]),
    ...(member.loadout.bloomSkillId === null ? [] : [member.loadout.bloomSkillId]),
  ]
  const changeLoadout = (genericSkillId: string | null, bloomSkillId: string | null) => {
    onChange(
      updateFormationMemberLoadout(
        playerData,
        formationId,
        instance.instanceId,
        { genericSkillId, bloomSkillId },
        catalog,
      ),
    )
  }
  return (
    <section className="member-editor" aria-labelledby="member-editor-title">
      <div className="collection-section-heading">
        <div>
          <p className="panel-heading__kicker">MEMBER SETTINGS</p>
          <h2 id="member-editor-title">{instance.nickname ?? displayName(species.id)}</h2>
        </div>
        <span>状態 {basisPointsLabel(instance.conditionBasisPoints)}</span>
      </div>

      <div className="member-editor__grid">
        <label>
          汎用技
          <select
            value={member.loadout.genericSkillId ?? ''}
            onChange={(event) => changeLoadout(event.target.value || null, member.loadout.bloomSkillId)}
          >
            <option value="">装備なし</option>
            {instance.learnedGenericSkillIds.map((skillId) => (
              <option key={skillId} value={skillId}>{displayName(skillId)}</option>
            ))}
          </select>
        </label>
        <label>
          開花技
          <select
            value={member.loadout.bloomSkillId ?? ''}
            onChange={(event) => changeLoadout(member.loadout.genericSkillId, event.target.value || null)}
          >
            <option value="">装備なし</option>
            {speciesState.bloomSkillIds.map((skillId) => (
              <option key={skillId} value={skillId}>{displayName(skillId)}</option>
            ))}
          </select>
        </label>
        <label>
          個体作戦
          <select
            value={member.ai.individualStrategy}
            onChange={(event) =>
              onChange(
                updateFormationMemberStrategies(
                  playerData,
                  formationId,
                  instance.instanceId,
                  event.target.value as AiIndividualStrategy,
                  member.ai.teamStrategy,
                  catalog,
                ),
              )
            }
          >
            {AI_INDIVIDUAL_STRATEGIES.map((strategy) => (
              <option key={strategy} value={strategy}>{INDIVIDUAL_LABELS[strategy]}</option>
            ))}
          </select>
        </label>
        <label>
          チーム作戦
          <select
            value={member.ai.teamStrategy}
            onChange={(event) =>
              onChange(
                updateFormationMemberStrategies(
                  playerData,
                  formationId,
                  instance.instanceId,
                  member.ai.individualStrategy,
                  event.target.value as AiTeamStrategy,
                  catalog,
                ),
              )
            }
          >
            {AI_TEAM_STRATEGIES.map((strategy) => (
              <option key={strategy} value={strategy}>{TEAM_LABELS[strategy]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="policy-editor">
        <h3>技ポリシー</h3>
        {policySkillIds.map((skillId) => {
          const current = member.ai.skillPolicies?.find((setting) => setting.skillId === skillId)?.policy ?? 'STANDARD'
          return (
            <label key={skillId}>
              <span>{displayName(skillId)}</span>
              <select
                value={current}
                onChange={(event) =>
                  onChange(
                    updateFormationMemberSkillPolicy(
                      playerData,
                      formationId,
                      instance.instanceId,
                      skillId,
                      event.target.value as AiSkillPolicy,
                      catalog,
                    ),
                  )
                }
              >
                {AI_SKILL_POLICIES.map((policy) => (
                  <option key={policy} value={policy}>{POLICY_LABELS[policy]}</option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      <div className="member-editor__actions">
        <button
          type="button"
          className="collection-button"
          onClick={() =>
            onChange(
              moveFormationMemberPriority(
                playerData,
                formationId,
                instance.instanceId,
                -1,
                catalog,
              ),
            )
          }
        >
          優先を前へ
        </button>
        <button
          type="button"
          className="collection-button"
          onClick={() =>
            onChange(
              moveFormationMemberPriority(
                playerData,
                formationId,
                instance.instanceId,
                1,
                catalog,
              ),
            )
          }
        >
          優先を後ろへ
        </button>
        <button
          type="button"
          className="collection-button collection-button--danger"
          onClick={() =>
            onChange(
              removeFormationMember(playerData, formationId, instance.instanceId, catalog),
            )
          }
        >
          編成から外す
        </button>
      </div>
    </section>
  )
}

export interface CollectionScreenProps {
  readonly playerData: PlayerData
  readonly catalog: PlayerDataContentCatalog
  readonly learningState: GenericSkillLearningState
  readonly genericSkillCosts: Readonly<Record<string, number>>
  readonly onPlayerDataChange: (next: PlayerData) => void
  readonly onLearningStateChange: (next: GenericSkillLearningState) => void
  readonly onStartBattle: (formationId: string) => void
}

export function CollectionScreen({
  playerData,
  catalog,
  learningState,
  genericSkillCosts,
  onPlayerDataChange,
  onLearningStateChange,
  onStartBattle,
}: CollectionScreenProps) {
  const [tab, setTab] = useState<CollectionTab>('FORMATION')
  const [selectedInstanceId, setSelectedInstanceId] = useState(
    playerData.collection.unitInstances[0]?.instanceId ?? null,
  )
  const [selectedSpeciesId, setSelectedSpeciesId] = useState(
    playerData.collection.speciesStates[0]?.speciesId ?? null,
  )
  const [notice, setNotice] = useState<string | null>(null)

  const activeFormationId =
    playerData.formations.activeFormationId ?? playerData.formations.formations[0]?.formationId ?? null
  const activeFormation =
    activeFormationId === null
      ? null
      : playerData.formations.formations.find(
          (formation) => formation.formationId === activeFormationId,
        ) ?? null
  const selectedInstance =
    playerData.collection.unitInstances.find(
      (instance) => instance.instanceId === selectedInstanceId,
    ) ?? null
  const selectedMember =
    activeFormation?.members.find((member) => member.instanceId === selectedInstanceId) ?? null

  const genericSkills = useMemo(
    () => catalog.skills.filter((skill) => skill.slotType === 'GENERIC'),
    [catalog.skills],
  )

  const applyPlayerChange = (operation: () => PlayerData, success: string) => {
    try {
      onPlayerDataChange(operation())
      setNotice(success)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '操作に失敗しました。')
    }
  }

  const savePreset = () => {
    if (activeFormation === null) {
      return
    }
    let index = playerData.formations.formations.length + 1
    let formationId = `formation.preset-${index}`
    while (playerData.formations.formations.some((formation) => formation.formationId === formationId)) {
      index += 1
      formationId = `formation.preset-${index}`
    }
    applyPlayerChange(
      () =>
        saveFormationPreset(
          playerData,
          activeFormation.formationId,
          formationId,
          `編成プリセット ${index}`,
          catalog,
        ),
      '現在の編成を新しいプリセットとして保存しました。',
    )
  }

  const learnSkill = (skill: SkillDefinition) => {
    if (selectedInstance === null) {
      return
    }
    const cost = genericSkillCosts[skill.id]
    if (cost === undefined) {
      setNotice('この技には習得コストが設定されていません。')
      return
    }
    try {
      const result = learnGenericSkill(
        playerData,
        learningState,
        selectedInstance.instanceId,
        skill.id,
        cost,
        catalog,
      )
      onPlayerDataChange(result.playerData)
      onLearningStateChange(result.learningState)
      setNotice(`${displayName(skill.id)}を習得しました。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '習得に失敗しました。')
    }
  }

  const selectedSpeciesState =
    playerData.collection.speciesStates.find((state) => state.speciesId === selectedSpeciesId) ??
    null
  const selectedSpecies =
    selectedSpeciesState === null
      ? null
      : catalog.species.find((species) => species.id === selectedSpeciesState.speciesId) ?? null

  return (
    <main className="collection-app">
      <header className="collection-header">
        <div>
          <p className="eyebrow">COLLECTION & FORMATION</p>
          <h1>Monster Research Tactics</h1>
          <p>所持個体、編成ごとの装備・AI、技習得、図鑑情報を同じPlayerDataから編集します。</p>
        </div>
        <dl className="collection-header__metrics">
          <div><dt>所持個体</dt><dd>{playerData.collection.unitInstances.length}</dd></div>
          <div><dt>編成</dt><dd>{playerData.formations.formations.length}</dd></div>
          <div><dt>開示種</dt><dd>{playerData.collection.speciesStates.filter((state) => encyclopediaStage(state.encyclopediaStageId) > 0).length}</dd></div>
        </dl>
      </header>

      <nav className="collection-tabs" aria-label="コレクション画面">
        {(Object.keys(TAB_LABELS) as CollectionTab[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className="collection-tab"
            aria-pressed={tab === candidate}
            onClick={() => setTab(candidate)}
          >
            {TAB_LABELS[candidate]}
          </button>
        ))}
      </nav>

      {notice !== null && <p className="collection-notice" role="status">{notice}</p>}

      {tab === 'FORMATION' && activeFormation !== null && activeFormationId !== null && (
        <div className="formation-layout">
          <section className="collection-panel formation-board-panel" aria-labelledby="formation-title">
            <div className="collection-section-heading">
              <div>
                <p className="panel-heading__kicker">FORMATION PRESET</p>
                <h2 id="formation-title">3×3 編成編集</h2>
              </div>
              <div className="formation-toolbar">
                <label>
                  編成
                  <select
                    value={activeFormationId}
                    onChange={(event) =>
                      applyPlayerChange(
                        () => setActiveFormation(playerData, event.target.value, catalog),
                        '使用する編成を切り替えました。',
                      )
                    }
                  >
                    {playerData.formations.formations.map((formation) => (
                      <option key={formation.formationId} value={formation.formationId}>
                        {formation.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="collection-button" onClick={savePreset}>
                  プリセット保存
                </button>
              </div>
            </div>

            <p className="formation-help">個体を選択して空きマスを押すと配置・移動します。占有マスへ置くと既存個体と交代します。</p>
            <div className="formation-board" aria-label="味方3×3編成盤面">
              {LOCAL_ROWS.flatMap((row) =>
                COLUMNS.map((column) => {
                  const member = activeFormation.members.find(
                    (candidate) =>
                      candidate.position.row === row && candidate.position.column === column,
                  )
                  const instance =
                    member === undefined
                      ? null
                      : playerData.collection.unitInstances.find(
                          (candidate) => candidate.instanceId === member.instanceId,
                        ) ?? null
                  return (
                    <button
                      key={`${row}:${column}`}
                      type="button"
                      className={`formation-cell${member !== undefined ? ' formation-cell--occupied' : ''}${member?.instanceId === selectedInstanceId ? ' formation-cell--selected' : ''}`}
                      aria-label={`${['前列', '中列', '後列'][row]} ${['A', 'B', 'C'][column]}${instance === null ? ' 空き' : ` ${instance.nickname ?? instance.instanceId}`}`}
                      onClick={() => {
                        if (selectedInstanceId === null) {
                          if (member !== undefined) setSelectedInstanceId(member.instanceId)
                          return
                        }
                        applyPlayerChange(
                          () =>
                            placeFormationMember(
                              playerData,
                              activeFormationId,
                              selectedInstanceId,
                              { row, column },
                              catalog,
                            ),
                          '配置を更新しました。',
                        )
                      }}
                    >
                      <span>{['前列', '中列', '後列'][row]} {['A', 'B', 'C'][column]}</span>
                      <strong>{instance === null ? '空き' : instance.nickname ?? displayName(instance.speciesId)}</strong>
                      {member !== undefined && <small>優先 {member.tiePriority}</small>}
                    </button>
                  )
                }),
              )}
            </div>

            <div className="formation-start-row">
              <span>{activeFormation.members.length}/9体を配置中</span>
              <button
                type="button"
                className="collection-button collection-button--primary"
                disabled={activeFormation.members.length === 0}
                onClick={() => onStartBattle(activeFormationId)}
              >
                この編成で戦闘開始
              </button>
            </div>
          </section>

          <aside className="collection-panel roster-panel" aria-labelledby="roster-title">
            <div className="collection-section-heading">
              <div>
                <p className="panel-heading__kicker">OWNED UNITS</p>
                <h2 id="roster-title">所持個体</h2>
              </div>
            </div>
            <div className="roster-list">
              {playerData.collection.unitInstances.map((instance) => (
                <RosterCard
                  key={instance.instanceId}
                  instance={instance}
                  species={speciesForInstance(instance, catalog)}
                  member={activeFormation.members.find((member) => member.instanceId === instance.instanceId) ?? null}
                  selected={selectedInstanceId === instance.instanceId}
                  onSelect={() => setSelectedInstanceId(instance.instanceId)}
                />
              ))}
            </div>
          </aside>

          {selectedInstance !== null && selectedMember !== null && (
            <FormationMemberEditor
              playerData={playerData}
              catalog={catalog}
              formationId={activeFormationId}
              instance={selectedInstance}
              member={selectedMember}
              onChange={(next) => {
                onPlayerDataChange(next)
                setNotice('個体設定を更新しました。')
              }}
            />
          )}
        </div>
      )}

      {tab === 'LEARNING' && (
        <div className="learning-layout">
          <aside className="collection-panel roster-panel">
            <div className="collection-section-heading">
              <div>
                <p className="panel-heading__kicker">LEARNING TARGET</p>
                <h2>習得する個体</h2>
              </div>
            </div>
            <div className="roster-list">
              {playerData.collection.unitInstances.map((instance) => (
                <RosterCard
                  key={instance.instanceId}
                  instance={instance}
                  species={speciesForInstance(instance, catalog)}
                  member={null}
                  selected={selectedInstanceId === instance.instanceId}
                  onSelect={() => setSelectedInstanceId(instance.instanceId)}
                />
              ))}
            </div>
          </aside>

          <section className="collection-panel learning-panel" aria-labelledby="learning-title">
            <div className="collection-section-heading">
              <div>
                <p className="panel-heading__kicker">GENERIC SKILL TRAINING</p>
                <h2 id="learning-title">汎用技習得</h2>
              </div>
              <strong className="learning-currency">
                訓練通貨 {selectedInstance === null ? 0 : getGenericSkillLearningBalance(learningState, selectedInstance.instanceId)}
              </strong>
            </div>
            <p className="formation-help">汎用技は個体ごとに習得し、一度習得すれば失いません。T034で正式な基本通貨へ接続します。</p>
            <div className="skill-learning-grid">
              {genericSkills.map((skill) => {
                const learned = selectedInstance?.learnedGenericSkillIds.includes(skill.id) ?? false
                const cost = genericSkillCosts[skill.id]
                return (
                  <article key={skill.id} className="skill-learning-card">
                    <div>
                      <span className="skill-slot-badge">GENERIC</span>
                      <h3>{displayName(skill.id)}</h3>
                      <p>コスト {skill.actionCost} / 威力 {skill.damageMultiplierPermille}</p>
                    </div>
                    <strong>{learned ? '習得済み' : `習得費 ${cost ?? '—'}`}</strong>
                    <button
                      type="button"
                      className="collection-button"
                      disabled={selectedInstance === null || learned || cost === undefined}
                      onClick={() => learnSkill(skill)}
                    >
                      {learned ? '習得済み' : 'この個体が習得'}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {tab === 'ENCYCLOPEDIA' && (
        <div className="encyclopedia-layout">
          <section className="collection-panel encyclopedia-grid-panel" aria-labelledby="encyclopedia-title">
            <div className="collection-section-heading">
              <div>
                <p className="panel-heading__kicker">SPECIES ENCYCLOPEDIA</p>
                <h2 id="encyclopedia-title">図鑑</h2>
              </div>
              <span>開示段階はT035で研究網と接続</span>
            </div>
            <div className="encyclopedia-grid">
              {playerData.collection.speciesStates.map((state) => {
                const species = catalog.species.find((candidate) => candidate.id === state.speciesId)
                if (species === undefined) return null
                const stage = encyclopediaStage(state.encyclopediaStageId)
                return (
                  <button
                    key={state.speciesId}
                    type="button"
                    className={`encyclopedia-card${selectedSpeciesId === state.speciesId ? ' encyclopedia-card--selected' : ''}`}
                    aria-pressed={selectedSpeciesId === state.speciesId}
                    onClick={() => setSelectedSpeciesId(state.speciesId)}
                  >
                    <MonsterIcon species={species} concealed={stage < 2} />
                    <strong>{stage < 2 ? '???' : displayName(species.id)}</strong>
                    <span>開示 {stage}/5</span>
                    <small>解析 {basisPointsLabel(state.analysisBasisPoints)}</small>
                  </button>
                )
              })}
            </div>
          </section>

          {selectedSpecies !== null && selectedSpeciesState !== null && (
            <aside className="collection-panel species-detail" aria-labelledby="species-detail-title">
              <MonsterIcon
                species={selectedSpecies}
                concealed={encyclopediaStage(selectedSpeciesState.encyclopediaStageId) < 2}
              />
              <div>
                <p className="panel-heading__kicker">SPECIES DETAIL</p>
                <h2 id="species-detail-title">
                  {encyclopediaStage(selectedSpeciesState.encyclopediaStageId) < 2
                    ? '未解析種'
                    : displayName(selectedSpecies.id)}
                </h2>
              </div>
              <dl className="species-detail__facts">
                <div><dt>開示段階</dt><dd>{encyclopediaStage(selectedSpeciesState.encyclopediaStageId)}/5</dd></div>
                <div><dt>解析度</dt><dd>{basisPointsLabel(selectedSpeciesState.analysisBasisPoints)}</dd></div>
                <div><dt>設計図</dt><dd>{selectedSpeciesState.blueprintUnlocked ? '解放済み' : '未解放'}</dd></div>
                <div><dt>所持数</dt><dd>{playerData.collection.unitInstances.filter((instance) => instance.speciesId === selectedSpecies.id).length}</dd></div>
                {encyclopediaStage(selectedSpeciesState.encyclopediaStageId) >= 2 && (
                  <>
                    <div><dt>属性</dt><dd>{displayName(selectedSpecies.attributeId)}</dd></div>
                    <div><dt>レア度</dt><dd>R{selectedSpecies.rarity}</dd></div>
                  </>
                )}
                {encyclopediaStage(selectedSpeciesState.encyclopediaStageId) >= 3 && (
                  <>
                    <div><dt>HP</dt><dd>{selectedSpecies.stats.hp}</dd></div>
                    <div><dt>Attack</dt><dd>{selectedSpecies.stats.attack}</dd></div>
                    <div><dt>Defense</dt><dd>{selectedSpecies.stats.defense}</dd></div>
                    <div><dt>Speed</dt><dd>{selectedSpecies.stats.speed}</dd></div>
                  </>
                )}
              </dl>
              {encyclopediaStage(selectedSpeciesState.encyclopediaStageId) >= 4 && (
                <section className="species-detail__skills">
                  <h3>技情報</h3>
                  <p>固有: {displayName(selectedSpecies.innateSkillId)}</p>
                  <p>
                    開花: {selectedSpeciesState.bloomSkillIds.length === 0
                      ? '未解放'
                      : selectedSpeciesState.bloomSkillIds.map(displayName).join(' / ')}
                  </p>
                </section>
              )}
              {encyclopediaStage(selectedSpeciesState.encyclopediaStageId) >= 5 && (
                <section className="species-detail__statistics">
                  <h3>観測統計</h3>
                  {Object.entries(selectedSpeciesState.statistics).map(([key, value]) => (
                    <p key={key}><span>{displayName(key)}</span><strong>{value}</strong></p>
                  ))}
                </section>
              )}
            </aside>
          )}
        </div>
      )}
    </main>
  )
}
