export type DisplayMasterKind =
  | 'SPECIES'
  | 'SKILL'
  | 'STAGE'
  | 'REGION'
  | 'RESEARCH'
  | 'CATALYST'
  | 'REWARD'
  | 'ATTRIBUTE'

export interface DisplayMasterEntry {
  readonly id: string
  readonly kind: DisplayMasterKind
  readonly name: string
  readonly description?: string
}

const SPECIES_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "species.slice.ancient-gear": "古歯車",
  "species.slice.disaster-flame-wyvern": "災炎翼竜",
  "species.slice.ember-gecko": "火種トカゲ",
  "species.slice.flame-automaton": "炎機兵",
  "species.slice.gale-wolf": "疾風狼",
  "species.slice.grassfang-rat": "草牙ネズミ",
  "species.slice.ironhorn-beast": "鉄角獣",
  "species.slice.molten-carapace": "溶岩甲獣",
  "species.slice.moss-healer": "苔癒し",
  "species.slice.moss-sprout": "苔芽",
  "species.slice.mudshell-beetle": "泥殻虫",
  "species.slice.rock-carapace": "岩甲虫",
  "species.slice.spark-bird": "火花鳥",
  "species.slice.venom-moth": "毒針蛾",
  "species.slice.windtree-priest": "風樹祭司",
  "species.slice.windwing-midge": "風羽虫",
})

const SKILL_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "skill.slice.canopy-blessing": "樹冠祝福",
  "skill.slice.disaster-assault": "災炎急襲",
  "skill.slice.disaster-wingstorm": "災翼炎嵐",
  "skill.slice.ember-bite": "火種噛み",
  "skill.slice.ember-firetrail": "火走り",
  "skill.slice.furnace-lance": "炉槍",
  "skill.slice.furnace-wall": "炉壁展開",
  "skill.slice.gale-circuit": "嵐巡り",
  "skill.slice.gale-claw": "追風爪",
  "skill.slice.gear-accelerate": "歯車加速",
  "skill.slice.gear-reversal": "逆転歯車",
  "skill.slice.generic.cleanse": "浄化",
  "skill.slice.generic.guard-stance": "防御態勢",
  "skill.slice.generic.impact": "衝撃",
  "skill.slice.generic.inspire": "鼓舞",
  "skill.slice.generic.light-strike": "軽撃",
  "skill.slice.generic.long-shot": "遠射",
  "skill.slice.generic.minor-heal": "小治癒",
  "skill.slice.generic.retreat": "後退",
  "skill.slice.generic.time-hinder": "時間阻害",
  "skill.slice.generic.venom-fang": "毒牙",
  "skill.slice.grand-canopy": "大樹冠",
  "skill.slice.grassfang-bite": "草牙噛み",
  "skill.slice.grassfang-pack-run": "群駆け",
  "skill.slice.ironhorn-avalanche": "雪崩角",
  "skill.slice.ironhorn-charge": "鉄角突進",
  "skill.slice.molten-aegis": "熔界大盾",
  "skill.slice.molten-guard": "熔岩護衛",
  "skill.slice.moss-cleansing-grove": "浄苔庭",
  "skill.slice.moss-drop": "苔雫",
  "skill.slice.moss-regrowth": "再生苔",
  "skill.slice.moss-seedbed": "芽吹き床",
  "skill.slice.mudshell-rampart": "歩く防塁",
  "skill.slice.mudshell-stance": "泥殻構え",
  "skill.slice.rock-bastion": "共有岩塞",
  "skill.slice.rock-shell": "岩殻付与",
  "skill.slice.spark-arc": "火花曲射",
  "skill.slice.spark-skyfall": "落雷標",
  "skill.slice.venom-cloud": "毒雲",
  "skill.slice.venom-needles": "連毒針",
  "skill.slice.windwing-crosswind": "横風掃射",
  "skill.slice.windwing-line-needle": "風線針",
})

const SKILL_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
  "skill.slice.canopy-blessing": "味方と隣接味方へ回復と支援強化を配る。",
  "skill.slice.disaster-assault": "遮蔽を無視し予兆後に対象周辺を焼く高性能攻撃。",
  "skill.slice.disaster-wingstorm": "敵陣営全体へ長い予兆を置く決戦技。",
  "skill.slice.ember-bite": "軽い火属性攻撃と火傷を与える。",
  "skill.slice.ember-firetrail": "移動経路へ炎上床を残して接近経路を制限する。",
  "skill.slice.furnace-lance": "列を貫通し着弾線へ炎上床を残す。",
  "skill.slice.furnace-wall": "占有壁を召喚し炎上床と射線を同時に操作する。",
  "skill.slice.gale-circuit": "複数対象を駆け抜ける連鎖攻撃。",
  "skill.slice.gale-claw": "移動後に最大効率となる高速近接。",
  "skill.slice.gear-accelerate": "味方一体の次回行動を早める。",
  "skill.slice.gear-reversal": "敵の次回行動を遅らせ味方の時間優位を作る。",
  "skill.slice.generic.cleanse": "味方一体の状態異常を一つ除去する。",
  "skill.slice.generic.guard-stance": "自身へ小障壁を付与する汎用防御。",
  "skill.slice.generic.impact": "小さく押し出す汎用位置操作。",
  "skill.slice.generic.inspire": "味方と隣接味方の攻撃を小強化する。",
  "skill.slice.generic.light-strike": "素早く回す汎用近接。",
  "skill.slice.generic.long-shot": "威力を抑えて射程を得る汎用射撃。",
  "skill.slice.generic.minor-heal": "単体を小回復する汎用支援。",
  "skill.slice.generic.retreat": "攻撃をせず後方へ移る汎用離脱。",
  "skill.slice.generic.time-hinder": "小ダメージと次回行動遅延を与える。",
  "skill.slice.generic.venom-fang": "低威力攻撃に毒を付ける汎用技。",
  "skill.slice.grand-canopy": "味方陣営全体へ支援と回復領域を展開する。",
  "skill.slice.grassfang-bite": "低コストで前列へ圧力をかける基本近接。",
  "skill.slice.grassfang-pack-run": "攻撃後に安全な隣接位置へ移り連続運用を広げる。",
  "skill.slice.ironhorn-avalanche": "縦列を押し込み敵陣の位置関係を崩す。",
  "skill.slice.ironhorn-charge": "対象を押し出して列を崩す重い近接。",
  "skill.slice.molten-aegis": "陣営全体を一時的に肩代わりし反撃圧力を作る。",
  "skill.slice.molten-guard": "周囲の味方を肩代わりし被弾へ火傷反撃を返す。",
  "skill.slice.moss-cleansing-grove": "小範囲を回復し状態異常を一つ除去する。",
  "skill.slice.moss-drop": "傷ついた味方一体を小さく回復する。",
  "skill.slice.moss-regrowth": "味方と隣接味方を回復し再生を付与する。",
  "skill.slice.moss-seedbed": "小範囲に回復領域を作り配置価値を生む。",
  "skill.slice.mudshell-rampart": "障壁を得て前方へ移り遮蔽線を作り直す。",
  "skill.slice.mudshell-stance": "自身へ障壁を張り遮蔽役を継続する。",
  "skill.slice.rock-bastion": "自身と隣接味方へ障壁を配る。",
  "skill.slice.rock-shell": "味方一体へ厚い障壁を付与する。",
  "skill.slice.spark-arc": "前列遮蔽を越えて後衛を狙える曲射。",
  "skill.slice.spark-skyfall": "予兆を置き十字範囲へ曲射火撃を落とす。",
  "skill.slice.venom-cloud": "対象周辺へ毒を配りスタック戦術を拡張する。",
  "skill.slice.venom-needles": "低威力の射撃で毒スタックを重ねる。",
  "skill.slice.windwing-crosswind": "横一列へ射撃し密集を罰する。",
  "skill.slice.windwing-line-needle": "遮蔽を意識して射線を通す直線遠距離攻撃。",
})

const STAGE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "stage.slice.a-01-order": "行動順を読む",
  "stage.slice.a-02-cover": "前列遮蔽",
  "stage.slice.a-03-movement": "移動と追撃",
  "stage.slice.a-04-ranged": "直線と曲射",
  "stage.slice.a-05-healing": "回復役の優先撃破",
  "stage.slice.a-06-poison": "毒スタック",
  "stage.slice.a-07-push": "押し出しで列を崩す",
  "stage.slice.a-08-barrier": "障壁を剥がす順番",
  "stage.slice.a-09-combined": "地域A総合試験",
  "stage.slice.b-01-burn": "火傷の蓄積",
  "stage.slice.b-02-burning-floor": "炎上床から移動する",
  "stage.slice.b-03-pierce": "障壁と貫通",
  "stage.slice.b-04-molten-boss": "溶岩甲獣迎撃",
  "stage.slice.b-05-delay": "行動遅延と加速",
  "stage.slice.b-06-telegraph": "予兆から退避する",
  "stage.slice.b-07-summon": "召喚体と本体の優先順位",
  "stage.slice.b-08-wyvern-boss": "災炎翼竜最終戦",
})

const REGION_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "region.slice-a": "翠風観測原",
  "region.slice-b": "灼熱機構域",
})

const RESEARCH_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "research.slice.disaster-flame-wyvern": "災炎翼竜の超越",
  "research.slice.flame-automaton": "炎機兵の収束",
  "research.slice.gale-wolf": "疾風狼の系譜",
  "research.slice.ironhorn-beast": "鉄角獣の収束",
  "research.slice.molten-carapace": "溶岩甲獣の融合",
  "research.slice.moss-healer": "苔癒しの系譜",
  "research.slice.rock-carapace": "岩甲虫の融合",
  "research.slice.spark-bird": "火花鳥の融合",
  "research.slice.venom-moth": "毒針蛾の秘匿融合",
  "research.slice.windtree-priest": "風樹祭司の系譜",
})

const CATALYST_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "catalyst.slice.earth": "土触媒",
  "catalyst.slice.fire": "火触媒",
  "catalyst.slice.machine-core": "機核触媒",
  "catalyst.slice.primal-core": "特殊触媒",
  "catalyst.slice.venom": "毒触媒",
  "catalyst.slice.wind": "風触媒",
  "catalyst.slice.wyvern-heart": "特殊触媒",
})

const REWARD_NAMES: Readonly<Record<string, string>> = Object.freeze({
})

const ATTRIBUTE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "attribute.dark": "闇",
  "attribute.earth": "土",
  "attribute.fire": "火",
  "attribute.light": "光",
  "attribute.neutral": "無",
  "attribute.water": "水",
  "attribute.wind": "風",
})

function readName(master: Readonly<Record<string, string>>, id: string, fallback: string): string {
  return master[id] ?? fallback
}

export function resolveSpeciesName(speciesId: string): string {
  return readName(SPECIES_NAMES, speciesId, '不明なモンスター')
}

export function resolveSkillName(skillId: string): string {
  return readName(SKILL_NAMES, skillId, '不明な技')
}

export function resolveSkillDescription(skillId: string): string {
  return readName(SKILL_DESCRIPTIONS, skillId, '効果情報を確認できません。')
}

export function resolveStageName(stageId: string): string {
  return readName(STAGE_NAMES, stageId, '不明なステージ')
}

export function resolveRegionName(regionId: string): string {
  return readName(REGION_NAMES, regionId, '不明な地域')
}

export function resolveResearchName(researchId: string): string {
  return readName(RESEARCH_NAMES, researchId, '不明な研究')
}

export function resolveCatalystName(catalystId: string): string {
  return readName(CATALYST_NAMES, catalystId, '不明な触媒')
}

export function resolveRewardName(rewardId: string): string {
  return readName(REWARD_NAMES, rewardId, '地域到達報酬')
}

export function resolveAttributeName(attributeId: string): string {
  return readName(ATTRIBUTE_NAMES, attributeId, '無')
}

export function resolveDisplayName(id: string): string {
  if (SPECIES_NAMES[id] !== undefined) return SPECIES_NAMES[id]
  if (SKILL_NAMES[id] !== undefined) return SKILL_NAMES[id]
  if (STAGE_NAMES[id] !== undefined) return STAGE_NAMES[id]
  if (REGION_NAMES[id] !== undefined) return REGION_NAMES[id]
  if (RESEARCH_NAMES[id] !== undefined) return RESEARCH_NAMES[id]
  if (CATALYST_NAMES[id] !== undefined) return CATALYST_NAMES[id]
  if (REWARD_NAMES[id] !== undefined) return REWARD_NAMES[id]
  if (ATTRIBUTE_NAMES[id] !== undefined) return ATTRIBUTE_NAMES[id]
  if (id.startsWith('species.')) return '不明なモンスター'
  if (id.startsWith('skill.')) return '不明な技'
  if (id.startsWith('stage.')) return '不明なステージ'
  if (id.startsWith('region.')) return '不明な地域'
  if (id.startsWith('research.')) return '不明な研究'
  if (id.startsWith('catalyst.')) return '不明な触媒'
  if (id.startsWith('reward.')) return '地域到達報酬'
  return '不明な項目'
}

export function formatUnitDisplayName(speciesId: string, unitId: string): string {
  const speciesName = resolveSpeciesName(speciesId)
  const match = unitId.match(/(?:-|:)(\d+)$/)
  if (match === null) return speciesName
  const parsed = Number(match[1])
  if (!Number.isSafeInteger(parsed)) return speciesName
  const ordinal = unitId.includes(':') && parsed === 0 ? 1 : Math.max(1, parsed)
  return `${speciesName} #${ordinal}`
}

export interface DisplayMasterValidationSummary {
  readonly entries: number
  readonly species: number
  readonly skills: number
  readonly stages: number
  readonly regions: number
  readonly catalysts: number
}

export function validateDisplayMasterEntries(
  entries: readonly DisplayMasterEntry[],
): DisplayMasterValidationSummary {
  const ids = new Set<string>()
  let species = 0
  let skills = 0
  let stages = 0
  let regions = 0
  let catalysts = 0
  for (const entry of entries) {
    if (entry.id.trim().length === 0) throw new Error('display master id must be non-empty')
    if (ids.has(entry.id)) throw new Error(`display master id must be unique: ${entry.id}`)
    ids.add(entry.id)
    if (entry.name.trim().length === 0) throw new Error(`display name must be non-empty: ${entry.id}`)
    if (entry.name.includes('.')) throw new Error(`display name must not expose an id: ${entry.id}`)
    if (entry.kind === 'SKILL' && (entry.description?.trim().length ?? 0) === 0) {
      throw new Error(`skill description must be non-empty: ${entry.id}`)
    }
    if (entry.kind === 'SPECIES') species += 1
    if (entry.kind === 'SKILL') skills += 1
    if (entry.kind === 'STAGE') stages += 1
    if (entry.kind === 'REGION') regions += 1
    if (entry.kind === 'CATALYST') catalysts += 1
  }
  return Object.freeze({ entries: entries.length, species, skills, stages, regions, catalysts })
}

export function validateDisplayMasters(): DisplayMasterValidationSummary {
  const entries: DisplayMasterEntry[] = [
    ...Object.entries(SPECIES_NAMES).map(([id, name]) => ({ id, name, kind: 'SPECIES' as const })),
    ...Object.entries(SKILL_NAMES).map(([id, name]) => ({
      id,
      name,
      description: SKILL_DESCRIPTIONS[id],
      kind: 'SKILL' as const,
    })),
    ...Object.entries(STAGE_NAMES).map(([id, name]) => ({ id, name, kind: 'STAGE' as const })),
    ...Object.entries(REGION_NAMES).map(([id, name]) => ({ id, name, kind: 'REGION' as const })),
    ...Object.entries(RESEARCH_NAMES).map(([id, name]) => ({ id, name, kind: 'RESEARCH' as const })),
    ...Object.entries(CATALYST_NAMES).map(([id, name]) => ({ id, name, kind: 'CATALYST' as const })),
    ...Object.entries(REWARD_NAMES).map(([id, name]) => ({ id, name, kind: 'REWARD' as const })),
    ...Object.entries(ATTRIBUTE_NAMES).map(([id, name]) => ({ id, name, kind: 'ATTRIBUTE' as const })),
  ]
  return validateDisplayMasterEntries(entries)
}

export const DISPLAY_MASTER_VALIDATION = validateDisplayMasters()
