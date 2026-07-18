# 11. Save and Compatibility

## 原則

- マスターデータとプレイヤーデータを分離
- 表示名ではなく固定IDを保存
- 公開済みIDは変更・再利用しない
- 派生情報は保存せず計算
- 数量・解析度・時間は整数保存

## 保存先

- 主要データ: IndexedDB
- 軽量端末設定: localStorage
- JSONエクスポート・インポート
- 将来のクラウドはRepository Adapterで追加

## セーブスロット

最大3を基準とします。

各スロット:

- 現行
- 直前バックアップ
- 最大3世代候補

## 種と個体

種状態:

- blueprintUnlocked
- analysisBasisPoints
- bloomSkillIds
- encyclopediaStage
- statistics

個体:

- instanceId
- speciesId
- learnedGenericSkillIds
- nickname
- favorite / locked
- condition

## ロードアウト

装備状態は編成側に保存します。同じ個体を異なる編成で別設定にできます。

## 研究状態

`hidden / hinted / candidate / known / completed`

試験研究の正規化署名を保存します。

## 戦闘中断

戦闘は処理途中ではなく `stable` 状態だけ保存します。

保存対象:

- seed
- virtualTime
- eventSequence
- unit states
- timeline / scheduled events
- effects / terrain
- defeat / revive counters
- manual inputs

処理中に終了した場合は直前のstableへ戻ります。

## アトミック保存

1. 仮領域へ書く
2. 整合性検証
3. 現行ポインタ切替
4. 旧現行をバックアップ

資源だけ減って成果が増えない状態を保存しません。

## バージョン

- schemaVersion
- gameVersion
- contentVersion

migrationは1段階ずつ、変換前バックアップを保持します。

## コンテンツ変更

- 名前変更: ID維持
- 性能変更: 全既存個体に新マスターを適用
- 技廃止: IDを残して非推奨化
- レシピ変更: 解放済み設計図を維持
- モンスター削除: 原則禁止
