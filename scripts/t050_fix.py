from pathlib import Path

path = Path('src/ui/SaveSlotScreen.tsx')
text = path.read_text(encoding='utf-8')
old = """type PendingSaveAction =
  | { readonly kind: 'OVERWRITE' | 'LOAD' | 'DELETE'; readonly slotId: SaveSlotId }
  | { readonly kind: 'IMPORT'; readonly json: string }
"""
new = """type PendingSaveAction =
  | { readonly kind: 'OVERWRITE'; readonly slotId: SaveSlotId }
  | { readonly kind: 'LOAD'; readonly slotId: SaveSlotId }
  | { readonly kind: 'DELETE'; readonly slotId: SaveSlotId }
  | { readonly kind: 'IMPORT'; readonly json: string }
"""
if old not in text:
    if new not in text:
        raise SystemExit('PendingSaveAction definition not found')
else:
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

build_log = Path('t050-build.log')
if build_log.exists():
    build_log.unlink()

print('T050 save action narrowing fixed')
