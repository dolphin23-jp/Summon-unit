from pathlib import Path

path = Path('src/ui/battle-replay.ts')
text = path.read_text()
old = """    case 'damage_applied':
      units = updateUnit(units, event.payload.targetBattleUnitId, (unit) => ({
        ...unit,
        hp: event.payload.hpAfter,
      }))
      break
    case 'unit_defeated':
"""
new = """    case 'damage_applied':
      units = updateUnit(units, event.payload.targetBattleUnitId, (unit) => ({
        ...unit,
        hp: event.payload.hpAfter,
      }))
      break
    case 'healing_applied':
      units = updateUnit(units, event.payload.targetBattleUnitId, (unit) => ({
        ...unit,
        hp: event.payload.hpAfter,
      }))
      break
    case 'unit_defeated':
"""
if old not in text:
    raise SystemExit('replay healing state anchor not found')
text = text.replace(old, new, 1)
old = """    case 'damage_applied':
      return `${shortId(event.payload.targetBattleUnitId)}に${event.payload.appliedDamage}ダメージ（HP ${event.payload.hpAfter}）`
    case 'effect_applied':
"""
new = """    case 'damage_applied':
      return `${shortId(event.payload.targetBattleUnitId)}に${event.payload.appliedDamage}ダメージ（HP ${event.payload.hpAfter}）`
    case 'healing_applied':
      return `${shortId(event.payload.targetBattleUnitId)}を${event.payload.appliedHealing}回復（過剰 ${event.payload.overheal} / HP ${event.payload.hpAfter}）`
    case 'effect_applied':
"""
if old not in text:
    raise SystemExit('replay healing display anchor not found')
path.write_text(text.replace(old, new, 1))
Path('.github/t048-support-model.py').unlink()
Path('.github/workflows/t048-support-model.yml').unlink(missing_ok=True)
