import type { BloomResearchDefinition } from '../progression/t036-progression-model'
import { validateContentCatalog, type ContentValidationSummary } from './content-validation'
import type { MonsterSpecies, SpeciesId } from './monster-species'
import type { SkillDefinition, SkillId } from './skill-definition'

export type VerticalSliceRoleId =
  | 'STRIKER'
  | 'RANGED'
  | 'HEALER'
  | 'TANK'
  | 'CONTROLLER'
  | 'SUPPORT'
  | 'BRUISER'
  | 'BOSS'

export type VerticalSliceSkillTier =
  | 'INNATE'
  | 'BLOOM'
  | 'GENERIC_T1'
  | 'GENERIC_T2'

export interface VerticalSlicePassiveTraitDefinition {
  readonly traitId: string
  readonly displayName: string
  readonly summary: string
  readonly effectTags: readonly string[]
}

export interface VerticalSliceSkillRecord {
  readonly definition: SkillDefinition
  readonly displayName: string
  readonly tacticalSummary: string
  readonly tier: VerticalSliceSkillTier
  readonly effectTags: readonly string[]
  readonly efficiencyBasisPoints?: number
}

export interface VerticalSliceMonsterRecord {
  readonly definition: MonsterSpecies
  readonly displayName: string
  readonly roleSentence: string
  readonly primaryRole: VerticalSliceRoleId
  readonly secondaryRole: VerticalSliceRoleId | null
  readonly recommendedPositionIds: readonly string[]
  readonly strengths: readonly string[]
  readonly weaknesses: readonly string[]
  readonly compatibleSpeciesIds: readonly SpeciesId[]
  readonly counterplay: string
  readonly testedMechanicIds: readonly string[]
}

export interface VerticalSliceContentSummary extends ContentValidationSummary {
  readonly passiveTraits: number
  readonly authoredMonsters: number
  readonly authoredSkills: number
  readonly innateSkills: number
  readonly bloomSkills: number
  readonly genericTier1Skills: number
  readonly genericTier2Skills: number
}

function freezeStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values])
}

function defineTrait(
  definition: VerticalSlicePassiveTraitDefinition,
): VerticalSlicePassiveTraitDefinition {
  return Object.freeze({
    ...definition,
    effectTags: freezeStrings(definition.effectTags),
  })
}

function defineSkill(record: VerticalSliceSkillRecord): VerticalSliceSkillRecord {
  return Object.freeze({
    ...record,
    definition: Object.freeze({ ...record.definition }),
    effectTags: freezeStrings(record.effectTags),
  })
}

function defineMonster(record: VerticalSliceMonsterRecord): VerticalSliceMonsterRecord {
  return Object.freeze({
    ...record,
    definition: Object.freeze({
      ...record.definition,
      tagIds: freezeStrings(record.definition.tagIds),
      bloomSkillIds: freezeStrings(record.definition.bloomSkillIds ?? []),
      passiveTraitIds: freezeStrings(record.definition.passiveTraitIds ?? []),
      stats: Object.freeze({ ...record.definition.stats }),
    }),
    recommendedPositionIds: freezeStrings(record.recommendedPositionIds),
    strengths: freezeStrings(record.strengths),
    weaknesses: freezeStrings(record.weaknesses),
    compatibleSpeciesIds: freezeStrings(record.compatibleSpeciesIds),
    testedMechanicIds: freezeStrings(record.testedMechanicIds),
  })
}

export const VERTICAL_SLICE_PASSIVE_TRAITS: readonly VerticalSlicePassiveTraitDefinition[] =
  Object.freeze([
    defineTrait({
      traitId: 'trait.slice.grassfang-scurry',
      displayName: '草間駆け',
      summary: '軽い行動の後に前線を維持しやすい。',
      effectTags: ['trait.after-light-action-positioning'],
    }),
    defineTrait({
      traitId: 'trait.slice.windwing-sight',
      displayName: '複眼照準',
      summary: '直線射撃で遮蔽の薄い対象を見つけやすい。',
      effectTags: ['trait.direct-line-targeting'],
    }),
    defineTrait({
      traitId: 'trait.slice.moss-root',
      displayName: '根付き',
      summary: '後列に留まるほど回復役として安定する。',
      effectTags: ['trait.stationary-healing'],
    }),
    defineTrait({
      traitId: 'trait.slice.mudshell-anchor',
      displayName: '泥錨',
      summary: '強制移動を受けにくく前列を固定する。',
      effectTags: ['trait.forced-move-resistance'],
    }),
    defineTrait({
      traitId: 'trait.slice.ember-blood',
      displayName: '残り火',
      summary: '火傷中の敵へ追加圧力を与える。',
      effectTags: ['trait.burn-synergy'],
    }),
    defineTrait({
      traitId: 'trait.slice.ancient-ratchet',
      displayName: '古式ラチェット',
      summary: '時間操作を一度だけ強める。',
      effectTags: ['trait.time-control-boost'],
    }),
    defineTrait({
      traitId: 'trait.slice.gale-hunt',
      displayName: '追風狩り',
      summary: '移動直後の攻撃効率が上がる。',
      effectTags: ['trait.move-then-attack'],
    }),
    defineTrait({
      traitId: 'trait.slice.rock-layer',
      displayName: '重層甲',
      summary: '障壁が残っている間は前列性能が高い。',
      effectTags: ['trait.barrier-defense'],
    }),
    defineTrait({
      traitId: 'trait.slice.spark-updraft',
      displayName: '上昇気流',
      summary: '曲射の位置制約を受けにくい。',
      effectTags: ['trait.arc-positioning'],
    }),
    defineTrait({
      traitId: 'trait.slice.moss-cycle',
      displayName: '苔の循環',
      summary: '継続回復が有効な味方を支えやすい。',
      effectTags: ['trait.regeneration-support'],
    }),
    defineTrait({
      traitId: 'trait.slice.iron-momentum',
      displayName: '鉄角慣性',
      summary: '押し出し成功時に次の攻撃準備が進む。',
      effectTags: ['trait.force-move-payoff'],
    }),
    defineTrait({
      traitId: 'trait.slice.venom-dust',
      displayName: '毒鱗粉',
      summary: '毒スタックを維持するほど圧力が増す。',
      effectTags: ['trait.poison-stack-synergy'],
    }),
    defineTrait({
      traitId: 'trait.slice.furnace-core',
      displayName: '炉心',
      summary: '火属性の地形と貫通攻撃を強化する。',
      effectTags: ['trait.fire-terrain-synergy', 'trait.pierce-synergy'],
    }),
    defineTrait({
      traitId: 'trait.slice.molten-intercept',
      displayName: '熔護',
      summary: '肩代わりした被弾へ火傷反撃を返す。',
      effectTags: ['trait.guard-share', 'trait.burn-counter'],
    }),
    defineTrait({
      traitId: 'trait.slice.canopy-prayer',
      displayName: '樹冠祈祷',
      summary: '複数味方への支援効果を長く保つ。',
      effectTags: ['trait.area-support-duration'],
    }),
    defineTrait({
      traitId: 'trait.slice.disaster-aura',
      displayName: '災炎威圧',
      summary: '遮蔽を無視する予兆攻撃で陣形全体を崩す。',
      effectTags: ['trait.cover-ignore', 'trait.telegraph-area'],
    }),
  ])

export const VERTICAL_SLICE_SKILL_RECORDS: readonly VerticalSliceSkillRecord[] = Object.freeze([
  defineSkill({
    displayName: '草牙噛み',
    tacticalSummary: '低コストで前列へ圧力をかける基本近接。',
    tier: 'INNATE',
    effectTags: ['DAMAGE', 'LIGHT_ACTION'],
    definition: {
      id: 'skill.slice.grassfang-bite',
      slotType: 'INNATE',
      attributeId: 'attribute.wind',
      actionCost: 70,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'CONTACT',
      damageMultiplierPermille: 800,
    },
  }),
  defineSkill({
    displayName: '風線針',
    tacticalSummary: '遮蔽を意識して射線を通す直線遠距離攻撃。',
    tier: 'INNATE',
    effectTags: ['DAMAGE', 'DIRECT'],
    definition: {
      id: 'skill.slice.windwing-line-needle',
      slotType: 'INNATE',
      attributeId: 'attribute.wind',
      actionCost: 90,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'DIRECT',
      damageMultiplierPermille: 900,
    },
  }),
  defineSkill({
    displayName: '苔雫',
    tacticalSummary: '傷ついた味方一体を小さく回復する。',
    tier: 'INNATE',
    effectTags: ['HEAL'],
    definition: {
      id: 'skill.slice.moss-drop',
      slotType: 'INNATE',
      attributeId: 'attribute.earth',
      actionCost: 90,
      targetType: 'SINGLE_ALLY',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '泥殻構え',
    tacticalSummary: '自身へ障壁を張り遮蔽役を継続する。',
    tier: 'INNATE',
    effectTags: ['BARRIER', 'SELF_DEFENSE'],
    definition: {
      id: 'skill.slice.mudshell-stance',
      slotType: 'INNATE',
      attributeId: 'attribute.earth',
      actionCost: 80,
      targetType: 'SELF',
      reachMethod: 'SELF',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '火種噛み',
    tacticalSummary: '軽い火属性攻撃と火傷を与える。',
    tier: 'INNATE',
    effectTags: ['DAMAGE', 'BURN'],
    definition: {
      id: 'skill.slice.ember-bite',
      slotType: 'INNATE',
      attributeId: 'attribute.fire',
      actionCost: 95,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'CONTACT',
      damageMultiplierPermille: 750,
    },
  }),
  defineSkill({
    displayName: '歯車加速',
    tacticalSummary: '味方一体の次回行動を早める。',
    tier: 'INNATE',
    effectTags: ['TIME_ADVANCE', 'SUPPORT'],
    definition: {
      id: 'skill.slice.gear-accelerate',
      slotType: 'INNATE',
      attributeId: 'attribute.neutral',
      actionCost: 100,
      targetType: 'SINGLE_ALLY',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
      cooldownActions: 1,
    },
  }),
  defineSkill({
    displayName: '追風爪',
    tacticalSummary: '移動後に最大効率となる高速近接。',
    tier: 'INNATE',
    effectTags: ['DAMAGE', 'MOVE_SCALING'],
    definition: {
      id: 'skill.slice.gale-claw',
      slotType: 'INNATE',
      attributeId: 'attribute.wind',
      actionCost: 85,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'CONTACT',
      damageMultiplierPermille: 1000,
    },
  }),
  defineSkill({
    displayName: '岩殻付与',
    tacticalSummary: '味方一体へ厚い障壁を付与する。',
    tier: 'INNATE',
    effectTags: ['BARRIER', 'ALLY_SUPPORT'],
    definition: {
      id: 'skill.slice.rock-shell',
      slotType: 'INNATE',
      attributeId: 'attribute.earth',
      actionCost: 105,
      targetType: 'SINGLE_ALLY',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '火花曲射',
    tacticalSummary: '前列遮蔽を越えて後衛を狙える曲射。',
    tier: 'INNATE',
    effectTags: ['DAMAGE', 'ARC'],
    definition: {
      id: 'skill.slice.spark-arc',
      slotType: 'INNATE',
      attributeId: 'attribute.fire',
      actionCost: 105,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'ARC',
      damageMultiplierPermille: 950,
    },
  }),
  defineSkill({
    displayName: '再生苔',
    tacticalSummary: '味方と隣接味方を回復し再生を付与する。',
    tier: 'INNATE',
    effectTags: ['HEAL', 'REGENERATION', 'SMALL_AREA'],
    definition: {
      id: 'skill.slice.moss-regrowth',
      slotType: 'INNATE',
      attributeId: 'attribute.earth',
      actionCost: 110,
      targetType: 'SINGLE_ALLY_AND_ADJACENT',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '鉄角突進',
    tacticalSummary: '対象を押し出して列を崩す重い近接。',
    tier: 'INNATE',
    effectTags: ['DAMAGE', 'FORCE_MOVE'],
    definition: {
      id: 'skill.slice.ironhorn-charge',
      slotType: 'INNATE',
      attributeId: 'attribute.earth',
      actionCost: 120,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'CONTACT',
      damageMultiplierPermille: 1050,
    },
  }),
  defineSkill({
    displayName: '連毒針',
    tacticalSummary: '低威力の射撃で毒スタックを重ねる。',
    tier: 'INNATE',
    effectTags: ['DAMAGE', 'POISON_STACK'],
    definition: {
      id: 'skill.slice.venom-needles',
      slotType: 'INNATE',
      attributeId: 'attribute.dark',
      actionCost: 110,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'DIRECT',
      damageMultiplierPermille: 800,
    },
  }),
  defineSkill({
    displayName: '炉槍',
    tacticalSummary: '列を貫通し着弾線へ炎上床を残す。',
    tier: 'INNATE',
    effectTags: ['DAMAGE', 'PIERCE', 'BURNING_TERRAIN'],
    definition: {
      id: 'skill.slice.furnace-lance',
      slotType: 'INNATE',
      attributeId: 'attribute.fire',
      actionCost: 130,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'PIERCE',
      areaMask: 'VERTICAL_COLUMN',
      damageMultiplierPermille: 1150,
    },
  }),
  defineSkill({
    displayName: '熔岩護衛',
    tacticalSummary: '周囲の味方を肩代わりし被弾へ火傷反撃を返す。',
    tier: 'INNATE',
    effectTags: ['GUARD_SHARE', 'BURN_COUNTER'],
    definition: {
      id: 'skill.slice.molten-guard',
      slotType: 'INNATE',
      attributeId: 'attribute.fire',
      actionCost: 130,
      targetType: 'SELF_AREA',
      reachMethod: 'SELF',
      areaMask: 'SURROUNDING_EIGHT',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '樹冠祝福',
    tacticalSummary: '味方と隣接味方へ回復と支援強化を配る。',
    tier: 'INNATE',
    effectTags: ['HEAL', 'BUFF', 'SMALL_AREA'],
    definition: {
      id: 'skill.slice.canopy-blessing',
      slotType: 'INNATE',
      attributeId: 'attribute.wind',
      actionCost: 125,
      targetType: 'SINGLE_ALLY_AND_ADJACENT',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '災炎急襲',
    tacticalSummary: '遮蔽を無視し予兆後に対象周辺を焼く高性能攻撃。',
    tier: 'INNATE',
    effectTags: ['DAMAGE', 'COVER_IGNORE', 'TELEGRAPH', 'AREA_DAMAGE'],
    definition: {
      id: 'skill.slice.disaster-assault',
      slotType: 'INNATE',
      attributeId: 'attribute.fire',
      actionCost: 170,
      telegraphDelay: 60,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'SNIPE',
      areaMask: 'TARGET_AND_SIDES',
      damageMultiplierPermille: 1500,
      cooldownActions: 1,
    },
  }),

  defineSkill({
    displayName: '群駆け',
    tacticalSummary: '攻撃後に安全な隣接位置へ移り連続運用を広げる。',
    tier: 'BLOOM',
    effectTags: ['DAMAGE', 'SELF_MOVE'],
    definition: {
      id: 'skill.slice.grassfang-pack-run',
      slotType: 'BLOOM',
      attributeId: 'attribute.wind',
      actionCost: 90,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'CONTACT',
      damageMultiplierPermille: 950,
      cooldownActions: 1,
    },
  }),
  defineSkill({
    displayName: '横風掃射',
    tacticalSummary: '横一列へ射撃し密集を罰する。',
    tier: 'BLOOM',
    effectTags: ['DAMAGE', 'DIRECT', 'AREA_DAMAGE'],
    definition: {
      id: 'skill.slice.windwing-crosswind',
      slotType: 'BLOOM',
      attributeId: 'attribute.wind',
      actionCost: 120,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'DIRECT',
      areaMask: 'HORIZONTAL_ROW',
      damageMultiplierPermille: 760,
      cooldownActions: 1,
    },
  }),
  defineSkill({
    displayName: '芽吹き床',
    tacticalSummary: '小範囲に回復領域を作り配置価値を生む。',
    tier: 'BLOOM',
    effectTags: ['HEALING_TERRAIN', 'AREA_HEAL'],
    definition: {
      id: 'skill.slice.moss-seedbed',
      slotType: 'BLOOM',
      attributeId: 'attribute.earth',
      actionCost: 120,
      targetType: 'SINGLE_ALLY_AND_ADJACENT',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
      cooldownActions: 2,
    },
  }),
  defineSkill({
    displayName: '歩く防塁',
    tacticalSummary: '障壁を得て前方へ移り遮蔽線を作り直す。',
    tier: 'BLOOM',
    effectTags: ['BARRIER', 'SELF_MOVE', 'FORCE_MOVE_RESISTANCE'],
    definition: {
      id: 'skill.slice.mudshell-rampart',
      slotType: 'BLOOM',
      attributeId: 'attribute.earth',
      actionCost: 110,
      targetType: 'SELF',
      reachMethod: 'SELF',
      damageMultiplierPermille: 1,
      cooldownActions: 1,
    },
  }),
  defineSkill({
    displayName: '火走り',
    tacticalSummary: '移動経路へ炎上床を残して接近経路を制限する。',
    tier: 'BLOOM',
    effectTags: ['SELF_MOVE', 'BURNING_TERRAIN'],
    definition: {
      id: 'skill.slice.ember-firetrail',
      slotType: 'BLOOM',
      attributeId: 'attribute.fire',
      actionCost: 100,
      targetType: 'SELF',
      reachMethod: 'SELF',
      damageMultiplierPermille: 1,
      cooldownActions: 1,
    },
  }),
  defineSkill({
    displayName: '逆転歯車',
    tacticalSummary: '敵の次回行動を遅らせ味方の時間優位を作る。',
    tier: 'BLOOM',
    effectTags: ['TIME_DELAY', 'DEBUFF'],
    definition: {
      id: 'skill.slice.gear-reversal',
      slotType: 'BLOOM',
      attributeId: 'attribute.neutral',
      actionCost: 125,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 550,
      cooldownActions: 2,
    },
  }),
  defineSkill({
    displayName: '嵐巡り',
    tacticalSummary: '複数対象を駆け抜ける連鎖攻撃。',
    tier: 'BLOOM',
    effectTags: ['DAMAGE', 'CHAIN', 'SELF_MOVE'],
    definition: {
      id: 'skill.slice.gale-circuit',
      slotType: 'BLOOM',
      attributeId: 'attribute.wind',
      actionCost: 135,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'CONTACT',
      areaMask: 'CHAIN',
      chainTargetCount: 3,
      damageMultiplierPermille: 780,
      cooldownActions: 2,
    },
  }),
  defineSkill({
    displayName: '共有岩塞',
    tacticalSummary: '自身と隣接味方へ障壁を配る。',
    tier: 'BLOOM',
    effectTags: ['BARRIER', 'AREA_SUPPORT'],
    definition: {
      id: 'skill.slice.rock-bastion',
      slotType: 'BLOOM',
      attributeId: 'attribute.earth',
      actionCost: 135,
      targetType: 'SELF_AREA',
      reachMethod: 'SELF',
      areaMask: 'SURROUNDING_EIGHT',
      damageMultiplierPermille: 1,
      cooldownActions: 2,
    },
  }),
  defineSkill({
    displayName: '落雷標',
    tacticalSummary: '予兆を置き十字範囲へ曲射火撃を落とす。',
    tier: 'BLOOM',
    effectTags: ['DAMAGE', 'ARC', 'TELEGRAPH', 'AREA_DAMAGE'],
    definition: {
      id: 'skill.slice.spark-skyfall',
      slotType: 'BLOOM',
      attributeId: 'attribute.fire',
      actionCost: 145,
      telegraphDelay: 50,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'ARC',
      areaMask: 'CROSS',
      damageMultiplierPermille: 880,
      cooldownActions: 2,
    },
  }),
  defineSkill({
    displayName: '浄苔庭',
    tacticalSummary: '小範囲を回復し状態異常を一つ除去する。',
    tier: 'BLOOM',
    effectTags: ['HEAL', 'REMOVE_STATUS', 'HEALING_TERRAIN'],
    definition: {
      id: 'skill.slice.moss-cleansing-grove',
      slotType: 'BLOOM',
      attributeId: 'attribute.earth',
      actionCost: 145,
      targetType: 'SINGLE_ALLY_AND_ADJACENT',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
      cooldownActions: 2,
    },
  }),
  defineSkill({
    displayName: '雪崩角',
    tacticalSummary: '縦列を押し込み敵陣の位置関係を崩す。',
    tier: 'BLOOM',
    effectTags: ['DAMAGE', 'PIERCE', 'FORCE_MOVE', 'AREA_DAMAGE'],
    definition: {
      id: 'skill.slice.ironhorn-avalanche',
      slotType: 'BLOOM',
      attributeId: 'attribute.earth',
      actionCost: 155,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'PIERCE',
      areaMask: 'VERTICAL_COLUMN',
      damageMultiplierPermille: 1050,
      cooldownActions: 2,
    },
  }),
  defineSkill({
    displayName: '毒雲',
    tacticalSummary: '対象周辺へ毒を配りスタック戦術を拡張する。',
    tier: 'BLOOM',
    effectTags: ['POISON_STACK', 'AREA_STATUS'],
    definition: {
      id: 'skill.slice.venom-cloud',
      slotType: 'BLOOM',
      attributeId: 'attribute.dark',
      actionCost: 145,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'ARC',
      areaMask: 'TARGET_AND_SIDES',
      damageMultiplierPermille: 620,
      cooldownActions: 2,
    },
  }),
  defineSkill({
    displayName: '炉壁展開',
    tacticalSummary: '占有壁を召喚し炎上床と射線を同時に操作する。',
    tier: 'BLOOM',
    effectTags: ['SUMMON', 'OCCUPYING_OBJECT', 'BURNING_TERRAIN'],
    definition: {
      id: 'skill.slice.furnace-wall',
      slotType: 'BLOOM',
      attributeId: 'attribute.fire',
      actionCost: 165,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'ARC',
      damageMultiplierPermille: 500,
      usageLimit: 2,
    },
  }),
  defineSkill({
    displayName: '熔界大盾',
    tacticalSummary: '陣営全体を一時的に肩代わりし反撃圧力を作る。',
    tier: 'BLOOM',
    effectTags: ['GUARD_SHARE', 'SIDE_SUPPORT', 'BURN_COUNTER'],
    definition: {
      id: 'skill.slice.molten-aegis',
      slotType: 'BLOOM',
      attributeId: 'attribute.fire',
      actionCost: 175,
      targetType: 'SELF_AREA',
      reachMethod: 'SELF',
      areaMask: 'SIDE_ALL',
      damageMultiplierPermille: 1,
      usageLimit: 2,
    },
  }),
  defineSkill({
    displayName: '大樹冠',
    tacticalSummary: '味方陣営全体へ支援と回復領域を展開する。',
    tier: 'BLOOM',
    effectTags: ['GLOBAL_SUPPORT', 'BUFF', 'HEALING_TERRAIN'],
    definition: {
      id: 'skill.slice.grand-canopy',
      slotType: 'BLOOM',
      attributeId: 'attribute.wind',
      actionCost: 170,
      targetType: 'SINGLE_ALLY',
      reachMethod: 'GLOBAL',
      areaMask: 'SIDE_ALL',
      damageMultiplierPermille: 1,
      usageLimit: 2,
    },
  }),
  defineSkill({
    displayName: '災翼炎嵐',
    tacticalSummary: '敵陣営全体へ長い予兆を置く決戦技。',
    tier: 'BLOOM',
    effectTags: ['GLOBAL_DAMAGE', 'COVER_IGNORE', 'TELEGRAPH', 'BURN'],
    definition: {
      id: 'skill.slice.disaster-wingstorm',
      slotType: 'BLOOM',
      attributeId: 'attribute.fire',
      actionCost: 220,
      telegraphDelay: 90,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'GLOBAL',
      areaMask: 'SIDE_ALL',
      damageMultiplierPermille: 1250,
      usageLimit: 1,
    },
  }),

  defineSkill({
    displayName: '軽撃',
    tacticalSummary: '素早く回す汎用近接。',
    tier: 'GENERIC_T1',
    effectTags: ['DAMAGE', 'LIGHT_ACTION'],
    efficiencyBasisPoints: 8000,
    definition: {
      id: 'skill.slice.generic.light-strike',
      slotType: 'GENERIC',
      attributeId: 'attribute.neutral',
      actionCost: 70,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'CONTACT',
      damageMultiplierPermille: 700,
    },
  }),
  defineSkill({
    displayName: '防御態勢',
    tacticalSummary: '自身へ小障壁を付与する汎用防御。',
    tier: 'GENERIC_T1',
    effectTags: ['BARRIER', 'SELF_DEFENSE'],
    efficiencyBasisPoints: 8000,
    definition: {
      id: 'skill.slice.generic.guard-stance',
      slotType: 'GENERIC',
      attributeId: 'attribute.neutral',
      actionCost: 75,
      targetType: 'SELF',
      reachMethod: 'SELF',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '小治癒',
    tacticalSummary: '単体を小回復する汎用支援。',
    tier: 'GENERIC_T1',
    effectTags: ['HEAL'],
    efficiencyBasisPoints: 8000,
    definition: {
      id: 'skill.slice.generic.minor-heal',
      slotType: 'GENERIC',
      attributeId: 'attribute.light',
      actionCost: 80,
      targetType: 'SINGLE_ALLY',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '遠射',
    tacticalSummary: '威力を抑えて射程を得る汎用射撃。',
    tier: 'GENERIC_T1',
    effectTags: ['DAMAGE', 'DIRECT'],
    efficiencyBasisPoints: 7800,
    definition: {
      id: 'skill.slice.generic.long-shot',
      slotType: 'GENERIC',
      attributeId: 'attribute.neutral',
      actionCost: 90,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'DIRECT',
      damageMultiplierPermille: 720,
    },
  }),
  defineSkill({
    displayName: '後退',
    tacticalSummary: '攻撃をせず後方へ移る汎用離脱。',
    tier: 'GENERIC_T1',
    effectTags: ['SELF_MOVE', 'ESCAPE'],
    efficiencyBasisPoints: 8500,
    definition: {
      id: 'skill.slice.generic.retreat',
      slotType: 'GENERIC',
      attributeId: 'attribute.neutral',
      actionCost: 65,
      targetType: 'SELF',
      reachMethod: 'SELF',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '毒牙',
    tacticalSummary: '低威力攻撃に毒を付ける汎用技。',
    tier: 'GENERIC_T2',
    effectTags: ['DAMAGE', 'POISON'],
    efficiencyBasisPoints: 7800,
    definition: {
      id: 'skill.slice.generic.venom-fang',
      slotType: 'GENERIC',
      attributeId: 'attribute.dark',
      actionCost: 95,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'CONTACT',
      damageMultiplierPermille: 650,
    },
  }),
  defineSkill({
    displayName: '衝撃',
    tacticalSummary: '小さく押し出す汎用位置操作。',
    tier: 'GENERIC_T2',
    effectTags: ['DAMAGE', 'FORCE_MOVE'],
    efficiencyBasisPoints: 8000,
    definition: {
      id: 'skill.slice.generic.impact',
      slotType: 'GENERIC',
      attributeId: 'attribute.earth',
      actionCost: 100,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'CONTACT',
      damageMultiplierPermille: 800,
    },
  }),
  defineSkill({
    displayName: '鼓舞',
    tacticalSummary: '味方と隣接味方の攻撃を小強化する。',
    tier: 'GENERIC_T2',
    effectTags: ['BUFF', 'SMALL_AREA'],
    efficiencyBasisPoints: 8200,
    definition: {
      id: 'skill.slice.generic.inspire',
      slotType: 'GENERIC',
      attributeId: 'attribute.light',
      actionCost: 100,
      targetType: 'SINGLE_ALLY_AND_ADJACENT',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '浄化',
    tacticalSummary: '味方一体の状態異常を一つ除去する。',
    tier: 'GENERIC_T2',
    effectTags: ['REMOVE_STATUS'],
    efficiencyBasisPoints: 8500,
    definition: {
      id: 'skill.slice.generic.cleanse',
      slotType: 'GENERIC',
      attributeId: 'attribute.light',
      actionCost: 95,
      targetType: 'SINGLE_ALLY',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 1,
    },
  }),
  defineSkill({
    displayName: '時間阻害',
    tacticalSummary: '小ダメージと次回行動遅延を与える。',
    tier: 'GENERIC_T2',
    effectTags: ['DAMAGE', 'TIME_DELAY'],
    efficiencyBasisPoints: 7500,
    definition: {
      id: 'skill.slice.generic.time-hinder',
      slotType: 'GENERIC',
      attributeId: 'attribute.neutral',
      actionCost: 105,
      targetType: 'SINGLE_ENEMY',
      reachMethod: 'SNIPE',
      damageMultiplierPermille: 600,
      cooldownActions: 1,
    },
  }),
])

const MONSTERS: readonly VerticalSliceMonsterRecord[] = Object.freeze([
  defineMonster({
    displayName: '草牙ネズミ',
    roleSentence: '軽い近接行動を高速回転させ、空いた前列へ素早く入り直す入門ストライカー。',
    primaryRole: 'STRIKER',
    secondaryRole: null,
    recommendedPositionIds: ['FRONT', 'MIDDLE'],
    strengths: ['低コスト行動', '高い速度', '位置変更への追従'],
    weaknesses: ['低耐久', '射線外へ逃げる敵', '障壁'],
    compatibleSpeciesIds: ['species.slice.mudshell-beetle', 'species.slice.ancient-gear'],
    counterplay: '前列で受け止め、障壁や押し出しで軽い連打を止める。',
    testedMechanicIds: ['action-order', 'movement'],
    definition: {
      id: 'species.slice.grassfang-rat',
      rarity: 1,
      attributeId: 'attribute.wind',
      primarySpeciesId: 'species-group.beast',
      tagIds: ['tag.fast', 'tag.melee'],
      stats: { hp: 78, attack: 25, defense: 8, speed: 7 },
      innateSkillId: 'skill.slice.grassfang-bite',
      bloomSkillIds: ['skill.slice.grassfang-pack-run'],
      passiveTraitIds: ['trait.slice.grassfang-scurry'],
    },
  }),
  defineMonster({
    displayName: '風羽虫',
    roleSentence: '直線射程と遮蔽の基本を教える、脆い高速後衛シューター。',
    primaryRole: 'RANGED',
    secondaryRole: null,
    recommendedPositionIds: ['BACK'],
    strengths: ['直線遠距離', '高速度', '前列越しの支援射撃'],
    weaknesses: ['接近戦', '遮蔽された後衛', '低HP'],
    compatibleSpeciesIds: ['species.slice.mudshell-beetle', 'species.slice.ironhorn-beast'],
    counterplay: '前列遮蔽を維持し、曲射や接近で後列を狙う。',
    testedMechanicIds: ['cover', 'direct-range'],
    definition: {
      id: 'species.slice.windwing-midge',
      rarity: 1,
      attributeId: 'attribute.wind',
      primarySpeciesId: 'species-group.insect',
      tagIds: ['tag.fast', 'tag.ranged'],
      stats: { hp: 62, attack: 27, defense: 6, speed: 8 },
      innateSkillId: 'skill.slice.windwing-line-needle',
      bloomSkillIds: ['skill.slice.windwing-crosswind'],
      passiveTraitIds: ['trait.slice.windwing-sight'],
    },
  }),
  defineMonster({
    displayName: '苔芽',
    roleSentence: '単体回復だけに役割を絞り、回復対象と行動順の判断を教える入門ヒーラー。',
    primaryRole: 'HEALER',
    secondaryRole: null,
    recommendedPositionIds: ['BACK'],
    strengths: ['単体回復', '低い運用複雑度', '持久戦'],
    weaknesses: ['攻撃性能', '集中攻撃', '回復阻害'],
    compatibleSpeciesIds: ['species.slice.mudshell-beetle', 'species.slice.grassfang-rat'],
    counterplay: '前列を迂回して優先撃破するか、回復阻害を付与する。',
    testedMechanicIds: ['healing', 'target-priority'],
    definition: {
      id: 'species.slice.moss-sprout',
      rarity: 1,
      attributeId: 'attribute.earth',
      primarySpeciesId: 'species-group.plant',
      tagIds: ['tag.healer', 'tag.plant'],
      stats: { hp: 70, attack: 10, defense: 12, speed: 4 },
      innateSkillId: 'skill.slice.moss-drop',
      bloomSkillIds: ['skill.slice.moss-seedbed'],
      passiveTraitIds: ['trait.slice.moss-root'],
    },
  }),
  defineMonster({
    displayName: '泥殻虫',
    roleSentence: '前列に居座り、同じ列の後衛を遮蔽する低速重装ユニット。',
    primaryRole: 'TANK',
    secondaryRole: null,
    recommendedPositionIds: ['FRONT'],
    strengths: ['高HP', '高防御', '障壁'],
    weaknesses: ['低速度', '貫通', '押し出し'],
    compatibleSpeciesIds: ['species.slice.windwing-midge', 'species.slice.moss-sprout'],
    counterplay: '貫通や押し出しで遮蔽線を無効化する。',
    testedMechanicIds: ['cover', 'barrier'],
    definition: {
      id: 'species.slice.mudshell-beetle',
      rarity: 1,
      attributeId: 'attribute.earth',
      primarySpeciesId: 'species-group.insect',
      tagIds: ['tag.guardian', 'tag.slow'],
      stats: { hp: 132, attack: 15, defense: 32, speed: 2 },
      innateSkillId: 'skill.slice.mudshell-stance',
      bloomSkillIds: ['skill.slice.mudshell-rampart'],
      passiveTraitIds: ['trait.slice.mudshell-anchor'],
    },
  }),
  defineMonster({
    displayName: '火種トカゲ',
    roleSentence: '小さな直接打点へ火傷を重ね、継続損害の価値を教える近接役。',
    primaryRole: 'STRIKER',
    secondaryRole: 'CONTROLLER',
    recommendedPositionIds: ['FRONT', 'MIDDLE'],
    strengths: ['火傷', '低コスト圧力', '持続損害'],
    weaknesses: ['浄化', '水属性', '低防御'],
    compatibleSpeciesIds: ['species.slice.ancient-gear', 'species.slice.venom-moth'],
    counterplay: '浄化または短期決戦で継続損害を無効化する。',
    testedMechanicIds: ['burn', 'damage-over-time'],
    definition: {
      id: 'species.slice.ember-gecko',
      rarity: 1,
      attributeId: 'attribute.fire',
      primarySpeciesId: 'species-group.reptile',
      tagIds: ['tag.melee', 'tag.burn'],
      stats: { hp: 84, attack: 24, defense: 10, speed: 5 },
      innateSkillId: 'skill.slice.ember-bite',
      bloomSkillIds: ['skill.slice.ember-firetrail'],
      passiveTraitIds: ['trait.slice.ember-blood'],
    },
  }),
  defineMonster({
    displayName: '古歯車',
    roleSentence: '味方の次回行動を早め、速度ではなく時間操作で先手を作る支援装置。',
    primaryRole: 'SUPPORT',
    secondaryRole: 'CONTROLLER',
    recommendedPositionIds: ['MIDDLE', 'BACK'],
    strengths: ['行動短縮', '味方選択', '低攻撃依存'],
    weaknesses: ['低い直接火力', '集中攻撃', 'クールダウン'],
    compatibleSpeciesIds: ['species.slice.grassfang-rat', 'species.slice.ironhorn-beast'],
    counterplay: '支援対象を先に崩すか本体を優先撃破する。',
    testedMechanicIds: ['time-advance', 'action-order'],
    definition: {
      id: 'species.slice.ancient-gear',
      rarity: 1,
      attributeId: 'attribute.neutral',
      primarySpeciesId: 'species-group.construct',
      tagIds: ['tag.support', 'tag.construct'],
      stats: { hp: 88, attack: 16, defense: 18, speed: 3 },
      innateSkillId: 'skill.slice.gear-accelerate',
      bloomSkillIds: ['skill.slice.gear-reversal'],
      passiveTraitIds: ['trait.slice.ancient-ratchet'],
    },
  }),
  defineMonster({
    displayName: '疾風狼',
    roleSentence: '移動と攻撃を交互に行い、位置を変え続けるほど強い高速ハンター。',
    primaryRole: 'STRIKER',
    secondaryRole: 'CONTROLLER',
    recommendedPositionIds: ['FRONT', 'MIDDLE'],
    strengths: ['移動後強化', '高速度', '追撃'],
    weaknesses: ['移動不能', '固定危険マス', '障壁'],
    compatibleSpeciesIds: ['species.slice.ancient-gear', 'species.slice.windtree-priest'],
    counterplay: '移動不能や危険領域で移動先を狭める。',
    testedMechanicIds: ['movement', 'move-then-attack'],
    definition: {
      id: 'species.slice.gale-wolf',
      rarity: 2,
      attributeId: 'attribute.wind',
      primarySpeciesId: 'species-group.beast',
      tagIds: ['tag.fast', 'tag.melee'],
      stats: { hp: 108, attack: 36, defense: 15, speed: 8 },
      innateSkillId: 'skill.slice.gale-claw',
      bloomSkillIds: ['skill.slice.gale-circuit'],
      passiveTraitIds: ['trait.slice.gale-hunt'],
    },
  }),
  defineMonster({
    displayName: '岩甲虫',
    roleSentence: '味方へ障壁を渡し、被弾前に守る判断を要求する防御支援役。',
    primaryRole: 'TANK',
    secondaryRole: 'SUPPORT',
    recommendedPositionIds: ['FRONT', 'MIDDLE'],
    strengths: ['味方障壁', '高防御', '範囲防御'],
    weaknesses: ['障壁破壊後', '貫通', '低速度'],
    compatibleSpeciesIds: ['species.slice.spark-bird', 'species.slice.moss-healer'],
    counterplay: '小技で障壁を剥がしてから重技を通す。',
    testedMechanicIds: ['barrier', 'damage-sequencing'],
    definition: {
      id: 'species.slice.rock-carapace',
      rarity: 2,
      attributeId: 'attribute.earth',
      primarySpeciesId: 'species-group.insect',
      tagIds: ['tag.guardian', 'tag.barrier'],
      stats: { hp: 158, attack: 22, defense: 42, speed: 2 },
      innateSkillId: 'skill.slice.rock-shell',
      bloomSkillIds: ['skill.slice.rock-bastion'],
      passiveTraitIds: ['trait.slice.rock-layer'],
    },
  }),
  defineMonster({
    displayName: '火花鳥',
    roleSentence: '遮蔽された後衛を曲射で狙い、前列だけを固める守りを崩す飛行射手。',
    primaryRole: 'RANGED',
    secondaryRole: null,
    recommendedPositionIds: ['MIDDLE', 'BACK'],
    strengths: ['曲射', '後衛狙い', '高速度'],
    weaknesses: ['低耐久', '近接', '火耐性'],
    compatibleSpeciesIds: ['species.slice.rock-carapace', 'species.slice.ironhorn-beast'],
    counterplay: '後衛を分散し、接近役で射手を追う。',
    testedMechanicIds: ['arc-range', 'cover-counter'],
    definition: {
      id: 'species.slice.spark-bird',
      rarity: 2,
      attributeId: 'attribute.fire',
      primarySpeciesId: 'species-group.avian',
      tagIds: ['tag.ranged', 'tag.fast'],
      stats: { hp: 96, attack: 39, defense: 13, speed: 7 },
      innateSkillId: 'skill.slice.spark-arc',
      bloomSkillIds: ['skill.slice.spark-skyfall'],
      passiveTraitIds: ['trait.slice.spark-updraft'],
    },
  }),
  defineMonster({
    displayName: '苔癒し',
    roleSentence: '小範囲回復と再生で密集陣形を長く支える中級ヒーラー。',
    primaryRole: 'HEALER',
    secondaryRole: 'SUPPORT',
    recommendedPositionIds: ['BACK'],
    strengths: ['小範囲回復', '再生', '状態回復'],
    weaknesses: ['分散陣形', '回復阻害', '低火力'],
    compatibleSpeciesIds: ['species.slice.rock-carapace', 'species.slice.molten-carapace'],
    counterplay: '味方を分散させる押し出しや回復阻害で効率を落とす。',
    testedMechanicIds: ['healing', 'regeneration', 'small-area'],
    definition: {
      id: 'species.slice.moss-healer',
      rarity: 2,
      attributeId: 'attribute.earth',
      primarySpeciesId: 'species-group.plant',
      tagIds: ['tag.healer', 'tag.plant'],
      stats: { hp: 105, attack: 14, defense: 20, speed: 4 },
      innateSkillId: 'skill.slice.moss-regrowth',
      bloomSkillIds: ['skill.slice.moss-cleansing-grove'],
      passiveTraitIds: ['trait.slice.moss-cycle'],
    },
  }),
  defineMonster({
    displayName: '鉄角獣',
    roleSentence: '押し出しで列を崩し、遮蔽と危険マスを戦術資源へ変える重装突撃役。',
    primaryRole: 'BRUISER',
    secondaryRole: 'CONTROLLER',
    recommendedPositionIds: ['FRONT'],
    strengths: ['押し出し', '高耐久', '列崩し'],
    weaknesses: ['低速度', '移動不能', '遠距離集中'],
    compatibleSpeciesIds: ['species.slice.spark-bird', 'species.slice.flame-automaton'],
    counterplay: '前列を空けず、移動不能や障壁で突進を受け止める。',
    testedMechanicIds: ['force-move', 'cover-disruption'],
    definition: {
      id: 'species.slice.ironhorn-beast',
      rarity: 3,
      attributeId: 'attribute.earth',
      primarySpeciesId: 'species-group.beast',
      tagIds: ['tag.bruiser', 'tag.force-move'],
      stats: { hp: 190, attack: 48, defense: 42, speed: 3 },
      innateSkillId: 'skill.slice.ironhorn-charge',
      bloomSkillIds: ['skill.slice.ironhorn-avalanche'],
      passiveTraitIds: ['trait.slice.iron-momentum'],
    },
  }),
  defineMonster({
    displayName: '毒針蛾',
    roleSentence: '毒スタックを広げ、浄化の有無で長期戦の評価を変える遠隔妨害役。',
    primaryRole: 'CONTROLLER',
    secondaryRole: 'RANGED',
    recommendedPositionIds: ['MIDDLE', 'BACK'],
    strengths: ['毒スタック', '遠隔圧力', '範囲状態異常'],
    weaknesses: ['浄化', '短期決戦', '低防御'],
    compatibleSpeciesIds: ['species.slice.mudshell-beetle', 'species.slice.ember-gecko'],
    counterplay: '浄化役を入れるか優先撃破してスタック蓄積を止める。',
    testedMechanicIds: ['poison', 'status-cleanse'],
    definition: {
      id: 'species.slice.venom-moth',
      rarity: 3,
      attributeId: 'attribute.dark',
      primarySpeciesId: 'species-group.insect',
      tagIds: ['tag.ranged', 'tag.poison'],
      stats: { hp: 118, attack: 41, defense: 18, speed: 6 },
      innateSkillId: 'skill.slice.venom-needles',
      bloomSkillIds: ['skill.slice.venom-cloud'],
      passiveTraitIds: ['trait.slice.venom-dust'],
    },
  }),
  defineMonster({
    displayName: '炎機兵',
    roleSentence: '貫通射撃と炎上床を同時に使い、列配置と移動先の両方を制限する砲兵。',
    primaryRole: 'RANGED',
    secondaryRole: 'CONTROLLER',
    recommendedPositionIds: ['BACK'],
    strengths: ['貫通', '炎上床', '列攻撃'],
    weaknesses: ['接近戦', '水属性', '長い行動コスト'],
    compatibleSpeciesIds: ['species.slice.ironhorn-beast', 'species.slice.molten-carapace'],
    counterplay: '列をずらし、接近または時間遅延で重い攻撃回数を減らす。',
    testedMechanicIds: ['pierce', 'burning-terrain'],
    definition: {
      id: 'species.slice.flame-automaton',
      rarity: 3,
      attributeId: 'attribute.fire',
      primarySpeciesId: 'species-group.construct',
      tagIds: ['tag.ranged', 'tag.construct', 'tag.burn'],
      stats: { hp: 150, attack: 55, defense: 32, speed: 3 },
      innateSkillId: 'skill.slice.furnace-lance',
      bloomSkillIds: ['skill.slice.furnace-wall'],
      passiveTraitIds: ['trait.slice.furnace-core'],
    },
  }),
  defineMonster({
    displayName: '溶岩甲獣',
    roleSentence: '味方への肩代わりと火傷反撃を両立し、被弾そのものを攻撃資源へ変える高耐久守護獣。',
    primaryRole: 'TANK',
    secondaryRole: 'BRUISER',
    recommendedPositionIds: ['FRONT', 'MIDDLE'],
    strengths: ['肩代わり', '火傷反撃', '高耐久'],
    weaknesses: ['貫通', '回復阻害', '時間遅延'],
    compatibleSpeciesIds: ['species.slice.moss-healer', 'species.slice.flame-automaton'],
    counterplay: '単体集中を避け、貫通や状態異常で肩代わり外から削る。',
    testedMechanicIds: ['guard-share', 'counter', 'burn'],
    definition: {
      id: 'species.slice.molten-carapace',
      rarity: 4,
      attributeId: 'attribute.fire',
      primarySpeciesId: 'species-group.beast',
      tagIds: ['tag.guardian', 'tag.burn-counter'],
      stats: { hp: 285, attack: 57, defense: 68, speed: 2 },
      innateSkillId: 'skill.slice.molten-guard',
      bloomSkillIds: ['skill.slice.molten-aegis'],
      passiveTraitIds: ['trait.slice.molten-intercept'],
    },
  }),
  defineMonster({
    displayName: '風樹祭司',
    roleSentence: '範囲支援と回復領域を重ね、味方の配置維持を勝ち筋にする高位支援役。',
    primaryRole: 'SUPPORT',
    secondaryRole: 'HEALER',
    recommendedPositionIds: ['MIDDLE', 'BACK'],
    strengths: ['範囲支援', '回復領域', '長期戦'],
    weaknesses: ['集中攻撃', '分散強制', '回復阻害'],
    compatibleSpeciesIds: ['species.slice.gale-wolf', 'species.slice.molten-carapace'],
    counterplay: '押し出しで陣形を分散し、祭司を優先して落とす。',
    testedMechanicIds: ['area-buff', 'healing-terrain'],
    definition: {
      id: 'species.slice.windtree-priest',
      rarity: 4,
      attributeId: 'attribute.wind',
      primarySpeciesId: 'species-group.plant',
      tagIds: ['tag.support', 'tag.healer'],
      stats: { hp: 205, attack: 32, defense: 48, speed: 5 },
      innateSkillId: 'skill.slice.canopy-blessing',
      bloomSkillIds: ['skill.slice.grand-canopy'],
      passiveTraitIds: ['trait.slice.canopy-prayer'],
    },
  }),
  defineMonster({
    displayName: '災炎翼竜',
    roleSentence: '高い基礎性能と遮蔽無視の予兆範囲攻撃で、完成した陣形へ最終試験を与える地域ボス級アタッカー。',
    primaryRole: 'BOSS',
    secondaryRole: 'RANGED',
    recommendedPositionIds: ['MIDDLE', 'BACK'],
    strengths: ['高基礎性能', '遮蔽無視', '予兆範囲', '火傷'],
    weaknesses: ['予兆回避', '水属性', '長い行動コスト'],
    compatibleSpeciesIds: ['species.slice.flame-automaton', 'species.slice.molten-carapace'],
    counterplay: '予兆を見て分散・移動し、行動遅延で大技回数を減らす。',
    testedMechanicIds: ['cover-ignore', 'telegraph', 'area-damage', 'boss-power'],
    definition: {
      id: 'species.slice.disaster-flame-wyvern',
      rarity: 5,
      attributeId: 'attribute.fire',
      primarySpeciesId: 'species-group.dragon',
      tagIds: ['tag.boss', 'tag.ranged', 'tag.burn'],
      stats: { hp: 390, attack: 88, defense: 72, speed: 6 },
      innateSkillId: 'skill.slice.disaster-assault',
      bloomSkillIds: ['skill.slice.disaster-wingstorm'],
      passiveTraitIds: ['trait.slice.disaster-aura'],
    },
  }),
])

export const VERTICAL_SLICE_MONSTER_RECORDS = MONSTERS
export const VERTICAL_SLICE_SPECIES: readonly MonsterSpecies[] = Object.freeze(
  MONSTERS.map((record) => record.definition),
)
export const VERTICAL_SLICE_SKILLS: readonly SkillDefinition[] = Object.freeze(
  VERTICAL_SLICE_SKILL_RECORDS.map((record) => record.definition),
)

export const VERTICAL_SLICE_GENERIC_SKILL_COSTS: Readonly<Record<SkillId, number>> =
  Object.freeze({
    'skill.slice.generic.light-strike': 45,
    'skill.slice.generic.guard-stance': 45,
    'skill.slice.generic.minor-heal': 50,
    'skill.slice.generic.long-shot': 55,
    'skill.slice.generic.retreat': 45,
    'skill.slice.generic.venom-fang': 90,
    'skill.slice.generic.impact': 90,
    'skill.slice.generic.inspire': 95,
    'skill.slice.generic.cleanse': 95,
    'skill.slice.generic.time-hinder': 100,
  })

export const VERTICAL_SLICE_BLOOM_RESEARCH_DEFINITIONS: readonly BloomResearchDefinition[] =
  Object.freeze(
    VERTICAL_SLICE_SPECIES.flatMap((species) =>
      (species.bloomSkillIds ?? []).map((skillId) =>
        Object.freeze({
          speciesId: species.id,
          skillId,
          analysisThresholdBasisPoints: species.rarity <= 3 ? 1500 : 2000,
          currencyCost: 30 * species.rarity,
          researchDataCost: 10 * species.rarity,
        }),
      ),
    ),
  )

export const VERTICAL_SLICE_CONTENT_CATALOG = Object.freeze({
  species: VERTICAL_SLICE_SPECIES,
  skills: VERTICAL_SLICE_SKILLS,
  researchNodes: Object.freeze([]),
  finalResearchDefinitions: Object.freeze([]),
  bloomResearchDefinitions: VERTICAL_SLICE_BLOOM_RESEARCH_DEFINITIONS,
  researchFacilityStages: Object.freeze([]),
  regions: Object.freeze([]),
  stages: Object.freeze([]),
})

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`${field} must be non-empty`)
}

function assertUnique(values: readonly string[], field: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    assertNonEmpty(value, `${field}[]`)
    if (seen.has(value)) throw new Error(`${field} must be unique: ${value}`)
    seen.add(value)
  }
}

function countTier(tier: VerticalSliceSkillTier): number {
  return VERTICAL_SLICE_SKILL_RECORDS.filter((record) => record.tier === tier).length
}

export function validateVerticalSliceContent(): VerticalSliceContentSummary {
  const base = validateContentCatalog(VERTICAL_SLICE_CONTENT_CATALOG, {
    genericSkillCosts: VERTICAL_SLICE_GENERIC_SKILL_COSTS,
  })
  const traitIds = VERTICAL_SLICE_PASSIVE_TRAITS.map((trait) => trait.traitId)
  const speciesIds = VERTICAL_SLICE_SPECIES.map((species) => species.id)
  const skillIds = VERTICAL_SLICE_SKILLS.map((skill) => skill.id)
  assertUnique(traitIds, 'verticalSlice.passiveTraits')
  assertUnique(speciesIds, 'verticalSlice.species')
  assertUnique(skillIds, 'verticalSlice.skills')
  assertUnique(
    VERTICAL_SLICE_MONSTER_RECORDS.map((record) => record.displayName),
    'verticalSlice.monsterDisplayNames',
  )
  assertUnique(
    VERTICAL_SLICE_SKILL_RECORDS.map((record) => record.displayName),
    'verticalSlice.skillDisplayNames',
  )

  const rarityCounts = new Map<number, number>()
  const knownSpeciesIds = new Set(speciesIds)
  const knownTraitIds = new Set(traitIds)
  const authoredSkillById = new Map(
    VERTICAL_SLICE_SKILL_RECORDS.map((record) => [record.definition.id, record]),
  )
  for (const record of VERTICAL_SLICE_MONSTER_RECORDS) {
    rarityCounts.set(
      record.definition.rarity,
      (rarityCounts.get(record.definition.rarity) ?? 0) + 1,
    )
    assertNonEmpty(record.displayName, `${record.definition.id}.displayName`)
    assertNonEmpty(record.roleSentence, `${record.definition.id}.roleSentence`)
    assertNonEmpty(record.counterplay, `${record.definition.id}.counterplay`)
    if (record.recommendedPositionIds.length === 0) {
      throw new Error(`monster recommended positions are required: ${record.definition.id}`)
    }
    if (record.strengths.length === 0 || record.weaknesses.length === 0) {
      throw new Error(`monster strengths and weaknesses are required: ${record.definition.id}`)
    }
    if (record.testedMechanicIds.length === 0) {
      throw new Error(`monster tested mechanics are required: ${record.definition.id}`)
    }
    for (const speciesId of record.compatibleSpeciesIds) {
      if (!knownSpeciesIds.has(speciesId)) {
        throw new Error(`monster compatibility references unknown species: ${record.definition.id}/${speciesId}`)
      }
    }
    if ((record.definition.passiveTraitIds ?? []).length !== 1) {
      throw new Error(`vertical slice monster requires exactly one passive trait: ${record.definition.id}`)
    }
    const traitId = record.definition.passiveTraitIds?.[0]
    if (traitId === undefined || !knownTraitIds.has(traitId)) {
      throw new Error(`monster passive trait is unknown: ${record.definition.id}/${traitId ?? 'missing'}`)
    }
    if ((record.definition.bloomSkillIds ?? []).length !== 1) {
      throw new Error(`vertical slice monster requires exactly one bloom skill: ${record.definition.id}`)
    }
    const innate = authoredSkillById.get(record.definition.innateSkillId)
    if (innate?.tier !== 'INNATE') {
      throw new Error(`monster innate skill authoring is missing: ${record.definition.id}`)
    }
    const bloomId = record.definition.bloomSkillIds?.[0]
    const bloom = bloomId === undefined ? undefined : authoredSkillById.get(bloomId)
    if (bloom?.tier !== 'BLOOM') {
      throw new Error(`monster bloom skill authoring is missing: ${record.definition.id}`)
    }
  }

  const expectedRarityCounts = new Map([
    [1, 6],
    [2, 4],
    [3, 3],
    [4, 2],
    [5, 1],
  ])
  for (const [rarity, expected] of expectedRarityCounts) {
    if ((rarityCounts.get(rarity) ?? 0) !== expected) {
      throw new Error(`vertical slice rarity ${rarity} requires ${expected} monsters`)
    }
  }
  for (const rarity of rarityCounts.keys()) {
    if (!expectedRarityCounts.has(rarity)) {
      throw new Error(`vertical slice contains unsupported rarity: ${rarity}`)
    }
  }

  for (const record of VERTICAL_SLICE_SKILL_RECORDS) {
    assertNonEmpty(record.displayName, `${record.definition.id}.displayName`)
    assertNonEmpty(record.tacticalSummary, `${record.definition.id}.tacticalSummary`)
    if (record.effectTags.length === 0) {
      throw new Error(`skill effect tags are required: ${record.definition.id}`)
    }
    if (record.tier.startsWith('GENERIC')) {
      const efficiency = record.efficiencyBasisPoints
      if (efficiency === undefined || efficiency < 7000 || efficiency > 9000) {
        throw new Error(`generic skill efficiency must be 70-90%: ${record.definition.id}`)
      }
    } else if (record.efficiencyBasisPoints !== undefined) {
      throw new Error(`only generic skills use efficiencyBasisPoints: ${record.definition.id}`)
    }
  }

  const innateSkills = countTier('INNATE')
  const bloomSkills = countTier('BLOOM')
  const genericTier1Skills = countTier('GENERIC_T1')
  const genericTier2Skills = countTier('GENERIC_T2')
  if (
    VERTICAL_SLICE_MONSTER_RECORDS.length !== 16 ||
    innateSkills !== 16 ||
    bloomSkills !== 16 ||
    genericTier1Skills !== 5 ||
    genericTier2Skills !== 5
  ) {
    throw new Error('vertical slice content counts do not match T044')
  }

  return Object.freeze({
    ...base,
    passiveTraits: VERTICAL_SLICE_PASSIVE_TRAITS.length,
    authoredMonsters: VERTICAL_SLICE_MONSTER_RECORDS.length,
    authoredSkills: VERTICAL_SLICE_SKILL_RECORDS.length,
    innateSkills,
    bloomSkills,
    genericTier1Skills,
    genericTier2Skills,
  })
}

export const VERTICAL_SLICE_CONTENT_VALIDATION = validateVerticalSliceContent()
