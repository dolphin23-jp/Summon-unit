from pathlib import Path

path = Path('src/content/vertical-slice-content.ts')
text = path.read_text()
text = text.replace(
    "? Math.max(1, Math.floor(record.definition.actionCost / 2))",
    "? Math.max(1, Math.floor(record.definition.actionCost / 3))",
    1,
)
text = text.replace(
    "cooldownActions: record.definition.cooldownActions ?? 2,",
    "cooldownActions: record.definition.cooldownActions ?? 3,",
    1,
)
path.write_text(text)
Path('.github/t048-support-model.py').unlink()
Path('.github/workflows/t048-support-model.yml').unlink(missing_ok=True)
