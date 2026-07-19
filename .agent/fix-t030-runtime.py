from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, got {count}: {old[:80]!r}')
    target.write_text(text.replace(old, new, 1))


replace_once(
    'src/battle/interactive-battle-runner.ts',
    "import type { SkillDefinition, SkillSlotType } from '../content/skill-definition'",
    """import {
  resolveSkillReachMethod,
  type SkillDefinition,
  type SkillSlotType,
} from '../content/skill-definition'""",
)
replace_once(
    'src/battle/interactive-battle-runner.ts',
    """  const skill = getRequiredSkill(context.skillById, candidate.skillId)
  const target =
""",
    """  const skill = getRequiredSkill(context.skillById, candidate.skillId)
  if (
    candidate.selectedTargetBattleUnitId === null &&
    resolveSkillReachMethod(skill) !== 'GLOBAL'
  ) {
    return false
  }
  const target =
""",
)
replace_once(
    'src/battle/interactive-battle-runner.ts',
    """  const eventTargetBattleUnitId =
    resolution.preview.actualTargetBattleUnitId ??
    resolution.preview.selectedTargetBattleUnitId ??
    actor.battleUnitId
""",
    """  const eventTargetBattleUnitId =
    resolution.preview.actualTargetBattleUnitId ??
    resolution.preview.selectedTargetBattleUnitId ??
    resolution.rawPreview.targetResults[0]?.battleUnitId ??
    actor.battleUnitId
""",
)
replace_once(
    'src/battle/event-log.ts',
    """      if (event.payload.actorBattleUnitId === event.payload.targetBattleUnitId) {
        throw new Error('skill actor and target must differ')
      }
      return
""",
    """      return
""",
)
replace_once(
    'src/ui/manual-action-preview.test.ts',
    "import { getTotalBarrierCapacity } from './barrier'",
    "import { getTotalBarrierCapacity } from '../battle/barrier'",
)
replace_once(
    'src/ui/manual-action-preview.test.ts',
    "} from './interactive-battle-runner'",
    "} from '../battle/interactive-battle-runner'",
)
replace_once(
    'src/battle/event-log.test.ts',
    """  it('can record environmental defeat and battle end separately', () => {
""",
    """  it('allows a self-target skill event for generalized manual commands', () => {
    const started = recordBattleStarted(EMPTY_BATTLE_EVENT_LOG, createBattle())
    const next = appendBattleEvent(started, {
      kind: 'skill_used',
      virtualTime: 10_000,
      payload: {
        actorBattleUnitId: 'ally.a',
        targetBattleUnitId: 'ally.a',
        skillId: 'skill.log-guard',
      },
    })

    expect(next.events.at(-1)).toMatchObject({
      kind: 'skill_used',
      payload: {
        actorBattleUnitId: 'ally.a',
        targetBattleUnitId: 'ally.a',
      },
    })
  })

  it('can record environmental defeat and battle end separately', () => {
""",
)
