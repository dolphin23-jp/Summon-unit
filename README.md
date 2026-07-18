# Monster Research Tactics

ブラウザで動作する、モンスター収集・研究・編成型タクティクスゲームです。

本企画は、3×3陣形、モンスター研究、新種発見という着想を持ちつつ、戦闘は独自の決定論的タイムライン方式を採用します。オート戦闘を基本とし、必要な一手だけ手動介入できます。

## 開発方針

- GitHub上で仕様・タスク・実装を一元管理する
- Vercelでブラウザ版を公開する
- Codexには一度に一つの小さなタスクだけを実装させる
- 仕様変更と実装変更を無断で混在させない
- 戦闘ロジック、UI、コンテンツデータ、セーブを分離する
- 同じ入力から同じ結果を再現できる決定論を優先する

## 技術基盤

- Vite
- React 18
- TypeScript strict
- pnpm 10.13.1
- Vitest
- ESLint
- Prettier
- GitHub Actions (`test`, `lint`, `build`)
- Vercel（静的SPA）

依存パッケージは `package.json` で固定バージョンを指定します。技術的な理由で変更する場合は、実装前に `docs/17_IMPLEMENTATION_ROADMAP.md` とADRを更新します。

## ローカル開発

Node.js 20以上を使用します。

```bash
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install --no-frozen-lockfile
pnpm dev
```

検証:

```bash
pnpm test
pnpm lint
pnpm build
```

## 文書の読み順

1. `docs/00_GAME_VISION.md`
2. `docs/01_CORE_LOOP.md`
3. `docs/02_BATTLE_RULES.md` ～ `docs/12_UI_UX.md`
4. `docs/13_CONTENT_AUTHORING_RULES.md`
5. `docs/14_VERTICAL_SLICE.md`
6. `docs/15_BALANCE_GUIDELINES.md`
7. `docs/16_DATA_SCHEMAS.md`
8. `docs/17_IMPLEMENTATION_ROADMAP.md`
9. `AGENTS.md`
10. `tasks/STATUS.md` の未完了タスクを上から実装

## 現在の状態

- 設計基準：確定
- 数値バランス：仮置き
- 開発環境・CI・Vercel設定：完了
- 盤面座標・陣営モデル：完了
- モンスター種マスター・戦闘ユニット状態モデル：完了
- 決定論的タイムラインキュー：完了
- 整数tickによる行動時刻計算・再スケジュール：完了
- 単体固有技・整数ダメージ計算：完了
- 戦闘不能処理・占有解除・全滅勝敗判定：完了
- 次の実装対象：T009「戦闘イベントログ」

詳細な確定・暫定区分は `docs/DECISIONS.md` を参照してください。
