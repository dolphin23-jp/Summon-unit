# T032: プレイヤーデータ・編成モデル

## 目的

マスターデータとプレイヤーの可変状態を分離し、所持個体と編成設定を固定IDで保存できる境界を作る。T033の編成UI、T034以降の経済・研究、将来のIndexedDBアダプタが同じモデルへ接続できる状態にする。

## 参照仕様

- `docs/11_SAVE_AND_COMPATIBILITY.md`
- `docs/16_DATA_SCHEMAS.md`
- `docs/17_IMPLEMENTATION_ROADMAP.md`
- `AGENTS.md`

## 実装内容

### 種状態・所持個体

- 種ごとの設計図解放、解析度basis points、解放済み開花技、図鑑段階ID、拡張可能な整数統計
- 固定`instanceId`を持つ所持個体
- 個体ごとの習得済み汎用技、ニックネーム、お気に入り、ロック、condition basis points
- `speciesId`、`instanceId`、技IDを表示名や配列位置から独立した固定IDとして保存
- `MonsterSpecies.bloomSkillIds`を任意項目として追加し、種に属する開花技だけを解放可能にする

### 編成・ロードアウト

- 編成ID、表示名、最大9体のメンバー
- 味方3×3内の位置、個体ID、`tiePriority`
- 汎用技1枠・開花技1枠を編成メンバー側へ保存
- 個体別の個体作戦、チーム作戦、技ポリシー
- 同じ個体を複数の編成へ登録し、編成ごとに異なるロードアウトとAI設定を保持可能
- 戦闘用の装備技列を`固有 → 汎用 → 開花`の固定順で取得する関数

### Repository境界

- `PlayerDataRepository`をPromiseベースで定義
- 固定3スロット: `slot-1` / `slot-2` / `slot-3`
- `listSlots` / `load` / `save` / `delete`
- `MemoryPlayerDataRepository`は保存時・読込時に再検証し、外部参照から切り離したfreeze済みスナップショットを返す
- IndexedDB、JSON import/export、migrationは同じRepository境界へ後続アダプタとして追加可能

## 不変条件

- 同じ`speciesId`の種状態は一つ
- 同じ`instanceId`の所持個体は一つ
- 所持個体には対応する種状態が存在する
- 習得済み技は`GENERIC`スロットのみ
- 解放済み開花技は種マスターに属する`BLOOM`スロットのみ
- 一つの編成内で個体、位置、`tiePriority`を重複させない
- 装備汎用技はその個体が習得済み
- 装備開花技はその種で解放済み
- AI技ポリシーは固有技と現在の装備技だけを参照する
- activeFormationIdは実在する編成を参照する
- 数量、解析度、condition、統計は非負の安全な整数

## 決定論・非破壊性

- 種状態、個体、編成、統計キー、技ID、AI技ポリシーを固定ID順へ正規化する
- 編成メンバーは3×3位置順へ正規化する
- 現在時刻、乱数、表示名を識別や順序決定に使用しない
- 入力配列・マスターデータを変更せず、新しいfreeze済みデータを返す
- Repositoryからの複数回loadは同値だが別参照のスナップショットを返す

## テスト

`src/progression/player-data.test.ts`で以下を検証する。

- 固定ID順への正規化と入力非破壊
- 同一個体の編成別ロードアウト・AI設定
- 固有・汎用・開花の装備技順
- instanceId重複拒否
- 編成内の個体・位置・tiePriority重複拒否
- 未習得汎用技・未解放開花技の装備拒否
- 未装備技を参照するAIポリシー拒否
- 3固定スロットの保存・一覧・読込・削除
- 不正スロット・不正schemaVersion拒否
- 保存・読込スナップショットの参照分離とfreeze

検証コマンド:

```bash
pnpm test
pnpm demo:headless
pnpm benchmark:ai
pnpm lint
pnpm build
```

## 対象外

- IndexedDBとJSON export/importの実アダプタ
- schema migrationと世代バックアップ
- 編成編集・図鑑・技習得UI（T033）
- 汎用技習得時の通貨消費（T033/T034）
- 経済、研究、世界進行、戦闘中断スナップショット（T034以降）
- 編成から対話型戦闘を起動するUI接続（T033）

## 手動確認

現時点はUI未接続のため単体テストを正本とする。T033で編成UIから同一モデルを編集し、その編成で戦闘を開始する。

## 次のタスク

T033「編成UI・技習得・図鑑」
