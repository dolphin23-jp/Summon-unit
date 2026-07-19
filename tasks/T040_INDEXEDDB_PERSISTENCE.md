# T040 — IndexedDB永続化

## 目的

T039までメモリ内だけで保持していたPlayerDataをブラウザ再読み込み後も復元できるようにする。主要データはIndexedDB、使用中スロットと自動保存設定はlocalStorageへ分離する。

## 実装範囲

- 固定3スロット（`slot-1`～`slot-3`）
- Repositoryアダプタ境界
- IndexedDB実装
- 現在世代と最大3件のバックアップ世代
- 仮世代への書き込み、再読込検証、ポインタ切替の順で行うアトミック保存
- チェックサムと既存PlayerData正規化による整合性検証
- 現在世代が破損している場合のバックアップ読込
- 使用中スロット、自動保存ON/OFFのlocalStorage保存
- 起動時の自動復元
- PlayerData変更時の直列化された自動保存
- 保存、ロード、削除、スロット切替UI

## 保存構造

### generationレコード

- `generationId`
- `slotId`
- `savedAtEpochMs`
- `TEMPORARY / COMMITTED`
- PlayerDataチェックサム
- 正規化済みPlayerData

### slot pointer

- `slotId`
- `currentGenerationId`
- `backupGenerationIds`（新しい順、最大3）
- `updatedAtEpochMs`

PlayerDataそのものへセーブスロット情報や保存日時は追加しない。

## アトミック保存

1. 新しいgenerationを`TEMPORARY`として書く。
2. IndexedDBから再読込する。
3. `createStagePlayerData`による全体検証とチェックサム照合を行う。
4. 一つのIndexedDB readwrite transaction内で以下を確定する。
   - generationを`COMMITTED`へ変更
   - 新generationをcurrentへ切替
   - 旧currentをバックアップ先頭へ移動
   - 4世代目以降のバックアップを削除
5. 失敗時は仮generationを削除し、既存current pointerを変更しない。

## UI

- 3スロットを常時表示
- 保存日時、資源、所持個体数、クリア数、schema/content version、バックアップ数を表示
- 空きスロットへの保存
- 既存スロットの上書き
- 非アクティブスロットのロードと削除
- 使用中スロットの削除は禁止
- 自動保存ON/OFF
- IndexedDB未対応時はゲームを継続しつつ永続化不可を通知

## 検証

- 仮保存の検証成功後だけpointerが切り替わる
- 仮保存の検証失敗では旧currentが維持される
- バックアップは新しい順で最大3件
- 破損currentを飛ばして有効なバックアップを読める
- 3スロットが独立する
- localStorage設定が往復する
- malformed設定は安全な既定値へ戻る
- 既存テスト、ヘッドレスデモ、AIベンチ、lint、buildが通る

## 対象外

- schemaVersionを一段ずつ変換するmigration（T041）
- migration前バックアップと失敗時復帰（T041）
- JSONエクスポート／インポート（T042）
- stable戦闘スナップショットと戦闘中断復帰（T042）
- クラウド同期

## 次タスク

T041「migration基盤」。
