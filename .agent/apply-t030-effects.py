from pathlib import Path
import shutil
import subprocess


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, got {count}: {old[:100]!r}')
    target.write_text(text.replace(old, new, 1))


shutil.copyfile('.agent/skill-effect-resolution.ts', 'src/battle/skill-effect-resolution.ts')
subprocess.run(
    [
        'git',
        'show',
        'origin/agent/t030-manual-preview-v2:src/content/skill-definition.ts',
    ],
    check=True,
    stdout=open('src/content/skill-definition.ts', 'w'),
)

# manual-action-preview.ts
replace_once(
    'src/battle/manual-action-preview.ts',
    "import type { MonsterSpecies } from '../content/monster-species'",
    """import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'""",
)
replace_once(
    'src/battle/manual-action-preview.ts',
    "import type { BattleState } from './defeat-and-victory'",
    """import {
  assertValidBattleState,
  resolveBattleUnitDefeat,
  type BattleState,
} from './defeat-and-victory'""",
)
replace_once(
    'src/battle/manual-action-preview.ts',
    "import { getModifiedBattleStatValue } from './stat-modifiers'",
    """import { resolveSkillEffects } from './skill-effect-resolution'
import { getModifiedBattleStatValue } from './stat-modifiers'""",
)
replace_once(
    'src/battle/manual-action-preview.ts',
    """  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly guardShares: readonly GuardShareState[]
""",
    """  readonly speciesById: Readonly<Record<string, MonsterSpecies>>
  readonly skillById: Readonly<Record<string, SkillDefinition>>
  readonly guardShares: readonly GuardShareState[]
  readonly applicationSequenceStart: number
""",
)
replace_once(
    'src/battle/manual-action-preview.ts',
    """function getRequiredUnit(
  unitsById: ReadonlyMap<BattleUnitId, BattleUnitState>,
  battleUnitId: BattleUnitId,
): BattleUnitState {
  const unit = unitsById.get(battleUnitId)
  if (unit === undefined) {
    throw new Error(`battle unit is missing: ${battleUnitId}`)
  }
  return unit
}
""",
    """function getRequiredUnit(
  battle: BattleState,
  battleUnitId: BattleUnitId,
): BattleUnitState {
  const unit = battle.units.find((candidate) => candidate.battleUnitId === battleUnitId)
  if (unit === undefined) {
    throw new Error(`battle unit is missing: ${battleUnitId}`)
  }
  return unit
}

function replaceLivingUnit(battle: BattleState, updatedUnit: BattleUnitState): BattleState {
  const nextBattle: BattleState = Object.freeze({
    ...battle,
    units: Object.freeze(
      battle.units.map((unit) =>
        unit.battleUnitId === updatedUnit.battleUnitId ? updatedUnit : unit,
      ),
    ),
  })
  assertValidBattleState(nextBattle)
  return nextBattle
}

function applyRecipientResolution(
  battle: BattleState,
  resolution: DamageRecipientResolution,
  killerBattleUnitId: BattleUnitId,
  currentTime: BattleTime,
): BattleState {
  return resolution.after.defeated
    ? resolveBattleUnitDefeat({
        battle,
        defeatedUnit: resolution.after,
        killerBattleUnitId,
        currentTime,
      })
    : replaceLivingUnit(battle, resolution.after)
}
""",
)
old_preview_damage = """function previewSkillDamage(
  input: CreateManualActionPreviewInput,
  preview: AiSkillActionResultPreview,
): readonly ManualDamagePreview[] {
  const unitsById = new Map(
    input.battle.units.map((unit) => [unit.battleUnitId, unit] as const),
  )
  const results: ManualDamagePreview[] = []

  for (const predicted of preview.targetResults) {
    const target = getRequiredUnit(unitsById, predicted.battleUnitId)
    if (target.defeated) {
      continue
    }
    const role: ManualDamagePreview['role'] =
      predicted.battleUnitId === preview.reach.actualTargetBattleUnitId
        ? 'PRIMARY'
        : 'AREA'
    if (predicted.calculatedDamage === 0) {
      results.push(zeroDamagePreview(target, role))
      continue
    }

    const targetSpecies = getRequiredSpecies(input.speciesById, target.speciesId)
    const guardShare = getGuardShareForProtectedUnit(
      input.guardShares,
      target.battleUnitId,
    )
    const guard =
      guardShare === null
        ? null
        : getRequiredUnit(unitsById, guardShare.guardBattleUnitId)
    const livingGuard =
      guardShare === null || guard === null || guard.defeated
        ? null
        : Object.freeze({
            unit: guard,
            species: getRequiredSpecies(input.speciesById, guard.speciesId),
            guardShare,
          })
    const mitigation = resolveBarrierGuardDamage({
      finalDamage: predicted.calculatedDamage,
      target,
      targetSpecies,
      guard: livingGuard,
    })

    results.push(freezeDamagePreview(mitigation.target, role, null))
    unitsById.set(target.battleUnitId, mitigation.target.after)
    if (mitigation.guardShare !== null) {
      results.push(
        freezeDamagePreview(
          mitigation.guardShare.guard,
          'GUARD',
          target.battleUnitId,
        ),
      )
      unitsById.set(
        mitigation.guardShare.guard.before.battleUnitId,
        mitigation.guardShare.guard.after,
      )
    }
  }

  return Object.freeze(results)
}
"""
new_preview_damage = """function previewSkillDamage(
  input: CreateManualActionPreviewInput,
  preview: AiSkillActionResultPreview,
): {
  readonly battle: BattleState
  readonly results: readonly ManualDamagePreview[]
} {
  let battle = input.battle
  const results: ManualDamagePreview[] = []

  for (const predicted of preview.targetResults) {
    if (battle.outcome !== 'ONGOING') {
      break
    }
    const target = getRequiredUnit(battle, predicted.battleUnitId)
    if (target.defeated) {
      continue
    }
    const role: ManualDamagePreview['role'] =
      predicted.battleUnitId === preview.reach.actualTargetBattleUnitId
        ? 'PRIMARY'
        : 'AREA'
    if (predicted.calculatedDamage === 0) {
      results.push(zeroDamagePreview(target, role))
      continue
    }

    const targetSpecies = getRequiredSpecies(input.speciesById, target.speciesId)
    const guardShare = getGuardShareForProtectedUnit(
      input.guardShares,
      target.battleUnitId,
    )
    const guard =
      guardShare === null
        ? null
        : getRequiredUnit(battle, guardShare.guardBattleUnitId)
    const livingGuard =
      guardShare === null || guard === null || guard.defeated
        ? null
        : Object.freeze({
            unit: guard,
            species: getRequiredSpecies(input.speciesById, guard.speciesId),
            guardShare,
          })
    const mitigation = resolveBarrierGuardDamage({
      finalDamage: predicted.calculatedDamage,
      target,
      targetSpecies,
      guard: livingGuard,
    })

    results.push(freezeDamagePreview(mitigation.target, role, null))
    battle = applyRecipientResolution(
      battle,
      mitigation.target,
      input.actor.battleUnitId,
      input.currentTime,
    )
    if (mitigation.guardShare !== null && battle.outcome === 'ONGOING') {
      results.push(
        freezeDamagePreview(
          mitigation.guardShare.guard,
          'GUARD',
          target.battleUnitId,
        ),
      )
      battle = applyRecipientResolution(
        battle,
        mitigation.guardShare.guard,
        input.actor.battleUnitId,
        input.currentTime,
      )
    }
  }

  return Object.freeze({ battle, results: Object.freeze(results) })
}
"""
replace_once('src/battle/manual-action-preview.ts', old_preview_damage, new_preview_damage)
replace_once(
    'src/battle/manual-action-preview.ts',
    """  const candidate = input.evaluation.preview.candidate
  return Object.freeze({
""",
    """  const candidate = input.evaluation.preview.candidate
  const damage = previewSkillDamage(input, input.evaluation.preview)
  const skill = input.skillById[candidate.skillId]
  if (skill === undefined) {
    throw new Error(`skill master is missing: ${candidate.skillId}`)
  }
  const effects = resolveSkillEffects({
    battle: damage.battle,
    actorBattleUnitId: input.actor.battleUnitId,
    targetBattleUnitIds: input.evaluation.preview.targetResults.map(
      (target) => target.battleUnitId,
    ),
    skill,
    speciesById: input.speciesById,
    currentTime: input.currentTime,
    applicationSequenceStart: input.applicationSequenceStart,
  })
  return Object.freeze({
""",
)
replace_once(
    'src/battle/manual-action-preview.ts',
    """    nextActionRank: getNextActionRank(
      input.battle,
      schedule,
      input.nextTimelineSequence,
    ),
    fromPositionId,
    toPositionId: fromPositionId,
""",
    """    nextActionRank: getNextActionRank(
      effects.battle,
      schedule,
      input.nextTimelineSequence,
    ),
    fromPositionId,
    toPositionId: fromPositionId,
""",
)
replace_once(
    'src/battle/manual-action-preview.ts',
    """    damageResults: previewSkillDamage(input, input.evaluation.preview),
    statusChanges: Object.freeze([]),
    forcedMovements: Object.freeze([]),
""",
    """    damageResults: damage.results,
    statusChanges: Object.freeze(
      effects.statusChanges.map(
        (change) =>
          `${change.targetBattleUnitId}: ${change.kind} ${
            change.applied ? '付与' : `無効(${change.resistanceStage})`
          }`,
      ),
    ),
    forcedMovements: Object.freeze(
      effects.forcedMovements.map((movement) =>
        Object.freeze({
          targetBattleUnitId: movement.targetBattleUnitId,
          fromPositionId: movement.fromPositionId,
          toPositionId: movement.toPositionId,
          success: movement.success,
          failureReason: movement.failureReason,
        }),
      ),
    ),
""",
)

# interactive-battle-runner.ts
replace_once(
    'src/battle/interactive-battle-runner.ts',
    "import { getModifiedBattleStatValue } from './stat-modifiers'",
    """import { resolveSkillEffects } from './skill-effect-resolution'
import { getModifiedBattleStatValue } from './stat-modifiers'""",
)
replace_once(
    'src/battle/interactive-battle-runner.ts',
    """  for (const defeatRecord of nextBattle.defeatRecords.slice(defeatCountBefore)) {
""",
    """  const effects = resolveSkillEffects({
    battle: nextBattle,
    actorBattleUnitId: actor.battleUnitId,
    targetBattleUnitIds: preview.targetResults.map((target) => target.battleUnitId),
    skill,
    speciesById: context.speciesById,
    currentTime,
    applicationSequenceStart: log.events.length,
  })
  nextBattle = effects.battle
  for (const mutation of effects.effectMutations) {
    nextLog = recordActiveEffectMutation(nextLog, mutation, currentTime)
  }
  for (const movement of effects.movementResults) {
    if (movement.success && movement.to !== null) {
      nextLog = recordUnitMoved(nextLog, {
        virtualTime: currentTime,
        battleUnitId: movement.targetBattleUnitId,
        from: movement.from,
        to: movement.to,
      })
    }
  }

  for (const defeatRecord of nextBattle.defeatRecords.slice(defeatCountBefore)) {
""",
)
replace_once(
    'src/battle/interactive-battle-runner.ts',
    """  nextTimelineSequence: number,
): InteractivePendingManualAction {
""",
    """  nextTimelineSequence: number,
  applicationSequenceStart: number,
): InteractivePendingManualAction {
""",
)
replace_once(
    'src/battle/interactive-battle-runner.ts',
    """        speciesById: context.speciesById,
        guardShares: context.guardShares,
""",
    """        speciesById: context.speciesById,
        skillById: context.skillById,
        guardShares: context.guardShares,
        applicationSequenceStart,
""",
)
replace_once(
    'src/battle/interactive-battle-runner.ts',
    """              this.context,
              this.nextTimelineSequence,
            ),
""",
    """              this.context,
              this.nextTimelineSequence,
              this.log.events.length,
            ),
""",
)

# demo effect data
replace_once(
    'src/demo/standard-headless-battle.ts',
    """    damageMultiplierPermille: 850,
  }),
""",
    """    damageMultiplierPermille: 850,
    effects: Object.freeze([
      Object.freeze({
        kind: 'POISON' as const,
        damagePerStack: 4,
        stacks: 2,
        triggerCount: 3,
      }),
    ]),
  }),
""",
)
replace_once(
    'src/demo/standard-headless-battle.ts',
    """    damageMultiplierPermille: 1800,
  }),
""",
    """    damageMultiplierPermille: 1800,
    effects: Object.freeze([
      Object.freeze({
        kind: 'FORCED_MOVEMENT' as const,
        movementKind: 'PUSH' as const,
      }),
    ]),
  }),
""",
)

# tests
replace_once(
    'src/battle/manual-action-preview.test.ts',
    "import { getTotalBarrierCapacity } from './barrier'",
    """import { getTotalBarrierCapacity } from './barrier'
import { getBoardPositionId } from './board'""",
)
replace_once(
    'src/battle/manual-action-preview.test.ts',
    """  it('previews barrier absorption and guard sharing with the same results used by commit', () => {
""",
    """  it('previews and commits status effects and forced movement', () => {
    const poisonRun = advanceToManual()
    const poison = poisonRun.snapshot.pendingManualAction?.options.find(
      (candidate) =>
        candidate.skillId === 'skill.demo-generic' &&
        candidate.preview.statusChanges.length > 0,
    )
    if (poison === undefined) {
      throw new Error('poison preview is missing')
    }
    const poisonTarget = poison.preview.selectedTargetBattleUnitId
    if (poisonTarget === null) {
      throw new Error('poison target is missing')
    }
    const poisonAfter = poisonRun.runner.submitManualAction(poison.candidateId)
    expect(
      poisonAfter.battle.units
        .find((unit) => unit.battleUnitId === poisonTarget)
        ?.effects.some((effect) => effect.effectId === 'effect.status.poison'),
    ).toBe(true)

    const movementRun = advanceToManual()
    const movement = movementRun.snapshot.pendingManualAction?.options.find(
      (candidate) =>
        candidate.skillId === 'skill.demo-bloom' &&
        candidate.preview.forcedMovements.some((result) => result.success),
    )
    if (movement === undefined) {
      throw new Error('forced movement preview is missing')
    }
    const movementPreview = movement.preview.forcedMovements.find(
      (result) => result.success,
    )
    if (movementPreview?.toPositionId === null || movementPreview === undefined) {
      throw new Error('successful forced movement destination is missing')
    }
    const movementAfter = movementRun.runner.submitManualAction(movement.candidateId)
    const movedUnit = movementAfter.battle.units.find(
      (unit) => unit.battleUnitId === movementPreview.targetBattleUnitId,
    )
    expect(movedUnit === undefined ? null : getBoardPositionId(movedUnit.position)).toBe(
      movementPreview.toPositionId,
    )
  })

  it('previews barrier absorption and guard sharing with the same results used by commit', () => {
""",
)

# docs
Path('tasks/T030_MANUAL_ACTION_PREVIEW.md').write_text("""# T030 — 手動操作・確定前プレビュー

## 目的

T028の手動割込とT029の戦闘画面を、行動・対象を選択してから同じ戦闘解決結果を確認し、明示的に確定できる操作へ完成させる。

## 実装範囲

- [x] 固有技 / 汎用技 / 開花技 / 移動 / 待機を独立表示
- [x] 同一技の複数対象・移動先候補から対象を指定
- [x] 確定前プレビューを表示してから明示的に実行
- [x] ダメージ、撃破、障壁、肩代わり、遮蔽、AoE対象マスを表示
- [x] 状態付与と強制移動を実際の技データ・解決器へ接続
- [x] 行動コスト、次回時刻、次回タイムライン順位を表示
- [x] プレビュー表示中に盤面・タイムラインへ仮状態を表示
- [x] AUTO_DISABLED技をAUTOから除外しつつ手動候補へ残す
- [x] プレビューと確定後状態の一致を回帰テスト

## 仕様上の判断

- 手動候補はAIポリシー適用前の合法候補から作る。
- 標準ヘッドレス戦闘は従来の4技構成を維持し、追加手動技は `STANDARD_INTERACTIVE_BATTLE` にだけ装備する。
- プレビューは障壁・肩代わり・状態耐性・強制移動・行動順の実解決関数を使用し、状態を変更しない。
- 技効果は `SkillDefinition.effects` に記述し、プレビューと確定処理が同じ純粋解決器を共有する。
- 状態付与は毒・火傷・移動不能・開花封印・回復阻害、強制移動はPUSH/PULL/左右移動を初期対応する。

## 検証

- `pnpm test`
- `pnpm demo:headless`
- `pnpm benchmark:ai`
- `pnpm lint`
- `pnpm build`
- 盤面セル選択とタッチ用対象ボタンが同じ候補を確定すること

## 次のタスク

T031「終了画面・モバイル・アクセシビリティ」
""")
