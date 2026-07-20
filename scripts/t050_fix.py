from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    if old in text:
        path.write_text(text.replace(old, new, 1), encoding='utf-8')
        return
    if new not in text:
        raise SystemExit(f'expected fragment not found in {path}: {old[:80]}')


save_path = Path('src/ui/SaveSlotScreen.tsx')
save_text = save_path.read_text(encoding='utf-8')
old_union = """type PendingSaveAction =
  | { readonly kind: 'OVERWRITE' | 'LOAD' | 'DELETE'; readonly slotId: SaveSlotId }
  | { readonly kind: 'IMPORT'; readonly json: string }
"""
new_union = """type PendingSaveAction =
  | { readonly kind: 'OVERWRITE'; readonly slotId: SaveSlotId }
  | { readonly kind: 'LOAD'; readonly slotId: SaveSlotId }
  | { readonly kind: 'DELETE'; readonly slotId: SaveSlotId }
  | { readonly kind: 'IMPORT'; readonly json: string }
"""
if old_union in save_text:
    save_text = save_text.replace(old_union, new_union, 1)
if "from '../content/display-masters'" not in save_text:
    save_text = "import { resolveStageName } from '../content/display-masters'\n" + save_text
save_text = save_text.replace(
    "<dd>{summary.resumableBattleStageId ?? 'なし'}</dd>",
    "<dd>{summary.resumableBattleStageId === null ? 'なし' : resolveStageName(summary.resumableBattleStageId)}</dd>",
)
save_path.write_text(save_text, encoding='utf-8')

research_path = Path('src/ui/ResearchScreen.tsx')
research = research_path.read_text(encoding='utf-8')
replace_once(
    research_path,
    """  const [catalystIds, setCatalystIds] = useState<readonly string[]>(
    definition.candidateRange.catalystIds.slice(0, definition.candidateRange.minimumCatalystCount),
  )

  const submit = () => {
    try {
""",
    """  const [catalystIds, setCatalystIds] = useState<readonly string[]>(
    definition.candidateRange.catalystIds.slice(0, definition.candidateRange.minimumCatalystCount),
  )
  const [confirmOpen, setConfirmOpen] = useState(false)

  const submit = () => {
    setConfirmOpen(false)
    try {
""",
)
research = research_path.read_text(encoding='utf-8')
replace_once(
    research_path,
    """      <button
        type=\"button\"
        className=\"collection-button collection-button--primary\"
        onClick={submit}
      >
        この条件で試験
      </button>
    </section>
""",
    """      <button
        type=\"button\"
        className=\"collection-button collection-button--primary\"
        onClick={() => setConfirmOpen(true)}
      >
        この条件で試験
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title=\"この条件で試験研究を行いますか？\"
        description=\"素材個体と触媒は消費しませんが、研究データを消費して適合結果を記録します。\"
        details={[
          `消費: 研究データ ${definition.trialResearchDataCost}`,
          `研究方式: ${METHOD_LABELS[method]}`,
          `素材候補: ${materialSpeciesIds.map(resolveDisplayName).join(' / ') || 'なし'}`,
          `触媒候補: ${catalystIds.map(resolveDisplayName).join(' / ') || 'なし'}`,
        ]}
        confirmLabel=\"研究データを消費して試験\"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submit}
      />
    </section>
""",
)

build_log = Path('t050-build.log')
if build_log.exists():
    build_log.unlink()

print('T050 confirmation coverage and display cleanup fixed')
