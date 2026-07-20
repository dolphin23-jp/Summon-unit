# T049 — 表示名・説明文マスター（生ID露出の根絶）

## 目的

プレイヤーに内部ID（`stage.slice.a-02-cover`、`catalyst.slice.wind`、`grassfang-01`等）や英語スラグ由来の名称（`Grassfang Rat`、`A 01 Timeline`）が一切見えない状態にする。すべての表示名・説明文をマスターデータへ正本化し、UI側の即席整形（`displayName()`）を廃止する。

## 背景・参照仕様

- `docs/13_CONTENT_AUTHORING_RULES.md`（数値・文言のマスター集約原則）
- `docs/14_VERTICAL_SLICE.md`（和名の正: 草牙ネズミ、翠風観測原 等）
- `docs/GLOSSARY.md`
- 前提タスク: T048（コード側完了済み）
- 既知の露出箇所:
  - `src/progression/region-progression.ts` `describeProgressRequirement()` が stageId / regionId を文へ直接埋め込む
  - `src/progression/stage-reward.ts` 進行通知 `` `${stage.stageId} をクリアしました。` ``
  - `src/ui/ResearchScreen.tsx` 触媒チェックボックスのラベルが catalystId
  - `src/ui/BattleResultScreen.tsx` 報酬一覧が `catalyst.catalystId` を表示
  - `src/ui/RegionScreen.tsx` / `CollectionScreen.tsx` / `ResearchScreen.tsx` の `displayName()`（IDスラグの英語化）
  - `src/ui/BattleUnitCard.tsx` `shortName(unit.battleUnitId)` / `shortName(unit.speciesId)`

## 実装範囲

- コンテンツマスターへ日本語表示名フィールドを追加する:
  - 種（`name`が英語なら和名へ差し替え。IDは不変）
  - 技: `name`（和名）と `description`（プレイヤー向け1〜2文。射程・対象・主効果が読み取れること）
  - ステージ: `name`（例: 導入1「行動順の観測」）※`theme`とは別に一覧用の短名
  - 地域・触媒・地域ポイント報酬・汎用技・開花技・状態異常/バフ表示名
- `describeProgressRequirement()`・進行通知・報酬精算文をID参照から名称参照へ変更する（カタログを引数で受け取り解決する。フォールバックはIDではなく「不明な◯◯」）
- UI各画面の `displayName()` / `shortName()` を削除し、マスター名称の参照に統一する。戦闘ユニットは「種和名＋個体番号」（例: 草牙ネズミ #1）表示とする
- `src/content/content-validation.ts` を拡張し、表示名・技説明の欠落/空文字/ID混入（`.`を含む名称）をエラーとして `pnpm validate:content` で検出する

## 対象外

- 文言のトーン調整やフレーバーテキストの拡充（最小限の実務的説明でよい）
- 多言語対応の仕組み
- UIレイアウト変更（T051/T052で扱う）

## 変更可能な領域

- `src/content/**`、`src/progression/**` の表示文生成部、`src/ui/**` の名称参照部、`docs/13`・`docs/16` の該当節

## 守るべき不変条件

- ID体系は不変（セーブ・研究網・ゴールデンテストが参照するため）
- 戦闘カーネル（`src/battle/**`）は変更しない。イベントログのペイロードはID基準のまま（表示層で名称解決する）
- 決定論リファレンス・stable snapshotテストのゴールデンを更新しない

## 完了条件

- [x] 全画面を目視巡回し、ドット区切りID・英語スラグ名がプレイヤー可視領域に存在しない
- [x] `pnpm validate:content` が名称・説明欠落を検出できる（欠落を仕込んだテストで確認）
- [x] 技の説明文が図鑑・編成の技選択・手動行動パネルで参照可能なデータとして提供されている（表示接続は最低限でよい。本格レイアウトはT052）

## 自動テスト

- [x] 名称解決ユーティリティの単体テスト（既知ID→和名、未知ID→「不明な◯◯」）
- [x] content-validation: 名称欠落・説明欠落・名称へのID混入の検出テスト
- [x] 進行通知/解放条件文のスナップショット更新（文言変更として差分理由をPRに明記）

## 手動確認

1. 地域画面でロック中ステージの解放条件が「導入2『遮蔽の観測』のクリアが必要です。」形式で表示される
2. 戦闘結果の触媒報酬が和名で表示される
3. 盤面・タイムライン・ログのユニット名が「和名 #n」になっている

## データ・セーブ互換性

- セーブスキーマ影響なし（表示名はPlayerDataへ保存しない）。contentVersionを上げる

## ドキュメント更新

- [x] `docs/13` に「全表示対象は名称マスター必須・UIでのID整形禁止」を明記
- [x] `docs/16` のスキーマ表へ追加フィールドを反映

## 完了報告に含めること

- 変更概要 / テスト結果 / 手動確認結果 / 未完了・残課題

## 次のタスク

- T050（UX導線・用語ヘルプ）、T051（画像展開。本タスクの名称に依存）


## 実装結果

- 種・技・ステージ・地域・研究・触媒・報酬・属性を一元解決する表示マスターを追加した。
- 技説明は既存の戦術説明を正本として公開し、欠落・空文字・ID混入をcontent validationで拒否する。
- 地域、編成、研究、戦闘盤面、戦闘結果の主要な生ID表示を名称参照へ置き換えた。
- ID、セーブスキーマ、戦闘イベントのペイロードは変更していない。
