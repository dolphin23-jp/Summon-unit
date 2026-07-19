from pathlib import Path


def patch(path: str, replacements: list[tuple[str, str]]) -> None:
    file = Path(path)
    text = file.read_text()
    for old, new in replacements:
        if old not in text:
            raise RuntimeError(f'pattern not found in {path}: {old[:100]!r}')
        text = text.replace(old, new, 1)
    file.write_text(text)


patch('src/save/save-model.ts', [
    (
        "import { createStagePlayerData } from '../progression/stage-reward'\n",
        "import { createStagePlayerData } from '../progression/stage-reward'\nimport { normalizeSavedBattleSession, type SavedBattleSession } from './save-state'\n",
    ),
    (
        """  readonly checksum: string
  readonly playerData: PlayerData
}""",
        """  readonly checksum: string
  readonly playerData: PlayerData
  readonly activeBattle?: SavedBattleSession | null
  readonly activeBattleChecksum?: string | null
}""",
    ),
    (
        '  readonly recoveredFromBackup: boolean\n}',
        '  readonly recoveredFromBackup: boolean\n  readonly resumableBattleStageId: string | null\n}',
    ),
    (
        """  readonly playerData: PlayerData
  readonly state?: SaveGenerationState
}""",
        """  readonly playerData: PlayerData
  readonly activeBattle?: SavedBattleSession | null
  readonly state?: SaveGenerationState
}""",
    ),
    (
        'export function calculatePlayerDataChecksum(',
        """function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson)
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key]
      if (child !== undefined) result[key] = canonicalizeJson(child)
    }
    return result
  }
  return value
}

export function calculateCanonicalJsonChecksum(value: unknown): string {
  const json = JSON.stringify(canonicalizeJson(value))
  if (json === undefined) throw new Error('value must be JSON serializable')
  return calculateChecksumFromJson(json)
}

export function calculatePlayerDataChecksum(""",
    ),
    (
        """  const playerData = createStagePlayerData(input.playerData, catalog)
  return Object.freeze({
    generationId: input.generationId,
    slotId: input.slotId,
    savedAtEpochMs: input.savedAtEpochMs,
    state,
    checksum: calculateStoredPlayerDataChecksum(playerData),
    playerData,
  })""",
        """  const playerData = createStagePlayerData(input.playerData, catalog)
  const activeBattle =
    input.activeBattle === null || input.activeBattle === undefined
      ? null
      : normalizeSavedBattleSession(input.activeBattle)
  return Object.freeze({
    generationId: input.generationId,
    slotId: input.slotId,
    savedAtEpochMs: input.savedAtEpochMs,
    state,
    checksum: calculateStoredPlayerDataChecksum(playerData),
    playerData,
    activeBattle,
    activeBattleChecksum:
      activeBattle === null ? null : calculateCanonicalJsonChecksum(activeBattle),
  })""",
    ),
    (
        """  const checksum = calculateStoredPlayerDataChecksum(record.playerData)
  if (record.checksum !== checksum) {
    throw new Error(`save generation checksum mismatch: ${record.generationId}`)
  }
  return record""",
        """  const checksum = calculateStoredPlayerDataChecksum(record.playerData)
  if (record.checksum !== checksum) {
    throw new Error(`save generation checksum mismatch: ${record.generationId}`)
  }
  const activeBattle = record.activeBattle ?? null
  const activeBattleChecksum = record.activeBattleChecksum ?? null
  if (activeBattle === null && activeBattleChecksum !== null) {
    throw new Error(`save generation battle checksum has no battle: ${record.generationId}`)
  }
  if (activeBattle !== null && activeBattleChecksum === null) {
    throw new Error(`save generation battle checksum is missing: ${record.generationId}`)
  }
  const normalizedActiveBattle =
    activeBattle === null ? null : normalizeSavedBattleSession(activeBattle)
  if (
    normalizedActiveBattle !== null &&
    calculateCanonicalJsonChecksum(activeBattle) !== activeBattleChecksum
  ) {
    throw new Error(`save generation battle checksum mismatch: ${record.generationId}`)
  }
  return Object.freeze({
    ...record,
    activeBattle: normalizedActiveBattle,
    activeBattleChecksum,
  })""",
    ),
    (
        """      state: envelope.state,
      playerData: envelope.playerData,
    },""",
        """      state: envelope.state,
      playerData: envelope.playerData,
      activeBattle: envelope.activeBattle ?? null,
    },""",
    ),
    (
        '    recoveredFromBackup: false,\n  })',
        '    recoveredFromBackup: false,\n    resumableBattleStageId: null,\n  })',
    ),
    (
        '    recoveredFromBackup,\n  })',
        '    recoveredFromBackup,\n    resumableBattleStageId: record.activeBattle?.stageId ?? null,\n  })',
    ),
])

patch('src/save/save-repository.ts', [
    (
        "import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'\n",
        "import type { PlayerData, PlayerDataContentCatalog } from '../progression/player-data'\nimport type { SavedBattleSession } from './save-state'\n",
    ),
    (
        '  readonly preferredBackupGenerationId?: string\n}',
        '  readonly preferredBackupGenerationId?: string\n  readonly activeBattle?: SavedBattleSession | null\n}',
    ),
    (
        """  readonly record: SaveGenerationRecord
  readonly pointer: SaveSlotPointer
}""",
        """  readonly record: SaveGenerationRecord
  readonly pointer: SaveSlotPointer
  readonly activeBattle: SavedBattleSession | null
}""",
    ),
    (
        '  readonly migration: SaveSlotMigrationReceipt | null\n}',
        '  readonly migration: SaveSlotMigrationReceipt | null\n  readonly activeBattle: SavedBattleSession | null\n}',
    ),
    (
        """      playerData,
      state: 'TEMPORARY',""",
        """      playerData,
      activeBattle: input.activeBattle ?? null,
      state: 'TEMPORARY',""",
    ),
    (
        '    return Object.freeze({ playerData: record.playerData, record, pointer })',
        """    return Object.freeze({
      playerData: record.playerData,
      record,
      pointer,
      activeBattle: record.activeBattle ?? null,
    })""",
    ),
    (
        """          recoveredFromBackup: index > 0,
          migration: null,
        })""",
        """          recoveredFromBackup: index > 0,
          migration: null,
          activeBattle: validated.activeBattle ?? null,
        })""",
    ),
    (
        """          savedAtEpochMs,
          preferredBackupGenerationId: envelope.generationId,
        },""",
        """          savedAtEpochMs,
          preferredBackupGenerationId: envelope.generationId,
          activeBattle: envelope.activeBattle ?? null,
        },""",
    ),
    (
        """        migration: Object.freeze({
          sourceGenerationId: envelope.generationId,
          backupGenerationId: envelope.generationId,
          fromSchemaVersion: migrated.originalSchemaVersion,
          toSchemaVersion: migrationPlan.targetSchemaVersion,
          appliedMigrations: migrated.appliedMigrations,
        }),
      })""",
        """        migration: Object.freeze({
          sourceGenerationId: envelope.generationId,
          backupGenerationId: envelope.generationId,
          fromSchemaVersion: migrated.originalSchemaVersion,
          toSchemaVersion: migrationPlan.targetSchemaVersion,
          appliedMigrations: migrated.appliedMigrations,
        }),
        activeBattle: saved.activeBattle,
      })""",
    ),
])

patch('src/save/browser-save-runtime.ts', [
    (
        "import { type SaveSlotId, type SaveSlotSummary } from './save-model'\n",
        "import { type SaveSlotId, type SaveSlotSummary } from './save-model'\nimport type { SavedBattleSession } from './save-state'\n",
    ),
    (
        '  readonly migration: SaveSlotMigrationReceipt | null\n}',
        '  readonly migration: SaveSlotMigrationReceipt | null\n  readonly activeBattle: SavedBattleSession | null\n}',
    ),
    (
        '  let migration: SaveSlotMigrationReceipt | null = null\n  if (loaded === null) {',
        '  let migration: SaveSlotMigrationReceipt | null = null\n  let activeBattle: SavedBattleSession | null = null\n  if (loaded === null) {',
    ),
    (
        '    migration = loaded.migration\n  }',
        '    migration = loaded.migration\n    activeBattle = loaded.activeBattle\n  }',
    ),
    (
        '    migration,\n  })',
        '    migration,\n    activeBattle,\n  })',
    ),
])
