# ADR 0001: コンテンツ検証は既存のTypeScript assertionを集約する

- Status: Accepted
- Date: 2026-07-20
- Task: T043

## Context

Phase 9ではモンスター、技、研究レシピ、地域、ステージをまとまった量で追加します。個別モジュールにはすでに型定義と実行時assertionがありますが、カタログ全体を一度に検証する入口と、参照整合をCIで確認する工程がありませんでした。

ロード元は現時点ではリポジトリ内のTypeScriptマスターデータです。外部JSONやCMSから未知の値を読み込む構成ではありません。

## Decision

T043ではZodなどの新しいschemaライブラリを追加せず、既存の`assertValid*`と`normalize*`を`validateContentCatalog`へ集約します。

検証は次の二つの入口で同じ関数を使用します。

1. ブラウザ起動時の現行カタログ検証
2. `pnpm validate:content`によるCI検証

検証器は種・技・汎用技費用、研究網・確定研究・開花研究、研究施設、地域・ステージ、敵AI、報酬解析度、ボスフェーズの参照を横断確認します。エラーは検証区分を接頭辞に付け、CI上で破損箇所を追跡できる形にします。

## Consequences

- 既存のルール正本を重複実装せず、アプリとCIの判定が一致します。
- 新依存とlockfile変更を避け、T043の差分を検証パイプラインへ限定できます。
- TypeScriptで表現できても参照先が存在しないデータを、起動時またはCIで即座に拒否できます。
- 外部JSON、YAML、CMSなどからマスターを読み込む段階では、入力境界のschema validationとしてZod等の採用を再検討します。その場合も横断参照検証は`validateContentCatalog`へ残します。
