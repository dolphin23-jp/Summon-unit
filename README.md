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

ブラウザ画面では、標準3対3の確定済み戦闘を6×3盤面で再生できます。`AUTO開始`、`一時停止`、`×1 / ×2`、`リセット`はマウスとタッチの両方で操作できます。

検証:

```bash
pnpm test
pnpm lint
pnpm demo:headless
pnpm build
```

`pnpm demo:headless` は標準4種・3対3のヘッドレス戦闘を実行し、勝敗、仮想時刻、行動回数、最終状態、イベントログをJSONで出力します。

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
- 連続sequence・virtualTime付き戦闘イベントログ：完了
- 4種5体の固定戦闘を100回再実行する決定論リファレンステスト：完了
- 自陣内8方向の通常移動・占有更新・移動イベント：完了
- 同列の最前敵で停止するDIRECT射程・遮蔽プレビュー：完了
- 予測ダメージ・撃破・行動コスト・射程接近による最小オートAI：完了
- 標準4種・3対3の決定論的ヘッドレス戦闘デモ：完了
- ヘッドレス結果を再生する6×3最小盤面UI：完了
- Phase 1のT001～T015：完了
- Phase 2 T016の効果状態・5持続単位・同名重複規則・10段階処理フック・効果イベントログ：完了
- Phase 2 T017の7属性相性・5種ステータス補正・タグ式状態耐性：完了
- Phase 2 T018の毒・火傷・移動不能・開花技封印・回復阻害・行動開始状態処理：完了
- Phase 2 T019の対象選択一般化・固有特性基盤・時間操作・正式待機・クールダウン・回数制限・使用条件：完了
- Phase 2 T020の複数障壁レイヤー・最終ダメージ肩代わり・障壁イベント・再生UI表示：完了
- Phase 2 T021の到達方式・9種範囲マスク・一歩強制移動・決定論テスト：完了
- Phase 2 T022の予兆予約・占有型設置物・非占有領域・決定論テスト：完了

次の実装対象はT023「召喚・蘇生」です。詳細な確定・暫定区分は `docs/DECISIONS.md` を参照してください。
