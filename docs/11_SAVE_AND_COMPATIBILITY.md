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

T040ではPlayerData全体をIndexedDBへ保存します。localStorageへ保存するのは使用中スロットIDと自動保存ON/OFFだけです。PlayerData、資源、研究、編成、地域進行はlocalStorageへ複製しません。

## セーブスロット

固定3スロットを使用します。

- `slot-1`
- `slot-2`
- `slot-3`

各スロットは次を保持します。

- 現在世代1件
- 新しい順のバックアップ世代最大3件

保存日時や世代IDは保存管理用メタデータであり、PlayerDataへ追加しません。スロット間でgenerationとpointerを共有しません。

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

T036の確定研究は`blueprintUnlocked`をtrueへ変更し、研究ノードを`completed`へ進めます。解放済み設計図は、個体の還元や別研究での標本消費によってfalseへ戻しません。

T036の開花研究は個体ではなく種状態の`bloomSkillIds`へ保存します。同種の全個体が同じ解放状態を参照します。

個体:

- instanceId
- speciesId
- learnedGenericSkillIds
- nickname
- favorite / locked
- condition

召喚時のinstanceIdは呼び出し側が固定値を指定します。時刻、乱数、表示名から生成しません。conditionは0～10000で保存し、T036の修復は不足分に応じた通貨を消費して10000へ戻します。

## ロードアウト

装備状態は編成側に保存します。同じ個体を異なる編成で別設定にできます。開花技は種単位で解放されますが、装備は各編成メンバーの`bloomSkillId`一枠です。

## 研究状態

T035からPlayerDataは研究ノードごとに次を保存します。

- 固定`nodeId`
- `hidden / hinted / candidate / known / completed`
- 開示段階0～5
- 開示済み固定`hintId`
- 正規化済みの不正解試験署名

研究マスターの対象種、隣接、候補範囲、正解レシピ、ヒント定義はセーブへ複製せず、`contentVersion`に対応するマスターデータを参照します。マスターに存在しセーブにないノードは`hidden`・段階0として補完し、ノード、ヒント、署名は固定ID順へ正規化します。

不正解署名はノードID、研究方式、固定ID順の素材種、固定ID順の触媒から構築します。表示名、現在時刻、乱数は署名へ含めません。同じ署名は同一ノードで一度だけ保存します。

試験研究は研究データだけを消費し、個体と触媒は消費しません。候補範囲外、重複署名、研究データ不足では新しいPlayerDataを返さず、資源減少または署名追加だけが保存される状態を作りません。

T036の確定研究費、触媒数量、標本要件、開花研究しきい値と費用はプレイヤーセーブへ複製せず、`contentVersion`に対応するマスターを参照します。セーブには確定後の資源残高、所持個体、設計図、研究状態、開花技解放だけを保存します。

確定研究では資源、標本個体、研究状態、設計図を一括確定します。locked個体と編成中個体は標本へ使用できません。召喚、還元、修復、開花研究も同じ原子性原則に従います。

研究開示段階は対象種の図鑑段階へ反映します。図鑑段階は研究以外の情報源でも上がり得るため、研究処理は既存段階を下げません。

## 研究施設状態

T037から研究画面で扱うPlayerDataは次を保存します。

```ts
interface PlayerFacilityState {
  researchFacilityStage: number;
}
```

保存するのは現在段階だけです。最大研究可能レア度、更新時の基本通貨費、研究データ費は`contentVersion`に対応する施設マスターを参照し、セーブへ複製しません。

施設マスターが存在し、旧PlayerDataに施設状態がない場合は段階1へ補完します。施設マスターを持たないT032～T036の既存データ・テストでは施設状態を要求しません。

施設更新は基本通貨、研究データ、施設段階を一つの結果として返します。資源不足では段階だけを上げません。施設上限を超える試験・確定・開花研究は、資源・標本・研究状態を変更する前に拒否します。

## ステージ進行

T038～T039のPlayerDataは次を保存します。

- クリア済み固定`stageId`
- 精算済み固定`settlementId`
- 地域ごとのポイント
- 受取済み地域ポイント報酬ID

地域名、ステージ名、敵編成、報酬定義、解放条件はセーブへ複製せず、`contentVersion`に対応するマスターを参照します。

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

処理中に終了した場合は直前のstableへ戻ります。T040はPlayerDataの永続化だけを扱い、戦闘中断スナップショットはT042で実装します。

## generationレコード

T040のIndexedDBはPlayerDataを直接スロットキーへ上書きしません。保存ごとに独立したgenerationレコードを作成します。

```ts
interface SaveGenerationRecord {
  generationId: string;
  slotId: 'slot-1' | 'slot-2' | 'slot-3';
  savedAtEpochMs: number;
  state: 'TEMPORARY' | 'COMMITTED';
  checksum: string;
  playerData: PlayerData;
}
```

generationのPlayerDataは`createStagePlayerData`で経済、研究、施設、編成、ステージ進行まで再検証・正規化します。チェックサムは正規化済みPlayerDataから算出します。

## slot pointer

```ts
interface SaveSlotPointer {
  slotId: 'slot-1' | 'slot-2' | 'slot-3';
  currentGenerationId: string;
  backupGenerationIds: string[];
  updatedAtEpochMs: number;
}
```

`backupGenerationIds`は新しい順で最大3件です。currentが読めない、チェックサム不一致、PlayerData検証失敗の場合は、バックアップを新しい順に検証して最初の有効世代を復元します。

## アトミック保存

1. 新generationを`TEMPORARY`として仮領域へ書く
2. IndexedDBから再読込する
3. PlayerData全体とチェックサムを検証する
4. 単一のreadwrite transactionで次を確定する
   - generationを`COMMITTED`へ変更
   - current pointerを新generationへ切り替える
   - 旧currentをバックアップ先頭へ移動する
   - 最大数を超えた旧バックアップを削除する
5. 検証またはtransactionが失敗した場合は仮generationを削除し、旧pointerを維持する

資源だけ減って成果が増えない状態を保存しません。T034のメモリ内トランザクションは経済差分と解析度増加を一つの結果として返し、T035の試験研究は研究データ消費、判定結果、不正解署名、追加ヒントを一つのPlayerData結果として返します。

T036は次を一つのPlayerData結果として返します。

- 確定研究の資源・標本消費、研究完了、設計図解放
- 召喚の通貨消費と個体追加
- 還元の個体削除と通貨増加
- 修復の通貨消費とcondition回復
- 開花研究の資源消費と種単位技解放

T037は施設更新、および施設レア度ゲートを通過した試験・確定・開花研究について、施設状態を失わない一つのPlayerData結果を返します。

T038～T039は勝敗、報酬、地域ポイント、解析度、研究ヒント、個体condition、二重精算防止IDを一つのPlayerData結果として返します。T040はその完成済みPlayerDataだけを世代単位で保存します。

## 保存操作とUI

- 起動時にlocalStorageの使用中スロットを読み、IndexedDBのcurrentを復元する
- 使用中スロットが空の場合は初期PlayerDataを保存する
- PlayerData変更時は自動保存要求を直列化する
- 3スロットの保存日時、資源、所持個体数、クリア数、バージョン、バックアップ数を表示する
- 空きスロットへの保存、上書き、ロード、非使用中スロット削除を行える
- 使用中スロットは削除できない
- IndexedDB未対応時はゲームを継続し、永続化不可を通知する

## バージョン

- schemaVersion
- gameVersion
- contentVersion

migrationは1段階ずつ、変換前バックアップを保持します。T034のデモPlayerDataは経済フィールド追加に伴いschemaVersion 2です。T035では研究状態を追加し、正式なT035以降のデータはschemaVersion 3を使用します。

T036は既存の経済、研究、種状態、個体、編成フィールドを更新するだけであり、新しいPlayerData保存フィールドを追加しません。このためschemaVersionは3のままです。

T037デモは研究施設段階を追加するためschemaVersion 4を使用します。T038はステージ進行を追加しschemaVersion 5、T039デモは地域進行マスターとの接続に合わせてschemaVersion 6を使用します。

T040はPlayerDataへ新しいゲーム進行フィールドを追加せず、外側へgenerationとslot pointerを追加します。このためデモPlayerDataのschemaVersionは6のままです。IndexedDB永続化は実装済みですが、旧schemaを一段ずつ変換するmigrationはT041、JSON import/exportはT042で実装します。

## コンテンツ変更

- 名前変更: ID維持
- 性能変更: 全既存個体に新マスターを適用
- 技廃止: IDを残して非推奨化
- レシピ変更: 解放済み設計図を維持
- 施設費用変更: 現在段階を維持し、新しいマスター費用を次回更新へ適用
- モンスター削除: 原則禁止
