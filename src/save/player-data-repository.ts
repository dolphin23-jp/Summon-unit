import type { PlayerData } from '../progression/player-data'

export const PLAYER_SAVE_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'] as const
export type PlayerSaveSlotId = (typeof PLAYER_SAVE_SLOT_IDS)[number]

export interface PlayerDataRepository {
  listSlots(): Promise<readonly PlayerSaveSlotId[]>
  load(slotId: PlayerSaveSlotId): Promise<PlayerData | null>
  save(slotId: PlayerSaveSlotId, playerData: PlayerData): Promise<void>
  delete(slotId: PlayerSaveSlotId): Promise<void>
}

export function assertValidPlayerSaveSlotId(slotId: PlayerSaveSlotId): void {
  if (!PLAYER_SAVE_SLOT_IDS.includes(slotId)) {
    throw new Error(`invalid player save slot id: ${slotId}`)
  }
}
