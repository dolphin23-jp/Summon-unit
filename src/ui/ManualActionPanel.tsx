import type {
  InteractiveManualActionOption,
  InteractivePendingManualAction,
} from '../battle/headless-battle-runner'

function slotLabel(slot: InteractiveManualActionOption['slot']): string {
  switch (slot) {
    case 'INNATE':
      return '固有'
    case 'GENERIC':
      return '汎用'
    case 'BLOOM':
      return '開花'
    case 'MOVE':
      return '移動'
    case 'WAIT':
      return '待機'
  }
}

function statusLabel(kind: string): string {
  switch (kind) {
    case 'POISON':
      return '毒'
    case 'BURN':
      return '火傷'
    case 'MOVEMENT_LOCK':
      return '移動不能'
    case 'BLOOM_SEAL':
      return '開花封印'
    case 'HEALING_INHIBITION':
      return '回復阻害'
    default:
      return kind
  }
}

function resistanceLabel(stage: string): string {
  switch (stage) {
    case 'IMMUNE':
      return '無効'
    case 'STRONG':
      return '強耐性'
    case 'LIGHT':
      return '軽耐性'
    case 'WEAK':
      return '弱点'
    default:
      return '通常'
  }
}

function movementLabel(kind: string): string {
  switch (kind) {
    case 'PUSH':
      return '押し出し'
    case 'PULL':
      return '引き寄せ'
    case 'LATERAL_LEFT':
      return '左移動'
    case 'LATERAL_RIGHT':
      return '右移動'
    default:
      return kind
  }
}

function failureLabel(reason: string | null): string {
  if (reason === null) {
    return '成功'
  }
  switch (reason) {
    case 'OCCUPIED':
      return '移動先が占有'
    case 'OUT_OF_BOUNDS':
      return '盤外'
    case 'INVALID_ALIGNMENT':
      return '方向不成立'
    case 'CROSS_SIDE':
      return '陣営境界'
    case 'TARGET_DEFEATED':
      return '対象戦闘不能'
    case 'SOURCE_DEFEATED':
      return '使用者戦闘不能'
    case 'BATTLE_ENDED':
      return '戦闘終了'
    default:
      return reason
  }
}

function ManualPreview({ option }: { readonly option: InteractiveManualActionOption }) {
  const preview = option.preview
  return (
    <section className="manual-preview" aria-live="polite">
      <div className="manual-preview__headline">
        <div>
          <span>確定前プレビュー</span>
          <strong>{option.label}</strong>
        </div>
        <dl className="manual-preview__timing">
          <div><dt>コスト</dt><dd>{preview.actionCost}</dd></div>
          <div><dt>次回</dt><dd>t={preview.nextActionTime}</dd></div>
          <div><dt>予測順</dt><dd>{preview.nextTimelineRank === null ? '終了' : `#${preview.nextTimelineRank}`}</dd></div>
        </dl>
      </div>

      {preview.kind === 'USE_SKILL' && (
        <div className="manual-preview__rules">
          <span>到達 {preview.reachMethod}</span>
          <span>範囲 {preview.areaMask}</span>
          {preview.blockedByBattleUnitId !== null && (
            <strong>遮蔽停止: {preview.blockedByBattleUnitId}</strong>
          )}
          {preview.telegraphDelay !== null && <span>予兆 +{preview.telegraphDelay}</span>}
        </div>
      )}

      <div className="manual-preview__grid">
        <section>
          <h3>ダメージ・撃破</h3>
          {preview.damageRecipients.length === 0 ? (
            <p className="detail-empty">HPダメージなし</p>
          ) : (
            <ul className="preview-result-list">
              {preview.damageRecipients.map((recipient, index) => (
                <li key={`${recipient.battleUnitId}:${recipient.role}:${index}`}>
                  <span>
                    {recipient.battleUnitId}
                    {recipient.role === 'GUARD' ? `（${recipient.protectedBattleUnitId}を肩代わり）` : ''}
                  </span>
                  <strong>
                    HP {recipient.hpBefore}→{recipient.hpAfter}
                    {recipient.barrierAbsorbedDamage > 0 ? ` / 障壁-${recipient.barrierAbsorbedDamage}` : ''}
                    {recipient.defeated ? ' / 撃破' : ''}
                  </strong>
                </li>
              ))}
            </ul>
          )}
          {preview.totalCalculatedDamage > 0 && (
            <p className="preview-total">計算値 {preview.totalCalculatedDamage} / HP実損 {preview.totalHpDamage}</p>
          )}
        </section>

        <section>
          <h3>状態・位置</h3>
          {preview.statusChanges.length === 0 && preview.forcedMovements.length === 0 ? (
            <p className="detail-empty">追加変化なし</p>
          ) : (
            <ul className="preview-result-list">
              {preview.statusChanges.map((change, index) => (
                <li key={`${change.targetBattleUnitId}:${change.kind}:${index}`}>
                  <span>{change.targetBattleUnitId} / {statusLabel(change.kind)}</span>
                  <strong>{change.applied ? '付与' : '不成立'}・{resistanceLabel(change.resistanceStage)}</strong>
                </li>
              ))}
              {preview.forcedMovements.map((movement, index) => (
                <li key={`${movement.targetBattleUnitId}:${movement.kind}:${index}`}>
                  <span>{movement.targetBattleUnitId} / {movementLabel(movement.kind)}</span>
                  <strong>
                    {movement.success
                      ? `${movement.fromPositionId}→${movement.toPositionId}`
                      : failureLabel(movement.failureReason)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {preview.affectedPositionIds.length > 0 && (
        <p className="manual-preview__affected">
          対象マス: {preview.affectedPositionIds.join(' / ')}
        </p>
      )}
    </section>
  )
}

export function ManualActionPanel({
  pending,
  selectedCandidateId,
  onSelectedCandidateChange,
  onConfirm,
}: {
  readonly pending: InteractivePendingManualAction
  readonly selectedCandidateId: string | null
  readonly onSelectedCandidateChange: (candidateId: string) => void
  readonly onConfirm: (candidateId: string) => void
}) {
  const selected =
    pending.options.find((option) => option.candidateId === selectedCandidateId) ??
    pending.options.find((option) => option.candidateId === pending.recommendedCandidateId) ??
    pending.options[0] ??
    null
  const actions = pending.options.filter(
    (option, index, options) =>
      options.findIndex((candidate) => candidate.actionKey === option.actionKey) === index,
  )
  const targets =
    selected === null
      ? []
      : pending.options.filter((option) => option.actionKey === selected.actionKey)

  const selectAction = (actionKey: string) => {
    const options = pending.options.filter((option) => option.actionKey === actionKey)
    const next =
      options.find((option) => option.recommended) ?? options[0]
    if (next !== undefined) {
      onSelectedCandidateChange(next.candidateId)
    }
  }

  return (
    <section className="manual-panel" aria-labelledby="manual-action-title">
      <div className="panel-heading">
        <div>
          <p className="panel-heading__kicker">MANUAL COMMAND</p>
          <h2 id="manual-action-title">{pending.actorBattleUnitId} の行動</h2>
        </div>
        <span className="manual-panel__hint">行動と対象を選び、プレビュー確認後に確定</span>
      </div>

      <div className="manual-command-layout">
        <section>
          <h3>1. 行動</h3>
          <div className="manual-action-tabs">
            {actions.map((option) => (
              <button
                key={option.actionKey}
                type="button"
                className="manual-choice-button"
                aria-pressed={selected?.actionKey === option.actionKey}
                onClick={() => selectAction(option.actionKey)}
              >
                <span>{slotLabel(option.slot)}</span>
                <strong>{option.actionLabel}</strong>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>2. 対象・移動先</h3>
          <div className="manual-targets">
            {targets.map((option) => (
              <button
                key={option.candidateId}
                type="button"
                className="manual-target-button"
                aria-pressed={selected?.candidateId === option.candidateId}
                onClick={() => onSelectedCandidateChange(option.candidateId)}
              >
                {option.targetLabel ?? '対象指定なし'}
                {option.recommended ? <small>AI推奨</small> : null}
              </button>
            ))}
          </div>
        </section>
      </div>

      {selected !== null && <ManualPreview option={selected} />}

      <div className="manual-confirm-row">
        <p>{pending.reasonLog === null ? 'AI推奨なし' : `AI参考: ${pending.reasonLog.oneLine}`}</p>
        <button
          type="button"
          className="control-button control-button--primary manual-confirm-button"
          disabled={selected === null}
          onClick={() => selected !== null && onConfirm(selected.candidateId)}
        >
          この行動を確定
        </button>
      </div>
    </section>
  )
}
