# 臨時タスク: 図鑑・編成カードへのモンスター画像表示

## 完了条件

- [x] 垂直スライス16体のPNGを`public/monsters/<speciesId>.png`へ配置する
- [x] 図鑑・編成カード・種詳細で`/monsters/<speciesId>.png`を表示する
- [x] 画像の読み込み失敗をReact stateで管理し、従来の頭文字プレースホルダーへ戻す
- [x] 未開示種では画像を読み込まず`?`表示を維持する
- [x] demo種と画像未配置の拡張種がフォールバックするテストを1件追加する
- [x] `import.meta.glob`を使用しない

## 検証

- `pnpm validate:content`
- `pnpm test`
- `pnpm demo:headless`
- `pnpm benchmark:ai`
- `pnpm lint`
- `pnpm build`
