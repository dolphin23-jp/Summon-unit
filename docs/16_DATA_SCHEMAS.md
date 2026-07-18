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

## プレイヤー状態

```ts
interface PlayerSave {
  schemaVersion: number;
  gameVersion: string;
  contentVersion: string;
  economy: EconomyState;
  collection: CollectionState;
  research: ResearchState;
  formations: FormationState;
  world: WorldProgressState;
  runs: { activeBattle: ActiveBattleSnapshot | null; activeExpedition: unknown | null };
}
```

## 不変条件

- 数量は負にならない
- 同じinstanceIdは一つ
- 同じ編成内で同一instanceIdを重複配置しない
- 装備汎用技は個体が習得済み
- 開花技は種で解放済み
- `activeBattle` はstableスナップショットのみ
- 表示名は参照キーに使わない

## スキーマ検証

実装時はZod等のランタイム検証を候補としますが、依存追加はTask 002で確定します。
