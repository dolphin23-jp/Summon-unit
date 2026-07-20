from __future__ import annotations

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    if new in content:
        return
    if old not in content:
        raise RuntimeError(f"expected block was not found in {path}")
    file_path.write_text(content.replace(old, new, 1), encoding="utf-8")


def append_once(path: str, marker: str, addition: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    if marker in content:
        return
    file_path.write_text(content.rstrip() + "\n\n" + addition.strip() + "\n", encoding="utf-8")


replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    "import type { Side } from '../battle/board'",
    "import { getBoardPositionId, type Side } from '../battle/board'",
)
replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    "import { STANDARD_INTERACTIVE_BATTLE } from '../demo/standard-headless-battle'",
    "import { VERTICAL_SLICE_SKILL_FX } from '../content/skill-fx'\nimport { STANDARD_INTERACTIVE_BATTLE } from '../demo/standard-headless-battle'",
)
replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    "import { UxHelpButton } from './UxHelpDialog'",
    "import { UxHelpButton } from './UxHelpDialog'\nimport { FxLayer } from './fx/FxLayer'\nimport { mapBattleEventsToFxCommands, type FxCommand } from './fx/fx-mapper'",
)
replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    "const CLEARED_BATTLE_SPEEDS: readonly BattleSpeed[] = Object.freeze([1, 2, 4, 8])",
    "const CLEARED_BATTLE_SPEEDS: readonly BattleSpeed[] = Object.freeze([1, 2, 4, 8])\nconst EMPTY_FX_COMMANDS: readonly FxCommand[] = Object.freeze([])\n\ninterface FxBatch {\n  readonly id: number\n  readonly commands: readonly FxCommand[]\n}",
)
replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    "  const [activePanel, setActivePanel] = useState<BattlePanelTab>('OPERATIONS')\n  const stableSnapshotCallbackRef = useRef(onStableSnapshot)",
    "  const [activePanel, setActivePanel] = useState<BattlePanelTab>('OPERATIONS')\n  const [fxBatch, setFxBatch] = useState<FxBatch>(() =>\n    Object.freeze({ id: 0, commands: EMPTY_FX_COMMANDS }),\n  )\n  const stableSnapshotCallbackRef = useRef(onStableSnapshot)\n  const lastFxSequenceRef = useRef(snapshot.log.nextSequence)\n  const fxBatchIdRef = useRef(0)",
)
replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    "  useEffect(() => {\n    setSnapshot(runner.getSnapshot())\n    return runner.subscribe(setSnapshot)\n  }, [runner])",
    "  useEffect(() => {\n    setSnapshot(runner.getSnapshot())\n    return runner.subscribe(setSnapshot)\n  }, [runner])\n\n  useEffect(() => {\n    lastFxSequenceRef.current = runner.getSnapshot().log.nextSequence\n    fxBatchIdRef.current += 1\n    setFxBatch(Object.freeze({ id: fxBatchIdRef.current, commands: EMPTY_FX_COMMANDS }))\n  }, [runner])",
)

species_block = """  const speciesIdByBattleUnitId = useMemo(
    () =>
      Object.freeze(
        Object.fromEntries(
          snapshot.battle.units.map((unit) => [unit.battleUnitId, unit.speciesId]),
        ),
      ),
    [snapshot.battle.units],
  )
"""
fx_block = species_block + """  const positionIdByBattleUnitId = useMemo(
    () =>
      Object.freeze(
        Object.fromEntries(
          snapshot.battle.units.map((unit) => [
            unit.battleUnitId,
            getBoardPositionId(unit.position),
          ]),
        ),
      ),
    [snapshot.battle.units],
  )

  useEffect(() => {
    const nextSequence = snapshot.log.nextSequence
    const startSequence = lastFxSequenceRef.current
    if (nextSequence < startSequence) {
      lastFxSequenceRef.current = nextSequence
      fxBatchIdRef.current += 1
      setFxBatch(Object.freeze({ id: fxBatchIdRef.current, commands: EMPTY_FX_COMMANDS }))
      return undefined
    }
    if (nextSequence === startSequence) return undefined

    const events = snapshot.log.events.slice(startSequence, nextSequence)
    lastFxSequenceRef.current = nextSequence
    const commands = mapBattleEventsToFxCommands(events, {
      motionLevel,
      playbackRate: speed,
      skipAnimations: speed === 8,
      positionIdByBattleUnitId,
      skills: definition.skills,
      skillFx: VERTICAL_SLICE_SKILL_FX,
    })
    fxBatchIdRef.current += 1
    const batchId = fxBatchIdRef.current
    setFxBatch(Object.freeze({ id: batchId, commands }))
    if (commands.length === 0) return undefined

    const maxDuration = Math.max(...commands.map((command) => command.durationMs))
    const timer = window.setTimeout(() => {
      setFxBatch((current) =>
        current.id === batchId
          ? Object.freeze({ id: batchId, commands: EMPTY_FX_COMMANDS })
          : current,
      )
    }, maxDuration + 120)
    return () => window.clearTimeout(timer)
  }, [
    definition.skills,
    motionLevel,
    positionIdByBattleUnitId,
    snapshot.log.events,
    snapshot.log.nextSequence,
    speed,
  ])
"""
replace_once("src/ui/MinimalBattleScreen.tsx", species_block, fx_block)
replace_once(
    "src/ui/MinimalBattleScreen.tsx",
    """          </div>
        </section>

        <BattleMobileTabs activeTab={activePanel} onChange={setActivePanel} />
""",
    """          </div>
          <FxLayer commands={fxBatch.commands} batchId={fxBatch.id} motionLevel={motionLevel} />
        </section>

        <BattleMobileTabs activeTab={activePanel} onChange={setActivePanel} />
""",
)

replace_once(
    "src/content/vertical-slice-runtime.ts",
    "export const VERTICAL_SLICE_RELEASE_CONTENT_VERSION = 'slice-v0.1.0-rc.2-t052'",
    "export const VERTICAL_SLICE_RELEASE_CONTENT_VERSION = 'slice-v0.1.0-rc.2-t053'",
)
replace_once(
    "src/content/vertical-slice-runtime.test.ts",
    "contentVersion: 'slice-v0.1.0-rc.2-t052'",
    "contentVersion: 'slice-v0.1.0-rc.2-t053'",
)

replace_once(
    "tasks/STATUS.md",
    "- [ ] T053 — [戦闘演出フレームワーク](T053_BATTLE_FX_FRAMEWORK.md)",
    "- [x] T053 — [戦闘演出フレームワーク](T053_BATTLE_FX_FRAMEWORK.md)",
)
replace_once(
    "tasks/STATUS.md",
    "T001～T047 complete. T048 external production verification remains. T049～T052 complete; next T053.",
    "T001～T047 complete. T048 external production verification remains. T049～T053 complete.",
)

append_once(
    "docs/07_BATTLE_EFFECTS.md",
    "## T053 UI演出コマンド",
    """
## T053 UI演出コマンド

戦闘カーネルが確定した`BattleEvent`は変更せず、UI層の`fx-mapper`が表示専用`FxCommand`へ純関数変換する。コマンドは対象マス、表示値、色、持続時間、技プリセットだけを持ち、`FxLayer`が盤面上でCSSアニメーションとして再生する。演出の有無、途中破棄、再生速度は戦闘状態・乱数・stable snapshotへ一切書き戻さない。

`damage_applied`、`healing_applied`、`barrier_absorbed`、状態変化、移動、撃破などはイベント種別ごとの汎用コマンドへ写像する。`skill_used`は`skillFx`マスターを参照し、未登録技は技の射程・範囲・属性から斬撃線、投射軌道、範囲波紋のいずれかへフォールバックする。
""",
)
append_once(
    "docs/12_UI_UX.md",
    "## T053 戦闘演出レイヤー",
    """
## T053 戦闘演出レイヤー

- 流れは`BattleEvent → fx-mapper → FxCommand → FxLayer`とし、演出は戦闘盤面の入力を遮らない`pointer-events: none`のオーバーレイで再生する。
- 標準は数値、被弾、移動、撃破、技プリセットを表示する。簡略は数値ポップと行動・被弾強調だけ、最小はコマンドを生成しない。`prefers-reduced-motion`は最小相当、AUTO×8は演出をスキップする。
- 技固有の見た目は`src/content/skill-fx.ts`へ技ID、プリセット、色、持続時間、倍率を追加する。プリセット追加を除き、既存技の見た目変更にコンポーネント修正は不要とする。
- フローティング数値は色だけでなく符号と「吸収」「軽減」「無効」「解除」などの文字を併記する。予兆は`!`表示を維持したまま点滅を加える。
""",
)
