from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    file.write_text(text.replace(old, new, 1))


replace_once('package.json', '"version": "0.1.0-rc.1"', '"version": "0.1.0-rc.2"', 'package version')
replace_once(
    'src/content/vertical-slice-runtime.ts',
    "export const VERTICAL_SLICE_RELEASE_VERSION = '0.1.0-rc.1'\nexport const VERTICAL_SLICE_RELEASE_CONTENT_VERSION = 'slice-v0.1.0-rc.1'",
    "export const VERTICAL_SLICE_RELEASE_VERSION = '0.1.0-rc.2'\nexport const VERTICAL_SLICE_RELEASE_CONTENT_VERSION = 'slice-v0.1.0-rc.2'",
    'runtime version',
)
replace_once(
    'src/content/vertical-slice-runtime.test.ts',
    "releaseVersion: '0.1.0-rc.1',\n      contentVersion: 'slice-v0.1.0-rc.1',",
    "releaseVersion: '0.1.0-rc.2',\n      contentVersion: 'slice-v0.1.0-rc.2',",
    'runtime test version',
)

readme = Path('README.md')
text = readme.read_text()
text = text.replace(
    '> Release candidate: `0.1.0-rc.1`。v0.1合格判定はNO-GOです。詳細は`docs/19_V0_1_RELEASE_READINESS.md`を参照してください。',
    '> Release candidate: `0.1.0-rc.2`。コード合格判定はGOです。Vercel production確認と`v0.1.0`タグ作成を保留しています。詳細は`docs/19_V0_1_RELEASE_READINESS.md`を参照してください。',
    1,
)
text = text.replace(
    '戦闘画面ではAUTO、一時停止、1行動進行、速度変更、次の味方だけ手動、確定前プレビュー、未来タイムライン、AI判断理由を利用できます。',
    '戦闘画面ではAUTO、一時停止、1行動進行、速度変更、次の味方だけ手動、確定前プレビュー、未来タイムライン、AI判断理由を利用できます。味方・自身対象の回復技はAUTOと手動の同じ候補・プレビュー・解決経路を使い、実回復量と過剰回復量をイベントログへ記録します。',
    1,
)
text = text.replace(
    '現行戦闘ランナーは`SINGLE_ENEMY`技だけを実解決するため、回復・障壁・浄化・時間短縮などの支援技はrelease blockerです。回復量と過剰回復率は未対応として`false`／`null`を出力し、ゼロ性能とは扱いません。',
    'T048では味方・自身対象の回復技を対話型／ヘッドレス戦闘ランナーへ統合し、`healing_applied`イベントから実回復量と過剰回復率を計測します。回復技には標準3行動クールダウンを設定し、51戦ベンチでタイムアウト0を維持します。',
    1,
)
text = text.replace(
    '- Phase 10 T047：完了 / T048：release candidate検証中（NO-GO）',
    '- Phase 10 T047：完了 / T048：コード検証完了、Vercel production確認待ち',
    1,
)
text = text.replace(
    '現在の実装対象はT048「合格条件検証・v0.1リリース」です。支援・回復技の戦闘統合とVercel本番確認が残っています。',
    '現在の実装対象はT048「合格条件検証・v0.1リリース」です。コード側の合格条件は完了し、Vercel production確認と最終タグ作成が残っています。',
    1,
)
readme.write_text(text)

Path('docs/19_V0_1_RELEASE_READINESS.md').write_text("""# 19. v0.1 Release Readiness

## 判定

**CODE GO / RELEASE WAITING FOR PRODUCTION DEPLOYMENT**

T048のコード側合格条件はすべて満たした。実行版は`0.1.0-rc.2`、コンテンツ版は`slice-v0.1.0-rc.2`とする。最終`v0.1.0`タグはVercel productionで主要導線を確認した後に作成する。

2026-07-20時点でVercelは無料プランの1日100デプロイ上限に達しており、最終コードのpreview／productionデプロイを実行できない。これはGitHub Actionsのbuild失敗ではない。

## T048で完了した事項

- ブラウザ実行時カタログをT046調整済みマスターへ切り替え
- ホーム、編成、出撃、結果、研究、開花研究、召喚、セーブの通し導線
- 味方・自身対象の回復技をAUTOと手動の共通経路へ統合
- 回復プレビュー、AI支援評価、実回復、過剰回復、リプレイ表示を実装
- 回復技へ標準3行動クールダウンを設定し無限回復を防止
- `healing_applied`イベントから回復量と過剰回復率を集計
- T046固定51戦でタイムアウト0を再確認
- 低レア開花研究を画面から実行可能にした
- content validation、全テスト、headless、AI／balance benchmark、lint、buildを成功させた

## 合格条件マトリクス

### 戦闘

| 条件 | 判定 | 根拠 |
|---|---|---|
| 配置・技変更で結果が変わる | PASS | 9固定編成×17戦で編成ごとに勝敗・行動価値が変化する |
| 軽技・重技の両方に用途 | PASS | 複数action cost帯の選択と導入戦の行動順価値を検証する |
| 移動・遮蔽・予兆が実用 | PASS | 専用エンジンテスト、導入戦、地域B、AI位置評価を持つ |
| 高速だけが最適でない | PASS | 複数speed帯が行動価値へ寄与し低速防御役を含む編成も勝利する |
| 回復無限・時間永久拘束がない | PASS | 回復クールダウン3行動、51戦タイムアウト0、決定論反復を検証する |

### AI

| 条件 | 判定 | 根拠 |
|---|---|---|
| 過剰回復・大技浪費・往復移動が少ない | PASS | 実回復と過剰回復を計測し、過剰回復率35%以下をテストで固定する |
| 危険マスを認識 | PASS | danger zone・telegraph評価と回避スコアの回帰テストがある |
| 理由を追跡可能 | PASS | AI理由ログとスコア内訳を戦闘画面・イベントログで確認できる |
| 同条件同結果 | PASS | カーネル、AI、51戦ベンチ、初戦生成をbyte-identicalで反復検証する |

### 研究

| 条件 | 判定 | 根拠 |
|---|---|---|
| 次の候補が完全に分からなくならない | PASS | 各研究ノードに開示段階1～4のヒントを4件持つ |
| 総当たり不要 | PASS | 候補範囲、要素別適合結果、失敗時追加ヒントを提供する |
| 低レア開花を実際に試せる | PASS | R1開花研究のサービス・UI・取引回帰テストがある |
| R5が明確な達成 | PASS | 災炎翼竜の研究、施設段階3、固定要件を持つ |

### 技術

| 条件 | 判定 | 根拠 |
|---|---|---|
| データ追加でコンテンツを増やせる | PASS | 16種・42技・17ステージ・10研究をマスター追加で構成する |
| セーブmigrationテスト | PASS | schema 1→6、失敗ロールバック、バックアップ復旧を検証する |
| イベントログで再現可能 | PASS | 行動、損害、回復、効果、終了を固定sequenceとvirtual timeで保存する |

## 自動検証

- `pnpm validate:content`
- `pnpm test`
- `pnpm demo:headless`
- `pnpm benchmark:ai`
- `pnpm benchmark:balance`
- `pnpm lint`
- `pnpm build`

すべて成功。T046固定基準は51戦、タイムアウト0、警告0を維持する。

## 残る外部確認

1. Vercelの日次上限解除後にproductionへデプロイ
2. 起動、初戦、AUTO回復、手動回復、保存・再読込、研究、開花研究、召喚をスモーク確認
3. versionを`0.1.0`へ確定
4. `v0.1.0`タグとGitHub Releaseを作成
""")

Path('tasks/T048_V0_1_RELEASE.md').write_text("""# T048 — 合格条件検証・v0.1リリース

## 目的

`docs/14_VERTICAL_SLICE.md`の合格条件を検証し、Vercel production確認後に`v0.1.0`を公開する。

## 実施内容

- [x] T046調整済みカタログを実行時へ接続
- [x] `docs/14`合格条件を根拠つきで判定
- [x] 低レア開花研究をUIへ接続
- [x] 味方・自身対象の回復技をAUTO／手動へ統合
- [x] 実回復量と過剰回復率をイベントログ・ベンチへ追加
- [x] 回復クールダウンを設定し51戦タイムアウト0を確認
- [x] content、tests、headless、AI／balance benchmark、lint、buildを成功
- [ ] Vercel productionで主要導線をスモーク確認
- [ ] versionを`0.1.0`へ確定
- [ ] `v0.1.0`タグとGitHub Releaseを作成

## 現在の判定

**CODE GO / EXTERNAL DEPLOYMENT PENDING**

コード側のrelease blockerは解消した。Vercel無料枠の日次デプロイ上限により最終production確認だけが実行不能であるため、現在は`0.1.0-rc.2`として保持し、最終タグは作成しない。

## 次の操作

Vercel上限解除後にproductionスモークを実施し、成功した場合のみ残る3項目を完了させる。
""")

status = Path('tasks/STATUS.md')
text = status.read_text()
text = text.replace(
    '- [ ] T048 — [合格条件検証・v0.1リリース](T048_V0_1_RELEASE.md) — release candidate `0.1.0-rc.1`; support resolution and Vercel production verification remain',
    '- [ ] T048 — [合格条件検証・v0.1リリース](T048_V0_1_RELEASE.md) — code GO at `0.1.0-rc.2`; Vercel production smoke and final tag remain',
    1,
)
text = text.replace(
    'T001～T047 complete. T048 is in progress with a documented NO-GO release gate.',
    'T001～T047 complete. T048 code acceptance is complete; external production verification remains.',
    1,
)
status.write_text(text)

vertical = Path('docs/14_VERTICAL_SLICE.md')
text = vertical.read_text()
old = 'T048のrelease candidate検証では、調整済みT046カタログの実行時接続と低レア開花研究UIを確認しました。一方、戦闘ランナーが味方対象・自身対象の支援技を実解決しないため、回復無限と過剰回復の条件は未判定です。v0.1の判定はNO-GOとし、`docs/19_V0_1_RELEASE_READINESS.md`へ根拠と解除条件を記録します。'
new = 'T048では調整済みカタログ、低レア開花研究、AUTO／手動回復、回復ログ、過剰回復指標を統合しました。コード側の合格条件はGOです。Vercel production確認と最終タグ作成は日次デプロイ上限解除後に実施します。詳細は`docs/19_V0_1_RELEASE_READINESS.md`を参照してください。'
if old not in text:
    raise SystemExit('vertical slice readiness paragraph not found')
vertical.write_text(text.replace(old, new, 1))

Path('.github/t048-support-model.py').unlink()
Path('.github/workflows/t048-support-model.yml').unlink(missing_ok=True)
