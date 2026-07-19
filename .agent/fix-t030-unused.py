from pathlib import Path

path = Path('src/battle/interactive-battle-runner.ts')
text = path.read_text()

replacements = [
    (
        """function completeHeadlessActionState(
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  decision: RunnerDecision,
""",
        """function completeHeadlessActionState(
  actor: BattleUnitState,
  decision: RunnerDecision,
""",
    ),
    (
        """    this.executeDecision(
      readyActor,
      actorSpecies,
      schedule,
""",
        """    this.executeDecision(
      readyActor,
      schedule,
""",
    ),
    (
        """    this.executeDecision(
      pending.actor,
      pending.actorSpecies,
      pending.schedule,
""",
        """    this.executeDecision(
      pending.actor,
      pending.schedule,
""",
    ),
    (
        """  private executeDecision(
    actor: BattleUnitState,
    actorSpecies: MonsterSpecies,
    schedule: UnitActionSchedule,
""",
        """  private executeDecision(
    actor: BattleUnitState,
    schedule: UnitActionSchedule,
""",
    ),
    (
        "completeHeadlessActionState(actor, actorSpecies, decision, this.context)",
        "completeHeadlessActionState(actor, decision, this.context)",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'expected one replacement, got {count}: {old[:80]!r}')
    text = text.replace(old, new, 1)

path.write_text(text)
