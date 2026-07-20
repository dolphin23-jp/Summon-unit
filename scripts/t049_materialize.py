from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "agent/t049-display-name-masters"


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=ROOT, check=check, text=True, capture_output=True)


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


for path in ("src/ui/CollectionScreen.tsx", "src/ui/ResearchScreen.tsx"):
    text = read(path)
    text = text.replace("displayName(", "resolveDisplayName(")
    text = text.replace("map(displayName)", "map(resolveDisplayName)")
    if "displayName(" in text or "map(displayName)" in text:
        raise SystemExit(f"stale displayName reference remains in {path}")
    write(path, text)

manual_path = "src/ui/ManualActionPanel.tsx"
manual = read(manual_path).replace(
    "<dd>{preview.toPositionId}</dd>",
    "<dd>{positionLabel(preview.toPositionId)}</dd>",
)
if "<dd>{preview.toPositionId}</dd>" in manual:
    raise SystemExit("raw destination position remains in ManualActionPanel")
write(manual_path, manual)

run("git", "config", "user.name", "github-actions[bot]")
run("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
run(
    "git",
    "add",
    "src/ui/CollectionScreen.tsx",
    "src/ui/ResearchScreen.tsx",
    "src/ui/ManualActionPanel.tsx",
)
if run("git", "diff", "--cached", "--quiet", check=False).returncode == 0:
    print("T049 product fixes already present")
    raise SystemExit(0)
run("git", "commit", "-m", "T049: fix final display-name references")

for attempt in range(1, 5):
    run("git", "fetch", "origin", BRANCH)
    run("git", "rebase", f"origin/{BRANCH}")
    pushed = run("git", "push", "origin", f"HEAD:{BRANCH}", check=False)
    if pushed.returncode == 0:
        print("T049 product fixes pushed")
        break
    if attempt == 4:
        raise SystemExit(pushed.stderr or pushed.stdout)
else:
    raise SystemExit("could not push T049 product fixes")
