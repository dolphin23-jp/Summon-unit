from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


# Unknown authored test fixtures must now assert the safe fallback, never the internal ID.
test_path = "src/progression/stage-battle.test.ts"
test = read(test_path)
test = test.replace(".toThrow('stage.demo-forest-boss')", ".toThrow('不明なステージ')")
write(test_path, test)

# Screen-reader labels are player-visible too; never fall back to instance IDs.
collection_path = "src/ui/CollectionScreen.tsx"
collection = read(collection_path)
collection = collection.replace(
    "instance.nickname ?? instance.instanceId",
    "instance.nickname ?? formatUnitDisplayName(instance.speciesId, instance.instanceId)",
)
write(collection_path, collection)

manual_path = "src/ui/ManualActionPanel.tsx"
manual = read(manual_path)
if "../content/display-masters" not in manual:
    manual = "import { resolveSkillName } from '../content/display-masters'\n" + manual
manual = manual.replace(
    "function shortId(id: string): string {\n  return id.split('.').at(-1) ?? id\n}\n\n",
    """function battleUnitLabel(id: string): string {
  const match = id.match(/(?:[.:-])(\\d+)$/)
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

""",
)
manual = manual.replace(
    "{preview.selectedTargetBattleUnitId ?? preview.selectedTargetPositionId ?? 'なし'}",
    "{preview.selectedTargetBattleUnitId !== null\n            ? battleUnitLabel(preview.selectedTargetBattleUnitId)\n            : positionLabel(preview.selectedTargetPositionId)}",
)
manual = manual.replace(
    "<> → 実対象 {preview.actualTargetBattleUnitId}</>",
    "<> → 実対象 {battleUnitLabel(preview.actualTargetBattleUnitId)}</>",
)
manual = manual.replace(
    "`${preview.blockedByBattleUnitId} で停止`",
    "`${battleUnitLabel(preview.blockedByBattleUnitId)} で停止`",
)
manual = manual.replace(
    "preview.affectedPositionIds.join(' / ')",
    "preview.affectedPositionIds.map(positionLabel).join(' / ')",
)
manual = manual.replace(
    "<strong>{shortId(result.battleUnitId)}</strong>",
    "<strong>{battleUnitLabel(result.battleUnitId)}</strong>",
)
manual = manual.replace(
    "<small>{shortId(result.guardedForBattleUnitId)} の肩代わり</small>",
    "<small>{battleUnitLabel(result.guardedForBattleUnitId)} の肩代わり</small>",
)
manual = manual.replace(
    "`${movement.targetBattleUnitId}: ${movement.fromPositionId} → ${movement.toPositionId ?? movement.failureReason ?? '失敗'}`",
    "`${battleUnitLabel(movement.targetBattleUnitId)}: ${positionLabel(movement.fromPositionId)} → ${movement.toPositionId === null ? movement.failureReason ?? '失敗' : positionLabel(movement.toPositionId)}`",
)
manual = manual.replace(
    "<h2 id=\"manual-action-title\">{pending.actorBattleUnitId} の行動</h2>",
    "<h2 id=\"manual-action-title\">{battleUnitLabel(pending.actorBattleUnitId)} の行動</h2>",
)
manual = manual.replace(
    "{option.skillId === null ? option.label : shortId(option.skillId)}",
    "{option.skillId === null ? option.label : resolveSkillName(option.skillId)}",
)
write(manual_path, manual)

# Update the audit after the fixes.
audit_path = ROOT / "t049-ui-id-audit.txt"
if audit_path.exists():
    audit_path.unlink()

for path, forbidden in {
    "src/ui/CollectionScreen.tsx": ["instance.nickname ?? instance.instanceId"],
    "src/ui/ManualActionPanel.tsx": [
        "function shortId(",
        "{pending.actorBattleUnitId}",
        "shortId(option.skillId)",
        "shortId(result.battleUnitId)",
        "preview.affectedPositionIds.join",
    ],
    "src/progression/stage-battle.test.ts": ["toThrow('stage.demo-forest-boss')"],
}.items():
    text = read(path)
    for fragment in forbidden:
        if fragment in text:
            raise SystemExit(f"T049 follow-up failed in {path}: {fragment}")

print("T049 follow-up fixes completed")
