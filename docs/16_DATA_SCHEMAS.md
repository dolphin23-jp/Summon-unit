# 16. Data Schemas

本書は最終APIではなく、モジュール境界を固定するための実装時点スキーマです。表示名ではなく固定IDを参照し、数量・時刻・解析度・開示段階は整数で保存します。

## ID

```ts
type SpeciesId = string;
type UnitInstanceId = string;
type SkillId = string;
type EffectId = string;
type ResearchNodeId = string;
type StageId = string;
type RegionId = string;
type CatalystId = string;
type BattleId = string;
type FormationId = string;
type SaveGenerationId = string;
type SaveSlotId = 'slot-1' | 'slot-2' | 'slot-3';
```

公開済みIDは変更・再利用しません。保存世代IDは保存管理用であり、ゲーム内マスター参照には使用しません。

## 盤面

```ts
type Side = 'ALLY' | 'ENEMY';
type Column = 0 | 1 | 2;
type LocalRow = 0 | 1 | 2;

interface BoardPosition {
  side: Side;
  row: LocalRow;
  column: Column;
}
```

## マスターモンスター

```ts
interface MonsterSpecies {
  id: SpeciesId;
  rarity: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  attributeId: string;
  primarySpeciesId: string;
  tagIds: string[];
  stats: { hp: number; attack: number; defense: number; speed: number };
  traitId?: string;
  innateSkillId: SkillId;
  bloomSkillIds?: SkillId[];
}
```

## 技

```ts
type DeliveryMode =
  | 'CONTACT'
  | 'DIRECT'
  | 'PIERCE'
  | 'ARC'
  | 'SNIPE'
  | 'SELF'
  | 'GLOBAL';

interface SkillDefinition {
  id: SkillId;
  slotType: 'INNATE' | 'GENERIC' | 'BLOOM';
  attributeId?: string;
  actionCost: number;
  cooldownActions?: number;
  useLimit?: number | null;
  telegraphDelay?: number | null;
  targetType: string;
  reachMethod?: DeliveryMode;
  areaMask?: string;
  damageMultiplierPermille: number;
}
```

## 戦闘ユニット

```ts
interface BattleUnitState {
  battleUnitId: string;
  sourceInstanceId: UnitInstanceId | null;
  speciesId: SpeciesId;
  side: Side;
  position: BoardPosition;
  hp: number;
  barriers: BarrierState[];
  effects: ActiveEffectState[];
  nextActionTime: number;
  lastActionTime: number;
  actionCount: number;
  cooldowns: Record<SkillId, number>;
  defeated: boolean;
}
```

## タイムライン

```ts
interface ScheduledEvent {
  id: string;
  time: number;
  priority: number;
  sequence: number;
  kind:
    | 'UNIT_TURN'
    | 'TELEGRAPH_RESOLVE'
    | 'SUMMON'
    | 'TERRAIN_TRIGGER'
    | 'PHASE_CHANGE';
  payload: unknown;
}
```

優先度とsequenceで安定順序を保証します。ボスフェーズ変更は同一仮想時刻の通常行動より先に解決します。

## 戦闘イベント

```ts
interface BattleEvent {
  sequence: number;
  virtualTime: number;
  type: string;
  actorId?: string;
  targetIds?: string[];
  payload: unknown;
}
```

状態更新はイベントを生成し、UIはイベントを購読します。

## プレイヤー状態（T040時点）

```ts
interface PlayerData {
  schemaVersion: number;
  gameVersion: string;
  contentVersion: string;
  economy: EconomyState;
  research: PlayerResearchState;
  facilities: PlayerFacilityState;
  collection: PlayerCollectionState;
  formations: PlayerFormationState;
  stageProgress: PlayerStageProgressState;
}

interface PlayerDataContentCatalog {
  species: MonsterSpecies[];
  skills: SkillDefinition[];
  researchNodes: ResearchNodeDefinition[];
  researchFacilityStages: ResearchFacilityStageDefinition[];
  finalResearchDefinitions: FinalResearchDefinition[];
  bloomResearchDefinitions: BloomResearchDefinition[];
  regions: RegionDefinition[];
  stages: StageDefinition[];
}
```

実装では後続タスクのモジュールがTypeScript declaration mergingで任意フィールドを拡張し、対応マスターが存在するときだけ検証を要求します。T039デモPlayerDataはschemaVersion 6です。T040はPlayerData外側へ保存世代を追加するためschemaVersion 6を維持します。

## 経済

```ts
interface EconomyState {
  currency: number;
  researchData: number;
  catalysts: CatalystBalance[];
}

interface CatalystBalance {
  catalystId: CatalystId;
  amount: number;
}

interface EconomyTransaction {
  currencyDelta?: number;
  researchDataDelta?: number;
  catalystDeltas?: { catalystId: CatalystId; amount: number }[];
}
```

残高は非負の安全な整数です。触媒は固定ID順へ正規化し、0残高は保存しません。全差分を検証してから一括確定します。

## コレクション

```ts
interface PlayerCollectionState {
  speciesStates: PlayerSpeciesState[];
  unitInstances: PlayerUnitInstance[];
}

interface PlayerSpeciesState {
  speciesId: SpeciesId;
  blueprintUnlocked: boolean;
  analysisBasisPoints: number;
  bloomSkillIds: SkillId[];
  encyclopediaStageId: string;
  statistics: Record<string, number>;
}

interface PlayerUnitInstance {
  instanceId: UnitInstanceId;
  speciesId: SpeciesId;
  learnedGenericSkillIds: SkillId[];
  nickname: string | null;
  favorite: boolean;
  locked: boolean;
  conditionBasisPoints: number;
}
```

解析度とconditionは0～10000の整数basis pointsです。解放済み設計図は個体消費・還元で失われません。開花技は種単位、装備状態は編成単位です。

## 解析度取引

```ts
type AnalysisGainSource =
  | 'ALLY_USE'
  | 'ENEMY_ENCOUNTER'
  | 'SKILL_OBSERVATION'
  | 'DATA_INVESTMENT'
  | 'SPECIMEN_CONSUMPTION';

interface AnalysisGain {
  speciesId: SpeciesId;
  source: AnalysisGainSource;
  amount: number;
}
```

同じ種・同じ増加源は集約し、種ID順、増加源の固定順で適用します。10000を超える分は切り捨て、経済と解析の一方だけを部分適用しません。

## 研究網

```ts
type ResearchNodeStatus =
  | 'hidden'
  | 'hinted'
  | 'candidate'
  | 'known'
  | 'completed';
type ResearchDisclosureStage = 0 | 1 | 2 | 3 | 4 | 5;
type ResearchMethod = 'FUSION' | 'LINEAGE' | 'CONVERGENCE' | 'TRANSCENDENCE';

interface ResearchRecipe {
  method: ResearchMethod;
  materialSpeciesIds: SpeciesId[];
  catalystIds: CatalystId[];
}

interface ResearchNodeDefinition {
  nodeId: ResearchNodeId;
  targetSpeciesId: SpeciesId;
  adjacentNodeIds: ResearchNodeId[];
  candidateRange: ResearchCandidateRange;
  recipe: ResearchRecipe;
  trialResearchDataCost: number;
  hints: ResearchHintDefinition[];
}

interface PlayerResearchState {
  nodes: PlayerResearchNodeState[];
}

interface PlayerResearchNodeState {
  nodeId: ResearchNodeId;
  status: ResearchNodeStatus;
  disclosureStage: ResearchDisclosureStage;
  unlockedHintIds: string[];
  incorrectTrialSignatures: string[];
}
```

開示段階0は`hidden`、1は`hinted`、2～3は`candidate`、4は`known`、5は`completed`です。不正解署名はノードID、方式、固定ID順の素材種・触媒から構築します。

## 確定研究・開花

```ts
interface FinalResearchDefinition {
  nodeId: ResearchNodeId;
  researchDataCost: number;
  catalysts: { catalystId: CatalystId; amount: number }[];
  specimenRequirements: { speciesId: SpeciesId; amount: number }[];
}

interface BloomResearchDefinition {
  speciesId: SpeciesId;
  skillId: SkillId;
  analysisThresholdBasisPoints: number;
  currencyCost: number;
  researchDataCost: number;
}
```

確定研究は資源・標本・研究状態・設計図を一括確定します。lockedまたは編成中個体を標本へ使用しません。開花研究は解析度と資源を検証し、種状態へ解放技を保存します。

## 研究施設

```ts
interface PlayerFacilityState {
  researchFacilityStage: number;
}

interface ResearchFacilityStageDefinition {
  stage: number;
  maxResearchableRarity: number;
  upgradeCurrencyCost: number;
  upgradeResearchDataCost: number;
}
```

セーブへ保存するのは現在段階だけです。上限レア度と更新費はマスターから導出します。

## 編成・ロードアウト

```ts
interface PlayerFormationState {
  activeFormationId: FormationId | null;
  formations: PlayerFormation[];
}

interface PlayerFormation {
  formationId: FormationId;
  name: string;
  members: FormationMember[];
}

interface FormationMember {
  instanceId: UnitInstanceId;
  position: { row: LocalRow; column: Column };
  loadout: {
    genericSkillId: SkillId | null;
    bloomSkillId: SkillId | null;
  };
  tiePriority: number;
  ai: AiDecisionConfiguration;
}
```

固有技は種マスターから導出し、保存しません。装備技は`固有 → 汎用 → 開花`の固定順です。

## 地域・ステージ進行

```ts
type StageKind = 'NORMAL' | 'ELITE' | 'BOSS' | 'HIDDEN';

type ProgressRequirement =
  | { type: 'ALWAYS' }
  | { type: 'STAGE_COMPLETED'; stageId: StageId }
  | { type: 'ALL_STAGES_COMPLETED'; stageIds: StageId[] }
  | { type: 'REGION_POINTS'; regionId: RegionId; points: number };

interface RegionDefinition {
  regionId: RegionId;
  name: string;
  summary: string;
  order: number;
  requirement: ProgressRequirement;
  hideUntilUnlocked: boolean;
}

interface StageDefinition {
  stageId: StageId;
  regionId: RegionId;
  kind: StageKind;
  theme: string;
  secondaryTheme: string | null;
  completionProgressId: string;
  access: StageAccessDefinition;
  enemyFormation: StageEnemyFormationDefinition;
  rewards: StageRewardDefinition;
  boss: BossEncounterDefinition | null;
}

interface PlayerStageProgressState {
  completedStageIds: StageId[];
  settledBattleIds: string[];
  regionalPoints: PlayerRegionalPointState[];
}

interface PlayerRegionalPointState {
  regionId: RegionId;
  points: number;
  claimedRewardIds: string[];
}
```

地域名、敵編成、報酬定義、解放条件はマスターから導出します。セーブにはクリア済みID、精算済みID、地域ポイント、受取済み報酬IDだけを保存します。

## ボスフェーズ

```ts
interface BossEncounterDefinition {
  bossBattleUnitId: string;
  phases: BossPhaseDefinition[];
}

interface BossPhaseDefinition {
  phaseId: string;
  enterAtOrBelowHpBasisPoints: number;
  actionSkillIds: SkillId[];
  gimmick: { type: 'NONE' } | { type: 'BARRIER'; capacity: number };
}
```

フェーズ状態は戦闘ランナーに保持し、通常のPlayerDataへ保存しません。stable戦闘中断スナップショットへの保存はT042で扱います。

## T040 保存世代

```ts
type SaveGenerationState = 'TEMPORARY' | 'COMMITTED';

interface SaveGenerationRecord {
  generationId: SaveGenerationId;
  slotId: SaveSlotId;
  savedAtEpochMs: number;
  state: SaveGenerationState;
  checksum: string;
  playerData: PlayerData;
}

interface SaveSlotPointer {
  slotId: SaveSlotId;
  currentGenerationId: SaveGenerationId;
  backupGenerationIds: SaveGenerationId[];
  updatedAtEpochMs: number;
}
```

各スロットはcurrent 1件と、新しい順のバックアップ最大3件を保持します。generationのPlayerDataは`createStagePlayerData`で全体を検証・正規化し、そのJSONからチェックサムを算出します。

## Repository境界

```ts
interface SaveRepository {
  putTemporaryGeneration(record: SaveGenerationRecord): Promise<void>;
  readGeneration(generationId: SaveGenerationId): Promise<SaveGenerationRecord | null>;
  readSlotPointer(slotId: SaveSlotId): Promise<SaveSlotPointer | null>;
  listSlotPointers(): Promise<readonly SaveSlotPointer[]>;
  commitTemporaryGeneration(input: {
    slotId: SaveSlotId;
    generationId: SaveGenerationId;
    maximumBackupGenerations: number;
  }): Promise<SaveSlotPointer>;
  deleteGeneration(generationId: SaveGenerationId): Promise<void>;
  deleteSlot(slotId: SaveSlotId): Promise<void>;
}
```

IndexedDBアダプタはgeneration storeとslot pointer storeを分離します。仮世代を再読込・検証した後、単一transactionでCOMMITTED化、current切替、旧currentのバックアップ化、上限超過世代の削除を行います。

localStorageには次の軽量設定だけを保存します。

```ts
interface LocalSaveSettings {
  activeSlotId: SaveSlotId;
  autosaveEnabled: boolean;
}
```

JSON export/importはT042、クラウド同期は将来同じRepository境界の別アダプタとして追加します。

## 将来の完全なプレイヤーセーブ

```ts
interface PlayerSave extends PlayerData {
  runs: {
    activeBattle: ActiveBattleSnapshot | null;
    activeExpedition: unknown | null;
  };
}
```

T040ではPlayerDataのみを永続化します。stable戦闘スナップショットはT042で追加します。

## 不変条件

- 基本通貨、研究データ、触媒数量は負にならない
- 数量・差分・解析増加は安全な整数
- 解析度とconditionは0～10000
- 同じspeciesIdの種状態は一つ
- 同じinstanceIdは一つ
- 同じ研究nodeIdのプレイヤー状態は一つ
- 研究状態と開示段階は固定対応を崩さない
- 確定研究は資源・標本・設計図・研究状態を一括確定する
- lockedまたは編成中個体を標本消費・還元しない
- 召喚instanceIdへ時刻・乱数・表示名を使わない
- 解放済み設計図は個体消費・還元で失われない
- 同じ編成内でinstanceId、位置、tiePriorityを重複させない
- 装備汎用技は個体が習得済み
- 開花技は種状態で解放済み
- 同じstageId・regionId・save slot pointerは一つ
- 精算済みsettlementIdを再適用しない
- save pointerのcurrentとbackup generation IDは重複しない
- backup generationは最大3件
- pointer切替前にTEMPORARY generationを再読込・検証する
- 保存失敗時に旧current pointerを変更しない
- 表示名を参照キーに使わない

## スキーマ検証

T040は依存を追加せず、純粋TypeScriptのランタイム検証と正規化を使用します。旧schemaを一段ずつ変換するmigrationはT041、外部JSONを受け入れるimport境界の追加依存採否はT042またはT043で判断します。
