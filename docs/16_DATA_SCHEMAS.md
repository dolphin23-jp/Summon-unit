# 16. Data Schemas

本書は最終APIではなく、モジュール境界を固定するための初期案です。表示名ではなく固定IDを参照し、数量・時刻・解析度・開示段階は整数で保存します。

## ID

```ts
type SpeciesId = string;
type UnitInstanceId = string;
type SkillId = string;
type EffectId = string;
type ResearchNodeId = string;
type StageId = string;
type CatalystId = string;
type BattleId = string;
type FormationId = string;
```

ブランド型は実装時に検討します。

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
type DeliveryMode = 'CONTACT' | 'DIRECT' | 'PIERCE' | 'ARC' | 'SNIPE' | 'SELF' | 'GLOBAL';

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
  kind: 'UNIT_TURN' | 'TELEGRAPH_RESOLVE' | 'SUMMON' | 'TERRAIN_TRIGGER' | 'PHASE_CHANGE';
  payload: unknown;
}
```

優先度とsequenceで安定順序を保証します。

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

## プレイヤー状態（T035時点）

T035ではコレクション、編成、経済、研究進行を同じPlayerDataへ統合します。地域進行と戦闘中断状態は後続タスクで同じトップレベルへ合成します。

```ts
interface PlayerData {
  schemaVersion: number;
  gameVersion: string;
  contentVersion: string;
  economy: EconomyState;
  research: PlayerResearchState;
  collection: PlayerCollectionState;
  formations: PlayerFormationState;
}

interface PlayerDataContentCatalog {
  species: MonsterSpecies[];
  skills: SkillDefinition[];
  researchNodes: ResearchNodeDefinition[];
}
```

T035のデモPlayerDataは研究状態追加に伴いschemaVersion 3です。IndexedDB永続化とmigrationは未実装です。既存T032～T034のメモリ内入力では`research`と`researchNodes`を省略でき、省略時は空状態へ正規化します。

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

状態の数量は非負の安全な整数です。取引差分は正負の安全な整数を許可し、全結果を検証してから一括確定します。触媒は固定ID順へ正規化し、0残高は保存しません。

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

図鑑段階と統計キーは固定文字列IDです。解析度とconditionは0～10000の整数basis pointsです。

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

interface AppliedAnalysisGain {
  speciesId: SpeciesId;
  source: AnalysisGainSource;
  requestedAmount: number;
  appliedAmount: number;
  before: number;
  after: number;
}

interface PlayerProgressionTransaction {
  economy?: EconomyTransaction;
  analysisGains?: AnalysisGain[];
}
```

同じ種・同じ増加源は集約し、種ID順、増加源の固定順で適用します。10000を超える分は切り捨てます。経済または解析のどちらかが不正なら結果を返さず、部分適用を公開しません。

## 研究網マスター

```ts
type ResearchNodeStatus = 'hidden' | 'hinted' | 'candidate' | 'known' | 'completed';
type ResearchDisclosureStage = 0 | 1 | 2 | 3 | 4 | 5;
type ResearchMethod = 'FUSION' | 'LINEAGE' | 'CONVERGENCE' | 'TRANSCENDENCE';

interface ResearchRecipe {
  method: ResearchMethod;
  materialSpeciesIds: SpeciesId[];
  catalystIds: CatalystId[];
}

interface ResearchCandidateRange {
  methods: ResearchMethod[];
  materialSpeciesIds: SpeciesId[];
  catalystIds: CatalystId[];
  minimumMaterialCount: number;
  maximumMaterialCount: number;
  minimumCatalystCount: number;
  maximumCatalystCount: number;
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
```

研究マスターは対象種・素材種・隣接ノードの参照を検証し、正解レシピが候補範囲と要素数範囲に含まれることを要求します。

## 研究ヒント

```ts
type ResearchHintTrigger =
  | { type: 'ANALYSIS'; speciesId: SpeciesId; minimumBasisPoints: number }
  | { type: 'CATALYST'; catalystId: CatalystId }
  | { type: 'PROGRESS'; progressId: string }
  | { type: 'ADJACENT'; nodeId: ResearchNodeId; minimumStatus?: 'known' | 'completed' }
  | { type: 'TRIAL'; minimumIncorrectTrials: number };

interface ResearchHintDefinition {
  hintId: string;
  disclosureStage: 1 | 2 | 3 | 4;
  trigger: ResearchHintTrigger;
}
```

ヒントは固定ノード順・固定ヒント順で評価します。隣接研究による連鎖は同じ入力から同じ結果へ収束するまで反復します。

## プレイヤー研究状態

```ts
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

開示段階0は`hidden`、1は`hinted`、2～3は`candidate`、4は`known`、5は`completed`です。セーブにないマスターノードは`hidden`・段階0として補完します。

不正解署名は`nodeId | method | sorted material species IDs | sorted catalyst IDs`の固定形式です。現在時刻、乱数、表示名は含めません。

## 試験研究

```ts
interface TrialResearchSubmission {
  nodeId: ResearchNodeId;
  method: ResearchMethod;
  materialSpeciesIds: SpeciesId[];
  catalystIds: CatalystId[];
}

interface TrialResearchEvaluation {
  methodMatched: boolean;
  materialSpecies: { elementId: SpeciesId; matched: boolean }[];
  catalysts: { elementId: CatalystId; matched: boolean }[];
  materialCountMatched: boolean;
  catalystCountMatched: boolean;
  exactMatch: boolean;
}
```

試験研究は`candidate`ノードと提示済み候補範囲だけを受け付けます。研究データのみを消費し、触媒と個体は消費しません。完全一致は`known`・段階4へ進め、不正解は署名を保存して試験ヒントを再評価します。

## 編成・ロードアウト

装備状態は個体ではなく編成メンバーへ保存します。同じ個体を異なる編成で別設定にできます。

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

固有技は種マスターから導出し、保存しません。戦闘用装備技は`固有 → 汎用 → 開花`の固定順です。

## Repository境界

```ts
type PlayerSaveSlotId = 'slot-1' | 'slot-2' | 'slot-3';

interface PlayerDataRepository {
  listSlots(): Promise<readonly PlayerSaveSlotId[]>;
  load(slotId: PlayerSaveSlotId): Promise<PlayerData | null>;
  save(slotId: PlayerSaveSlotId, playerData: PlayerData): Promise<void>;
  delete(slotId: PlayerSaveSlotId): Promise<void>;
}
```

メモリアダプタは研究と経済を含むPlayerData全体を再検証して保存します。IndexedDB、JSON export/import、クラウド同期は同じRepositoryインターフェースの別アダプタとします。

## 将来の完全なプレイヤーセーブ

```ts
interface PlayerSave extends PlayerData {
  world: WorldProgressState;
  runs: { activeBattle: ActiveBattleSnapshot | null; activeExpedition: unknown | null };
}
```

## 不変条件

- 基本通貨、研究データ、触媒数量は負にならない
- 数量・差分・解析増加は安全な整数
- 解析度は0～10000
- 同じspeciesIdの種状態は一つ
- 同じinstanceIdは一つ
- 同じ研究nodeIdのプレイヤー状態は一つ
- 研究状態と開示段階は固定対応を崩さない
- 研究ヒントIDと不正解署名は同一ノード内で一意
- 試験研究は研究データ以外を消費しない
- 所持個体には対応する種状態が存在する
- 同じ編成内で同一instanceIdを重複配置しない
- 同じ編成内で位置とtiePriorityを重複させない
- 装備汎用技は個体が習得済み
- 開花技は種マスターに属し、種状態で解放済み
- AI技ポリシーは固有技と現在の装備技だけを参照する
- `activeBattle`はstableスナップショットのみ
- 表示名は参照キーに使わない

## スキーマ検証

T035は依存を追加せず、純粋TypeScriptのランタイム検証と正規化を実装します。将来、JSON import境界を追加する際はZod等の導入を別タスクで判断します。
