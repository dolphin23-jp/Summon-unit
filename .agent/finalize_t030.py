from pathlib import Path
import re


def replace_file(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old[:160]!r}')
    file.write_text(text.replace(old, new, count))


replace_file(
    'src/ui/MinimalBattleScreen.tsx',
    "import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'",
    "import { STANDARD_INTERACTIVE_BATTLE } from '../demo/standard-headless-battle'",
)
replace_file(
    'src/ui/MinimalBattleScreen.tsx',
    'STANDARD_HEADLESS_BATTLE',
    'STANDARD_INTERACTIVE_BATTLE',
    20,
)

replace_file(
    'src/battle/manual-action-preview.test.ts',
    "import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'",
    "import { STANDARD_INTERACTIVE_BATTLE } from '../demo/standard-headless-battle'",
)
replace_file(
    'src/battle/manual-action-preview.test.ts',
    'STANDARD_HEADLESS_BATTLE',
    'STANDARD_INTERACTIVE_BATTLE',
    20,
)

view_path = Path('src/ui/battle-screen-view.ts')
view = view_path.read_text()
view = view.replace(
    "import {\n  calculateNextActionTime,\n  type UnitTurnEventPayload,\n} from '../battle/action-scheduling'",
    "import type { UnitTurnEventPayload } from '../battle/action-scheduling'",
)
view = view.replace("import { NORMAL_MOVEMENT_ACTION_COST } from '../battle/normal-movement'\n", '')
view = view.replace("import { getModifiedBattleStatValue } from '../battle/stat-modifiers'\n", '')
start = view.index('function getPreviewActionCost(')
end = view.index('function createProvisionalTimelineEntry(', start)
view = view[:start] + view[end:]
view = view.replace(
    "  option: InteractiveManualActionOption | null,\n  speciesById: Readonly<Record<string, MonsterSpecies>>,\n): BattleTimelineEntryView | null {",
    "  option: InteractiveManualActionOption | null,\n): BattleTimelineEntryView | null {",
)
old_calculation = """  const actionCost = getPreviewActionCost(definition, actor, option)
  if (actionCost === null) {
    return null
  }
  const species = getRequiredSpecies(speciesById, actor.speciesId)
  const speed = getModifiedBattleStatValue(species.stats.speed, actor.effects, 'SPEED')
  const time = calculateNextActionTime(
    snapshot.currentVirtualTime,
    actionCost,
    speed,
  )
  const positionId = getPreviewPositionId(actor, option)
"""
if old_calculation not in view:
    raise SystemExit('missing provisional timeline calculation')
view = view.replace(
    old_calculation,
    "  const time = option.preview.nextActionTime\n  const positionId = option.preview.toPositionId\n",
    1,
)
view = view.replace(
    "    previewOption,\n    speciesById,\n  )",
    "    previewOption,\n  )",
    1,
)
view_path.write_text(view)

css_path = Path('src/index.css')
css = css_path.read_text()
marker = '/* T030 confirmed manual action preview */'
if marker not in css:
    css += '''

/* T030 confirmed manual action preview */
.manual-step { margin-top: 0.9rem; padding-top: 0.85rem; border-top: 1px solid rgba(151, 184, 203, 0.14); }
.manual-step h3 { display: flex; gap: 0.45rem; align-items: center; margin-bottom: 0.55rem; }
.manual-step h3 span { width: 1.35rem; height: 1.35rem; display: inline-grid; place-items: center; border-radius: 999px; color: #071019; background: #a8dcf2; font-size: 0.65rem; }
.manual-options .control-button { display: inline-flex; flex-direction: column; gap: 0.12rem; align-items: flex-start; }
.manual-options .control-button small { color: #8ca5b5; font-size: 0.55rem; font-weight: 700; }
.manual-preview { margin-top: 1rem; padding: 0.9rem; border: 1px solid rgba(111, 195, 218, 0.34); border-radius: 0.8rem; background: rgba(17, 43, 55, 0.66); }
.manual-preview__heading { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: 0.75rem; }
.manual-preview__selection { color: #b9dcea; font-size: 0.72rem; text-align: right; }
.manual-preview__metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.45rem; margin: 0 0 0.75rem; }
.manual-preview__metrics div { padding: 0.5rem; border: 1px solid rgba(146, 189, 211, 0.16); border-radius: 0.5rem; background: rgba(9, 27, 36, 0.6); }
.manual-preview__metrics dt { color: #7f9bab; font-size: 0.55rem; }
.manual-preview__metrics dd { margin: 0.2rem 0 0; color: #d5e7ef; font-size: 0.72rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.manual-preview__facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; margin-bottom: 0.75rem; }
.manual-preview__facts p { margin: 0; padding: 0.55rem; border-left: 2px solid rgba(116, 190, 220, 0.5); color: #a9bfcb; background: rgba(16, 35, 45, 0.48); font-size: 0.64rem; line-height: 1.45; overflow-wrap: anywhere; }
.manual-preview__resolution-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(15rem, 0.55fr); gap: 0.75rem; }
.manual-preview__resolution-grid > section { padding: 0.65rem; border: 1px solid rgba(143, 178, 198, 0.13); border-radius: 0.6rem; background: rgba(9, 25, 34, 0.5); }
.manual-preview__resolution-grid h4 { margin: 0 0 0.55rem; color: #9fc4d8; font-size: 0.68rem; }
.manual-damage-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.45rem; }
.manual-damage { padding: 0.55rem; border: 1px solid rgba(214, 154, 177, 0.25); border-radius: 0.5rem; background: rgba(62, 29, 41, 0.38); }
.manual-damage--guard { border-color: rgba(120, 184, 224, 0.35); background: rgba(28, 60, 78, 0.45); }
.manual-damage__title { display: flex; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.4rem; }
.manual-damage__title strong { font-size: 0.7rem; }
.manual-damage__title span { color: #9eb3c0; font-size: 0.53rem; }
.manual-damage dl { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem; margin: 0; }
.manual-damage dl div { display: flex; justify-content: space-between; gap: 0.35rem; padding: 0.25rem; border-radius: 0.3rem; background: rgba(8, 20, 27, 0.45); font-size: 0.55rem; }
.manual-damage dt { color: #8299a8; }
.manual-damage dd { margin: 0; color: #dce9ef; font-weight: 800; font-variant-numeric: tabular-nums; }
.manual-damage small { display: block; margin-top: 0.38rem; color: #8fb6cc; font-size: 0.52rem; }
.manual-preview__secondary { margin: 0 0 0.45rem; color: #a9bdc8; font-size: 0.62rem; line-height: 1.5; }
.manual-preview__confirm-row { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(135, 180, 203, 0.16); }
.manual-preview__confirm-row p { margin: 0; color: #829baa; font-size: 0.58rem; line-height: 1.45; }
.control-button--confirm { flex: none; border-color: rgba(100, 214, 153, 0.58); background: linear-gradient(135deg, #17633f, #1e5f55); font-weight: 900; }
.board-cell--preview-affected { box-shadow: inset 0 0 0 2px rgba(244, 193, 92, 0.75); }
.board-cell--preview-selected { outline: 3px solid rgba(116, 206, 241, 0.82); outline-offset: -4px; }

@media (max-width: 920px) {
  .manual-preview__resolution-grid { grid-template-columns: 1fr; }
}

@media (max-width: 620px) {
  .manual-preview__heading, .manual-preview__confirm-row { align-items: stretch; flex-direction: column; }
  .manual-preview__selection { text-align: left; }
  .manual-preview__metrics { grid-template-columns: 1fr 1fr; }
  .manual-preview__facts { grid-template-columns: 1fr; }
  .control-button--confirm { width: 100%; }
}
'''
css_path.write_text(css)
