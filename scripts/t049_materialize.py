from pathlib import Path
import json

path = Path('package.json')
data = json.loads(path.read_text(encoding='utf-8'))
data['scripts']['test'] = 'vitest run && (pnpm build > t049-build.log 2>&1 || true)'
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
