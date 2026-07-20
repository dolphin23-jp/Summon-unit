import type { AiIndividualStrategy, AiTeamStrategy } from '../ai/strategy-presets'
import type { BossEncounterDefinition } from '../battle/boss-phase'
import type { HeadlessBattleUnitDefinition } from '../battle/headless-battle-runner'
import type { SpeciesId } from './monster-species'
import {
  VERTICAL_SLICE_BLOOM_RESEARCH_DEFINITIONS,
  VERTICAL_SLICE_GENERIC_SKILL_COSTS,
  VERTICAL_SLICE_SKILLS,
  VERTICAL_SLICE_SPECIES,
} from './vertical-slice-content'
import { validateContentCatalog, type ContentValidationSummary } from './content-validation'
import type { FinalResearchDefinition } from '../progression/t036-progression-model'
import type { RegionDefinition } from '../progression/region-progression'
import type { ResearchFacilityStageDefinition } from '../progression/research-facility-model'
import type {
  ResearchHintDefinition,
  ResearchHintTrigger,
  ResearchMethod,
  ResearchNodeDefinition,
} from '../progression/research-model'
import { createStagePlayerData } from '../progression/stage-reward'
import type { PlayerData } from '../progression/player-data'
import type {
  RegionalPointRewardDefinition,
  StageDefinition,
  StageKind,
} from '../progression/stage-model'

export interface VerticalSliceResearchHintCopy {
  readonly nodeId: string
  readonly hintId: string
  readonly text: string
}

export interface VerticalSliceResearchRecord {
  readonly displayName: string
  readonly hidden: boolean
  readonly definition: ResearchNodeDefinition
  readonly hintCopies: readonly VerticalSliceResearchHintCopy[]
}

export interface VerticalSliceEnemyFormationTicket {
  readonly stageId: string
  readonly intent: string
  readonly mostDangerousEnemy: string
  readonly counterplay: string
  readonly aiPlan: string
  readonly lessonOnDefeat: string
}

export interface VerticalSliceStageRecord {
  readonly definition: StageDefinition
  readonly mechanicIds: readonly string[]
  readonly ticket: VerticalSliceEnemyFormationTicket
}

export interface VerticalSliceWorldValidationSummary extends ContentValidationSummary {
  readonly authoredResearchNodes: number
  readonly hintTexts: number
  readonly hiddenResearchNodes: number
  readonly stageTickets: number
  readonly regionAStages: number
  readonly regionBStages: number
  readonly regionBBosses: number
  readonly initialBlueprints: number
  readonly initialUnits: number
}

type Row = 0 | 1 | 2
type Column = 0 | 1 | 2

interface ResearchHintSpec {
  readonly hintId: string
  readonly disclosureStage: 1 | 2 | 3 | 4
  readonly trigger: ResearchHintTrigger
  readonly text: string
}

interface ResearchRecordInput {
  readonly nodeId: string
  readonly displayName: string
  readonly targetSpeciesId: SpeciesId
  readonly hidden?: boolean
  readonly adjacentNodeIds: readonly string[]
  readonly method: ResearchMethod
  readonly candidateMethods: readonly ResearchMethod[]
  readonly candidateSpeciesIds: readonly SpeciesId[]
  readonly recipeSpeciesIds: readonly SpeciesId[]
  readonly candidateCatalystIds: readonly string[]
  readonly recipeCatalystIds: readonly string[]
  readonly trialResearchDataCost: number
  readonly hints: readonly ResearchHintSpec[]
}

interface EnemyUnitSpec {
  readonly speciesId: SpeciesId
  readonly row: Row
  readonly column: Column
  readonly equippedSkillIds?: readonly string[]
  readonly individualStrategy?: AiIndividualStrategy
  readonly teamStrategy?: AiTeamStrategy
}

interface BossSpec {
  readonly unitIndex: number
  readonly phases: BossEncounterDefinition['phases']
}

interface StageRecordInput {
  readonly stageId: string
  readonly regionId: 'region.slice-a' | 'region.slice-b'
  readonly order: number
  readonly kind: StageKind
  readonly theme: string
  readonly secondaryTheme: string
  readonly mechanicIds: readonly string[]
  readonly units: readonly EnemyUnitSpec[]
  readonly unlockAfter?: string
  readonly currency: number
  readonly researchData: number
  readonly regionalPointGain: number
  readonly catalystIds?: readonly string[]
  readonly boss?: BossSpec
  readonly ticket: Omit<VerticalSliceEnemyFormationTicket, 'stageId'>
}

function freezeStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values])
}

function defineResearchRecord(input: ResearchRecordInput): VerticalSliceResearchRecord {
  const hints: readonly ResearchHintDefinition[] = Object.freeze(
    input.hints.map((hint) =>
      Object.freeze({
        hintId: hint.hintId,
        disclosureStage: hint.disclosureStage,
        trigger: Object.freeze({ ...hint.trigger }),
      }),
    ),
  )
  return Object.freeze({
    displayName: input.displayName,
    hidden: input.hidden ?? false,
    definition: Object.freeze({
      nodeId: input.nodeId,
      targetSpeciesId: input.targetSpeciesId,
      adjacentNodeIds: freezeStrings(input.adjacentNodeIds),
      candidateRange: Object.freeze({
        methods: Object.freeze([...input.candidateMethods]),
        materialSpeciesIds: freezeStrings(input.candidateSpeciesIds),
        catalystIds: freezeStrings(input.candidateCatalystIds),
        minimumMaterialCount: input.recipeSpeciesIds.length,
        maximumMaterialCount: input.recipeSpeciesIds.length,
        minimumCatalystCount: input.recipeCatalystIds.length,
        maximumCatalystCount: input.recipeCatalystIds.length,
      }),
      recipe: Object.freeze({
        method: input.method,
        materialSpeciesIds: freezeStrings(input.recipeSpeciesIds),
        catalystIds: freezeStrings(input.recipeCatalystIds),
      }),
      trialResearchDataCost: input.trialResearchDataCost,
      hints,
    }),
    hintCopies: Object.freeze(
      input.hints.map((hint) =>
        Object.freeze({ nodeId: input.nodeId, hintId: hint.hintId, text: hint.text }),
      ),
    ),
  })
}

const R = defineResearchRecord

export const VERTICAL_SLICE_RESEARCH_RECORDS: readonly VerticalSliceResearchRecord[] =
  Object.freeze([
    R({
      nodeId: 'research.slice.gale-wolf',
      displayName: '疾風狼の系譜',
      targetSpeciesId: 'species.slice.gale-wolf',
      adjacentNodeIds: ['research.slice.ironhorn-beast', 'research.slice.windtree-priest'],
      method: 'LINEAGE',
      candidateMethods: ['FUSION', 'LINEAGE'],
      candidateSpeciesIds: [
        'species.slice.grassfang-rat',
        'species.slice.windwing-midge',
        'species.slice.ember-gecko',
      ],
      recipeSpeciesIds: ['species.slice.grassfang-rat', 'species.slice.windwing-midge'],
      candidateCatalystIds: ['catalyst.slice.wind', 'catalyst.slice.earth'],
      recipeCatalystIds: ['catalyst.slice.wind'],
      trialResearchDataCost: 12,
      hints: [
        {
          hintId: 'hint.slice.gale.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.a-03-movement' },
          text: '移動後に勢いを増す獣の痕跡が残っている。',
        },
        {
          hintId: 'hint.slice.gale.2',
          disclosureStage: 2,
          trigger: {
            type: 'ANALYSIS',
            speciesId: 'species.slice.grassfang-rat',
            minimumBasisPoints: 1200,
          },
          text: '小型獣と風羽系の特徴が同時に観測された。',
        },
        {
          hintId: 'hint.slice.gale.3',
          disclosureStage: 3,
          trigger: { type: 'CATALYST', catalystId: 'catalyst.slice.wind' },
          text: '風触媒を用いる系譜研究らしい。',
        },
        {
          hintId: 'hint.slice.gale.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '草牙ネズミと風羽虫を一体ずつ用いる。',
        },
      ],
    }),
    R({
      nodeId: 'research.slice.rock-carapace',
      displayName: '岩甲虫の融合',
      targetSpeciesId: 'species.slice.rock-carapace',
      adjacentNodeIds: ['research.slice.ironhorn-beast', 'research.slice.molten-carapace'],
      method: 'FUSION',
      candidateMethods: ['FUSION', 'CONVERGENCE'],
      candidateSpeciesIds: [
        'species.slice.mudshell-beetle',
        'species.slice.ancient-gear',
        'species.slice.moss-sprout',
      ],
      recipeSpeciesIds: ['species.slice.mudshell-beetle', 'species.slice.ancient-gear'],
      candidateCatalystIds: ['catalyst.slice.earth', 'catalyst.slice.machine-core'],
      recipeCatalystIds: ['catalyst.slice.earth'],
      trialResearchDataCost: 12,
      hints: [
        {
          hintId: 'hint.slice.rock.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.a-02-cover' },
          text: '硬い殻と人工的な層構造が同時に見つかった。',
        },
        {
          hintId: 'hint.slice.rock.2',
          disclosureStage: 2,
          trigger: {
            type: 'ANALYSIS',
            speciesId: 'species.slice.mudshell-beetle',
            minimumBasisPoints: 1200,
          },
          text: '土属性の甲虫種で、障壁形成に優れる。',
        },
        {
          hintId: 'hint.slice.rock.3',
          disclosureStage: 3,
          trigger: { type: 'CATALYST', catalystId: 'catalyst.slice.earth' },
          text: '泥殻と歯車を融合する記録がある。',
        },
        {
          hintId: 'hint.slice.rock.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '泥殻虫と古歯車、土触媒が正解である。',
        },
      ],
    }),
    R({
      nodeId: 'research.slice.spark-bird',
      displayName: '火花鳥の融合',
      targetSpeciesId: 'species.slice.spark-bird',
      adjacentNodeIds: ['research.slice.flame-automaton', 'research.slice.disaster-flame-wyvern'],
      method: 'FUSION',
      candidateMethods: ['FUSION', 'LINEAGE'],
      candidateSpeciesIds: [
        'species.slice.windwing-midge',
        'species.slice.ember-gecko',
        'species.slice.grassfang-rat',
      ],
      recipeSpeciesIds: ['species.slice.windwing-midge', 'species.slice.ember-gecko'],
      candidateCatalystIds: ['catalyst.slice.wind', 'catalyst.slice.fire'],
      recipeCatalystIds: ['catalyst.slice.fire'],
      trialResearchDataCost: 14,
      hints: [
        {
          hintId: 'hint.slice.spark.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.a-04-ranged' },
          text: '前列を越えて火花を落とす飛翔体が観測された。',
        },
        {
          hintId: 'hint.slice.spark.2',
          disclosureStage: 2,
          trigger: {
            type: 'ANALYSIS',
            speciesId: 'species.slice.windwing-midge',
            minimumBasisPoints: 1400,
          },
          text: '風羽系と火種系の双方に近い。',
        },
        {
          hintId: 'hint.slice.spark.3',
          disclosureStage: 3,
          trigger: { type: 'CATALYST', catalystId: 'catalyst.slice.fire' },
          text: '融合には火触媒が一つ必要となる。',
        },
        {
          hintId: 'hint.slice.spark.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '風羽虫と火種トカゲを融合する。',
        },
      ],
    }),
    R({
      nodeId: 'research.slice.moss-healer',
      displayName: '苔癒しの系譜',
      targetSpeciesId: 'species.slice.moss-healer',
      adjacentNodeIds: ['research.slice.venom-moth', 'research.slice.windtree-priest'],
      method: 'LINEAGE',
      candidateMethods: ['LINEAGE', 'CONVERGENCE'],
      candidateSpeciesIds: [
        'species.slice.moss-sprout',
        'species.slice.mudshell-beetle',
        'species.slice.grassfang-rat',
      ],
      recipeSpeciesIds: ['species.slice.moss-sprout', 'species.slice.mudshell-beetle'],
      candidateCatalystIds: ['catalyst.slice.earth', 'catalyst.slice.wind'],
      recipeCatalystIds: ['catalyst.slice.earth'],
      trialResearchDataCost: 14,
      hints: [
        {
          hintId: 'hint.slice.healer.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.a-05-healing' },
          text: '複数個体を同時に癒す苔類の反応が記録された。',
        },
        {
          hintId: 'hint.slice.healer.2',
          disclosureStage: 2,
          trigger: {
            type: 'ANALYSIS',
            speciesId: 'species.slice.moss-sprout',
            minimumBasisPoints: 1400,
          },
          text: '苔芽の系譜を、安定した殻で支える必要がある。',
        },
        {
          hintId: 'hint.slice.healer.3',
          disclosureStage: 3,
          trigger: { type: 'CATALYST', catalystId: 'catalyst.slice.earth' },
          text: '土触媒を使う系譜研究である。',
        },
        {
          hintId: 'hint.slice.healer.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '苔芽と泥殻虫を一体ずつ用いる。',
        },
      ],
    }),
    R({
      nodeId: 'research.slice.ironhorn-beast',
      displayName: '鉄角獣の収束',
      targetSpeciesId: 'species.slice.ironhorn-beast',
      adjacentNodeIds: [
        'research.slice.gale-wolf',
        'research.slice.rock-carapace',
        'research.slice.molten-carapace',
      ],
      method: 'CONVERGENCE',
      candidateMethods: ['FUSION', 'CONVERGENCE'],
      candidateSpeciesIds: [
        'species.slice.gale-wolf',
        'species.slice.rock-carapace',
        'species.slice.ancient-gear',
      ],
      recipeSpeciesIds: ['species.slice.gale-wolf', 'species.slice.rock-carapace'],
      candidateCatalystIds: ['catalyst.slice.earth', 'catalyst.slice.machine-core'],
      recipeCatalystIds: ['catalyst.slice.earth'],
      trialResearchDataCost: 24,
      hints: [
        {
          hintId: 'hint.slice.ironhorn.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.a-07-push' },
          text: '重い角で陣形を押し崩す大型獣の痕跡。',
        },
        {
          hintId: 'hint.slice.ironhorn.2',
          disclosureStage: 2,
          trigger: { type: 'ADJACENT', nodeId: 'research.slice.gale-wolf', minimumStatus: 'known' },
          text: '高速獣の運動性と重層甲の防御性を収束させる。',
        },
        {
          hintId: 'hint.slice.ironhorn.3',
          disclosureStage: 3,
          trigger: {
            type: 'ADJACENT',
            nodeId: 'research.slice.rock-carapace',
            minimumStatus: 'known',
          },
          text: '素材は疾風狼と岩甲虫の二種に絞られる。',
        },
        {
          hintId: 'hint.slice.ironhorn.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '収束研究、土触媒一つが正解である。',
        },
      ],
    }),
    R({
      nodeId: 'research.slice.venom-moth',
      displayName: '毒針蛾の秘匿融合',
      targetSpeciesId: 'species.slice.venom-moth',
      hidden: true,
      adjacentNodeIds: ['research.slice.moss-healer', 'research.slice.flame-automaton'],
      method: 'FUSION',
      candidateMethods: ['FUSION', 'LINEAGE'],
      candidateSpeciesIds: [
        'species.slice.windwing-midge',
        'species.slice.moss-sprout',
        'species.slice.ember-gecko',
      ],
      recipeSpeciesIds: ['species.slice.windwing-midge', 'species.slice.moss-sprout'],
      candidateCatalystIds: ['catalyst.slice.venom', 'catalyst.slice.wind'],
      recipeCatalystIds: ['catalyst.slice.venom'],
      trialResearchDataCost: 26,
      hints: [
        {
          hintId: 'hint.slice.venom.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.a-06-poison' },
          text: '毒を受けた戦闘記録の余白に、未登録の翅紋が残る。',
        },
        {
          hintId: 'hint.slice.venom.2',
          disclosureStage: 2,
          trigger: { type: 'CATALYST', catalystId: 'catalyst.slice.venom' },
          text: '昆虫と植物の特徴を持つ暗属性種らしい。',
        },
        {
          hintId: 'hint.slice.venom.3',
          disclosureStage: 3,
          trigger: {
            type: 'ANALYSIS',
            speciesId: 'species.slice.moss-sprout',
            minimumBasisPoints: 1800,
          },
          text: '風羽虫と苔芽の二素材を用いる。',
        },
        {
          hintId: 'hint.slice.venom.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '融合研究と毒触媒の組合せが正解である。',
        },
      ],
    }),
    R({
      nodeId: 'research.slice.flame-automaton',
      displayName: '炎機兵の収束',
      targetSpeciesId: 'species.slice.flame-automaton',
      adjacentNodeIds: [
        'research.slice.spark-bird',
        'research.slice.venom-moth',
        'research.slice.molten-carapace',
        'research.slice.disaster-flame-wyvern',
      ],
      method: 'CONVERGENCE',
      candidateMethods: ['FUSION', 'CONVERGENCE'],
      candidateSpeciesIds: [
        'species.slice.ancient-gear',
        'species.slice.ember-gecko',
        'species.slice.spark-bird',
      ],
      recipeSpeciesIds: ['species.slice.ancient-gear', 'species.slice.ember-gecko'],
      candidateCatalystIds: ['catalyst.slice.fire', 'catalyst.slice.machine-core'],
      recipeCatalystIds: ['catalyst.slice.machine-core'],
      trialResearchDataCost: 28,
      hints: [
        {
          hintId: 'hint.slice.automaton.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.b-01-burn' },
          text: '火炎を直線状に投射する機構の残骸が回収された。',
        },
        {
          hintId: 'hint.slice.automaton.2',
          disclosureStage: 2,
          trigger: { type: 'CATALYST', catalystId: 'catalyst.slice.machine-core' },
          text: '構造体と火属性爬虫類の収束体である。',
        },
        {
          hintId: 'hint.slice.automaton.3',
          disclosureStage: 3,
          trigger: {
            type: 'ADJACENT',
            nodeId: 'research.slice.spark-bird',
            minimumStatus: 'known',
          },
          text: '古歯車と火種トカゲを素材にする。',
        },
        {
          hintId: 'hint.slice.automaton.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '収束研究と機構核一つが正解である。',
        },
      ],
    }),
    R({
      nodeId: 'research.slice.molten-carapace',
      displayName: '溶岩甲獣の融合',
      targetSpeciesId: 'species.slice.molten-carapace',
      adjacentNodeIds: [
        'research.slice.rock-carapace',
        'research.slice.ironhorn-beast',
        'research.slice.flame-automaton',
        'research.slice.disaster-flame-wyvern',
      ],
      method: 'FUSION',
      candidateMethods: ['FUSION', 'CONVERGENCE'],
      candidateSpeciesIds: [
        'species.slice.rock-carapace',
        'species.slice.flame-automaton',
        'species.slice.ironhorn-beast',
      ],
      recipeSpeciesIds: ['species.slice.rock-carapace', 'species.slice.flame-automaton'],
      candidateCatalystIds: ['catalyst.slice.fire', 'catalyst.slice.primal-core'],
      recipeCatalystIds: ['catalyst.slice.primal-core'],
      trialResearchDataCost: 42,
      hints: [
        {
          hintId: 'hint.slice.molten.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.b-04-molten-boss' },
          text: '味方への攻撃を引き受ける高熱甲殻の記録。',
        },
        {
          hintId: 'hint.slice.molten.2',
          disclosureStage: 2,
          trigger: {
            type: 'ADJACENT',
            nodeId: 'research.slice.rock-carapace',
            minimumStatus: 'completed',
          },
          text: '岩甲虫と火炎機構の特徴が重なっている。',
        },
        {
          hintId: 'hint.slice.molten.3',
          disclosureStage: 3,
          trigger: {
            type: 'ADJACENT',
            nodeId: 'research.slice.flame-automaton',
            minimumStatus: 'known',
          },
          text: '原始核を用いる融合研究である。',
        },
        {
          hintId: 'hint.slice.molten.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '岩甲虫と炎機兵、原始核一つが正解である。',
        },
      ],
    }),
    R({
      nodeId: 'research.slice.windtree-priest',
      displayName: '風樹祭司の系譜',
      targetSpeciesId: 'species.slice.windtree-priest',
      adjacentNodeIds: [
        'research.slice.gale-wolf',
        'research.slice.moss-healer',
        'research.slice.disaster-flame-wyvern',
      ],
      method: 'LINEAGE',
      candidateMethods: ['LINEAGE', 'CONVERGENCE'],
      candidateSpeciesIds: [
        'species.slice.gale-wolf',
        'species.slice.moss-healer',
        'species.slice.moss-sprout',
      ],
      recipeSpeciesIds: ['species.slice.gale-wolf', 'species.slice.moss-healer'],
      candidateCatalystIds: ['catalyst.slice.wind', 'catalyst.slice.earth'],
      recipeCatalystIds: ['catalyst.slice.wind', 'catalyst.slice.earth'],
      trialResearchDataCost: 44,
      hints: [
        {
          hintId: 'hint.slice.priest.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.b-07-summon' },
          text: '回復領域の中心に、風をまとう樹木型個体が立っていた。',
        },
        {
          hintId: 'hint.slice.priest.2',
          disclosureStage: 2,
          trigger: {
            type: 'ADJACENT',
            nodeId: 'research.slice.moss-healer',
            minimumStatus: 'completed',
          },
          text: '苔癒しの系譜を高速獣へ接続する。',
        },
        {
          hintId: 'hint.slice.priest.3',
          disclosureStage: 3,
          trigger: {
            type: 'ADJACENT',
            nodeId: 'research.slice.gale-wolf',
            minimumStatus: 'completed',
          },
          text: '風と土の触媒を一つずつ必要とする。',
        },
        {
          hintId: 'hint.slice.priest.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '疾風狼と苔癒しによる系譜研究が正解である。',
        },
      ],
    }),
    R({
      nodeId: 'research.slice.disaster-flame-wyvern',
      displayName: '災炎翼竜の超越',
      targetSpeciesId: 'species.slice.disaster-flame-wyvern',
      adjacentNodeIds: [
        'research.slice.spark-bird',
        'research.slice.flame-automaton',
        'research.slice.molten-carapace',
        'research.slice.windtree-priest',
      ],
      method: 'TRANSCENDENCE',
      candidateMethods: ['CONVERGENCE', 'TRANSCENDENCE'],
      candidateSpeciesIds: [
        'species.slice.spark-bird',
        'species.slice.flame-automaton',
        'species.slice.molten-carapace',
        'species.slice.windtree-priest',
      ],
      recipeSpeciesIds: [
        'species.slice.spark-bird',
        'species.slice.flame-automaton',
        'species.slice.molten-carapace',
      ],
      candidateCatalystIds: ['catalyst.slice.wyvern-heart', 'catalyst.slice.primal-core'],
      recipeCatalystIds: ['catalyst.slice.wyvern-heart'],
      trialResearchDataCost: 70,
      hints: [
        {
          hintId: 'hint.slice.wyvern.1',
          disclosureStage: 1,
          trigger: { type: 'PROGRESS', progressId: 'progress.slice.b-08-wyvern-boss' },
          text: '災炎翼竜の核は撃破後も高熱を保っている。',
        },
        {
          hintId: 'hint.slice.wyvern.2',
          disclosureStage: 2,
          trigger: { type: 'CATALYST', catalystId: 'catalyst.slice.wyvern-heart' },
          text: '飛翔火種、火炎機構、高熱甲殻の三系統が必要。',
        },
        {
          hintId: 'hint.slice.wyvern.3',
          disclosureStage: 3,
          trigger: {
            type: 'ADJACENT',
            nodeId: 'research.slice.molten-carapace',
            minimumStatus: 'completed',
          },
          text: '火花鳥、炎機兵、溶岩甲獣を超越研究へ投入する。',
        },
        {
          hintId: 'hint.slice.wyvern.4',
          disclosureStage: 4,
          trigger: { type: 'TRIAL', minimumIncorrectTrials: 1 },
          text: '災炎心核一つを用いる三素材超越が正解である。',
        },
      ],
    }),
  ])

export const VERTICAL_SLICE_RESEARCH_NODES: readonly ResearchNodeDefinition[] = Object.freeze(
  VERTICAL_SLICE_RESEARCH_RECORDS.map((record) => record.definition),
)

export const VERTICAL_SLICE_RESEARCH_HINT_COPIES: readonly VerticalSliceResearchHintCopy[] =
  Object.freeze(VERTICAL_SLICE_RESEARCH_RECORDS.flatMap((record) => record.hintCopies))

export const VERTICAL_SLICE_FINAL_RESEARCH_DEFINITIONS: readonly FinalResearchDefinition[] =
  Object.freeze(
    [
      {
        nodeId: 'research.slice.gale-wolf',
        researchDataCost: 80,
        catalysts: [{ catalystId: 'catalyst.slice.wind', amount: 1 }],
        specimenRequirements: [],
      },
      {
        nodeId: 'research.slice.rock-carapace',
        researchDataCost: 80,
        catalysts: [{ catalystId: 'catalyst.slice.earth', amount: 1 }],
        specimenRequirements: [],
      },
      {
        nodeId: 'research.slice.spark-bird',
        researchDataCost: 90,
        catalysts: [{ catalystId: 'catalyst.slice.fire', amount: 1 }],
        specimenRequirements: [],
      },
      {
        nodeId: 'research.slice.moss-healer',
        researchDataCost: 90,
        catalysts: [{ catalystId: 'catalyst.slice.earth', amount: 1 }],
        specimenRequirements: [],
      },
      {
        nodeId: 'research.slice.ironhorn-beast',
        researchDataCost: 160,
        catalysts: [{ catalystId: 'catalyst.slice.earth', amount: 2 }],
        specimenRequirements: [],
      },
      {
        nodeId: 'research.slice.venom-moth',
        researchDataCost: 170,
        catalysts: [{ catalystId: 'catalyst.slice.venom', amount: 2 }],
        specimenRequirements: [],
      },
      {
        nodeId: 'research.slice.flame-automaton',
        researchDataCost: 180,
        catalysts: [{ catalystId: 'catalyst.slice.machine-core', amount: 2 }],
        specimenRequirements: [],
      },
      {
        nodeId: 'research.slice.molten-carapace',
        researchDataCost: 320,
        catalysts: [{ catalystId: 'catalyst.slice.primal-core', amount: 2 }],
        specimenRequirements: [
          { speciesId: 'species.slice.rock-carapace', amount: 1 },
          { speciesId: 'species.slice.flame-automaton', amount: 1 },
        ],
      },
      {
        nodeId: 'research.slice.windtree-priest',
        researchDataCost: 340,
        catalysts: [
          { catalystId: 'catalyst.slice.wind', amount: 2 },
          { catalystId: 'catalyst.slice.earth', amount: 2 },
        ],
        specimenRequirements: [
          { speciesId: 'species.slice.gale-wolf', amount: 1 },
          { speciesId: 'species.slice.moss-healer', amount: 1 },
        ],
      },
      {
        nodeId: 'research.slice.disaster-flame-wyvern',
        researchDataCost: 560,
        catalysts: [{ catalystId: 'catalyst.slice.wyvern-heart', amount: 1 }],
        specimenRequirements: [
          { speciesId: 'species.slice.spark-bird', amount: 1 },
          { speciesId: 'species.slice.flame-automaton', amount: 1 },
          { speciesId: 'species.slice.molten-carapace', amount: 1 },
        ],
      },
    ].map((definition) =>
      Object.freeze({
        ...definition,
        catalysts: Object.freeze(definition.catalysts.map((item) => Object.freeze({ ...item }))),
        specimenRequirements: Object.freeze(
          definition.specimenRequirements.map((item) => Object.freeze({ ...item })),
        ),
      }),
    ),
  )

export const VERTICAL_SLICE_RESEARCH_FACILITY_STAGES: readonly ResearchFacilityStageDefinition[] =
  Object.freeze([
    Object.freeze({
      stage: 1,
      maxResearchableRarity: 2,
      upgradeCurrencyCost: 0,
      upgradeResearchDataCost: 0,
    }),
    Object.freeze({
      stage: 2,
      maxResearchableRarity: 4,
      upgradeCurrencyCost: 420,
      upgradeResearchDataCost: 160,
    }),
    Object.freeze({
      stage: 3,
      maxResearchableRarity: 5,
      upgradeCurrencyCost: 900,
      upgradeResearchDataCost: 420,
    }),
  ])

export const VERTICAL_SLICE_REGIONS: readonly RegionDefinition[] = Object.freeze([
  Object.freeze({
    regionId: 'region.slice-a',
    name: '翠風観測原',
    summary: '行動順、遮蔽、移動、遠距離、回復、毒、押し出しを段階的に学ぶ導入地域。',
    themeColor: '#55b889',
    order: 1,
    requirement: Object.freeze({ type: 'ALWAYS' as const }),
    hideUntilUnlocked: false,
  }),
  Object.freeze({
    regionId: 'region.slice-b',
    name: '灼熱機構域',
    summary: '火傷、炎上床、障壁、貫通、遅延、予兆、召喚を組み合わせる高難度地域。',
    themeColor: '#ee7045',
    order: 2,
    requirement: Object.freeze({
      type: 'STAGE_COMPLETED' as const,
      stageId: 'stage.slice.a-09-combined',
    }),
    hideUntilUnlocked: false,
  }),
])

const REGION_A_POINT_REWARDS: readonly RegionalPointRewardDefinition[] = Object.freeze([
  Object.freeze({
    rewardId: 'regional.slice-a.wind-30',
    requiredPoints: 30,
    bundle: Object.freeze({
      currency: 80,
      researchData: 30,
      catalysts: Object.freeze([{ catalystId: 'catalyst.slice.wind', amount: 1 }]),
    }),
  }),
  Object.freeze({
    rewardId: 'regional.slice-a.earth-60',
    requiredPoints: 60,
    bundle: Object.freeze({
      currency: 110,
      researchData: 45,
      catalysts: Object.freeze([{ catalystId: 'catalyst.slice.earth', amount: 1 }]),
    }),
  }),
  Object.freeze({
    rewardId: 'regional.slice-a.venom-90',
    requiredPoints: 90,
    bundle: Object.freeze({
      currency: 140,
      researchData: 60,
      catalysts: Object.freeze([{ catalystId: 'catalyst.slice.venom', amount: 1 }]),
    }),
  }),
])

const REGION_B_POINT_REWARDS: readonly RegionalPointRewardDefinition[] = Object.freeze([
  Object.freeze({
    rewardId: 'regional.slice-b.fire-30',
    requiredPoints: 30,
    bundle: Object.freeze({
      currency: 150,
      researchData: 60,
      catalysts: Object.freeze([{ catalystId: 'catalyst.slice.fire', amount: 1 }]),
    }),
  }),
  Object.freeze({
    rewardId: 'regional.slice-b.machine-60',
    requiredPoints: 60,
    bundle: Object.freeze({
      currency: 190,
      researchData: 80,
      catalysts: Object.freeze([{ catalystId: 'catalyst.slice.machine-core', amount: 1 }]),
    }),
  }),
  Object.freeze({
    rewardId: 'regional.slice-b.primal-90',
    requiredPoints: 90,
    bundle: Object.freeze({
      currency: 240,
      researchData: 110,
      catalysts: Object.freeze([{ catalystId: 'catalyst.slice.primal-core', amount: 1 }]),
    }),
  }),
])

function defineStageRecord(input: StageRecordInput): VerticalSliceStageRecord {
  const units: readonly HeadlessBattleUnitDefinition[] = Object.freeze(
    input.units.map((unit, index) =>
      Object.freeze({
        battleUnitId: `enemy.${input.stageId}.${index + 1}`,
        speciesId: unit.speciesId,
        position: Object.freeze({ side: 'ENEMY' as const, row: unit.row, column: unit.column }),
        ...(unit.equippedSkillIds === undefined
          ? {}
          : { equippedSkillIds: freezeStrings(unit.equippedSkillIds) }),
        tiePriority: index,
      }),
    ),
  )
  const aiConfigurations = Object.freeze(
    Object.fromEntries(
      input.units.map((unit, index) => [
        units[index].battleUnitId,
        Object.freeze({
          individualStrategy: unit.individualStrategy ?? 'STANDARD',
          teamStrategy: unit.teamStrategy ?? 'STABLE_CLEAR',
        }),
      ]),
    ),
  )
  const boss: BossEncounterDefinition | null =
    input.boss === undefined
      ? null
      : Object.freeze({
          bossBattleUnitId: units[input.boss.unitIndex].battleUnitId,
          phases: Object.freeze(
            input.boss.phases.map((phase) =>
              Object.freeze({
                ...phase,
                actionSkillIds: freezeStrings(phase.actionSkillIds),
                gimmick: Object.freeze({ ...phase.gimmick }),
              }),
            ),
          ),
        })
  const pointRewards =
    input.regionId === 'region.slice-a' ? REGION_A_POINT_REWARDS : REGION_B_POINT_REWARDS
  const catalystIds = input.catalystIds ?? []
  const uniqueSpeciesIds = [...new Set(input.units.map((unit) => unit.speciesId))]
  return Object.freeze({
    definition: Object.freeze({
      stageId: input.stageId,
      regionId: input.regionId,
      kind: input.kind,
      theme: input.theme,
      secondaryTheme: input.secondaryTheme,
      completionProgressId: input.stageId.replace(/^stage\./, 'progress.'),
      access: Object.freeze({
        order: input.order,
        requirement:
          input.unlockAfter === undefined
            ? Object.freeze({ type: 'ALWAYS' as const })
            : Object.freeze({ type: 'STAGE_COMPLETED' as const, stageId: input.unlockAfter }),
        hideUntilUnlocked: false,
      }),
      enemyFormation: Object.freeze({ units, aiConfigurations }),
      rewards: Object.freeze({
        guaranteed: Object.freeze({
          currency: input.currency,
          researchData: input.researchData,
          catalysts: Object.freeze(
            catalystIds.map((catalystId) => Object.freeze({ catalystId, amount: 1 })),
          ),
        }),
        randomBonuses: Object.freeze([]),
        regionalPointGain: input.regionalPointGain,
        regionalPointRewards: pointRewards,
        analysisGains: Object.freeze(
          uniqueSpeciesIds.map((speciesId) =>
            Object.freeze({
              speciesId,
              source: 'ENEMY_ENCOUNTER' as const,
              amount: input.kind === 'BOSS' ? 280 : 140,
            }),
          ),
        ),
      }),
      boss,
    }),
    mechanicIds: freezeStrings(input.mechanicIds),
    ticket: Object.freeze({ stageId: input.stageId, ...input.ticket }),
  })
}

const S = defineStageRecord

export const VERTICAL_SLICE_STAGE_RECORDS: readonly VerticalSliceStageRecord[] = Object.freeze([
  S({
    stageId: 'stage.slice.a-01-order',
    regionId: 'region.slice-a',
    order: 1,
    kind: 'NORMAL',
    theme: '行動順を読む',
    secondaryTheme: '軽い行動を先に使う価値',
    mechanicIds: ['action-order'],
    units: [
      {
        speciesId: 'species.slice.grassfang-rat',
        row: 0,
        column: 1,
        individualStrategy: 'ASSAULT',
        teamStrategy: 'FAST_KILL',
      },
    ],
    currency: 70,
    researchData: 18,
    regionalPointGain: 10,
    ticket: {
      intent: '高速の単体敵で行動順表示を読む。',
      mostDangerousEnemy: '草牙ネズミ',
      counterplay: '先に軽い技を使い、次行動を奪う。',
      aiPlan: '最短で接触し低コスト攻撃を反復する。',
      lessonOnDefeat: '重い技だけでは先手を失う。',
    },
  }),
  S({
    stageId: 'stage.slice.a-02-cover',
    regionId: 'region.slice-a',
    order: 2,
    kind: 'NORMAL',
    theme: '前列遮蔽',
    secondaryTheme: '直線射撃を前列で止める',
    mechanicIds: ['cover', 'direct-range'],
    unlockAfter: 'stage.slice.a-01-order',
    units: [
      {
        speciesId: 'species.slice.mudshell-beetle',
        row: 0,
        column: 1,
        equippedSkillIds: ['skill.slice.generic.guard-stance'],
        individualStrategy: 'CAUTIOUS',
      },
      {
        speciesId: 'species.slice.windwing-midge',
        row: 2,
        column: 1,
        equippedSkillIds: ['skill.slice.generic.long-shot'],
        individualStrategy: 'FIXED_TURRET',
        teamStrategy: 'FAST_KILL',
      },
    ],
    currency: 85,
    researchData: 22,
    regionalPointGain: 10,
    catalystIds: ['catalyst.slice.earth'],
    ticket: {
      intent: '前列が後衛射手を守る基本形。',
      mostDangerousEnemy: '風羽虫',
      counterplay: '遮蔽役を崩すか射線外から後衛を狙う。',
      aiPlan: '泥殻虫が前列を維持し風羽虫が直線射撃する。',
      lessonOnDefeat: '射手だけを直接狙っても遮蔽で止まる。',
    },
  }),
  S({
    stageId: 'stage.slice.a-03-movement',
    regionId: 'region.slice-a',
    order: 3,
    kind: 'NORMAL',
    theme: '移動と追撃',
    secondaryTheme: '危険な列から離れる',
    mechanicIds: ['movement', 'move-then-attack'],
    unlockAfter: 'stage.slice.a-02-cover',
    units: [
      {
        speciesId: 'species.slice.gale-wolf',
        row: 1,
        column: 0,
        equippedSkillIds: ['skill.slice.generic.retreat'],
        individualStrategy: 'POSITIONAL',
        teamStrategy: 'FAST_KILL',
      },
      {
        speciesId: 'species.slice.grassfang-rat',
        row: 0,
        column: 2,
        individualStrategy: 'ASSAULT',
      },
    ],
    currency: 95,
    researchData: 26,
    regionalPointGain: 10,
    catalystIds: ['catalyst.slice.wind'],
    ticket: {
      intent: '移動してから攻撃する敵を追う。',
      mostDangerousEnemy: '疾風狼',
      counterplay: '移動先を塞ぎ集中攻撃する。',
      aiPlan: '位置変更を優先し弱った対象へ追撃する。',
      lessonOnDefeat: '固定配置のままでは高速敵を捕まえられない。',
    },
  }),
  S({
    stageId: 'stage.slice.a-04-ranged',
    regionId: 'region.slice-a',
    order: 4,
    kind: 'NORMAL',
    theme: '直線と曲射',
    secondaryTheme: '後衛配置を分散する',
    mechanicIds: ['direct-range', 'arc-range', 'cover-counter'],
    unlockAfter: 'stage.slice.a-03-movement',
    units: [
      {
        speciesId: 'species.slice.windwing-midge',
        row: 2,
        column: 0,
        equippedSkillIds: ['skill.slice.generic.long-shot'],
        individualStrategy: 'FIXED_TURRET',
      },
      {
        speciesId: 'species.slice.spark-bird',
        row: 2,
        column: 2,
        equippedSkillIds: ['skill.slice.spark-skyfall'],
        individualStrategy: 'POSITIONAL',
        teamStrategy: 'FAST_KILL',
      },
    ],
    currency: 110,
    researchData: 30,
    regionalPointGain: 10,
    catalystIds: ['catalyst.slice.fire'],
    ticket: {
      intent: '二種類の遠距離到達方式を比較させる。',
      mostDangerousEnemy: '火花鳥',
      counterplay: '後衛を分散し接近役で射手を追う。',
      aiPlan: '直線射撃で前列を削り曲射で後列へ圧力をかける。',
      lessonOnDefeat: '前列だけを固めても曲射は後衛へ届く。',
    },
  }),
  S({
    stageId: 'stage.slice.a-05-healing',
    regionId: 'region.slice-a',
    order: 5,
    kind: 'NORMAL',
    theme: '回復役の優先撃破',
    secondaryTheme: '回復前に火力を集中する',
    mechanicIds: ['healing', 'target-priority'],
    unlockAfter: 'stage.slice.a-04-ranged',
    units: [
      {
        speciesId: 'species.slice.mudshell-beetle',
        row: 0,
        column: 1,
        equippedSkillIds: ['skill.slice.generic.guard-stance'],
        individualStrategy: 'CAUTIOUS',
      },
      {
        speciesId: 'species.slice.moss-sprout',
        row: 2,
        column: 0,
        equippedSkillIds: ['skill.slice.generic.minor-heal'],
        individualStrategy: 'SUPPORT',
      },
      {
        speciesId: 'species.slice.moss-healer',
        row: 2,
        column: 2,
        equippedSkillIds: ['skill.slice.moss-cleansing-grove'],
        individualStrategy: 'SUPPORT',
        teamStrategy: 'LOSS_MINIMIZATION',
      },
    ],
    currency: 120,
    researchData: 34,
    regionalPointGain: 10,
    ticket: {
      intent: '守られた回復役をどう崩すか判断させる。',
      mostDangerousEnemy: '苔癒し',
      counterplay: '回復役へ火力を集中するか回復量を上回る。',
      aiPlan: '前列を維持し傷ついた味方を優先回復する。',
      lessonOnDefeat: '攻撃対象を散らすと回復で帳消しになる。',
    },
  }),
  S({
    stageId: 'stage.slice.a-06-poison',
    regionId: 'region.slice-a',
    order: 6,
    kind: 'NORMAL',
    theme: '毒スタック',
    secondaryTheme: '浄化と短期決戦',
    mechanicIds: ['poison', 'status-cleanse'],
    unlockAfter: 'stage.slice.a-05-healing',
    units: [
      {
        speciesId: 'species.slice.mudshell-beetle',
        row: 0,
        column: 1,
        individualStrategy: 'CAUTIOUS',
      },
      {
        speciesId: 'species.slice.venom-moth',
        row: 2,
        column: 1,
        equippedSkillIds: ['skill.slice.venom-cloud', 'skill.slice.generic.venom-fang'],
        individualStrategy: 'CAUTIOUS',
        teamStrategy: 'LOSS_MINIMIZATION',
      },
    ],
    currency: 130,
    researchData: 38,
    regionalPointGain: 10,
    catalystIds: ['catalyst.slice.venom'],
    ticket: {
      intent: '継続損害と浄化の価値を示す。',
      mostDangerousEnemy: '毒針蛾',
      counterplay: '毒針蛾を先に落とすか浄化技を装備する。',
      aiPlan: '前列の後ろから毒を積み長期戦へ持ち込む。',
      lessonOnDefeat: '毒を放置すると後半ほど不利になる。',
    },
  }),
  S({
    stageId: 'stage.slice.a-07-push',
    regionId: 'region.slice-a',
    order: 7,
    kind: 'NORMAL',
    theme: '押し出しで列を崩す',
    secondaryTheme: '盤面端と遮蔽線を意識する',
    mechanicIds: ['force-move', 'cover-disruption'],
    unlockAfter: 'stage.slice.a-06-poison',
    units: [
      {
        speciesId: 'species.slice.ironhorn-beast',
        row: 0,
        column: 1,
        equippedSkillIds: ['skill.slice.ironhorn-avalanche', 'skill.slice.generic.impact'],
        individualStrategy: 'ASSAULT',
        teamStrategy: 'FAST_KILL',
      },
      {
        speciesId: 'species.slice.grassfang-rat',
        row: 1,
        column: 2,
        individualStrategy: 'ASSAULT',
      },
    ],
    currency: 145,
    researchData: 42,
    regionalPointGain: 10,
    catalystIds: ['catalyst.slice.earth'],
    ticket: {
      intent: '強制移動で安全な配置が崩れることを教える。',
      mostDangerousEnemy: '鉄角獣',
      counterplay: '前列を厚くし移動不能や障壁で突進を受ける。',
      aiPlan: '鉄角獣が列を崩し草牙ネズミが空いた対象を追う。',
      lessonOnDefeat: '盤面端や一列密集は押し出しに弱い。',
    },
  }),
  S({
    stageId: 'stage.slice.a-08-barrier',
    regionId: 'region.slice-a',
    order: 8,
    kind: 'ELITE',
    theme: '障壁を剥がす順番',
    secondaryTheme: '小技から重技へつなぐ',
    mechanicIds: ['barrier', 'damage-sequencing'],
    unlockAfter: 'stage.slice.a-07-push',
    units: [
      {
        speciesId: 'species.slice.rock-carapace',
        row: 0,
        column: 1,
        equippedSkillIds: ['skill.slice.rock-bastion'],
        individualStrategy: 'CAUTIOUS',
      },
      {
        speciesId: 'species.slice.spark-bird',
        row: 2,
        column: 0,
        equippedSkillIds: ['skill.slice.spark-skyfall'],
        individualStrategy: 'POSITIONAL',
      },
      {
        speciesId: 'species.slice.moss-healer',
        row: 2,
        column: 2,
        equippedSkillIds: ['skill.slice.generic.cleanse'],
        individualStrategy: 'SUPPORT',
      },
    ],
    currency: 165,
    researchData: 48,
    regionalPointGain: 15,
    ticket: {
      intent: '障壁、曲射、回復の複合編成。',
      mostDangerousEnemy: '火花鳥',
      counterplay: '軽技で障壁を剥がし射手へ重技を通す。',
      aiPlan: '障壁と回復で時間を稼ぎ曲射を反復する。',
      lessonOnDefeat: '障壁へ重技を直接使うと火力を浪費する。',
    },
  }),
  S({
    stageId: 'stage.slice.a-09-combined',
    regionId: 'region.slice-a',
    order: 9,
    kind: 'ELITE',
    theme: '地域A総合試験',
    secondaryTheme: '移動、押し出し、毒への対応を統合する',
    mechanicIds: ['movement', 'force-move', 'poison'],
    unlockAfter: 'stage.slice.a-08-barrier',
    units: [
      {
        speciesId: 'species.slice.gale-wolf',
        row: 1,
        column: 0,
        equippedSkillIds: ['skill.slice.gale-circuit'],
        individualStrategy: 'POSITIONAL',
      },
      {
        speciesId: 'species.slice.ironhorn-beast',
        row: 0,
        column: 1,
        equippedSkillIds: ['skill.slice.generic.impact'],
        individualStrategy: 'ASSAULT',
      },
      {
        speciesId: 'species.slice.venom-moth',
        row: 2,
        column: 2,
        equippedSkillIds: ['skill.slice.venom-cloud'],
        individualStrategy: 'CAUTIOUS',
        teamStrategy: 'FAST_KILL',
      },
    ],
    currency: 190,
    researchData: 58,
    regionalPointGain: 15,
    catalystIds: ['catalyst.slice.wind', 'catalyst.slice.venom'],
    ticket: {
      intent: '地域Aで学んだ判断を同時に要求する。',
      mostDangerousEnemy: '鉄角獣',
      counterplay: '突進を受け止めてから毒針蛾へ集中する。',
      aiPlan: '押し出しで穴を作り高速追撃と毒を重ねる。',
      lessonOnDefeat: '最危険役と長期戦役の優先順位を分ける必要がある。',
    },
  }),
  S({
    stageId: 'stage.slice.b-01-burn',
    regionId: 'region.slice-b',
    order: 1,
    kind: 'NORMAL',
    theme: '火傷の蓄積',
    secondaryTheme: '浄化するか短期決戦を選ぶ',
    mechanicIds: ['burn', 'damage-over-time'],
    units: [
      {
        speciesId: 'species.slice.ember-gecko',
        row: 0,
        column: 0,
        equippedSkillIds: ['skill.slice.ember-firetrail'],
        individualStrategy: 'ASSAULT',
      },
      {
        speciesId: 'species.slice.flame-automaton',
        row: 2,
        column: 1,
        equippedSkillIds: ['skill.slice.generic.long-shot'],
        individualStrategy: 'FIXED_TURRET',
      },
      { speciesId: 'species.slice.ember-gecko', row: 0, column: 2, individualStrategy: 'ASSAULT' },
    ],
    currency: 175,
    researchData: 52,
    regionalPointGain: 12,
    catalystIds: ['catalyst.slice.fire'],
    ticket: {
      intent: '複数の火傷源で継続損害を可視化する。',
      mostDangerousEnemy: '炎機兵',
      counterplay: '炎機兵を遅延し火種トカゲを短時間で倒す。',
      aiPlan: '前列が火傷を付け後列が重い射撃を重ねる。',
      lessonOnDefeat: '火傷を放置した持久戦は不利になる。',
    },
  }),
  S({
    stageId: 'stage.slice.b-02-burning-floor',
    regionId: 'region.slice-b',
    order: 2,
    kind: 'NORMAL',
    theme: '炎上床から移動する',
    secondaryTheme: '安全マスを先に確保する',
    mechanicIds: ['burning-terrain', 'movement'],
    unlockAfter: 'stage.slice.b-01-burn',
    units: [
      {
        speciesId: 'species.slice.flame-automaton',
        row: 2,
        column: 1,
        equippedSkillIds: ['skill.slice.furnace-wall'],
        individualStrategy: 'FIXED_TURRET',
      },
      {
        speciesId: 'species.slice.ember-gecko',
        row: 0,
        column: 1,
        equippedSkillIds: ['skill.slice.ember-firetrail'],
        individualStrategy: 'POSITIONAL',
      },
      {
        speciesId: 'species.slice.spark-bird',
        row: 1,
        column: 2,
        individualStrategy: 'POSITIONAL',
      },
    ],
    currency: 185,
    researchData: 56,
    regionalPointGain: 12,
    catalystIds: ['catalyst.slice.fire'],
    ticket: {
      intent: '地形危険と敵攻撃を同時に避ける。',
      mostDangerousEnemy: '炎機兵',
      counterplay: '炎上予定列を空けつつ砲兵へ接近する。',
      aiPlan: '炎上床で移動先を狭め曲射で逃げ先を狙う。',
      lessonOnDefeat: '現在の安全だけでなく次の危険マスを見る必要がある。',
    },
  }),
  S({
    stageId: 'stage.slice.b-03-pierce',
    regionId: 'region.slice-b',
    order: 3,
    kind: 'ELITE',
    theme: '障壁と貫通',
    secondaryTheme: '列をずらして貫通効率を落とす',
    mechanicIds: ['barrier', 'pierce'],
    unlockAfter: 'stage.slice.b-02-burning-floor',
    units: [
      {
        speciesId: 'species.slice.rock-carapace',
        row: 0,
        column: 1,
        equippedSkillIds: ['skill.slice.rock-bastion'],
        individualStrategy: 'CAUTIOUS',
      },
      {
        speciesId: 'species.slice.flame-automaton',
        row: 2,
        column: 1,
        equippedSkillIds: ['skill.slice.generic.long-shot'],
        individualStrategy: 'FIXED_TURRET',
        teamStrategy: 'FAST_KILL',
      },
    ],
    currency: 205,
    researchData: 62,
    regionalPointGain: 14,
    catalystIds: ['catalyst.slice.machine-core'],
    ticket: {
      intent: '自軍は障壁を剥がし、敵の貫通には列分散で対処する。',
      mostDangerousEnemy: '炎機兵',
      counterplay: '同じ列に密集せず岩甲虫の障壁から先に削る。',
      aiPlan: '岩甲虫が守り炎機兵が同列を貫く。',
      lessonOnDefeat: '高耐久前列だけでは貫通射撃を防げない。',
    },
  }),
  S({
    stageId: 'stage.slice.b-04-molten-boss',
    regionId: 'region.slice-b',
    order: 4,
    kind: 'BOSS',
    theme: '溶岩甲獣迎撃',
    secondaryTheme: '肩代わりと障壁フェーズを突破する',
    mechanicIds: ['guard-share', 'barrier', 'boss-phase'],
    unlockAfter: 'stage.slice.b-03-pierce',
    units: [
      {
        speciesId: 'species.slice.molten-carapace',
        row: 0,
        column: 1,
        equippedSkillIds: ['skill.slice.molten-aegis', 'skill.slice.generic.impact'],
        individualStrategy: 'CAUTIOUS',
        teamStrategy: 'LOSS_MINIMIZATION',
      },
      {
        speciesId: 'species.slice.moss-healer',
        row: 2,
        column: 1,
        equippedSkillIds: ['skill.slice.generic.minor-heal'],
        individualStrategy: 'SUPPORT',
      },
    ],
    currency: 260,
    researchData: 85,
    regionalPointGain: 20,
    catalystIds: ['catalyst.slice.primal-core'],
    boss: {
      unitIndex: 0,
      phases: [
        {
          phaseId: 'phase.slice.molten.1',
          enterAtOrBelowHpBasisPoints: 10_000,
          actionSkillIds: ['skill.slice.generic.impact'],
          gimmick: { type: 'NONE' },
        },
        {
          phaseId: 'phase.slice.molten.2',
          enterAtOrBelowHpBasisPoints: 5000,
          actionSkillIds: ['skill.slice.molten-aegis'],
          gimmick: { type: 'BARRIER', capacity: 120 },
        },
      ],
    },
    ticket: {
      intent: '守護ボスの肩代わりと障壁再展開を突破する。',
      mostDangerousEnemy: '溶岩甲獣',
      counterplay: '支援役を先に落とし、障壁後の重技を温存する。',
      aiPlan: '前半は衝撃、後半は障壁を再展開して持久戦にする。',
      lessonOnDefeat: 'ボスフェーズ前に重技を使い切ると障壁を突破できない。',
    },
  }),
  S({
    stageId: 'stage.slice.b-05-delay',
    regionId: 'region.slice-b',
    order: 5,
    kind: 'NORMAL',
    theme: '行動遅延と加速',
    secondaryTheme: '重要行動の順番を操作する',
    mechanicIds: ['time-delay', 'time-advance'],
    unlockAfter: 'stage.slice.b-04-molten-boss',
    units: [
      {
        speciesId: 'species.slice.ancient-gear',
        row: 2,
        column: 1,
        equippedSkillIds: ['skill.slice.gear-reversal', 'skill.slice.generic.time-hinder'],
        individualStrategy: 'SUPPORT',
      },
      {
        speciesId: 'species.slice.gale-wolf',
        row: 0,
        column: 0,
        equippedSkillIds: ['skill.slice.gale-circuit'],
        individualStrategy: 'ASSAULT',
        teamStrategy: 'FAST_KILL',
      },
      { speciesId: 'species.slice.venom-moth', row: 1, column: 2, individualStrategy: 'CAUTIOUS' },
    ],
    currency: 215,
    researchData: 66,
    regionalPointGain: 14,
    catalystIds: ['catalyst.slice.wind'],
    ticket: {
      intent: '時間操作で危険役の行動回数が変わることを示す。',
      mostDangerousEnemy: '古歯車',
      counterplay: '支援装置を先に落とすか高速役を遅延する。',
      aiPlan: '古歯車が疾風狼を加速し毒針蛾が持久戦を作る。',
      lessonOnDefeat: 'HPだけでなく次行動時刻も優先撃破判断に必要。',
    },
  }),
  S({
    stageId: 'stage.slice.b-06-telegraph',
    regionId: 'region.slice-b',
    order: 6,
    kind: 'ELITE',
    theme: '予兆から退避する',
    secondaryTheme: '発動前に移動可能か確認する',
    mechanicIds: ['telegraph', 'movement'],
    unlockAfter: 'stage.slice.b-05-delay',
    units: [
      {
        speciesId: 'species.slice.spark-bird',
        row: 2,
        column: 0,
        equippedSkillIds: ['skill.slice.spark-skyfall'],
        individualStrategy: 'POSITIONAL',
      },
      {
        speciesId: 'species.slice.flame-automaton',
        row: 2,
        column: 2,
        equippedSkillIds: ['skill.slice.furnace-wall'],
        individualStrategy: 'FIXED_TURRET',
      },
      {
        speciesId: 'species.slice.windwing-midge',
        row: 1,
        column: 1,
        equippedSkillIds: ['skill.slice.windwing-crosswind'],
        individualStrategy: 'CAUTIOUS',
      },
    ],
    currency: 230,
    researchData: 72,
    regionalPointGain: 15,
    catalystIds: ['catalyst.slice.fire'],
    ticket: {
      intent: '複数の遠隔予兆から安全マスを選ばせる。',
      mostDangerousEnemy: '炎機兵',
      counterplay: 'タイムラインを見て発動前に列を変更する。',
      aiPlan: '予兆で移動を強制し曲射で逃げ先を狙う。',
      lessonOnDefeat: '予兆を見ても次行動が間に合わなければ軽減を選ぶ必要がある。',
    },
  }),
  S({
    stageId: 'stage.slice.b-07-summon',
    regionId: 'region.slice-b',
    order: 7,
    kind: 'ELITE',
    theme: '召喚体と本体の優先順位',
    secondaryTheme: '回復領域を維持する本体を狙う',
    mechanicIds: ['summon', 'healing-terrain'],
    unlockAfter: 'stage.slice.b-06-telegraph',
    units: [
      {
        speciesId: 'species.slice.windtree-priest',
        row: 2,
        column: 1,
        equippedSkillIds: ['skill.slice.grand-canopy'],
        individualStrategy: 'SUPPORT',
        teamStrategy: 'LOSS_MINIMIZATION',
      },
      {
        speciesId: 'species.slice.moss-healer',
        row: 1,
        column: 0,
        equippedSkillIds: ['skill.slice.moss-cleansing-grove'],
        individualStrategy: 'SUPPORT',
      },
      {
        speciesId: 'species.slice.flame-automaton',
        row: 0,
        column: 2,
        equippedSkillIds: ['skill.slice.furnace-wall'],
        individualStrategy: 'FIXED_TURRET',
      },
    ],
    currency: 245,
    researchData: 78,
    regionalPointGain: 16,
    catalystIds: ['catalyst.slice.earth', 'catalyst.slice.wind'],
    ticket: {
      intent: '増援・回復領域と本体撃破の優先順位を問う。',
      mostDangerousEnemy: '風樹祭司',
      counterplay: '召喚体へ火力を散らさず祭司を集中攻撃する。',
      aiPlan: '祭司が領域と増援を維持し砲兵が時間を稼ぐ。',
      lessonOnDefeat: '増援を倒し続けるだけでは戦線が縮まらない。',
    },
  }),
  S({
    stageId: 'stage.slice.b-08-wyvern-boss',
    regionId: 'region.slice-b',
    order: 8,
    kind: 'BOSS',
    theme: '災炎翼竜最終戦',
    secondaryTheme: '予兆、遅延、障壁、範囲攻撃を統合する',
    mechanicIds: ['telegraph', 'area-damage', 'cover-ignore', 'boss-phase'],
    unlockAfter: 'stage.slice.b-07-summon',
    units: [
      {
        speciesId: 'species.slice.disaster-flame-wyvern',
        row: 1,
        column: 1,
        equippedSkillIds: [
          'skill.slice.disaster-wingstorm',
          'skill.slice.generic.long-shot',
          'skill.slice.generic.time-hinder',
        ],
        individualStrategy: 'ASSAULT',
        teamStrategy: 'FAST_KILL',
      },
      {
        speciesId: 'species.slice.molten-carapace',
        row: 0,
        column: 0,
        equippedSkillIds: ['skill.slice.molten-aegis'],
        individualStrategy: 'CAUTIOUS',
      },
      {
        speciesId: 'species.slice.windtree-priest',
        row: 2,
        column: 2,
        equippedSkillIds: ['skill.slice.grand-canopy'],
        individualStrategy: 'SUPPORT',
      },
    ],
    currency: 360,
    researchData: 130,
    regionalPointGain: 25,
    catalystIds: ['catalyst.slice.wyvern-heart'],
    boss: {
      unitIndex: 0,
      phases: [
        {
          phaseId: 'phase.slice.wyvern.1',
          enterAtOrBelowHpBasisPoints: 10_000,
          actionSkillIds: ['skill.slice.generic.long-shot'],
          gimmick: { type: 'NONE' },
        },
        {
          phaseId: 'phase.slice.wyvern.2',
          enterAtOrBelowHpBasisPoints: 6500,
          actionSkillIds: ['skill.slice.generic.time-hinder'],
          gimmick: { type: 'BARRIER', capacity: 160 },
        },
        {
          phaseId: 'phase.slice.wyvern.3',
          enterAtOrBelowHpBasisPoints: 3000,
          actionSkillIds: ['skill.slice.disaster-wingstorm'],
          gimmick: { type: 'NONE' },
        },
      ],
    },
    ticket: {
      intent: '地域A/Bの全判断を三段階ボスへ統合する。',
      mostDangerousEnemy: '災炎翼竜',
      counterplay: '予兆退避、支援役の処理、フェーズ用火力温存を順に行う。',
      aiPlan: '遠射、遅延障壁、遮蔽無視範囲技へ段階的に移行する。',
      lessonOnDefeat: '一つの固定陣形と単一優先順位では三フェーズを通せない。',
    },
  }),
])

export const VERTICAL_SLICE_STAGES: readonly StageDefinition[] = Object.freeze(
  VERTICAL_SLICE_STAGE_RECORDS.map((record) => record.definition),
)

export const VERTICAL_SLICE_ENEMY_FORMATION_TICKETS: readonly VerticalSliceEnemyFormationTicket[] =
  Object.freeze(VERTICAL_SLICE_STAGE_RECORDS.map((record) => record.ticket))

export const VERTICAL_SLICE_WORLD_CATALOG = Object.freeze({
  species: VERTICAL_SLICE_SPECIES,
  skills: VERTICAL_SLICE_SKILLS,
  researchNodes: VERTICAL_SLICE_RESEARCH_NODES,
  finalResearchDefinitions: VERTICAL_SLICE_FINAL_RESEARCH_DEFINITIONS,
  bloomResearchDefinitions: VERTICAL_SLICE_BLOOM_RESEARCH_DEFINITIONS,
  researchFacilityStages: VERTICAL_SLICE_RESEARCH_FACILITY_STAGES,
  regions: VERTICAL_SLICE_REGIONS,
  stages: VERTICAL_SLICE_STAGES,
})

const INITIAL_BLUEPRINT_SPECIES = new Set<SpeciesId>([
  'species.slice.grassfang-rat',
  'species.slice.windwing-midge',
  'species.slice.moss-sprout',
  'species.slice.mudshell-beetle',
  'species.slice.ember-gecko',
  'species.slice.ancient-gear',
])

const initialSpeciesStates = VERTICAL_SLICE_SPECIES.map((species) =>
  Object.freeze({
    speciesId: species.id,
    blueprintUnlocked: INITIAL_BLUEPRINT_SPECIES.has(species.id),
    analysisBasisPoints: INITIAL_BLUEPRINT_SPECIES.has(species.id) ? 800 : 0,
    bloomSkillIds: Object.freeze([] as string[]),
    encyclopediaStageId: INITIAL_BLUEPRINT_SPECIES.has(species.id)
      ? 'encyclopedia-stage.5'
      : 'encyclopedia-stage.0',
    statistics: Object.freeze({}),
  }),
)

export const VERTICAL_SLICE_INITIAL_PLAYER_DATA: PlayerData = createStagePlayerData(
  {
    schemaVersion: 6,
    gameVersion: '0.0.0-t045',
    contentVersion: 'slice-t045',
    economy: {
      currency: 600,
      researchData: 120,
      catalysts: [
        { catalystId: 'catalyst.slice.wind', amount: 1 },
        { catalystId: 'catalyst.slice.earth', amount: 1 },
        { catalystId: 'catalyst.slice.fire', amount: 1 },
      ],
    },
    research: { nodes: [] },
    facilities: { researchFacilityStage: 1 },
    stageProgress: { completedStageIds: [], settledBattleIds: [], regionalPoints: [] },
    collection: {
      speciesStates: initialSpeciesStates,
      unitInstances: [
        {
          instanceId: 'unit.slice.grassfang-01',
          speciesId: 'species.slice.grassfang-rat',
          learnedGenericSkillIds: ['skill.slice.generic.light-strike'],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
        {
          instanceId: 'unit.slice.mudshell-01',
          speciesId: 'species.slice.mudshell-beetle',
          learnedGenericSkillIds: ['skill.slice.generic.guard-stance'],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
        {
          instanceId: 'unit.slice.windwing-01',
          speciesId: 'species.slice.windwing-midge',
          learnedGenericSkillIds: ['skill.slice.generic.long-shot'],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
        {
          instanceId: 'unit.slice.moss-01',
          speciesId: 'species.slice.moss-sprout',
          learnedGenericSkillIds: ['skill.slice.generic.minor-heal'],
          nickname: null,
          favorite: false,
          locked: false,
          conditionBasisPoints: 10_000,
        },
      ],
    },
    formations: {
      activeFormationId: 'formation.slice.starter',
      formations: [
        {
          formationId: 'formation.slice.starter',
          name: '初期観測班',
          members: [
            {
              instanceId: 'unit.slice.mudshell-01',
              position: { row: 0, column: 1 },
              loadout: { genericSkillId: 'skill.slice.generic.guard-stance', bloomSkillId: null },
              tiePriority: 0,
              ai: {
                individualStrategy: 'CAUTIOUS',
                teamStrategy: 'STABLE_CLEAR',
                skillPolicies: [],
              },
            },
            {
              instanceId: 'unit.slice.grassfang-01',
              position: { row: 1, column: 0 },
              loadout: { genericSkillId: 'skill.slice.generic.light-strike', bloomSkillId: null },
              tiePriority: 1,
              ai: { individualStrategy: 'ASSAULT', teamStrategy: 'FAST_KILL', skillPolicies: [] },
            },
            {
              instanceId: 'unit.slice.windwing-01',
              position: { row: 2, column: 1 },
              loadout: { genericSkillId: 'skill.slice.generic.long-shot', bloomSkillId: null },
              tiePriority: 2,
              ai: {
                individualStrategy: 'FIXED_TURRET',
                teamStrategy: 'STABLE_CLEAR',
                skillPolicies: [],
              },
            },
          ],
        },
      ],
    },
  },
  VERTICAL_SLICE_WORLD_CATALOG,
)

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

export function validateVerticalSliceWorld(): VerticalSliceWorldValidationSummary {
  const base = validateContentCatalog(VERTICAL_SLICE_WORLD_CATALOG, {
    genericSkillCosts: VERTICAL_SLICE_GENERIC_SKILL_COSTS,
  })
  assertUnique(
    VERTICAL_SLICE_RESEARCH_HINT_COPIES.map((hint) => hint.hintId),
    'T045 hint IDs',
  )
  assertUnique(
    VERTICAL_SLICE_ENEMY_FORMATION_TICKETS.map((ticket) => ticket.stageId),
    'T045 stage tickets',
  )

  const copyKeys = new Set(
    VERTICAL_SLICE_RESEARCH_HINT_COPIES.map((copy) => `${copy.nodeId}\u0000${copy.hintId}`),
  )
  for (const record of VERTICAL_SLICE_RESEARCH_RECORDS) {
    assertNonEmpty(record.displayName, `${record.definition.nodeId}.displayName`)
    for (const hint of record.definition.hints) {
      if (!copyKeys.has(`${record.definition.nodeId}\u0000${hint.hintId}`)) {
        throw new Error(`research hint copy is missing: ${record.definition.nodeId}/${hint.hintId}`)
      }
    }
  }

  for (const record of VERTICAL_SLICE_STAGE_RECORDS) {
    if (record.mechanicIds.length === 0)
      throw new Error(`stage mechanics are required: ${record.definition.stageId}`)
    for (const [field, value] of Object.entries(record.ticket)) {
      assertNonEmpty(String(value), `${record.definition.stageId}.ticket.${field}`)
    }
  }

  const requiredMechanics = [
    'action-order',
    'cover',
    'movement',
    'direct-range',
    'healing',
    'poison',
    'force-move',
    'burn',
    'burning-terrain',
    'barrier',
    'pierce',
    'time-delay',
    'telegraph',
    'summon',
  ]
  const authoredMechanics = new Set(
    VERTICAL_SLICE_STAGE_RECORDS.flatMap((record) => record.mechanicIds),
  )
  for (const mechanicId of requiredMechanics) {
    if (!authoredMechanics.has(mechanicId))
      throw new Error(`required T045 mechanic is not staged: ${mechanicId}`)
  }

  const regionAStages = VERTICAL_SLICE_STAGES.filter(
    (stage) => stage.regionId === 'region.slice-a',
  ).length
  const regionBStages = VERTICAL_SLICE_STAGES.filter(
    (stage) => stage.regionId === 'region.slice-b',
  ).length
  const regionBBosses = VERTICAL_SLICE_STAGES.filter(
    (stage) => stage.regionId === 'region.slice-b' && stage.kind === 'BOSS',
  ).length
  if (regionAStages !== 9 || regionBStages !== 8 || regionBBosses !== 2) {
    throw new Error(`T045 stage distribution must be A=9, B=8, B bosses=2`)
  }

  return Object.freeze({
    ...base,
    authoredResearchNodes: VERTICAL_SLICE_RESEARCH_RECORDS.length,
    hintTexts: VERTICAL_SLICE_RESEARCH_HINT_COPIES.length,
    hiddenResearchNodes: VERTICAL_SLICE_RESEARCH_RECORDS.filter((record) => record.hidden).length,
    stageTickets: VERTICAL_SLICE_ENEMY_FORMATION_TICKETS.length,
    regionAStages,
    regionBStages,
    regionBBosses,
    initialBlueprints: VERTICAL_SLICE_INITIAL_PLAYER_DATA.collection.speciesStates.filter(
      (state) => state.blueprintUnlocked,
    ).length,
    initialUnits: VERTICAL_SLICE_INITIAL_PLAYER_DATA.collection.unitInstances.length,
  })
}

export const VERTICAL_SLICE_WORLD_VALIDATION = validateVerticalSliceWorld()
