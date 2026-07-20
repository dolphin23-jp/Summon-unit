from __future__ import annotations

import runpy
from pathlib import Path

base = Path(__file__).parent
runpy.run_path(str(base / 't049_finalize.py'), run_name='__main__')
runpy.run_path(str(base / 't049_followup.py'), run_name='__main__')
