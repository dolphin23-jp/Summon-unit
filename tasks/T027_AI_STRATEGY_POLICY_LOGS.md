# Task 027: 作戦・ポリシー・理由ログ・回帰指標

## 目的

T025～T026で構築した決定論的な候補評価へ、個体作戦・チーム作戦・技ポリシーを組み合わせる設定層を追加する。選択結果には通常表示用の一行理由と、検証・詳細表示用の全候補スコア内訳を残し、固定シナリオの回帰指標をCIで継続確認する。

## 背景・参照仕様

- `docs/08_AI_SYSTEM.md`
- `docs/12_UI_UX.md`
- `docs/15_BALANCE_GUIDELINES.md`
- `docs/17_IMPLEMENTATION_ROADMAP.md`
- 前提タスク: T025、T026

## 実装範囲

### 個体作戦8種

- `STANDARD`: 標準
- `ASSAULT`: 強襲
- `CAUTIOUS`: 慎重
- `SUPPORT`: 支援
- `POSITIONAL`: 位置重視
- `FIXED_TURRET`: 固定砲台
- `BLOOM_PRIORITY`: 開花技優先
- `BLOOM_CONSERVE`: 開花技温存

### チーム作戦4種

- `FAST_KILL`: 最速撃破
- `STABLE_CLEAR`: 安定攻略
- `LOSS_MINIMIZATION`: 損耗抑制
- `INDIVIDUAL_PRIORITY`: 個体設定優先

### 技ポリシー5種

- `AGGRESSIVE_USE`: 積極使用
- `STANDARD`: 標準
- `CONDITIONAL`: 条件付き
- `CONSERVE`: 温存
- `AUTO_DISABLED`: 自動使用禁止

### 理由ログ

- 行動者ID
- 選択candidateId
- 行動の一行表現
- 一行の主要理由
- 主要理由に対応するスコア項目ID
- 総合点と2位との差
- 個体作戦・チーム作戦・選択技ポリシー
- 全スコア項目
- 全候補の順位、総合点、首位との差
- ポリシーで除外された候補と除外理由

### 回帰指標

- 意思決定数
- 技選択数、移動選択数、開花技選択数
- 生回復量、実回復量、過剰回復率
- 計算ダメージ、実適用ダメージ、オーバーキル率
- 直前マスへの戻り回数・率
- 2マス往復回数・率
- ポリシー除外候補数
- 選択candidateId列
- 選択理由列

## 作戦補正の規則

T026の標準重みへ、個体作戦とチーム作戦のpermille倍率を順に適用する。

```text
resolvedWeight = round(baseWeight × individualPermille × teamPermille / 1,000,000)
```

- すべて整数・BigIntで計算する。
- `INDIVIDUAL_PRIORITY`はチーム側の無補正を意味する。
- T026の明示的な呼び出し側overrideを基礎値としてから作戦補正を適用する。
- 補正済み重みも安全な整数でなければならない。

## 候補単位の補正

重み変更だけでは表現できない作戦・ポリシーは、固定スコア項目を追加する。

- `FIXED_TURRET`: 移動候補へ `-12000`
- `BLOOM_PRIORITY`: 開花技候補へ `+5000`
- `BLOOM_CONSERVE`: 開花技候補へ `-5000`
- `AGGRESSIVE_USE`: 対象技候補へ `+2000`
- `CONSERVE`: 対象技候補へ `-3000`
- `STANDARD`: 追加補正なし

追加項目ID:

- `strategy.individual-candidate`
- `policy.skill`

## 技ポリシーの除外規則

- `AUTO_DISABLED`は該当技の全候補をAUTO評価から除外する。
- `CONDITIONAL`は`conditionSatisfied === true`の場合のみ候補を残す。
- 除外候補は消失させず、理由ログへ`AUTO_DISABLED`または`CONDITION_UNMET`として記録する。
- 未指定技は`STANDARD`として扱う。
- 同一技へのポリシー重複と、使用可能技一覧にない技IDを拒否する。

## 理由の決定規則

1. 撃破候補の中で最小行動コストなら「最小コストで撃破可能」
2. それ以外は、選択候補の正のスコア項目で値が最大の項目
3. 正の項目がなければ「総合減点が最も小さい」

通常ログは次の形式とする。

```text
<actor>は<skill/position>を使用/移動。理由: <主要理由>
```

詳細ログでは、固定順のスコア内訳と全候補の比較を保持する。

## 固定回帰ベンチ

`runReferenceAiRegressionBenchmark`は次の5シナリオを毎回評価する。

1. 標準作戦で安い撃破技を選ぶ
2. 支援＋損耗抑制で次行動前の救援を選ぶ
3. 慎重＋安定攻略で予兆マスから退避する
4. 開花技優先で開花技を選ぶ
5. 自動使用禁止により移動へフォールバックする

固定見出し値:

- decisionCount: `5`
- skillSelectionCount: `3`
- moveSelectionCount: `2`
- bloomSelectionCount: `1`
- rawHealingTotal: `50`
- appliedHealingTotal: `40`
- overhealPermille: `200`
- backtrackSelectionCount: `0`
- oscillationSelectionCount: `0`
- backtrackPermilleOfMoves: `0`
- oscillationPermilleOfMoves: `0`
- excludedPolicyCandidateCount: `1`

計算ダメージ・実適用ダメージ・オーバーキル率、選択列、理由列も同じJSONへ含め、100回再実行でバイト一致を確認する。

## CLI・CI

```bash
pnpm benchmark:ai
```

- 固定ベンチのJSONを標準出力へ出す。
- GitHub Actionsでテスト、既存ヘッドレスデモの後に実行する。
- 指標の変更は、AI仕様またはバランス変更として差分理由を確認する。

## 対象外

- T028の対話型戦闘ランナーへの実運用接続
- 戦闘UIの理由パネル
- 作戦・ポリシー設定UI
- セーブデータへの設定永続化
- 敵編成マスターへの作戦設定
- 複数手探索や確率的探索
- 回復・障壁・バフ効果の正式なSkillDefinition拡張

## 守るべき不変条件

- 作戦層はReact、DOM、永続化へ依存しない。
- T025の固定同点規則を変更しない。
- 戦闘状態・候補プレビューを変更しない。
- 同じ戦闘入力、作戦、ポリシー、補助入力から同じ結果・理由・指標を返す。
- 候補除外後も残存候補は既存の決定論的比較順で並べる。
- スコア、倍率、差分、指標は安全な整数を使用する。

## 完了条件

- [x] 個体作戦8種を定義した
- [x] チーム作戦4種を定義した
- [x] 技ポリシー5種を定義した
- [x] 個体・チーム作戦を標準重みへ合成できる
- [x] 固定砲台と開花技作戦を候補単位で補正できる
- [x] 積極使用・温存を候補単位で補正できる
- [x] 条件付き・自動禁止候補を除外できる
- [x] 一行理由を生成できる
- [x] 詳細スコア内訳と全候補比較を保持できる
- [x] 過剰回復・オーバーキル・往復率等の回帰指標を収集できる
- [x] 固定AI回帰ベンチをCLIとCIで実行できる

## 自動テスト

- [x] 8/4/5プリセットの固定列
- [x] 個体・チーム倍率の整数合成
- [x] 最小コスト撃破の一行理由
- [x] 詳細スコア内訳・順位・スコア差
- [x] 開花技優先、固定砲台、積極使用の補正
- [x] 自動使用禁止・条件未達の除外
- [x] 支援作戦による緊急救援選択
- [x] 不正な技ポリシーの拒否
- [x] 設定済み意思決定の100回バイト一致
- [x] 固定回帰ベンチの見出し値
- [x] 固定回帰ベンチJSONの100回バイト一致
- [x] 既存テスト全件
- [x] `pnpm demo:headless`
- [x] `pnpm benchmark:ai`
- [x] `pnpm lint`
- [x] `pnpm build`

## データ・セーブ互換性

- MonsterSpecies、SkillDefinition、BattleState、T025/T026の既存形式は変更しない。
- 作戦設定、理由ログ、回帰指標は現時点では実行時データであり永続化しない。
- T032の編成モデルとT040の永続化で、設定IDを保存対象へ接続する。
- 永続セーブは未実装のためmigrationへの影響はない。

## 完了結果

- `src/ai/strategy-presets.ts` に8/4/5の設定と重み合成を追加した。
- `src/ai/configured-decision.ts` に候補除外、候補補正、理由ログ付き意思決定を追加した。
- `src/ai/regression-metrics.ts` に回帰指標集計を追加した。
- `src/demo/ai-regression-benchmark.ts` とCLIに固定5シナリオを追加した。
- GitHub Actions CI run 139でtest、headless demo、AI regression benchmark、lint、buildが成功した。

## 次のタスク

- T028 対話型戦闘ランナー
