import {
  createPlayerData,
  type PlayerData,
  type PlayerDataContentCatalog,
} from '../progression/player-data'
import {
  PLAYER_SAVE_SLOT_IDS,
  assertValidPlayerSaveSlotId,
  type PlayerDataRepository,
  type PlayerSaveSlotId,
} from './player-data-repository'

export type InitialPlayerDataEntry = readonly [PlayerSaveSlotId, PlayerData]

export class MemoryPlayerDataRepository implements PlayerDataRepository {
  readonly #contentCatalog: PlayerDataContentCatalog
  readonly #slots = new Map<PlayerSaveSlotId, PlayerData>()

  constructor(
    contentCatalog: PlayerDataContentCatalog,
    initialEntries: readonly InitialPlayerDataEntry[] = [],
  ) {
    this.#contentCatalog = contentCatalog
    for (const [slotId, playerData] of initialEntries) {
      assertValidPlayerSaveSlotId(slotId)
      if (this.#slots.has(slotId)) {
        throw new Error(`initial player save slot must be unique: ${slotId}`)
      }
      this.#slots.set(slotId, createPlayerData(playerData, this.#contentCatalog))
    }
  }

  async listSlots(): Promise<readonly PlayerSaveSlotId[]> {
    return Object.freeze(PLAYER_SAVE_SLOT_IDS.filter((slotId) => this.#slots.has(slotId)))
  }

  async load(slotId: PlayerSaveSlotId): Promise<PlayerData | null> {
    assertValidPlayerSaveSlotId(slotId)
    const playerData = this.#slots.get(slotId)
    return playerData === undefined
      ? null
      : createPlayerData(playerData, this.#contentCatalog)
  }

  async save(slotId: PlayerSaveSlotId, playerData: PlayerData): Promise<void> {
    assertValidPlayerSaveSlotId(slotId)
    this.#slots.set(slotId, createPlayerData(playerData, this.#contentCatalog))
  }

  async delete(slotId: PlayerSaveSlotId): Promise<void> {
    assertValidPlayerSaveSlotId(slotId)
    this.#slots.delete(slotId)
  }
}
