export interface GuidanceStep {
  readonly order: number
  readonly title: string
  readonly detail: string
  readonly destination: 'REGION' | 'COLLECTION' | 'RESEARCH'
}

export const FIRST_EXPEDITION_STEPS: readonly GuidanceStep[] = Object.freeze([
  Object.freeze({
    order: 1,
    title: '編成を確認する',
    detail: '初期個体の配置、行動優先度、装備技を確認します。迷った場合は初期編成のままで進められます。',
    destination: 'COLLECTION',
  }),
  Object.freeze({
    order: 2,
    title: '最初の地域へ出撃する',
    detail: '翠風観測原の導入戦で、行動順と軽い技の価値を確認します。',
    destination: 'REGION',
  }),
  Object.freeze({
    order: 3,
    title: '解析結果を研究へつなぐ',
    detail: '戦闘で得た解析度と研究データを使い、研究網の情報を開示します。',
    destination: 'RESEARCH',
  }),
])

export type ConfirmOperation = 'OVERWRITE_SAVE' | 'LOAD_SAVE' | 'DELETE_SAVE' | 'IMPORT_SAVE'

export interface ConfirmationCopy {
  readonly title: string
  readonly detail: string
  readonly confirmLabel: string
  readonly tone: 'STANDARD' | 'DANGER'
}

export function confirmationCopy(operation: ConfirmOperation, target: string): ConfirmationCopy {
  switch (operation) {
    case 'OVERWRITE_SAVE':
      return Object.freeze({
        title: `${target}を上書きしますか？`,
        detail: '現在保存されている進行はバックアップ世代へ移動します。操作後は元の現在世代へ直接戻せません。',
        confirmLabel: '上書きして保存',
        tone: 'DANGER',
      })
    case 'LOAD_SAVE':
      return Object.freeze({
        title: `${target}をロードしますか？`,
        detail: '画面上の未保存進行と中断中の戦闘は破棄され、選択したスロットの状態へ切り替わります。',
        confirmLabel: 'ロードする',
        tone: 'DANGER',
      })
    case 'DELETE_SAVE':
      return Object.freeze({
        title: `${target}を削除しますか？`,
        detail: '現在世代と全バックアップを削除します。この操作は取り消せません。',
        confirmLabel: '完全に削除',
        tone: 'DANGER',
      })
    case 'IMPORT_SAVE':
      return Object.freeze({
        title: 'JSONを使用中スロットへ読み込みますか？',
        detail: 'JSONの検証後、使用中スロットをインポート内容で置き換えます。現在世代はバックアップへ移動します。',
        confirmLabel: '検証して読み込む',
        tone: 'DANGER',
      })
  }
}

export function shouldShowFirstExpeditionGuide(completedStageCount: number): boolean {
  return completedStageCount === 0
}
