export const UX_GUIDANCE_STORAGE_KEY = 'summon-unit.ux-guidance.v1'
export const UX_GUIDANCE_VERSION = 1

export type UxHelpContext =
  | 'HOME'
  | 'REGION'
  | 'COLLECTION'
  | 'RESEARCH'
  | 'SUMMON'
  | 'SAVE'
  | 'BATTLE'

export interface UxGuidanceState {
  readonly version: number
  readonly firstRunCompleted: boolean
}

export interface UxGuidanceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface FirstRunStep {
  readonly title: string
  readonly summary: string
  readonly detail: string
}

export interface GlossaryEntry {
  readonly term: string
  readonly category: '進行' | '研究' | '戦闘'
  readonly definition: string
}

export interface ScreenHelp {
  readonly title: string
  readonly summary: string
  readonly actions: readonly string[]
}

export const DEFAULT_UX_GUIDANCE_STATE: UxGuidanceState = Object.freeze({
  version: UX_GUIDANCE_VERSION,
  firstRunCompleted: false,
})

export const FIRST_RUN_STEPS: readonly FirstRunStep[] = Object.freeze([
  Object.freeze({
    title: '観測拠点から準備する',
    summary: '編成、出撃、研究、召喚を一つの循環として進めます。',
    detail: '最初は「編成・図鑑」で3体まで配置し、行動方針と装備技を確認します。',
  }),
  Object.freeze({
    title: '地域で課題を選ぶ',
    summary: '各ステージは一つずつ戦術を教える順番になっています。',
    detail: 'ロック条件とFIELD GUIDANCEを読み、クリア済みなら高速化や即時シミュレーションも使えます。',
  }),
  Object.freeze({
    title: '戦闘はAUTOから始めてよい',
    summary: 'AUTO、1行動進行、手動割込をいつでも切り替えられます。',
    detail: '予兆、遮蔽、障壁、次回行動を見ながら、必要な場面だけ手動で介入してください。',
  }),
  Object.freeze({
    title: '観測結果を研究と召喚へ戻す',
    summary: '解析度と研究データで研究を進め、設計図から新しい個体を召喚します。',
    detail: '資源や標本を消費する操作は、実行前に共通の確認画面が表示されます。',
  }),
])

export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = Object.freeze([
  Object.freeze({ term: '基本通貨', category: '進行', definition: '召喚、技習得、施設更新、開花研究に使う共通資源です。' }),
  Object.freeze({ term: '研究データ', category: '研究', definition: '試験研究、確定研究、施設更新、開花研究に使う研究資源です。' }),
  Object.freeze({ term: '触媒', category: '研究', definition: '研究条件や確定研究で要求される属性・特殊素材です。' }),
  Object.freeze({ term: '解析度', category: '研究', definition: '敵の観測や戦闘結果などで増え、図鑑開示と開花研究条件に使われます。0〜10000で管理します。' }),
  Object.freeze({ term: '開示段階', category: '研究', definition: '研究ノードや図鑑情報がどこまで判明しているかを0〜5で示します。' }),
  Object.freeze({ term: '設計図', category: '研究', definition: '確定研究で永久解放され、同じ種を何度でも召喚できるようになります。' }),
  Object.freeze({ term: '開花技', category: '研究', definition: '高い解析度と資源を使う開花研究で、同種すべての個体へ解放する特別技です。' }),
  Object.freeze({ term: '行動コスト', category: '戦闘', definition: '技や移動の重さです。大きいほど、そのユニットの次の行動が遅くなります。' }),
  Object.freeze({ term: '次回行動', category: '戦闘', definition: 'タイムライン上で次に行動できる仮想時刻と順位です。' }),
  Object.freeze({ term: '遮蔽', category: '戦闘', definition: '直線攻撃が前列のユニットで止まり、後方の対象へ届かない仕組みです。' }),
  Object.freeze({ term: '障壁', category: '戦闘', definition: 'HPより先にダメージを受ける一時的な耐久値です。' }),
  Object.freeze({ term: '肩代わり', category: '戦闘', definition: '守護役が味方へのダメージの一部を受け持つ効果です。' }),
  Object.freeze({ term: '予兆', category: '戦闘', definition: '後の時刻に発動する攻撃や危険範囲の予約表示です。' }),
  Object.freeze({ term: '即時シミュレーション', category: '進行', definition: 'クリア済みステージを画面内戦闘なしで決定論的に精算する機能です。' }),
])

export const SCREEN_HELP: Readonly<Record<UxHelpContext, ScreenHelp>> = Object.freeze({
  HOME: Object.freeze({
    title: '観測拠点',
    summary: '現在資源を確認し、次に行う準備・出撃・研究を選ぶ起点です。',
    actions: Object.freeze(['初回は編成を確認する', '地域観測で最初の課題へ進む', '進行はセーブスロットで管理する']),
  }),
  REGION: Object.freeze({
    title: '地域・ステージ',
    summary: '解放条件、報酬、敵編成、学習テーマを確認して出撃します。',
    actions: Object.freeze(['FIELD GUIDANCEを読む', '出撃編成を確認する', 'クリア後は高速化を利用する']),
  }),
  COLLECTION: Object.freeze({
    title: '編成・技習得・図鑑',
    summary: '所持個体の配置、AI方針、技装備、図鑑情報を管理します。',
    actions: Object.freeze(['3×3盤面へ配置する', '固有・汎用・開花技を確認する', '解析度で図鑑情報を開く']),
  }),
  RESEARCH: Object.freeze({
    title: '研究網・施設',
    summary: 'ヒントを集め、試験研究で条件を照合し、確定研究で設計図を解放します。',
    actions: Object.freeze(['開示段階を確認する', '試験研究は標本と触媒を消費しない', '確定研究の消費物を確認する']),
  }),
  SUMMON: Object.freeze({
    title: '設計図召喚',
    summary: '解放済み設計図から、抽選や待機なしで新しい個体を追加します。',
    actions: Object.freeze(['所持数と召喚費を比較する', '確認画面で消費通貨を確認する', '召喚後は編成へ戻る']),
  }),
  SAVE: Object.freeze({
    title: 'セーブ管理',
    summary: 'IndexedDBの3スロット、バックアップ、JSON移送を管理します。',
    actions: Object.freeze(['上書き・ロード・削除は確認後に実行する', '使用中スロットは削除できない', 'JSON読込は使用中スロットを置換する']),
  }),
  BATTLE: Object.freeze({
    title: '戦闘画面',
    summary: '6×3盤面、タイムライン、予兆、確定前プレビュー、AI理由を同時に確認します。',
    actions: Object.freeze(['まずAUTOで流れを見る', '危険な行動前だけ手動割込する', 'リセットや途中離脱は確認して実行する']),
  }),
})

export function loadUxGuidanceState(storage: UxGuidanceStorage): UxGuidanceState {
  let raw: string | null
  try {
    raw = storage.getItem(UX_GUIDANCE_STORAGE_KEY)
  } catch {
    return DEFAULT_UX_GUIDANCE_STATE
  }
  if (raw === null) return DEFAULT_UX_GUIDANCE_STATE
  try {
    const parsed = JSON.parse(raw) as Partial<UxGuidanceState>
    if (parsed.version !== UX_GUIDANCE_VERSION || typeof parsed.firstRunCompleted !== 'boolean') {
      return DEFAULT_UX_GUIDANCE_STATE
    }
    return Object.freeze({ version: UX_GUIDANCE_VERSION, firstRunCompleted: parsed.firstRunCompleted })
  } catch {
    return DEFAULT_UX_GUIDANCE_STATE
  }
}

export function storeUxGuidanceState(
  storage: UxGuidanceStorage,
  state: UxGuidanceState,
): void {
  if (state.version !== UX_GUIDANCE_VERSION || typeof state.firstRunCompleted !== 'boolean') {
    throw new Error('UX guidance state is invalid')
  }
  storage.setItem(UX_GUIDANCE_STORAGE_KEY, JSON.stringify(state))
}

export function completeFirstRunGuide(storage: UxGuidanceStorage): UxGuidanceState {
  const next = Object.freeze({ version: UX_GUIDANCE_VERSION, firstRunCompleted: true })
  storeUxGuidanceState(storage, next)
  return next
}

export function createBrowserUxGuidanceStorage(): UxGuidanceStorage | null {
  if (typeof window === 'undefined') return null
  return Object.freeze({
    getItem(key: string): string | null {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem(key: string, value: string): void {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // The guide still works for the current session when storage is unavailable.
      }
    },
  })
}

export interface UxGuidanceValidationSummary {
  readonly steps: number
  readonly glossaryEntries: number
  readonly contexts: number
}

export function validateUxGuidanceContent(): UxGuidanceValidationSummary {
  if (FIRST_RUN_STEPS.length < 3) throw new Error('first-run guidance requires at least three steps')
  const terms = new Set<string>()
  for (const entry of GLOSSARY_ENTRIES) {
    if (entry.term.trim().length === 0 || entry.definition.trim().length === 0) {
      throw new Error('glossary terms and definitions must be non-empty')
    }
    if (terms.has(entry.term)) throw new Error(`glossary term must be unique: ${entry.term}`)
    terms.add(entry.term)
  }
  const contexts = Object.keys(SCREEN_HELP) as UxHelpContext[]
  if (contexts.length !== 7) throw new Error('all seven UX help contexts must be authored')
  for (const context of contexts) {
    const help = SCREEN_HELP[context]
    if (help.title.trim().length === 0 || help.summary.trim().length === 0 || help.actions.length === 0) {
      throw new Error(`screen help must be complete: ${context}`)
    }
  }
  return Object.freeze({
    steps: FIRST_RUN_STEPS.length,
    glossaryEntries: GLOSSARY_ENTRIES.length,
    contexts: contexts.length,
  })
}

export const UX_GUIDANCE_VALIDATION = validateUxGuidanceContent()
