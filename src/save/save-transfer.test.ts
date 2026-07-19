import { describe, expect, it } from 'vitest'
import { createInteractiveBattleRunner } from '../battle/interactive-battle-runner'
import {
  T039_INITIAL_PLAYER_DATA,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import { STANDARD_HEADLESS_BATTLE } from '../demo/standard-headless-battle'
import { calculateCanonicalJsonChecksum } from './save-model'
import { SAVED_BATTLE_SESSION_VERSION, type SavedBattleSession } from './save-state'
import {
  exportSaveTransferJson,
  importSaveTransferJson,
  type SaveTransferDocument,
} from './save-transfer'

function createActiveBattle(): SavedBattleSession {
  const runner = createInteractiveBattleRunner(STANDARD_HEADLESS_BATTLE)
  runner.step()
  runner.step()
  return Object.freeze({
    saveVersion: SAVED_BATTLE_SESSION_VERSION,
    stageId: 'stage.demo-forest-01',
    serial: 7,
    attempt: 1,
    fastModeAvailable: false,
    definition: STANDARD_HEADLESS_BATTLE,
    stableSnapshot: runner.getStableSnapshot(),
  })
}

describe('save JSON transfer', () => {
  it('round-trips PlayerData and an active stable battle snapshot', () => {
    const json = exportSaveTransferJson(
      { playerData: T039_INITIAL_PLAYER_DATA, activeBattle: createActiveBattle() },
      T039_PLAYER_CATALOG,
      12345,
    )
    const imported = importSaveTransferJson(json, T039_PLAYER_CATALOG)

    expect(imported.playerData).toEqual(T039_INITIAL_PLAYER_DATA)
    expect(imported.activeBattle?.stageId).toBe('stage.demo-forest-01')
    expect(imported.activeBattle?.stableSnapshot.totalActions).toBe(2)
    expect(imported.exportedAtEpochMs).toBe(12345)
  })

  it('rejects a payload modified without updating its checksum', () => {
    const document = JSON.parse(
      exportSaveTransferJson(
        { playerData: T039_INITIAL_PLAYER_DATA, activeBattle: null },
        T039_PLAYER_CATALOG,
        12345,
      ),
    ) as SaveTransferDocument
    const tampered = {
      ...document,
      payload: {
        ...document.payload,
        playerData: {
          ...document.payload.playerData,
          economy: { ...document.payload.playerData.economy, currency: 999999 },
        },
      },
    }

    expect(() => importSaveTransferJson(JSON.stringify(tampered), T039_PLAYER_CATALOG)).toThrow(
      'checksum mismatch',
    )
  })

  it('migrates an older schema after validating the transfer checksum', () => {
    const document = JSON.parse(
      exportSaveTransferJson(
        { playerData: T039_INITIAL_PLAYER_DATA, activeBattle: null },
        T039_PLAYER_CATALOG,
        12345,
      ),
    ) as SaveTransferDocument
    const legacyPayload = {
      ...document.payload,
      playerData: { ...document.payload.playerData, schemaVersion: 5 },
    }
    const legacyDocument = {
      ...document,
      payload: legacyPayload,
      checksum: calculateCanonicalJsonChecksum(legacyPayload),
    }
    const imported = importSaveTransferJson(JSON.stringify(legacyDocument), T039_PLAYER_CATALOG)

    expect(imported.originalSchemaVersion).toBe(5)
    expect(imported.playerData.schemaVersion).toBe(6)
    expect(imported.appliedMigrations).toEqual([{ fromVersion: 5, toVersion: 6 }])
  })
})
