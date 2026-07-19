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

## 経済

T034からPlayerDataは次を保存します。

- 基本通貨
- 研究データ
- `catalystId`ごとの個別触媒数量

数量は非負の安全な整数です。触媒残高は固定ID順へ正規化し、残高0は保存しません。複数資源を変更する操作は一括検証後に確定し、資源の一部だけが変化した状態を保存しません。

## 種と個体

種状態:

- blueprintUnlocked
- analysisBasisPoints
- bloomSkillIds
- encyclopediaStage
- statistics

解析度は0～10000の整数basis pointsです。増加源は味方使用、敵遭遇、技観察、解析データ投入、同種標本消費の固定5種類ですが、保存する正本は現在値であり、表示用の派生率は保存しません。

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

戦闘は処理途中ではなく`stable`状態だけ保存します。

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

資源だけ減って成果が増えない状態を保存しません。T034のメモリ内トランザクションも同じ原則で、経済差分と解析度増加を一つの結果として返します。

## バージョン

- schemaVersion
- gameVersion
- contentVersion

migrationは1段階ずつ、変換前バックアップを保持します。T034のデモPlayerDataは経済フィールド追加に伴いschemaVersion 2です。IndexedDB永続化前のため、公開済みセーブmigrationはまだ実行しません。

## コンテンツ変更

- 名前変更: ID維持
- 性能変更: 全既存個体に新マスターを適用
- 技廃止: IDを残して非推奨化
- レシピ変更: 解放済み設計図を維持
- モンスター削除: 原則禁止
