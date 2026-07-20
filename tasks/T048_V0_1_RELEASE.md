# T048 — 合格条件検証・v0.1リリース

## 目的

`docs/14_VERTICAL_SLICE.md`の合格条件を検証し、Vercel production確認後に`v0.1.0`を公開する。

## 実施内容

- [x] T046調整済みカタログを実行時へ接続
- [x] `docs/14`合格条件を根拠つきで判定
- [x] 低レア開花研究をUIへ接続
- [x] 味方・自身対象の回復技をAUTO／手動へ統合
- [x] 実回復量と過剰回復率をイベントログ・ベンチへ追加
- [x] 回復クールダウンを設定し51戦タイムアウト0を確認
- [x] content、tests、headless、AI／balance benchmark、lint、buildを成功
- [x] 一時パッチWorkflow・診断トリガーを削除し、標準CIだけのclean headへ戻す
- [ ] Vercel productionで主要導線をスモーク確認
- [ ] versionを`0.1.0`へ確定
- [ ] `v0.1.0`タグとGitHub Releaseを作成

## 現在の判定

**CODE GO / EXTERNAL DEPLOYMENT PENDING**

コード側のrelease blockerは解消した。Vercel無料枠の日次デプロイ上限により最終production確認だけが実行不能であるため、現在は`0.1.0-rc.2`として保持し、最終タグは作成しない。

## 最終統合条件

マージ対象headには製品コード、テスト、ベンチマーク、文書だけを含める。標準CIでcontent validation、全テスト、headless、AI／balance benchmark、lint、buildが成功したclean headだけを`main`へ統合する。

## 次の操作

Vercel上限解除後にproductionスモークを実施し、成功した場合のみ残る3項目を完了させる。
