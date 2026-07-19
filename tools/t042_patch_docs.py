from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f'documentation pattern not found in {path}: {old[:100]!r}')
    file.write_text(text.replace(old, new, 1))


save_doc = 'docs/11_SAVE_AND_COMPATIBILITY.md'
replace_once(
    save_doc,
    '処理中に終了した場合は直前のstableへ戻ります。T040はPlayerDataの永続化だけを扱い、戦闘中断スナップショットはT042で実装します。',
    'T042では各行動解決後などのstable状態を保存します。手動入力の選択途中は保存せず、処理中に終了した場合は直前のstableへ戻します。起動時またはスロットロード時に中断戦闘があれば、保存済み定義とsnapshotを検証して戦闘画面を再開します。',
)
replace_once(
    save_doc,
    '''  checksum: string;
  playerData: PlayerData;
}''',
    '''  checksum: string;
  playerData: PlayerData;
  activeBattle?: SavedBattleSession | null;
  activeBattleChecksum?: string | null;
}''',
)
replace_once(
    save_doc,
    'generationのPlayerDataは`createStagePlayerData`で経済、研究、施設、編成、ステージ進行まで再検証・正規化します。チェックサムは正規化済みPlayerDataから算出します。',
    'generationのPlayerDataは`createStagePlayerData`で経済、研究、施設、編成、ステージ進行まで再検証・正規化します。既存PlayerDataチェックサムはT040形式を維持します。中断戦闘は別チェックサムを持ち、戦闘定義とstable snapshotを再構築できることまで検証します。',
)
replace_once(
    save_doc,
    'T040はPlayerDataへ新しいゲーム進行フィールドを追加せず、外側へgenerationとslot pointerを追加します。このためデモPlayerDataのschemaVersionは6のままです。IndexedDB永続化は実装済みですが、旧schemaを一段ずつ変換するmigrationはT041、JSON import/exportはT042で実装します。',
    'T040はPlayerData外側へgenerationとslot pointerを追加し、T041は旧schemaを一段ずつ変換します。T042はPlayerDataのschemaVersionを6のまま維持し、generationへ任意の中断戦闘を追加します。JSON import/exportは転送format versionをPlayerData schemaVersionから分離します。',
)
replace_once(
    save_doc,
    '## コンテンツ変更',
    '''## JSONエクスポート・インポート

T042の転送文書は次を持ちます。

- 固定format名 `summon-unit-save`
- 転送format version
- 出力時刻
- PlayerDataと任意の中断戦闘を含むpayload
- キー順を正規化したpayload全体のチェックサム

インポートはJSON構文、format、format version、チェックサムの順に検証します。その後でPlayerDataをT041 migrationへ通し、中断戦闘の定義・unit ID・schedule・使用状態・ボスphaseを検証します。すべて成功した場合だけ、使用中スロットへ新generationとしてアトミック保存します。

## stable戦闘snapshot

保存対象は盤面状態、イベントログ、仮想時刻、総行動数、次回timeline sequence、各unitのschedule、連続待機状態、技使用回数、現在の技表、位置履歴、手動介入予約、直前AI理由ログ、ボスphaseです。manual actionの候補選択途中はstableではないため保存しません。復元後の同じ入力列は、中断しなかった実行と同じ最終結果になります。

## コンテンツ変更''',
)

schema = Path('docs/16_DATA_SCHEMAS.md')
text = schema.read_text()
if '## T042 JSON転送と戦闘snapshot' not in text:
    schema.write_text(text + '''

## T042 JSON転送と戦闘snapshot

```ts
interface SaveTransferDocument {
  format: 'summon-unit-save';
  formatVersion: 1;
  exportedAtEpochMs: number;
  checksum: string;
  payload: {
    playerData: PlayerData;
    activeBattle: SavedBattleSession | null;
  };
}

interface SavedBattleSession {
  saveVersion: 1;
  stageId: StageId;
  serial: number;
  attempt: number;
  fastModeAvailable: boolean;
  definition: HeadlessBattleDefinition;
  stableSnapshot: InteractiveBattleStableSnapshot;
}

interface InteractiveBattleStableSnapshot {
  snapshotVersion: 1;
  battle: BattleState;
  log: BattleEventLog;
  currentVirtualTime: BattleTime;
  totalActions: number;
  manualAllyActionRequested: boolean;
  lastDecisionLog: AiDecisionReasonLog | null;
  bossPhase: BossPhaseRuntimeState | null;
  nextTimelineSequence: number;
  schedules: UnitActionSchedule[];
  waitStates: BattleRuntimeEntry<WaitActionState>[];
  skillUsageBooks: BattleRuntimeEntry<SkillUsageBook>[];
  skillIdsByBattleUnitId: BattleRuntimeEntry<SkillId[]>[];
  recentPositionIds: BattleRuntimeEntry<string[]>[];
}
```

転送format version、戦闘snapshot version、PlayerData schemaVersionは独立して更新します。PlayerData-onlyの旧generationは`activeBattle`未定義を`null`として読み込みます。
''')

ui = Path('docs/12_UI_UX.md')
text = ui.read_text()
if '## T042 セーブ転送・戦闘再開' not in text:
    ui.write_text(text + '''

## T042 セーブ転送・戦闘再開

- セーブ画面から使用中スロットをJSONファイルとして保存できる
- JSON読込は使用中スロットへの上書き操作として扱い、検証完了前に画面状態やpointerを変更しない
- 各スロットに中断戦闘のstageIdまたは「なし」を表示する
- 中断戦闘を含むスロットをロードした場合は戦闘画面へ直接戻る
- 起動時に中断戦闘が見つかった場合は再開したことを通知する
- 戦闘中はstable地点だけを自動保存し、手動入力選択中の再読込では直前stableへ戻る
- 結果確定、編成・研究・地域への離脱時は中断戦闘を削除する
- インポート失敗時は理由を表示し、現在のスロットと戦闘を維持する
''')
