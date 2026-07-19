# T041 — migration基盤

## 目的

公開後のPlayerDataを一段ずつ安全に現行schemaへ変換し、変換前データを失わず、失敗時に旧セーブへ戻れる永続化境界を確立します。

## 実装

- `PlayerDataMigrationStep`を`fromVersion -> fromVersion + 1`へ限定
- migration planの重複、段階飛ばし、欠落、現行より新しいschemaを拒否
- JSONクローンを介して入力データを破壊せずに変換
- schema 1～6の変換履歴を明示
  - 1→2: 経済状態
  - 2→3: 研究状態
  - 3→4: 研究施設状態
  - 4→5: ステージ進行
  - 5→6: 地域進行接続に伴うversion更新
- 最終段階で`createStagePlayerData`による全PlayerData検証と正規化
- 旧schemaのchecksumを現行schema検証前に確認できるgeneration envelope検証
- `loadSaveSlot`で旧schemaを検出した場合に自動migration
- migration結果を新generationとしてアトミック保存
- 変換元generationを最優先バックアップとして保持
- migration失敗、検証失敗、commit失敗では旧pointerを維持
- currentが破損している場合はバックアップを新しい順に検証し、移行可能な世代から復元

## テスト

- v1→v6を一段ずつ変換する
- 段階を飛ばすmigration定義を拒否する
- 中間migration欠落を拒否する
- 変換元PlayerDataを変更しない
- migration後のcurrentがschema 6になる
- 変換元currentを最新バックアップとして残す
- commit失敗時にcurrent pointerと変換元generationを維持する
- 第3バックアップから移行した場合も変換元をバックアップ先頭へ残す

## 対象外

- JSON export/import
- 戦闘stable snapshotの保存・再開
- contentVersion固有のデータ変換
- クラウド同期

これらはT042以降で扱います。
