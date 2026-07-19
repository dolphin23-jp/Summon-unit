from pathlib import Path


def patch(path: str, replacements: list[tuple[str, str]]) -> None:
    file = Path(path)
    text = file.read_text()
    for old, new in replacements:
        if old not in text:
            raise RuntimeError(f'pattern not found in {path}: {old[:100]!r}')
        text = text.replace(old, new, 1)
    file.write_text(text)


patch('src/ui/MinimalBattleScreen.tsx', [
    (
        "import { useEffect, useMemo, useState } from 'react'",
        "import { useEffect, useMemo, useRef, useState } from 'react'",
    ),
    (
        """  type InteractiveBattleRunner,
  type InteractiveBattleSnapshot,""",
        """  type InteractiveBattleRunner,
  type InteractiveBattleSnapshot,
  type InteractiveBattleStableSnapshot,""",
    ),
    (
        """function createRunner(definition: HeadlessBattleDefinition): InteractiveBattleRunner {
  return createInteractiveBattleRunner(definition)
}""",
        """function createRunner(
  definition: HeadlessBattleDefinition,
  stableSnapshot?: InteractiveBattleStableSnapshot,
): InteractiveBattleRunner {
  return createInteractiveBattleRunner(definition, stableSnapshot)
}""",
    ),
    (
        """  readonly allowFastMode?: boolean
  readonly onOpenFormation?: () => void""",
        """  readonly allowFastMode?: boolean
  readonly initialStableSnapshot?: InteractiveBattleStableSnapshot
  readonly initialAttempt?: number
  readonly onStableSnapshot?: (
    snapshot: InteractiveBattleStableSnapshot,
    attempt: number,
  ) => void
  readonly onOpenFormation?: () => void""",
    ),
    (
        """  allowFastMode = false,
  onOpenFormation,""",
        """  allowFastMode = false,
  initialStableSnapshot,
  initialAttempt = 0,
  onStableSnapshot,
  onOpenFormation,""",
    ),
    (
        '  const [runner, setRunner] = useState(() => createRunner(definition))',
        """  const [runner, setRunner] = useState(() =>
    createRunner(definition, initialStableSnapshot),
  )""",
    ),
    (
        '  const [attempt, setAttempt] = useState(0)\n',
        """  const [attempt, setAttempt] = useState(initialAttempt)
  const stableSnapshotCallbackRef = useRef(onStableSnapshot)

  useEffect(() => {
    stableSnapshotCallbackRef.current = onStableSnapshot
  }, [onStableSnapshot])
""",
    ),
    (
        """  useEffect(() => {
    if (!allowFastMode && speed === 8) setSpeed(4)
  }, [allowFastMode, speed])
""",
        """  useEffect(() => {
    if (!allowFastMode && speed === 8) setSpeed(4)
  }, [allowFastMode, speed])

  useEffect(() => {
    if (snapshot.status === 'AWAITING_MANUAL_ACTION') return
    stableSnapshotCallbackRef.current?.(runner.getStableSnapshot(), attempt)
  }, [attempt, runner, snapshot.manualAllyActionRequested, snapshot.status, snapshot.totalActions])
""",
    ),
])

patch('src/ui/SaveSlotScreen.tsx', [
    (
        """  readonly onAutosaveChange: (enabled: boolean) => void
  readonly onBack: () => void""",
        """  readonly onAutosaveChange: (enabled: boolean) => void
  readonly onExportJson: () => void
  readonly onImportJson: (json: string) => void
  readonly onBack: () => void""",
    ),
    (
        """  onAutosaveChange,
  onBack,""",
        """  onAutosaveChange,
  onExportJson,
  onImportJson,
  onBack,""",
    ),
    (
        '      {notice !== null && (',
        """      <section className="save-transfer collection-panel" aria-labelledby="save-transfer-title">
        <div>
          <p className="panel-heading__kicker">PORTABLE JSON</p>
          <h2 id="save-transfer-title">エクスポート・インポート</h2>
          <p>使用中スロットの進行とstable戦闘スナップショットを、整合性チェック付きJSONで移動できます。</p>
        </div>
        <div className="save-transfer__actions">
          <button
            type="button"
            className="collection-button"
            disabled={busy}
            onClick={onExportJson}
          >
            使用中スロットをJSON保存
          </button>
          <label className={`collection-button save-import-button${busy ? ' is-disabled' : ''}`}>
            JSONを使用中スロットへ読込
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file !== undefined) void file.text().then(onImportJson)
              }}
            />
          </label>
        </div>
      </section>

      {notice !== null && (""",
    ),
    (
        '                    <div><dt>content</dt><dd>{summary.contentVersion}</dd></div>\n                  </dl>',
        """                    <div><dt>content</dt><dd>{summary.contentVersion}</dd></div>
                    <div><dt>中断戦闘</dt><dd>{summary.resumableBattleStageId ?? 'なし'}</dd></div>
                  </dl>""",
    ),
])

css = Path('src/t040.css')
css.write_text(css.read_text() + """

.save-transfer {
  width: min(94rem, 100%);
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.save-transfer h2,
.save-transfer p {
  margin-bottom: 0;
}

.save-transfer p:last-child {
  margin-top: 0.45rem;
  color: #91aaa9;
  line-height: 1.5;
}

.save-transfer__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.55rem;
}

.save-import-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.save-import-button.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-import-button input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 680px) {
  .save-transfer {
    align-items: stretch;
    flex-direction: column;
  }

  .save-transfer__actions,
  .save-transfer__actions .collection-button {
    width: 100%;
  }
}
""")
