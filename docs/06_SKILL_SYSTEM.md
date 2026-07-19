# 06. Skill System

## 三種類のアクティブ技

### 固有技

- 最初から使用可能
- 変更不能
- 原則回数制限・クールダウンなし
- モンスターの主役割を担う

### 汎用技

- 研究で技自体を永久解放
- 個体ごとに通貨で習得
- 一度習得すれば失わない
- 複数習得、1つ装備
- T1～T5
- 全モンスターが原則習得可能

専用技より同条件で70～90%程度の効率を基準とし、専門性を奪わないようにします。

### 開花技

- 種単位で解放
- 低レアは2～3戦程度で研究可能
- 個体・希少触媒を消費しない
- 少量の通貨・研究データ
- 単なる威力上位版ではなく、運用を拡張
- 将来複数候補を追加可能、装備は1つ

解析度目安:

- R1～R3: 15%
- R4～R6: 20%
- R7～R8: 25%
- R9～R10: 30%

T036では種・開花技ごとに解析度しきい値、基本通貨費、研究データ費をマスター定義します。対象種の設計図が解放済みで、解析度がしきい値以上の場合だけ研究できます。解放結果は個体ではなく種状態の`bloomSkillIds`へ保存するため、同種の全個体が利用できます。

開花研究は個体や触媒を消費しません。費用と開花技追加を一括検証後に確定し、残高不足や重複解放では一部だけ更新しません。装備側は既存の`FormationLoadout.bloomSkillId`一枠を使用します。

## 共通データ項目

- id / name
- slotType
- attribute
- usageConditions
- targetSelector
- reachPattern
- deliveryMode
- effectPattern
- effects[]
- actionCost
- cooldownActions
- usageLimit
- telegraphDelay
- AI metadata

## 効果部品

- damage
- heal
- applyStatus
- removeStatus
- buff / debuff
- modifyNextActionTime
- forceMove
- selfMove
- barrier
- guardShare
- summon
- createTerrain
- revive

## 技価値の暫定原則

追加効果のない単体攻撃:

```text
威力0.7 ≈ コスト70
威力1.0 ≈ コスト100
威力1.5 ≈ コスト150
```

付加価値には威力低下またはコスト増を与えます。

- 遠距離化: 10～20%
- 遮蔽無視: 15～25%
- 押し出し: 約15%
- 小範囲: 単体威力20～40%低下
- 攻撃後移動: 威力低下またはコスト増

高レア専用技は基準効率を超えて構いません。

## クールダウン

使用者自身の行動機会で進みます。移動・待機でも進みます。

## AIメタデータ

例:

- FINISHER
- AREA_DAMAGE
- HEAL
- EMERGENCY_HEAL
- POSITION_CONTROL
- ESCAPE
- BUFF
- DEBUFF
- TIME_CONTROL
- SUMMON
