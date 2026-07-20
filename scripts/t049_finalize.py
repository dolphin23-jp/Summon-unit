from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


# Complete authored catalyst and regional reward labels.
display_path = "src/content/display-masters.ts"
display = read(display_path)
display = display.replace('"catalyst.slice.primal-core": "特殊触媒"', '"catalyst.slice.primal-core": "原初核触媒"')
display = display.replace('"catalyst.slice.wyvern-heart": "特殊触媒"', '"catalyst.slice.wyvern-heart": "災炎心核"')
display = display.replace(
    "const REWARD_NAMES: Readonly<Record<string, string>> = Object.freeze({\n})",
    '''const REWARD_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "regional.slice-a.earth-60": "土触媒補給",
  "regional.slice-a.venom-90": "毒触媒補給",
  "regional.slice-a.wind-30": "風触媒補給",
  "regional.slice-b.fire-30": "火触媒補給",
  "regional.slice-b.machine-60": "機核触媒補給",
  "regional.slice-b.primal-90": "原初核触媒補給",
})''',
)
write(display_path, display)

# Research choices keep IDs as keys/state only, while visible labels use the master.
research_path = "src/ui/ResearchScreen.tsx"
research = read(research_path)
research = research.replace(
    "import { resolveCatalystName, resolveDisplayName } from '../content/display-masters'",
    "import { formatUnitDisplayName, resolveDisplayName } from '../content/display-masters'",
)
research = research.replace(
    "import { resolveDisplayName } from '../content/display-masters'",
    "import { formatUnitDisplayName, resolveDisplayName } from '../content/display-masters'",
)
research = research.replace("<label key={resolveCatalystName(catalystId)}>", "<label key={catalystId}>")
research = research.replace(
    "{instance.nickname ?? resolveDisplayName(instance.speciesId)}{' '}\n              <small>{instance.instanceId}</small>",
    "{instance.nickname ?? formatUnitDisplayName(instance.speciesId, instance.instanceId)}",
)
research = research.replace(
    "{state.disclosureStage < 2 ? '?' : shortId(species.id).slice(0, 2).toUpperCase()}",
    "{state.disclosureStage < 2 ? '?' : resolveDisplayName(species.id).slice(0, 1)}",
)
research = re.sub(r"\nfunction shortId\(id: string\): string \{.*?\n\}\n", "\n", research, count=1, flags=re.DOTALL)
write(research_path, research)

# Connect the player-facing skill description master and remove instance IDs from accessible labels.
collection_path = "src/ui/CollectionScreen.tsx"
collection = read(collection_path)
collection = collection.replace(
    "import { formatUnitDisplayName, resolveDisplayName } from '../content/display-masters'",
    "import { formatUnitDisplayName, resolveDisplayName, resolveSkillDescription } from '../content/display-masters'",
)
collection = collection.replace(
    "<h3>{resolveDisplayName(skill.id)}</h3>\n                      <p>",
    "<h3>{resolveDisplayName(skill.id)}</h3>\n                      <p>{resolveSkillDescription(skill.id)}</p>\n                      <p>",
)
collection = collection.replace(
    "` ${instance.nickname ?? instance.instanceId}`",
    "` ${instance.nickname ?? formatUnitDisplayName(instance.speciesId, instance.instanceId)}`",
)
write(collection_path, collection)

# Manual action preview receives battle IDs only. Convert them to neutral numbered labels and resolve skill IDs.
manual_path = "src/ui/ManualActionPanel.tsx"
manual = read(manual_path)
if "resolveSkillName" not in manual:
    manual = "import { resolveSkillName } from '../content/display-masters'\n" + manual
manual = re.sub(
    r"function shortId\(id: string\): string \{.*?\n\}",
    "function battleUnitLabel(id: string): string {\n"
    "  const match = id.match(/(?:\\.|-|:)(\\d+)$/)\n"
    "  return match === null ? '戦闘個体' : `戦闘個体 #${Math.max(1, Number(match[1]))}`\n"
    "}",
    manual,
    count=1,
    flags=re.DOTALL,
)
manual = manual.replace("shortId(result.battleUnitId)", "battleUnitLabel(result.battleUnitId)")
manual = manual.replace("shortId(result.guardedForBattleUnitId)", "battleUnitLabel(result.guardedForBattleUnitId)")
manual = manual.replace("shortId(option.skillId)", "resolveSkillName(option.skillId)")
manual = manual.replace("{pending.actorBattleUnitId} の行動", "{battleUnitLabel(pending.actorBattleUnitId)} の行動")
manual = manual.replace(
    "{preview.selectedTargetBattleUnitId ?? preview.selectedTargetPositionId ?? 'なし'}",
    "{preview.selectedTargetBattleUnitId === null\n            ? (preview.selectedTargetPositionId ?? 'なし')\n            : battleUnitLabel(preview.selectedTargetBattleUnitId)}",
)
manual = manual.replace("<> → 実対象 {preview.actualTargetBattleUnitId}</>", "<> → 実対象 {battleUnitLabel(preview.actualTargetBattleUnitId)}</>")
manual = manual.replace("`${preview.blockedByBattleUnitId} で停止`", "`${battleUnitLabel(preview.blockedByBattleUnitId)} で停止`")
manual = manual.replace(
    "`${movement.targetBattleUnitId}: ${movement.fromPositionId} → ${movement.toPositionId ?? movement.failureReason ?? '失敗'}`",
    "`${battleUnitLabel(movement.targetBattleUnitId)}: ${movement.fromPositionId} → ${movement.toPositionId ?? movement.failureReason ?? '失敗'}`",
)
write(manual_path, manual)

# UI code must call the central resolver directly, not retain slug-to-title wrappers.
for target in sorted((ROOT / "src/ui").glob("*.tsx")):
    text = target.read_text(encoding="utf-8")
    wrapper = re.compile(r"\nfunction displayName\(id: string\): string \{\n\s*return resolveDisplayName\(id\)\n\}\n")
    if wrapper.search(text):
        text = wrapper.sub("\n", text, count=1).replace("displayName(", "resolveDisplayName(")
        target.write_text(text, encoding="utf-8")

# Extend resolver tests for regional rewards.
test_path = "src/content/display-masters.test.ts"
tests = read(test_path)
if "resolveRewardName" not in tests:
    tests = tests.replace("  resolveSkillDescription,", "  resolveRewardName,\n  resolveSkillDescription,")
if "regional.slice-a.wind-30" not in tests:
    tests = tests.replace(
        "    expect(resolveCatalystName('catalyst.slice.wind')).toBe('風触媒')",
        "    expect(resolveCatalystName('catalyst.slice.wind')).toBe('風触媒')\n"
        "    expect(resolveRewardName('regional.slice-a.wind-30')).toBe('風触媒補給')",
    )
write(test_path, tests)

for generated in ("pnpm-lock.yaml", "t049-test-results.json"):
    target = ROOT / generated
    if target.exists():
        target.unlink()

# Produce a reviewable identity-field audit. IDs may remain as state keys and callbacks, but not labels.
patterns = re.compile(r"battleUnitId|speciesId|catalystId|stageId|regionId|instanceId|function displayName\(|function shortName\(")
audit: list[str] = ["# T049 UI identity-field audit", ""]
for target in sorted((ROOT / "src/ui").glob("*.tsx")):
    for line_number, line in enumerate(target.read_text(encoding="utf-8").splitlines(), start=1):
        if patterns.search(line):
            audit.append(f"{target.relative_to(ROOT)}:{line_number}: {line.strip()}")
write("t049-ui-id-audit.txt", "\n".join(audit) + "\n")

# Hard failures for known player-facing raw-ID regressions.
for path, fragments in {
    "src/ui/ResearchScreen.tsx": ["<small>{instance.instanceId}</small>", "key={resolveCatalystName("],
    "src/ui/CollectionScreen.tsx": ["<small>{instance.instanceId}</small>", "instance.nickname ?? instance.instanceId"],
    "src/ui/BattleResultScreen.tsx": ["<span>{catalyst.catalystId}</span>", "<span>{change.speciesId}</span>", "<strong>{unit.battleUnitId}</strong>"],
    "src/ui/BattleUnitCard.tsx": ["shortName(unit.battleUnitId)", "shortName(unit.speciesId)"],
    "src/ui/ManualActionPanel.tsx": ["shortId(", "{pending.actorBattleUnitId} の行動", "{preview.actualTargetBattleUnitId}"],
}.items():
    text = read(path)
    for fragment in fragments:
        if fragment in text:
            raise SystemExit(f"raw player-facing id remains in {path}: {fragment}")

for target in sorted((ROOT / "src/ui").glob("*.tsx")):
    text = target.read_text(encoding="utf-8")
    if "function displayName(" in text or "function shortName(" in text:
        raise SystemExit(f"local id-derived display helper remains: {target.relative_to(ROOT)}")

print("T049 finalization patches and audit completed")
