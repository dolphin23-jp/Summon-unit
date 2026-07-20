from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    file.write_text(text.replace(old, new, 1))


def replace_section(path: str, start: str, end: str, replacement: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f'{label} start not found')
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f'{label} end not found')
    file.write_text(text[:start_index] + replacement.rstrip() + '\n\n' + text[end_index + 1 :])


replace_once(
    'src/ai/action-evaluation.ts',
    "import { getModifiedBattleStatValue } from '../battle/stat-modifiers'",
    "import { applyHealingReceivedModifier, getModifiedBattleStatValue } from '../battle/stat-modifiers'",
    'healing modifier import',
)
replace_once(
    'src/ai/action-evaluation.ts',
    """  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly hpAfter: number
""",
    """  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly rawHealing: number
  readonly appliedHealing: number
  readonly overheal: number
  readonly hpAfter: number
""",
    'predicted healing fields',
)
replace_once(
    'src/ai/action-evaluation.ts',
    """  if (actor.side === target.side) {
    return Object.freeze({
      battleUnitId: target.battleUnitId,
      positionId: getBoardPositionId(target.position),
      hpBefore: target.hp,
      maxHp: targetSpecies.stats.hp,
      calculatedDamage: 0,
      appliedDamage: 0,
      hpAfter: target.hp,
      defeatsTarget: false,
      effectiveAttack: null,
      effectiveDefense: null,
      attributeMultiplierPermille: null,
    })
  }
""",
    """  if (actor.side === target.side) {
    const rawHealing =
      skill.healingPower === undefined
        ? 0
        : applyHealingReceivedModifier(skill.healingPower, target.effects)
    const appliedHealing = Math.min(rawHealing, targetSpecies.stats.hp - target.hp)
    return Object.freeze({
      battleUnitId: target.battleUnitId,
      positionId: getBoardPositionId(target.position),
      hpBefore: target.hp,
      maxHp: targetSpecies.stats.hp,
      calculatedDamage: 0,
      appliedDamage: 0,
      rawHealing,
      appliedHealing,
      overheal: rawHealing - appliedHealing,
      hpAfter: target.hp + appliedHealing,
      defeatsTarget: false,
      effectiveAttack: null,
      effectiveDefense: null,
      attributeMultiplierPermille: null,
    })
  }
""",
    'ally healing preview',
)
replace_once(
    'src/ai/action-evaluation.ts',
    """    calculatedDamage,
    appliedDamage,
    hpAfter,
""",
    """    calculatedDamage,
    appliedDamage,
    rawHealing: 0,
    appliedHealing: 0,
    overheal: 0,
    hpAfter,
""",
    'enemy healing zeros',
)

support_metrics = """function getSupportMetrics(
  context: AiStandardScoringContext,
  preview: AiActionResultPreview,
  supportByCandidateId: ReadonlyMap<string, AiCandidateSupportProjection>,
): CandidateSupportMetrics {
  const projection = supportByCandidateId.get(preview.candidate.candidateId)
  const targets =
    projection?.targets ??
    (preview.kind === 'USE_SKILL'
      ? preview.targetResults
          .filter((target) => target.rawHealing > 0)
          .map((target) =>
            Object.freeze({
              battleUnitId: target.battleUnitId,
              rawHealing: target.rawHealing,
              appliedHealing: target.appliedHealing,
              preventedDamage: 0,
              usefulActionCount: target.appliedHealing > 0 ? 1 : 0,
            }),
          )
      : [])
  if (targets.length === 0) {
    return Object.freeze({
      rawHealing: 0,
      appliedHealing: 0,
      preventedDamage: 0,
      usefulActionCount: 0,
      rescueCount: 0,
      preventedDamageForActor: 0,
    })
  }

  let rescueCount = 0
  for (const target of targets) {
    const unit = getRequiredUnit(context.input.battle, target.battleUnitId)
    const incomingDamage = getThreatDamageBeforeNextTurn(context, unit)
    const effectiveHpBefore = unit.hp + getCurrentBarrierCapacity(unit)
    const effectiveHpAfter =
      effectiveHpBefore + target.appliedHealing + target.preventedDamage
    if (
      incomingDamage >= effectiveHpBefore &&
      effectiveHpAfter > incomingDamage
    ) {
      rescueCount += 1
    }
  }

  const actorProjection = targets.find(
    (target) => target.battleUnitId === context.input.actorBattleUnitId,
  )
  return Object.freeze({
    rawHealing: safeAdd(
      targets.map((target) => target.rawHealing),
      'raw healing',
    ),
    appliedHealing: safeAdd(
      targets.map((target) => target.appliedHealing),
      'applied healing',
    ),
    preventedDamage: safeAdd(
      targets.map((target) => target.preventedDamage),
      'prevented damage',
    ),
    usefulActionCount: safeAdd(
      targets.map((target) => target.usefulActionCount),
      'useful support action count',
    ),
    rescueCount,
    preventedDamageForActor: actorProjection?.preventedDamage ?? 0,
  })
}"""
replace_section(
    'src/ai/standard-scorers.ts',
    'function getSupportMetrics(',
    '\nfunction getTelegraphMetrics(',
    support_metrics,
    'support metrics',
)

replace_once(
    'src/battle/interactive-battle-runner.ts',
    """import type {
  AiActionEvaluation,
  AiEvaluationInput,
} from '../ai/action-evaluation'
import {
  evaluateStandardAiActions,
  type AiCandidateSupportProjection,
} from '../ai/standard-scorers'""",
    """import type { AiActionEvaluation } from '../ai/action-evaluation'
import { evaluateStandardAiActions } from '../ai/standard-scorers'""",
    'restore runner AI imports',
)

decision_functions = """function getConfiguredDecision(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): AiConfiguredDecisionResult {
  return evaluateConfiguredAiDecision({
    input: Object.freeze({
      battle,
      actorBattleUnitId: actor.battleUnitId,
      speciesById: context.speciesById,
      availableSkills: getUsableSkills(battle, actor, actorSpecies, context),
    }),
    currentTime,
    recentActorPositionIds: context.recentPositionIds.get(actor.battleUnitId),
    configuration: context.aiConfigurations[actor.battleUnitId] ?? DEFAULT_AI_CONFIGURATION,
  })
}

function getManualEvaluations(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): readonly AiActionEvaluation[] {
  return Object.freeze(
    evaluateStandardAiActions({
      input: Object.freeze({
        battle,
        actorBattleUnitId: actor.battleUnitId,
        speciesById: context.speciesById,
        availableSkills: getUsableSkills(battle, actor, actorSpecies, context),
      }),
      currentTime,
      recentActorPositionIds: context.recentPositionIds.get(actor.battleUnitId),
    }).filter(
      (evaluation) =>
        evaluation.preview.kind === 'MOVE' || evaluation.preview.targetResults.length > 0,
    ),
  )
}"""
replace_section(
    'src/battle/interactive-battle-runner.ts',
    'function createRunnerEvaluationInput(',
    '\nfunction evaluationToDecision(',
    decision_functions,
    'single-pass runner decisions',
)

Path('.github/t048-support-model.py').unlink()
Path('.github/workflows/t048-support-model.yml').unlink(missing_ok=True)
