from pathlib import Path

path = Path('/tmp/apply_t030.py')
text = path.read_text()

replacements = [
    (
        'ブラウザ画面では、標準3対3の戦闘を1行動ずつ実行できます。`AUTO開始`、`一時停止`、`1行動進める`、`×1 / ×2 / ×4`、`次の味方を手動`、`リセット`はマウスとタッチの両方で操作できます。\n',
        'ブラウザ画面では、標準3対3の戦闘を1行動ずつ実行できます。`AUTO開始`、`一時停止`、`1行動進める`、`×1 / ×2 / ×4`、`次の味方を手動`、`リセット`はマウスとタッチの両方で操作できます。盤面にはHP・障壁・属性・主要状態・次回行動・予兆対象を表示し、未来12件のタイムラインとAI判断理由を同時に確認できます。\n',
    ),
    (
        '- Phase 4 T028の1行動実行・イベント購読・設定済みAI・AUTO速度・次の味方への手動割込：完了\n\n次の実装対象はT029「戦闘画面一式」です。詳細な確定・暫定区分は `docs/DECISIONS.md` を参照してください。\n',
        '- Phase 4 T028の1行動実行・イベント購読・設定済みAI・AUTO速度・次の味方への手動割込：完了\n- Phase 4 T029の盤面常時情報・未来12件タイムライン・仮位置表示・詳細理由パネル：完了\n\n次の実装対象はT030「手動操作・確定前プレビュー」です。詳細な確定・暫定区分は `docs/DECISIONS.md` を参照してください。\n',
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'expected one script replacement, got {count}: {old[:80]!r}')
    text = text.replace(old, new, 1)

path.write_text(text)
