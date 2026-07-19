from pathlib import Path

PATH = Path('src/battle/interactive-battle-runner.ts')
text = PATH.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'runner pattern not found: {old[:100]!r}')
    text = text.replace(old, new, 1)


replace_once(
    "import {\n  createInitialUnitActionSchedule,",
    "import {\n  assertValidUnitActionSchedule,\n  createInitialUnitActionSchedule,",
)
replace_once(
    "import {\n  canUseSkillWithUsageState,",
    "import {\n  assertValidSkillUsageBook,\n  canUseSkillWithUsageState,",
)
replace_once(
    "import {\n  EMPTY_WAIT_ACTION_STATE,\n  performWaitAction,",
    "import {\n  EMPTY_WAIT_ACTION_STATE,\n  assertValidWaitActionState,\n  performWaitAction,",
)
replace_once(
    """export type InteractiveBattleListener = (snapshot: InteractiveBattleSnapshot) => void

export interface InteractiveBattleRunner {
  getSnapshot(): InteractiveBattleSnapshot""",
    """export const INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION = 1

export interface InteractiveBattleRuntimeEntry<T> {
  readonly battleUnitId: BattleUnitId
  readonly value: T
}

export interface InteractiveBattleStableSnapshot {
  readonly snapshotVersion: typeof INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION
  readonly battle: BattleState
  readonly log: BattleEventLog
  readonly currentVirtualTime: BattleTime
  readonly totalActions: number
  readonly manualAllyActionRequested: boolean
  readonly lastDecisionLog: AiDecisionReasonLog | null
  readonly bossPhase: BossPhaseRuntimeState | null
  readonly nextTimelineSequence: number
  readonly schedules: readonly UnitActionSchedule[]
  readonly waitStates: readonly InteractiveBattleRuntimeEntry<WaitActionState>[]
  readonly skillUsageBooks: readonly InteractiveBattleRuntimeEntry<SkillUsageBook>[]
  readonly skillIdsByBattleUnitId: readonly InteractiveBattleRuntimeEntry<readonly string[]>[]
  readonly recentPositionIds: readonly InteractiveBattleRuntimeEntry<readonly string[]>[]
}

export type InteractiveBattleListener = (snapshot: InteractiveBattleSnapshot) => void

export interface InteractiveBattleRunner {
  getSnapshot(): InteractiveBattleSnapshot
  getStableSnapshot(): InteractiveBattleStableSnapshot""",
)
helpers = """function createRuntimeEntries<T>(
  values: ReadonlyMap<BattleUnitId, T>,
): readonly InteractiveBattleRuntimeEntry<T>[] {
  return Object.freeze(
    [...values.entries()]
      .sort(([left], [right]) => compareIds(left, right))
      .map(([battleUnitId, value]) => Object.freeze({ battleUnitId, value })),
  )
}

function restoreRuntimeEntries<T>(input: {
  readonly entries: readonly InteractiveBattleRuntimeEntry<T>[]
  readonly expectedBattleUnitIds: ReadonlySet<BattleUnitId>
  readonly field: string
  readonly validate: (value: T, battleUnitId: BattleUnitId) => void
}): Map<BattleUnitId, T> {
  if (input.entries.length !== input.expectedBattleUnitIds.size) {
    throw new Error(`${input.field} must contain every battle unit exactly once`)
  }
  const restored = new Map<BattleUnitId, T>()
  for (const entry of input.entries) {
    if (!input.expectedBattleUnitIds.has(entry.battleUnitId)) {
      throw new Error(`${input.field} references unknown unit: ${entry.battleUnitId}`)
    }
    if (restored.has(entry.battleUnitId)) {
      throw new Error(`${input.field} contains duplicate unit: ${entry.battleUnitId}`)
    }
    input.validate(entry.value, entry.battleUnitId)
    restored.set(entry.battleUnitId, entry.value)
  }
  return restored
}

"""
replace_once(
    'class InteractiveBattleRunnerImpl implements InteractiveBattleRunner {',
    helpers + 'class InteractiveBattleRunnerImpl implements InteractiveBattleRunner {',
)
replace_once(
    '  constructor(definition: HeadlessBattleDefinition) {',
    """  constructor(
    definition: HeadlessBattleDefinition,
    stableSnapshot?: InteractiveBattleStableSnapshot,
  ) {""",
)
replace_once(
    """      this.setBossActionSkills(this.bossPhase.actionSkillIds)
    }
  }

  getSnapshot(): InteractiveBattleSnapshot {""",
    """      this.setBossActionSkills(this.bossPhase.actionSkillIds)
    }
    if (stableSnapshot !== undefined) {
      this.restoreStableSnapshot(stableSnapshot)
    }
  }

  getSnapshot(): InteractiveBattleSnapshot {""",
)
stable_method = """
  getStableSnapshot(): InteractiveBattleStableSnapshot {
    if (this.pendingManualExecution !== null) {
      throw new Error('cannot capture a stable snapshot during manual action selection')
    }
    return Object.freeze({
      snapshotVersion: INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION,
      battle: this.battle,
      log: this.log,
      currentVirtualTime: this.currentVirtualTime,
      totalActions: this.totalActions,
      manualAllyActionRequested: this.manualAllyActionRequested,
      lastDecisionLog: this.lastDecisionLog,
      bossPhase: this.bossPhase,
      nextTimelineSequence: this.nextTimelineSequence,
      schedules: Object.freeze(
        [...this.context.schedules.values()].sort((left, right) =>
          compareIds(left.battleUnitId, right.battleUnitId),
        ),
      ),
      waitStates: createRuntimeEntries(this.context.waitStates),
      skillUsageBooks: createRuntimeEntries(this.context.skillUsageBooks),
      skillIdsByBattleUnitId: createRuntimeEntries(this.context.skillIdsByBattleUnitId),
      recentPositionIds: createRuntimeEntries(this.context.recentPositionIds),
    })
  }

"""
replace_once(
    '  subscribe(listener: InteractiveBattleListener): () => void {',
    stable_method + '  subscribe(listener: InteractiveBattleListener): () => void {',
)
restore_method = """
  private restoreStableSnapshot(snapshot: InteractiveBattleStableSnapshot): void {
    if (snapshot.snapshotVersion !== INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION) {
      throw new Error(`unsupported battle snapshot version: ${String(snapshot.snapshotVersion)}`)
    }
    assertSafeIntegerAtLeast(snapshot.currentVirtualTime, 0, 'snapshot currentVirtualTime')
    assertSafeIntegerAtLeast(snapshot.totalActions, 0, 'snapshot totalActions')
    assertSafeIntegerAtLeast(snapshot.nextTimelineSequence, 0, 'snapshot nextTimelineSequence')
    if (typeof snapshot.manualAllyActionRequested !== 'boolean') {
      throw new Error('snapshot manualAllyActionRequested must be boolean')
    }
    assertValidBattleState(snapshot.battle)
    const expectedBattleUnitIds = new Set(this.battle.units.map((unit) => unit.battleUnitId))
    const restoredBattleUnitIds = new Set(snapshot.battle.units.map((unit) => unit.battleUnitId))
    if (
      expectedBattleUnitIds.size !== restoredBattleUnitIds.size ||
      [...expectedBattleUnitIds].some((battleUnitId) => !restoredBattleUnitIds.has(battleUnitId))
    ) {
      throw new Error('snapshot battle units do not match the battle definition')
    }
    if (snapshot.schedules.length !== expectedBattleUnitIds.size) {
      throw new Error('snapshot schedules must contain every battle unit exactly once')
    }
    const schedules = new Map<BattleUnitId, UnitActionSchedule>()
    for (const schedule of snapshot.schedules) {
      assertValidUnitActionSchedule(schedule)
      if (!expectedBattleUnitIds.has(schedule.battleUnitId)) {
        throw new Error(`snapshot schedule references unknown unit: ${schedule.battleUnitId}`)
      }
      if (schedules.has(schedule.battleUnitId)) {
        throw new Error(`snapshot schedules contain duplicate unit: ${schedule.battleUnitId}`)
      }
      schedules.set(schedule.battleUnitId, schedule)
    }
    const waitStates = restoreRuntimeEntries({
      entries: snapshot.waitStates,
      expectedBattleUnitIds,
      field: 'snapshot waitStates',
      validate: (value) => assertValidWaitActionState(value),
    })
    const skillUsageBooks = restoreRuntimeEntries({
      entries: snapshot.skillUsageBooks,
      expectedBattleUnitIds,
      field: 'snapshot skillUsageBooks',
      validate: (value) => assertValidSkillUsageBook(value),
    })
    const skillIdsByBattleUnitId = restoreRuntimeEntries({
      entries: snapshot.skillIdsByBattleUnitId,
      expectedBattleUnitIds,
      field: 'snapshot skillIdsByBattleUnitId',
      validate: (value, battleUnitId) => {
        if (value.length === 0 || new Set(value).size !== value.length) {
          throw new Error(`snapshot skill loadout is invalid: ${battleUnitId}`)
        }
        for (const skillId of value) getRequiredSkill(this.context.skillById, skillId)
      },
    })
    const recentPositionIds = restoreRuntimeEntries({
      entries: snapshot.recentPositionIds,
      expectedBattleUnitIds,
      field: 'snapshot recentPositionIds',
      validate: (value, battleUnitId) => {
        if (value.length === 0 || value.some((positionId) => positionId.trim().length === 0)) {
          throw new Error(`snapshot recent positions are invalid: ${battleUnitId}`)
        }
      },
    })
    if ((this.bossDefinition === null) !== (snapshot.bossPhase === null)) {
      throw new Error('snapshot boss phase does not match the battle definition')
    }
    this.battle = snapshot.battle
    this.log = snapshot.log
    this.currentVirtualTime = snapshot.currentVirtualTime
    this.totalActions = snapshot.totalActions
    this.manualAllyActionRequested = snapshot.manualAllyActionRequested
    this.pendingManualExecution = null
    this.lastDecisionLog = snapshot.lastDecisionLog
    this.bossPhase = snapshot.bossPhase
    this.nextTimelineSequence = snapshot.nextTimelineSequence
    this.context.schedules.clear()
    for (const [battleUnitId, value] of schedules) this.context.schedules.set(battleUnitId, value)
    this.context.waitStates.clear()
    for (const [battleUnitId, value] of waitStates) this.context.waitStates.set(battleUnitId, value)
    this.context.skillUsageBooks.clear()
    for (const [battleUnitId, value] of skillUsageBooks) {
      this.context.skillUsageBooks.set(battleUnitId, value)
    }
    this.context.skillIdsByBattleUnitId.clear()
    for (const [battleUnitId, value] of skillIdsByBattleUnitId) {
      this.context.skillIdsByBattleUnitId.set(battleUnitId, Object.freeze([...value]))
    }
    this.context.recentPositionIds.clear()
    for (const [battleUnitId, value] of recentPositionIds) {
      this.context.recentPositionIds.set(battleUnitId, Object.freeze([...value]))
    }
  }

"""
replace_once(runner if False else '  private executeDecision(', restore_method + '  private executeDecision(')
replace_once(
    """export function createInteractiveBattleRunner(
  definition: HeadlessBattleDefinition,
): InteractiveBattleRunner {
  return new InteractiveBattleRunnerImpl(definition)
}""",
    """export function createInteractiveBattleRunner(
  definition: HeadlessBattleDefinition,
  stableSnapshot?: InteractiveBattleStableSnapshot,
): InteractiveBattleRunner {
  return new InteractiveBattleRunnerImpl(definition, stableSnapshot)
}""",
)

PATH.write_text(text)
