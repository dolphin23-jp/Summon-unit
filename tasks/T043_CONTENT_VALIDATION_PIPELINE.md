# T043 コンテンツ検証パイプライン

## 目的

Phase 9の大量コンテンツ追加前に、マスターデータの値と参照整合を一括検証し、壊れたデータをブラウザ起動時とCIの両方で拒否できるようにします。

## 完了条件

- [x] マスターデータの実行時検証入口を追加する
- [x] 種・技・汎用技費用のID、型、slot参照を検証する
- [x] 研究網・レシピ・確定研究・開花研究・施設段階を検証する
- [x] 地域・ステージ・解放条件・敵編成・AI・報酬・ボスフェーズを検証する
- [x] 現行カタログをブラウザ起動時に検証する
- [x] `pnpm validate:content`をCIへ組み込む
- [x] 正常系、参照破損、ボスloadout不整合、100回決定論テストを追加する
- [x] schemaライブラリ採否をADRへ記録する
- [x] README、authoring rules、STATUSを更新する

## 実装

`src/content/content-validation.ts`の`validateContentCatalog`が、既存の`assertValid*`と`normalize*`を横断して呼び出します。ブラウザは`src/content/runtime-content-validation.ts`を起動時に読み込み、CLIは同じ結果をJSONで出力します。

検証対象:

- 重複ID、空ID、数値範囲
- 種の固有技・開花技slot参照
- 汎用技習得費とGENERIC技の対応
- 研究素材、隣接ノード、レシピ候補、確定研究、開花研究
- 研究施設段階の連続性と上限
- 地域・ステージ所属、表示順、解放条件
- 敵種、装備技、AI作戦、技ポリシー
- 報酬解析度の種・source・量
- ボスフェーズ技の存在と実際のboss loadout
- stage completion progress IDの重複

## 設計判断

マスターは現時点でTypeScript内にあり、既存の実行時assertionがルール正本になっています。T043ではZodを追加せず、それらを集約します。外部JSONやCMSを入力境界に導入する時点でschemaライブラリを再検討します。詳細は`docs/adr/0001-content-validation-runtime-assertions.md`を参照してください。

## 検証

- `pnpm validate:content`
- `pnpm test`
- `pnpm demo:headless`
- `pnpm benchmark:ai`
- `pnpm lint`
- `pnpm build`

## 対象外

- T044のモンスター・技データ制作
- T045の研究網・地域A/B制作
- 外部JSON/YAML/CMSからのマスター読込
- バランス値の良否判定

## 次

T044 — スライスモンスター・技一式
