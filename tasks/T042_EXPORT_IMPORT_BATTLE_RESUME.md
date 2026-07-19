# T042 — エクスポート／インポート・戦闘再開

## 目的

PlayerDataと中断中の戦闘を端末外へ安全に移動でき、ブラウザ終了後も直前のstable戦闘状態から再開できるようにする。

## 実装範囲

- [x] PlayerDataと中断戦闘を含むversion付きJSON転送形式
- [x] 転送payload全体の正規化チェックサム
- [x] インポート時の形式、version、チェックサム、PlayerData、戦闘snapshot検証
- [x] 旧schemaのJSONをT041 migrationへ接続
- [x] 対話型戦闘ランナーのstable snapshot取得・復元
- [x] timeline、unit state、effects、行動schedule、技使用状態、待機状態、AI履歴、ボスphaseの復元
- [x] 手動入力選択中は直前stableへ戻す
- [x] IndexedDB generationへの中断戦闘保存
- [x] 起動時・スロットロード時の中断戦闘再開
- [x] セーブ画面のJSONエクスポート／インポートUI
- [x] JSON往復、改変検知、migration、戦闘継続の回帰テスト

## 非対象

- クラウド同期
- 複数端末間の競合解決
- active expedition等、戦闘以外の中断状態
- JSONファイルの暗号化

## 完了条件

- JSONエクスポート後にインポートするとPlayerDataと中断戦闘が一致する
- 改変されたJSONは保存前に拒否される
- snapshot復元後の最終戦闘結果が中断しなかった場合と一致する
- リロード後に使用中スロットの中断戦闘を再開できる
- 既存のPlayerData-only generationを引き続きロードできる
- 全CIが成功する
