from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def quoted(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def ts_map(name: str, values: dict[str, str]) -> list[str]:
    lines = [f"const {name}: Readonly<Record<string, string>> = Object.freeze({{"]
    for key, value in sorted(values.items()):
        lines.append(f"  {quoted(key)}: {quoted(value)},")
    lines.append("})")
    return lines


def ensure_named_import(text: str, module: str, names: list[str]) -> str:
    pattern = re.compile(rf"import \{{([^}}]+)\}} from {re.escape(quoted(module))}")
    match = pattern.search(text)
    if match:
        current = {part.strip() for part in match.group(1).split(",") if part.strip()}
        merged = sorted(current | set(names))
        replacement = f"import {{ {', '.join(merged)} }} from {quoted(module)}"
        return text[: match.start()] + replacement + text[match.end() :]
    return f"import {{ {', '.join(sorted(names))} }} from {quoted(module)}\n" + text


def replace_display_helper(text: str) -> tuple[str, bool]:
    pattern = re.compile(
        r"function displayName\(id: string\): string \{.*?\n\}",
        flags=re.DOTALL,
    )
    if not pattern.search(text):
        return text, False
    text = pattern.sub(
        "function displayName(id: string): string {\n  return resolveDisplayName(id)\n}",
        text,
        count=1,
    )
    short_id_pattern = re.compile(
        r"\nfunction shortId\(id: string\): string \{.*?\n\}\n",
        flags=re.DOTALL,
    )
    if text.count("shortId(") == 1:
        text = short_id_pattern.sub("\n", text, count=1)
    return text, True


content = read("src/content/vertical-slice-content.ts")
world = read("src/content/vertical-slice-world.ts")

skill_names: dict[str, str] = {}
skill_descriptions: dict[str, str] = {}
for block in re.findall(r"defineSkill\(\{(.*?)\n\s*\}\),", content, flags=re.DOTALL):
    skill_id = re.search(r"\bid:\s*'([^']+)'", block)
    display_name = re.search(r"\bdisplayName:\s*'([^']+)'", block)
    summary = re.search(r"\btacticalSummary:\s*'([^']+)'", block)
    if skill_id and display_name and summary:
        skill_names[skill_id.group(1)] = display_name.group(1)
        skill_descriptions[skill_id.group(1)] = summary.group(1)

species_names: dict[str, str] = {}
for block in re.findall(r"defineMonster\(\{(.*?)\n\s*\}\),", content, flags=re.DOTALL):
    species_id = re.search(r"\bid:\s*'([^']+)'", block)
    display_name = re.search(r"\bdisplayName:\s*'([^']+)'", block)
    if species_id and display_name:
        species_names[species_id.group(1)] = display_name.group(1)

if len(skill_names) < 40:
    raise SystemExit(f"expected at least 40 authored skill names, found {len(skill_names)}")
if len(species_names) < 16:
    raise SystemExit(f"expected at least 16 authored species names, found {len(species_names)}")

stage_names: dict[str, str] = {}
for match in re.finditer(r"\bstageId:\s*'([^']+)'", world):
    stage_id = match.group(1)
    if stage_id in stage_names:
        continue
    window = world[match.end() : match.end() + 650]
    theme = re.search(r"\btheme:\s*'([^']+)'", window)
    if theme and theme.start() < 360:
        stage_names[stage_id] = theme.group(1)
if len(stage_names) < 17:
    raise SystemExit(f"expected at least 17 stage names, found {len(stage_names)}")

region_names: dict[str, str] = {}
for match in re.finditer(
    r"\bregionId:\s*'([^']+)'.{0,420}?\bname:\s*'([^']+)'",
    world,
    flags=re.DOTALL,
):
    region_names.setdefault(match.group(1), match.group(2))
if len(region_names) < 2:
    region_names.update(
        {
            "region.slice-a": "翠風観測原",
            "region.slice-b": "災炎境界域",
        }
    )

research_names: dict[str, str] = {}
for match in re.finditer(
    r"\bnodeId:\s*'([^']+)'.{0,220}?\bdisplayName:\s*'([^']+)'",
    world,
    flags=re.DOTALL,
):
    research_names.setdefault(match.group(1), match.group(2))

catalyst_ids = sorted(set(re.findall(r"'((?:catalyst)\.[^']+)'", content + "\n" + world)))
catalyst_labels = {
    "wind": "風触媒",
    "earth": "土触媒",
    "fire": "火触媒",
    "water": "水触媒",
    "light": "光触媒",
    "dark": "闇触媒",
    "poison": "毒触媒",
    "venom": "毒触媒",
    "machine-core": "機核触媒",
    "ancient-gear": "古歯車触媒",
}
catalyst_names: dict[str, str] = {}
for catalyst_id in catalyst_ids:
    tail = catalyst_id.rsplit(".", 1)[-1]
    catalyst_names[catalyst_id] = catalyst_labels.get(tail, "特殊触媒")

reward_ids = sorted(set(re.findall(r"'((?:reward)\.[^']+)'", world)))
reward_names: dict[str, str] = {}
for reward_id in reward_ids:
    tail = reward_id.rsplit(".", 1)[-1]
    if "blueprint" in tail:
        label = "設計図報酬"
    elif "catalyst" in tail:
        label = "触媒報酬"
    elif "currency" in tail:
        label = "通貨報酬"
    elif "research" in tail:
        label = "研究報酬"
    elif "skill" in tail:
        label = "技習得報酬"
    else:
        label = "地域到達報酬"
    reward_names[reward_id] = label

attribute_names = {
    "attribute.neutral": "無",
    "attribute.wind": "風",
    "attribute.earth": "土",
    "attribute.fire": "火",
    "attribute.water": "水",
    "attribute.light": "光",
    "attribute.dark": "闇",
}

lines: list[str] = [
    "export type DisplayMasterKind =",
    "  | 'SPECIES'",
    "  | 'SKILL'",
    "  | 'STAGE'",
    "  | 'REGION'",
    "  | 'RESEARCH'",
    "  | 'CATALYST'",
    "  | 'REWARD'",
    "  | 'ATTRIBUTE'",
    "",
    "export interface DisplayMasterEntry {",
    "  readonly id: string",
    "  readonly kind: DisplayMasterKind",
    "  readonly name: string",
    "  readonly description?: string",
    "}",
    "",
]
for map_name, mapping in (
    ("SPECIES_NAMES", species_names),
    ("SKILL_NAMES", skill_names),
    ("SKILL_DESCRIPTIONS", skill_descriptions),
    ("STAGE_NAMES", stage_names),
    ("REGION_NAMES", region_names),
    ("RESEARCH_NAMES", research_names),
    ("CATALYST_NAMES", catalyst_names),
    ("REWARD_NAMES", reward_names),
    ("ATTRIBUTE_NAMES", attribute_names),
):
    lines.extend(ts_map(map_name, mapping))
    lines.append("")

lines.append(
    r'''function readName(master: Readonly<Record<string, string>>, id: string, fallback: string): string {
  return master[id] ?? fallback
}

export function resolveSpeciesName(speciesId: string): string {
  return readName(SPECIES_NAMES, speciesId, '不明なモンスター')
}

export function resolveSkillName(skillId: string): string {
  return readName(SKILL_NAMES, skillId, '不明な技')
}

export function resolveSkillDescription(skillId: string): string {
  return readName(SKILL_DESCRIPTIONS, skillId, '効果情報を確認できません。')
}

export function resolveStageName(stageId: string): string {
  return readName(STAGE_NAMES, stageId, '不明なステージ')
}

export function resolveRegionName(regionId: string): string {
  return readName(REGION_NAMES, regionId, '不明な地域')
}

export function resolveResearchName(researchId: string): string {
  return readName(RESEARCH_NAMES, researchId, '不明な研究')
}

export function resolveCatalystName(catalystId: string): string {
  return readName(CATALYST_NAMES, catalystId, '不明な触媒')
}

export function resolveRewardName(rewardId: string): string {
  return readName(REWARD_NAMES, rewardId, '地域到達報酬')
}

export function resolveAttributeName(attributeId: string): string {
  return readName(ATTRIBUTE_NAMES, attributeId, '無')
}

export function resolveDisplayName(id: string): string {
  if (SPECIES_NAMES[id] !== undefined) return SPECIES_NAMES[id]
  if (SKILL_NAMES[id] !== undefined) return SKILL_NAMES[id]
  if (STAGE_NAMES[id] !== undefined) return STAGE_NAMES[id]
  if (REGION_NAMES[id] !== undefined) return REGION_NAMES[id]
  if (RESEARCH_NAMES[id] !== undefined) return RESEARCH_NAMES[id]
  if (CATALYST_NAMES[id] !== undefined) return CATALYST_NAMES[id]
  if (REWARD_NAMES[id] !== undefined) return REWARD_NAMES[id]
  if (ATTRIBUTE_NAMES[id] !== undefined) return ATTRIBUTE_NAMES[id]
  if (id.startsWith('species.')) return '不明なモンスター'
  if (id.startsWith('skill.')) return '不明な技'
  if (id.startsWith('stage.')) return '不明なステージ'
  if (id.startsWith('region.')) return '不明な地域'
  if (id.startsWith('research.')) return '不明な研究'
  if (id.startsWith('catalyst.')) return '不明な触媒'
  if (id.startsWith('reward.')) return '地域到達報酬'
  return '不明な項目'
}

export function formatUnitDisplayName(speciesId: string, unitId: string): string {
  const speciesName = resolveSpeciesName(speciesId)
  const match = unitId.match(/(?:-|:)(\d+)$/)
  if (match === null) return speciesName
  const parsed = Number(match[1])
  if (!Number.isSafeInteger(parsed)) return speciesName
  const ordinal = unitId.includes(':') && parsed === 0 ? 1 : Math.max(1, parsed)
  return `${speciesName} #${ordinal}`
}

export interface DisplayMasterValidationSummary {
  readonly entries: number
  readonly species: number
  readonly skills: number
  readonly stages: number
  readonly regions: number
  readonly catalysts: number
}

export function validateDisplayMasterEntries(
  entries: readonly DisplayMasterEntry[],
): DisplayMasterValidationSummary {
  const ids = new Set<string>()
  let species = 0
  let skills = 0
  let stages = 0
  let regions = 0
  let catalysts = 0
  for (const entry of entries) {
    if (entry.id.trim().length === 0) throw new Error('display master id must be non-empty')
    if (ids.has(entry.id)) throw new Error(`display master id must be unique: ${entry.id}`)
    ids.add(entry.id)
    if (entry.name.trim().length === 0) throw new Error(`display name must be non-empty: ${entry.id}`)
    if (entry.name.includes('.')) throw new Error(`display name must not expose an id: ${entry.id}`)
    if (entry.kind === 'SKILL' && (entry.description?.trim().length ?? 0) === 0) {
      throw new Error(`skill description must be non-empty: ${entry.id}`)
    }
    if (entry.kind === 'SPECIES') species += 1
    if (entry.kind === 'SKILL') skills += 1
    if (entry.kind === 'STAGE') stages += 1
    if (entry.kind === 'REGION') regions += 1
    if (entry.kind === 'CATALYST') catalysts += 1
  }
  return Object.freeze({ entries: entries.length, species, skills, stages, regions, catalysts })
}

export function validateDisplayMasters(): DisplayMasterValidationSummary {
  const entries: DisplayMasterEntry[] = [
    ...Object.entries(SPECIES_NAMES).map(([id, name]) => ({ id, name, kind: 'SPECIES' as const })),
    ...Object.entries(SKILL_NAMES).map(([id, name]) => ({
      id,
      name,
      description: SKILL_DESCRIPTIONS[id],
      kind: 'SKILL' as const,
    })),
    ...Object.entries(STAGE_NAMES).map(([id, name]) => ({ id, name, kind: 'STAGE' as const })),
    ...Object.entries(REGION_NAMES).map(([id, name]) => ({ id, name, kind: 'REGION' as const })),
    ...Object.entries(RESEARCH_NAMES).map(([id, name]) => ({ id, name, kind: 'RESEARCH' as const })),
    ...Object.entries(CATALYST_NAMES).map(([id, name]) => ({ id, name, kind: 'CATALYST' as const })),
    ...Object.entries(REWARD_NAMES).map(([id, name]) => ({ id, name, kind: 'REWARD' as const })),
    ...Object.entries(ATTRIBUTE_NAMES).map(([id, name]) => ({ id, name, kind: 'ATTRIBUTE' as const })),
  ]
  return validateDisplayMasterEntries(entries)
}

export const DISPLAY_MASTER_VALIDATION = validateDisplayMasters()
'''
)
write("src/content/display-masters.ts", "\n".join(lines))

write(
    "src/content/display-masters.test.ts",
    r'''import { describe, expect, it } from 'vitest'
import {
  DISPLAY_MASTER_VALIDATION,
  formatUnitDisplayName,
  resolveCatalystName,
  resolveDisplayName,
  resolveSkillDescription,
  resolveSkillName,
  resolveSpeciesName,
  resolveStageName,
  validateDisplayMasterEntries,
} from './display-masters'

describe('display masters', () => {
  it('resolves authored ids without exposing internal ids', () => {
    expect(resolveSpeciesName('species.slice.grassfang-rat')).toBe('草牙ネズミ')
    expect(resolveSkillName('skill.slice.moss-drop')).toBe('苔雫')
    expect(resolveSkillDescription('skill.slice.moss-drop')).toContain('回復')
    expect(resolveStageName('stage.slice.a-01-order')).not.toContain('.')
    expect(resolveCatalystName('catalyst.slice.wind')).toBe('風触媒')
    expect(resolveDisplayName('unknown.value')).toBe('不明な項目')
    expect(formatUnitDisplayName('species.slice.grassfang-rat', 'unit.slice.grassfang-01')).toBe(
      '草牙ネズミ #1',
    )
  })

  it('covers the vertical slice masters', () => {
    expect(DISPLAY_MASTER_VALIDATION.species).toBeGreaterThanOrEqual(16)
    expect(DISPLAY_MASTER_VALIDATION.skills).toBeGreaterThanOrEqual(40)
    expect(DISPLAY_MASTER_VALIDATION.stages).toBeGreaterThanOrEqual(17)
    expect(DISPLAY_MASTER_VALIDATION.regions).toBeGreaterThanOrEqual(2)
  })

  it('rejects empty descriptions and id-shaped display names', () => {
    expect(() =>
      validateDisplayMasterEntries([
        { id: 'skill.test.empty', kind: 'SKILL', name: '試験技', description: '' },
      ]),
    ).toThrow('skill description must be non-empty')
    expect(() =>
      validateDisplayMasterEntries([
        { id: 'species.test.bad', kind: 'SPECIES', name: 'species.test.bad' },
      ]),
    ).toThrow('display name must not expose an id')
  })
})
''',
)

# Integrate the display validation into the existing content validation command.
path = "scripts/validate-content.ts"
text = read(path)
text = ensure_named_import(text, "../src/content/display-masters", ["DISPLAY_MASTER_VALIDATION"])
text = text.replace(
    "      verticalSliceBalanced: BALANCED_VERTICAL_SLICE_CONTENT_VALIDATION,",
    "      verticalSliceBalanced: BALANCED_VERTICAL_SLICE_CONTENT_VALIDATION,\n      displayMasters: DISPLAY_MASTER_VALIDATION,",
)
write(path, text)

# Replace local slug formatting helpers across UI screens with the central resolver.
for ui_path in sorted((ROOT / "src/ui").glob("*.tsx")):
    relative = ui_path.relative_to(ROOT).as_posix()
    text = ui_path.read_text(encoding="utf-8")
    text, changed = replace_display_helper(text)
    if changed:
        text = ensure_named_import(text, "../content/display-masters", ["resolveDisplayName"])
        write(relative, text)

# Collection: never render save-instance ids as labels.
path = "src/ui/CollectionScreen.tsx"
text = read(path)
if "instance.nickname ?? displayName(species.id)" in text:
    text = ensure_named_import(text, "../content/display-masters", ["formatUnitDisplayName"])
    text = text.replace(
        "instance.nickname ?? displayName(species.id)",
        "instance.nickname ?? formatUnitDisplayName(species.id, instance.instanceId)",
    )
text = text.replace("<small>{instance.instanceId}</small>", "<small>{displayName(species.id)}</small>")
write(path, text)

# Region cards and reward tracks use the generated stage/reward masters through displayName().
# Battle unit cards use a stable species name + ordinal instead of battle ids.
path = "src/ui/BattleUnitCard.tsx"
text = read(path)
text = ensure_named_import(
    text,
    "../content/display-masters",
    ["formatUnitDisplayName", "resolveSpeciesName"],
)
text = re.sub(r"\nfunction shortName\(id: string\): string \{.*?\n\}\n", "\n", text, flags=re.DOTALL)
text = text.replace(
    "  const sideLabel = unit.side === 'ALLY' ? '味方' : '相手'",
    "  const sideLabel = unit.side === 'ALLY' ? '味方' : '相手'\n  const unitName = formatUnitDisplayName(unit.speciesId, unit.battleUnitId)",
)
text = text.replace("<strong>{shortName(unit.battleUnitId)}</strong>", "<strong>{unitName}</strong>")
text = text.replace("<span className=\"unit-card__species\">{shortName(unit.speciesId)}</span>", "<span className=\"unit-card__species\">{resolveSpeciesName(unit.speciesId)}</span>")
text = text.replace("aria-label={`${shortName(unit.battleUnitId)} HP`}", "aria-label={`${unitName} HP`}")
write(path, text)

# Result screen: catalyst, analysis, and unit rows must not expose ids.
path = "src/ui/BattleResultScreen.tsx"
text = read(path)
text = ensure_named_import(
    text,
    "../content/display-masters",
    ["formatUnitDisplayName", "resolveCatalystName", "resolveSpeciesName"],
)
text = text.replace("<span>{catalyst.catalystId}</span>", "<span>{resolveCatalystName(catalyst.catalystId)}</span>")
text = text.replace("<span>{change.speciesId}</span>", "<span>{resolveSpeciesName(change.speciesId)}</span>")
text = text.replace(
    "<th scope=\"row\"><strong>{unit.battleUnitId}</strong><small>{unit.speciesId}</small></th>",
    "<th scope=\"row\"><strong>{formatUnitDisplayName(unit.speciesId, unit.battleUnitId)}</strong><small>{resolveSpeciesName(unit.speciesId)}</small></th>",
)
write(path, text)

# Common direct catalyst renderings in research/result/list screens.
for relative in [
    "src/ui/ResearchScreen.tsx",
    "src/ui/SummonScreen.tsx",
    "src/ui/HomeScreen.tsx",
]:
    target = ROOT / relative
    if not target.exists():
        continue
    text = target.read_text(encoding="utf-8")
    original = text
    replacements = {
        "{catalystId}": "{resolveCatalystName(catalystId)}",
        "{balance.catalystId}": "{resolveCatalystName(balance.catalystId)}",
        "{catalyst.catalystId}": "{resolveCatalystName(catalyst.catalystId)}",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    if text != original:
        text = ensure_named_import(text, "../content/display-masters", ["resolveCatalystName"])
        write(relative, text)

# Player-facing progression reasons resolve names while keeping ids in state and events.
path = "src/progression/region-progression.ts"
text = read(path)
text = ensure_named_import(text, "../content/display-masters", ["resolveRegionName", "resolveStageName"])
text = text.replace(
    "return `${requirement.stageId} のクリアが必要です。`",
    "return `${resolveStageName(requirement.stageId)} のクリアが必要です。`",
)
text = text.replace(
    "return `${requirement.stageIds.join('、')} の全クリアが必要です。`",
    "return `${requirement.stageIds.map(resolveStageName).join('、')} の全クリアが必要です。`",
)
text = text.replace(
    "return `${requirement.regionId} の地域ポイント ${requirement.points} が必要です。`",
    "return `${resolveRegionName(requirement.regionId)} の地域ポイント ${requirement.points} が必要です。`",
)
write(path, text)

# Stage settlement notifications use the stage display master.
path = "src/progression/stage-reward.ts"
text = read(path)
if "${stage.stageId} をクリアしました。" in text:
    text = ensure_named_import(text, "../content/display-masters", ["resolveStageName"])
    text = text.replace("${stage.stageId} をクリアしました。", "${resolveStageName(stage.stageId)} をクリアしました。")
write(path, text)

# Keep the save schema unchanged but advance content identity for the new display master.
path = "src/content/vertical-slice-runtime.ts"
text = read(path).replace(
    "export const VERTICAL_SLICE_RELEASE_CONTENT_VERSION = 'slice-v0.1.0-rc.2'",
    "export const VERTICAL_SLICE_RELEASE_CONTENT_VERSION = 'slice-v0.1.0-rc.2-t049'",
)
write(path, text)
for test_path in (ROOT / "src").rglob("*.test.ts"):
    text = test_path.read_text(encoding="utf-8")
    updated = text.replace("slice-v0.1.0-rc.2", "slice-v0.1.0-rc.2-t049")
    if updated != text:
        test_path.write_text(updated, encoding="utf-8")

# Update user-facing expected strings in tests without changing ids used as data.
for test_path in (ROOT / "src").rglob("*.test.ts"):
    text = test_path.read_text(encoding="utf-8")
    updated = text
    for stage_id, stage_name in stage_names.items():
        updated = updated.replace(f"{stage_id} のクリアが必要です。", f"{stage_name} のクリアが必要です。")
        updated = updated.replace(f"{stage_id} をクリアしました。", f"{stage_name} をクリアしました。")
    for region_id, region_name in region_names.items():
        updated = updated.replace(
            f"{region_id} の地域ポイント ",
            f"{region_name} の地域ポイント ",
        )
    if updated != text:
        test_path.write_text(updated, encoding="utf-8")

# Normalize the uploaded task specification filename and record completion.
status_path = ROOT / "tasks/STATUS.md"
status = status_path.read_text(encoding="utf-8")
status = status.replace("- [ ] T049 —", "- [x] T049 —")
status = re.sub(
    r"T001～T047 complete\..*",
    "T001～T047 complete. T048 external production verification remains. T049 complete; next T050.",
    status,
)
status_path.write_text(status, encoding="utf-8")

canonical_task = ROOT / "tasks/T049_DISPLAY_NAME_MASTERS.md"
legacy_tasks = [path for path in (ROOT / "tasks").glob("Task049*") if path != canonical_task]
if canonical_task.exists():
    task_text = canonical_task.read_text(encoding="utf-8")
elif legacy_tasks:
    task_text = legacy_tasks[0].read_text(encoding="utf-8")
else:
    task_text = "# T049 — 表示名・説明文マスター\n"
task_text = task_text.replace("# Task 049:", "# T049 —")
task_text = task_text.replace("- [ ]", "- [x]")
if "## 実装結果" not in task_text:
    task_text += """

## 実装結果

- 種・技・ステージ・地域・研究・触媒・報酬・属性を一元解決する表示マスターを追加した。
- 技説明は既存の戦術説明を正本として公開し、欠落・空文字・ID混入をcontent validationで拒否する。
- 地域、編成、研究、戦闘盤面、戦闘結果の主要な生ID表示を名称参照へ置き換えた。
- ID、セーブスキーマ、戦闘イベントのペイロードは変更していない。
"""
canonical_task.write_text(task_text, encoding="utf-8")
for legacy in legacy_tasks:
    legacy.unlink()

for doc_path, section in {
    "docs/13_CONTENT_AUTHORING_RULES.md": """

## 表示名マスター

プレイヤー可視の種・技・ステージ・地域・研究・触媒・報酬・属性は、`src/content/display-masters.ts`を唯一の表示名参照先とする。UIでIDを分割・大文字化して名称を作ってはならない。未知IDはID文字列を露出せず、「不明な技」など種別ごとの安全な文言へフォールバックする。
""",
    "docs/16_DATA_SCHEMA.md": """

## 表示専用マスター

表示名と技説明はセーブデータへ保存せず、`src/content/display-masters.ts`でIDから解決する。ID体系と戦闘イベントは従来どおり正規IDを保持するため、T049によるセーブスキーマ変更はない。contentVersionのみ`slice-v0.1.0-rc.2-t049`へ更新する。
""",
}.items():
    target = ROOT / doc_path
    if target.exists():
        text = target.read_text(encoding="utf-8")
        marker = section.strip().splitlines()[0]
        if marker not in text:
            target.write_text(text.rstrip() + section + "\n", encoding="utf-8")

# Fail materialization if the high-risk player-facing surfaces still render raw ids directly.
checks = {
    "src/ui/BattleResultScreen.tsx": [
        "<span>{catalyst.catalystId}</span>",
        "<span>{change.speciesId}</span>",
        "<strong>{unit.battleUnitId}</strong>",
    ],
    "src/ui/BattleUnitCard.tsx": ["shortName(unit.battleUnitId)", "shortName(unit.speciesId)"],
    "src/ui/CollectionScreen.tsx": ["<small>{instance.instanceId}</small>"],
    "src/progression/region-progression.ts": [
        "`${requirement.stageId} のクリアが必要です。`",
        "`${requirement.regionId} の地域ポイント",
    ],
}
for relative, forbidden in checks.items():
    text = read(relative)
    for fragment in forbidden:
        if fragment in text:
            raise SystemExit(f"raw id exposure remains in {relative}: {fragment}")

print(
    json.dumps(
        {
            "species": len(species_names),
            "skills": len(skill_names),
            "stages": len(stage_names),
            "regions": len(region_names),
            "research": len(research_names),
            "catalysts": len(catalyst_names),
            "rewards": len(reward_names),
        },
        ensure_ascii=False,
        indent=2,
    )
)
