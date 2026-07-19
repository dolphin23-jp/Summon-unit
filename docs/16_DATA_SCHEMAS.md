# 16. Data Schemas

本書は最終APIではなく、モジュール境界を固定するための初期案です。

## ID

```ts
type SpeciesId = string;
type UnitInstanceId = string;
type SkillId = string;
type EffectId = string;
type RecipeId = string;
type StageId = string;
type ItemId = string;
type BattleId = string;
type FormationId = string;
```

ブランド型は実装時に検討します。

## 盤面

```ts
type Side = 'ALLY' | 'ENEMY';
type Column = 0 | 1 | 2;
type LocalRow = 0 | 1 | 2; // front, middle, back は変換関数で扱う

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
  traitId: string;
  innateSkillId: SkillId;
  bloomSkillIds: SkillId[];
}
```

## 技

```ts
type DeliveryMode = 'CONTACT' | 'DIRECT' | 'PIERCE' | 'ARC' | 'SNIPE' | 'SELF' | 'GLOBAL';

interface SkillDefinition {
  id: SkillId;
  slotType: 'INNATE' | 'GENERIC' | 'BLOOM';
  attributeId: string;
  actionCost: number;
  cooldownActions: number;
  useLimit: number | null;
  telegraphDelay: number | null;
  targetRuleId: string;
  reachPatternId: string;
  deliveryMode: DeliveryMode;
  effectPatternId: string;
  effects: EffectDefinition[];
  ai: SkillAiMetadata;
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

## プレイヤー状態（T032時点）

T032ではコレクションと編成の境界を具体化します。経済、研究、地域進行、戦闘中断状態はT034以降で同じトップレベルへ合成します。

```ts
interface PlayerData {
  schemaVersion: number;
  gameVersion: string;
  contentVersion: string;
  collection: PlayerCollectionState;
  formations: PlayerFormationState;
}

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

図鑑段階と統計キーはコンテンツ追加を妨げない固定文字列IDとします。解析度とconditionは0～10000の整数basis pointsです。

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
  members: FormationMember[]; // 0～9体
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

T032はメモリアダプタを実装します。IndexedDB、JSON export/import、クラウド同期は同じRepositoryインターフェースの別アダプタとします。

## 将来の完全なプレイヤーセーブ

```ts
interface PlayerSave extends PlayerData {
  economy: EconomyState;
  research: ResearchState;
  world: WorldProgressState;
  runs: { activeBattle: ActiveBattleSnapshot | null; activeExpedition: unknown | null };
}
```

## 不変条件

- 数量は負にならない
- 同じspeciesIdの種状態は一つ
- 同じinstanceIdは一つ
- 所持個体には対応する種状態が存在する
- 同じ編成内で同一instanceIdを重複配置しない
- 同じ編成内で位置とtiePriorityを重複させない
- 装備汎用技は個体が習得済み
- 開花技は種マスターに属し、種状態で解放済み
- AI技ポリシーは固有技と現在の装備技だけを参照する
- `activeBattle` はstableスナップショットのみ
- 表示名は参照キーに使わない

## スキーマ検証

T032は依存を追加せず、純粋TypeScriptのランタイム検証と正規化を実装します。将来、JSON import境界を追加する際はZod等の導入を別タスクで判断します。
