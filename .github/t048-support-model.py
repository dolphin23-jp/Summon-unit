from pathlib import Path

path = Path('src/battle/interactive-battle-runner.ts')
text = path.read_text()
old = """      if (skill.healingPower === undefined) return []
      const targets = evaluation.preview.targetResults.map((predicted) => {
        const target = getRequiredUnit(input.battle, predicted.battleUnitId)
        const species = getRequiredSpecies(context.speciesById, target.speciesId)
        const healing = resolveUnitHealing(target, species, skill.healingPower)
"""
new = """      const healingPower = skill.healingPower
      if (healingPower === undefined) return []
      const targets = evaluation.preview.targetResults.map((predicted) => {
        const target = getRequiredUnit(input.battle, predicted.battleUnitId)
        const species = getRequiredSpecies(context.speciesById, target.speciesId)
        const healing = resolveUnitHealing(target, species, healingPower)
"""
if old not in text:
    raise SystemExit('healing power narrowing anchor not found')
path.write_text(text.replace(old, new, 1))
Path('.github/t048-support-model.py').unlink()
Path('.github/workflows/t048-support-model.yml').unlink(missing_ok=True)
