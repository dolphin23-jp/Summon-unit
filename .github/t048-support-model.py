from pathlib import Path

path = Path('src/content/vertical-slice-content.ts')
text = path.read_text()
old = """    definition: Object.freeze({
      ...record.definition,
      ...(healingPower === undefined ? {} : { healingPower }),
    }),
"""
new = """    definition: Object.freeze({
      ...record.definition,
      ...(healingPower === undefined
        ? {}
        : {
            healingPower,
            cooldownActions: record.definition.cooldownActions ?? 2,
          }),
    }),
"""
if old not in text:
    raise SystemExit('healing cooldown anchor not found')
path.write_text(text.replace(old, new, 1))
Path('.github/t048-support-model.py').unlink()
Path('.github/workflows/t048-support-model.yml').unlink(missing_ok=True)
