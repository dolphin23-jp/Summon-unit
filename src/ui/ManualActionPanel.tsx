import { resolveSkillName } from '../content/display-masters'
import { useMemo } from 'react'
import type {
  InteractiveManualActionOption,
  InteractivePendingManualAction,
} from '../battle/headless-battle-runner'
import type { ManualActionCategory } from '../battle/manual-action-preview'

function battleUnitLabel(id: string): string {
  const match = id.match(/(?:[.:-])(\d+)$/)
  const ordinal = match === null ? null : Number(match[1])
  const side = id.startsWith('enemy.') || id.startsWith('ENEMY:') ? '敵' : '味方'
  return ordinal === null || !Number.isSafeInteger(ordinal)
    ? `${side}ユニット`
    : `${side}ユニット #${Math.max(1, ordinal)}`
}

function positionLabel(id: string | null): string {
  if (id === null) return 'なし'
  const match = id.match(/^(ALLY|ENEMY)[:.]([0-2])[:.]([0-2])$/)
  if (match === null) return '指定マス'
  const side = match[1] === 'ALLY' ? '味方側' : '敵側'
  const rows = ['前列', '中列', '後列'] as const
  const columns = ['A', 'B', 'C'] as const
  return `${side}${rows[Number(match[2])]}${columns[Number(match[3])]}`
}

export function getManualActionKey(option: InteractiveManualActionOption): string {
  return option.kind === 'USE_SKILL' ? `skill:${option.skillId ?? option.candidateId}` : option.kind
}

function categoryLabel(category: ManualActionCategory): string {
  switch (category) {
    case 'INNATE':
      return '固有技'
    case 'GENERIC':
      return '汎用技'
    case 'BLOOM':
      return '開花技'
    case 'MOVE':
      return '移動'
    case 'WAIT':
      return '待機'
  }
}

function damageRoleLabel(
  role: InteractiveManualActionOption['preview']['damageResults'][number]['role'],
): string {
  if (role === 'PRIMARY') {
    return '主対象'
  }
  if (role === 'GUARD') {
    return '肩代わり'
  }
  return '範囲'
}

function ManualActionPreviewPanel({
  option,
  onConfirm,
}: {
  readonly option: InteractiveManualActionOption
  readonly onConfirm: () => void
}) {
  const preview = option.preview
  const hasArea = preview.affectedPositionIds.length > 1

  return (
    <section className="manual-preview" aria-labelledby="manual-preview-title">
      <div className="manual-preview__heading">
        <div>
          <p className="panel-heading__kicker">CONFIRMATION PREVIEW</p>
          <h3 id="manual-preview-title">確定前プレビュー</h3>
        </div>
        <span className="manual-preview__selection">
          {option.label} → {option.targetLabel}
        </span>
      </div>

      <dl className="manual-preview__metrics">
        <div>
          <dt>行動コスト</dt>
          <dd>{preview.actionCost}</dd>
        </div>
        <div>
          <dt>次回時刻</dt>
          <dd>t={preview.nextActionTime}</dd>
        </div>
        <div>
          <dt>次回順位</dt>
          <dd>{preview.nextActionRank}番目</dd>
        </div>
        <div>
          <dt>移動後</dt>
          <dd>{positionLabel(preview.toPositionId)}</dd>
        </div>
      </dl>

      <div className="manual-preview__facts">
        <p>
          <strong>対象:</strong>{' '}
          {preview.selectedTargetBattleUnitId !== null
            ? battleUnitLabel(preview.selectedTargetBattleUnitId)
            : positionLabel(preview.selectedTargetPositionId)}
          {preview.actualTargetBattleUnitId !== null &&
            preview.actualTargetBattleUnitId !== preview.selectedTargetBattleUnitId && (
              <> → 実対象 {battleUnitLabel(preview.actualTargetBattleUnitId)}</>
            )}
        </p>
        <p>
          <strong>遮蔽:</strong>{' '}
          {preview.blockedByBattleUnitId === null
            ? '停止なし'
            : `${battleUnitLabel(preview.blockedByBattleUnitId)} で停止`}
        </p>
        <p>
          <strong>{hasArea ? 'AoE範囲' : '影響マス'}:</strong>{' '}
          {preview.affectedPositionIds.length === 0
            ? 'なし'
            : preview.affectedPositionIds.map(positionLabel).join(' / ')}
        </p>
      </div>

      <div className="manual-preview__resolution-grid">
        <section>
          <h4>ダメージ・撃破</h4>
          {preview.damageResults.length === 0 ? (
            <p className="panel-empty">HP・障壁への変化はありません。</p>
          ) : (
            <div className="manual-damage-list">
              {preview.damageResults.map((result, index) => (
                <article
                  key={`${result.battleUnitId}:${result.role}:${index}`}
                  className={`manual-damage manual-damage--${result.role.toLowerCase()}`}
                >
                  <div className="manual-damage__title">
                    <strong>{battleUnitLabel(result.battleUnitId)}</strong>
                    <span>{damageRoleLabel(result.role)}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>計算値</dt>
                      <dd>{result.calculatedDamage}</dd>
                    </div>
                    <div>
                      <dt>障壁</dt>
                      <dd>
                        {result.barrierBefore} → {result.barrierAfter}
                      </dd>
                    </div>
                    <div>
                      <dt>HP</dt>
                      <dd>
                        {result.hpBefore} → {result.hpAfter}
                      </dd>
                    </div>
                    <div>
                      <dt>結果</dt>
                      <dd>{result.defeated ? '撃破' : `HP-${result.hpDamage}`}</dd>
                    </div>
                  </dl>
                  {result.guardedForBattleUnitId !== null && (
                    <small>{battleUnitLabel(result.guardedForBattleUnitId)} の肩代わり</small>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h4>状態・強制移動</h4>
          <p className="manual-preview__secondary">
            状態:{' '}
            {preview.statusChanges.length === 0 ? '変化なし' : preview.statusChanges.join(' / ')}
          </p>
          <p className="manual-preview__secondary">
            強制移動:{' '}
            {preview.forcedMovements.length === 0
              ? 'なし'
              : preview.forcedMovements
                  .map(
                    (movement) =>
                      `${battleUnitLabel(movement.targetBattleUnitId)}: ${positionLabel(movement.fromPositionId)} → ${movement.toPositionId === null ? (movement.failureReason ?? '失敗') : positionLabel(movement.toPositionId)}`,
                  )
                  .join(' / ')}
          </p>
        </section>
      </div>

      <div className="manual-preview__confirm-row">
        <p>この表示は戦闘カーネルと同じ障壁・肩代わり・行動順計算を使用します。</p>
        <button
          type="button"
          className="control-button control-button--confirm"
          onClick={onConfirm}
        >
          この行動を確定
        </button>
      </div>
    </section>
  )
}

export function ManualActionPanel({
  pending,
  selectedActionKey,
  selectedCandidateId,
  onSelectAction,
  onSelectCandidate,
  onConfirm,
}: {
  readonly pending: InteractivePendingManualAction
  readonly selectedActionKey: string | null
  readonly selectedCandidateId: string | null
  readonly onSelectAction: (option: InteractiveManualActionOption) => void
  readonly onSelectCandidate: (candidateId: string) => void
  readonly onConfirm: () => void
}) {
  const actionChoices = useMemo(() => {
    const seen = new Set<string>()
    return pending.options.filter((option) => {
      const key = getManualActionKey(option)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }, [pending])

  const targetOptions = useMemo(
    () =>
      pending.options.filter(
        (option) => selectedActionKey !== null && getManualActionKey(option) === selectedActionKey,
      ),
    [pending, selectedActionKey],
  )
  const previewOption =
    pending.options.find((option) => option.candidateId === selectedCandidateId) ?? null

  return (
    <section className="manual-panel" aria-labelledby="manual-action-title">
      <div className="panel-heading">
        <div>
          <p className="panel-heading__kicker">MANUAL INTERRUPT</p>
          <h2 id="manual-action-title">{battleUnitLabel(pending.actorBattleUnitId)} の行動</h2>
        </div>
        <span className="manual-panel__hint">
          選択だけでは実行されません。最後に確定してください。
        </span>
      </div>

      <div className="manual-step">
        <h3>
          <span>1</span> 行動を選択
        </h3>
        <div className="manual-options">
          {actionChoices.map((option) => (
            <button
              key={getManualActionKey(option)}
              type="button"
              className={`control-button${selectedActionKey === getManualActionKey(option) ? ' control-button--previewing' : ''}`}
              aria-pressed={selectedActionKey === getManualActionKey(option)}
              onClick={() => onSelectAction(option)}
            >
              <small>{categoryLabel(option.category)}</small>
              {option.skillId === null ? option.label : resolveSkillName(option.skillId)}
            </button>
          ))}
        </div>
      </div>

      <div className="manual-step">
        <h3>
          <span>2</span> 対象・移動先を指定
        </h3>
        <div className="manual-options">
          {targetOptions.map((option) => (
            <button
              key={option.candidateId}
              type="button"
              className={`control-button${selectedCandidateId === option.candidateId ? ' control-button--previewing' : ''}`}
              aria-pressed={selectedCandidateId === option.candidateId}
              onPointerEnter={() => onSelectCandidate(option.candidateId)}
              onFocus={() => onSelectCandidate(option.candidateId)}
              onClick={() => onSelectCandidate(option.candidateId)}
            >
              {option.targetLabel}
              {option.recommended ? '（AI推奨）' : ''}
            </button>
          ))}
        </div>
      </div>

      {previewOption !== null && (
        <ManualActionPreviewPanel option={previewOption} onConfirm={onConfirm} />
      )}

      {pending.reasonLog !== null && (
        <p className="manual-panel__reason">AI参考: {pending.reasonLog.oneLine}</p>
      )}
    </section>
  )
}
