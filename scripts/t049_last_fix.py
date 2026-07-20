from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


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
    if "resolveDisplayName" not in text:
        raise SystemExit(f"display resolver is not imported in {path}")
    write(path, text)

manual_path = "src/ui/ManualActionPanel.tsx"
manual = read(manual_path)
manual = manual.replace("<dd>{preview.toPositionId}</dd>", "<dd>{positionLabel(preview.toPositionId)}</dd>")
if "<dd>{preview.toPositionId}</dd>" in manual:
    raise SystemExit("raw destination position remains in ManualActionPanel")
write(manual_path, manual)

print("T049 final TypeScript and position-label fixes completed")
