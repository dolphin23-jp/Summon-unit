# T002: 開発環境・テスト・CI・Vercelを整える

## 目的

Vite/React/TypeScript strict、pnpm、Vitest、ESLint、Prettier、GitHub Actions、Vercelの最小基盤を構築する。

## 背景・参照仕様

- `AGENTS.md`
- `docs/17_IMPLEMENTATION_ROADMAP.md`
- 関連する個別仕様書

## 実装範囲

- Vite + React 18 + TypeScript strict
- pnpm固定
- Vitestのサンプルテスト
- ESLint・Prettier
- GitHub Actionsで test/lint/build
- Vercel静的SPA設定

## 対象外

- 戦闘ロジック
- 完成UI
- ゲームコンテンツ

## 守るべき不変条件

- UIと戦闘ロジックを分離する
- 固定IDを使用する
- 同条件で同結果となる
- このタスクの対象外を先回りしない

## 完了条件

- [ ] pnpm test/lint/build成功
- [ ] PRでActions成功
- [ ] Vercelプレビュー表示
- [ ] 関連する単体テストを追加する
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` が成功する

## 手動確認

1. READMEまたはPR本文に実行コマンドを記載する。
2. 期待結果と実結果を確認する。
3. 決定論に関係する場合は複数回実行する。

## データ・セーブ互換性

初期タスクでは原則セーブ形式を導入しない。永続IDへ影響する変更は文書化する。

## 完了報告

- 変更概要
- 変更ファイル
- テスト結果
- 手動確認
- 残課題

## 次のタスク

`tasks/STATUS.md` の順序に従う。
