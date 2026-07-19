from pathlib import Path

path = Path('src/battle/interactive-battle-runner.ts')
text = path.read_text()
old = """  getStableSnapshot(): InteractiveBattleStableSnapshot {
    if (this.pendingManualExecution !== null) {
      throw new Error('cannot capture a stable snapshot during manual action selection')
    }
    return Object.freeze({
      snapshotVersion: INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION,"""
new = """  getStableSnapshot(): InteractiveBattleStableSnapshot {
    if (this.pendingManualExecution !== null) {
      throw new Error('cannot capture a stable snapshot during manual action selection')
    }
    const serializable = {
      snapshotVersion: INTERACTIVE_BATTLE_STABLE_SNAPSHOT_VERSION,"""
if old not in text:
    raise RuntimeError('stable snapshot opening not found')
text = text.replace(old, new, 1)
old = """      recentPositionIds: createRuntimeEntries(this.context.recentPositionIds),
    })
  }

  subscribe(listener: InteractiveBattleListener): () => void {"""
new = """      recentPositionIds: createRuntimeEntries(this.context.recentPositionIds),
    }
    return Object.freeze(
      JSON.parse(JSON.stringify(serializable)) as InteractiveBattleStableSnapshot,
    )
  }

  subscribe(listener: InteractiveBattleListener): () => void {"""
if old not in text:
    raise RuntimeError('stable snapshot closing not found')
path.write_text(text.replace(old, new, 1))
