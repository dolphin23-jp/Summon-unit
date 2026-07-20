from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'src/battle/event-log.ts',
    """    case 'skill_used':
      assertNonEmptyId(event.payload.actorBattleUnitId, 'actorBattleUnitId')
      assertNonEmptyId(event.payload.targetBattleUnitId, 'targetBattleUnitId')
      assertNonEmptyId(event.payload.skillId, 'skillId')
      if (event.payload.actorBattleUnitId === event.payload.targetBattleUnitId) {
        throw new Error('skill actor and target must differ')
      }
      return""",
    """    case 'skill_used':
      assertNonEmptyId(event.payload.actorBattleUnitId, 'actorBattleUnitId')
      assertNonEmptyId(event.payload.targetBattleUnitId, 'targetBattleUnitId')
      assertNonEmptyId(event.payload.skillId, 'skillId')
      return""",
    'self skill event validation',
)

replace_once(
    'src/battle/interactive-battle-runner.ts',
    "import type { AiActionEvaluation } from '../ai/action-evaluation'\nimport { evaluateStandardAiActions } from '../ai/standard-scorers'",
    """import type {
  AiActionEvaluation,
  AiEvaluationInput,
} from '../ai/action-evaluation'
import {
  evaluateStandardAiActions,
  type AiCandidateSupportProjection,
} from '../ai/standard-scorers'""",
    'runner AI imports',
)
replace_once(
    'src/battle/interactive-battle-runner.ts',
    "import { performNormalMovement } from './normal-movement'",
    "import { resolveUnitHealing } from './healing'\nimport { performNormalMovement } from './normal-movement'",
    'runner healing import',
)

old_execute = """function executeSkillDecision(
  battle: BattleState,
  log: BattleEventLog,
  decision: Extract<RunnerDecision, { readonly kind: 'USE_SKILL' }>,
  schedule: UnitActionSchedule,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): ExecutedHeadlessAction {
  const actor = getRequiredUnit(battle, decision.actorBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const preview = decision.evaluation.preview
  if (preview.kind !== 'USE_SKILL') {
    throw new Error('skill decision must carry a skill preview')
  }
  const skill = getRequiredSkill(context.skillById, preview.candidate.skillId)
  const targetBattleUnitId =
    preview.reach.actualTargetBattleUnitId ?? preview.targetResults[0]?.battleUnitId
  if (targetBattleUnitId === null || targetBattleUnitId === undefined) {
    throw new Error('damage skill requires at least one resolved target')
  }
  const effectiveSpeed = getModifiedBattleStatValue(
    actorSpecies.stats.speed,
    actor.effects,
    'SPEED',
  )
  const actorSchedule = rescheduleUnitActionAfterAction(
    schedule,
    currentTime,
    preview.actionCost,
    effectiveSpeed,
  )
  const defeatCountBefore = battle.defeatRecords.length
  let nextBattle = battle
  let nextLog = appendBattleEvent(log, {
    kind: 'skill_used',
    virtualTime: currentTime,
    payload: {
      actorBattleUnitId: actor.battleUnitId,
      targetBattleUnitId,
      skillId: skill.id,
    },
  })

  for (const predicted of preview.targetResults) {
    if (nextBattle.outcome !== 'ONGOING') {
      break
    }
    const target = getRequiredUnit(nextBattle, predicted.battleUnitId)
    if (target.defeated || predicted.calculatedDamage === 0) {
      continue
    }
    const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
    const mitigation = resolveBarrierGuardDamage({
      finalDamage: predicted.calculatedDamage,
      target,
      targetSpecies,
      guard: getLivingGuard(nextBattle, target, context),
    })
    nextBattle = applyRecipientResolution(
      nextBattle,
      mitigation.target,
      actor.battleUnitId,
      currentTime,
    )
    if (mitigation.guardShare !== null && nextBattle.outcome === 'ONGOING') {
      nextBattle = applyRecipientResolution(
        nextBattle,
        mitigation.guardShare.guard,
        actor.battleUnitId,
        currentTime,
      )
      nextLog = recordGuardShared(nextLog, {
        virtualTime: currentTime,
        sourceBattleUnitId: actor.battleUnitId,
        skillId: skill.id,
        guardShare: mitigation.guardShare.guardShare,
        finalDamage: mitigation.finalDamage,
        retainedDamage: mitigation.guardShare.retainedDamage,
        redirectedDamage: mitigation.guardShare.redirectedDamage,
      })
    }
    nextLog = recordRecipientResolution(
      nextLog,
      mitigation.target,
      actor.battleUnitId,
      skill.id,
      currentTime,
    )
    if (mitigation.guardShare !== null) {
      nextLog = recordRecipientResolution(
        nextLog,
        mitigation.guardShare.guard,
        actor.battleUnitId,
        skill.id,
        currentTime,
      )
    }
  }

  for (const defeatRecord of nextBattle.defeatRecords.slice(defeatCountBefore)) {
    nextLog = recordUnitDefeated(nextLog, defeatRecord)
  }
  if (nextBattle.outcome !== 'ONGOING') {
    nextLog = recordBattleEnded(nextLog, nextBattle.outcome, currentTime)
  }
  return Object.freeze({
    battle: withTimeline(nextBattle, nextBattle.timeline),
    log: nextLog,
    schedule: actorSchedule,
  })
}"""
new_execute = """function executeSkillDecision(
  battle: BattleState,
  log: BattleEventLog,
  decision: Extract<RunnerDecision, { readonly kind: 'USE_SKILL' }>,
  schedule: UnitActionSchedule,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): ExecutedHeadlessAction {
  const actor = getRequiredUnit(battle, decision.actorBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const preview = decision.evaluation.preview
  if (preview.kind !== 'USE_SKILL') {
    throw new Error('skill decision must carry a skill preview')
  }
  const skill = getRequiredSkill(context.skillById, preview.candidate.skillId)
  const targetBattleUnitId =
    preview.reach.actualTargetBattleUnitId ?? preview.targetResults[0]?.battleUnitId
  if (targetBattleUnitId === null || targetBattleUnitId === undefined) {
    throw new Error('skill requires at least one resolved target')
  }
  const effectiveSpeed = getModifiedBattleStatValue(
    actorSpecies.stats.speed,
    actor.effects,
    'SPEED',
  )
  const actorSchedule = rescheduleUnitActionAfterAction(
    schedule,
    currentTime,
    preview.actionCost,
    effectiveSpeed,
  )
  const defeatCountBefore = battle.defeatRecords.length
  let nextBattle = battle
  let nextLog = appendBattleEvent(log, {
    kind: 'skill_used',
    virtualTime: currentTime,
    payload: {
      actorBattleUnitId: actor.battleUnitId,
      targetBattleUnitId,
      skillId: skill.id,
    },
  })

  if (skill.healingPower !== undefined) {
    for (const predicted of preview.targetResults) {
      const target = getRequiredUnit(nextBattle, predicted.battleUnitId)
      if (target.defeated) continue
      const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
      const healing = resolveUnitHealing(target, targetSpecies, skill.healingPower)
      nextBattle = replaceLivingUnit(nextBattle, healing.after)
      nextLog = appendBattleEvent(nextLog, {
        kind: 'healing_applied',
        virtualTime: currentTime,
        payload: {
          sourceBattleUnitId: actor.battleUnitId,
          targetBattleUnitId: target.battleUnitId,
          skillId: skill.id,
          baseHealing: healing.baseHealing,
          modifiedHealing: healing.modifiedHealing,
          appliedHealing: healing.appliedHealing,
          overheal: healing.overheal,
          hpBefore: healing.before.hp,
          hpAfter: healing.after.hp,
        },
      })
    }
  } else {
    for (const predicted of preview.targetResults) {
      if (nextBattle.outcome !== 'ONGOING') {
        break
      }
      const target = getRequiredUnit(nextBattle, predicted.battleUnitId)
      if (target.defeated || predicted.calculatedDamage === 0) {
        continue
      }
      const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
      const mitigation = resolveBarrierGuardDamage({
        finalDamage: predicted.calculatedDamage,
        target,
        targetSpecies,
        guard: getLivingGuard(nextBattle, target, context),
      })
      nextBattle = applyRecipientResolution(
        nextBattle,
        mitigation.target,
        actor.battleUnitId,
        currentTime,
      )
      if (mitigation.guardShare !== null && nextBattle.outcome === 'ONGOING') {
        nextBattle = applyRecipientResolution(
          nextBattle,
          mitigation.guardShare.guard,
          actor.battleUnitId,
          currentTime,
        )
        nextLog = recordGuardShared(nextLog, {
          virtualTime: currentTime,
          sourceBattleUnitId: actor.battleUnitId,
          skillId: skill.id,
          guardShare: mitigation.guardShare.guardShare,
          finalDamage: mitigation.finalDamage,
          retainedDamage: mitigation.guardShare.retainedDamage,
          redirectedDamage: mitigation.guardShare.redirectedDamage,
        })
      }
      nextLog = recordRecipientResolution(
        nextLog,
        mitigation.target,
        actor.battleUnitId,
        skill.id,
        currentTime,
      )
      if (mitigation.guardShare !== null) {
        nextLog = recordRecipientResolution(
          nextLog,
          mitigation.guardShare.guard,
          actor.battleUnitId,
          skill.id,
          currentTime,
        )
      }
    }
  }

  for (const defeatRecord of nextBattle.defeatRecords.slice(defeatCountBefore)) {
    nextLog = recordUnitDefeated(nextLog, defeatRecord)
  }
  if (nextBattle.outcome !== 'ONGOING') {
    nextLog = recordBattleEnded(nextLog, nextBattle.outcome, currentTime)
  }
  return Object.freeze({
    battle: withTimeline(nextBattle, nextBattle.timeline),
    log: nextLog,
    schedule: actorSchedule,
  })
}"""
replace_once(
    'src/battle/interactive-battle-runner.ts',
    old_execute,
    new_execute,
    'execute skill decision',
)

old_usable = """function getUsableSkills(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  context: HeadlessBattleContext,
): readonly SkillDefinition[] {
  const usageBook = getRequiredSkillUsageBook(context, actor.battleUnitId)
  const usable = getRequiredSkillIds(context, actor.battleUnitId)
    .map((skillId) => getRequiredSkill(context.skillById, skillId))
    .filter((skill) => {
      if (skill.targetType !== 'SINGLE_ENEMY') {
        return false
      }
      return getSkillReachTargetCandidates(battle, actor.battleUnitId, skill).some(
        (target) =>
          canUseSkillWithUsageState({
            usageBook,
            skill,
            actor,
            actorSpecies,
            target,
            targetSpecies: getRequiredSpecies(context.speciesById, target.speciesId),
          }),
      )
    })
  return Object.freeze(usable)
}"""
new_usable = """function getUsableSkills(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  context: HeadlessBattleContext,
): readonly SkillDefinition[] {
  const usageBook = getRequiredSkillUsageBook(context, actor.battleUnitId)
  const usable = getRequiredSkillIds(context, actor.battleUnitId)
    .map((skillId) => getRequiredSkill(context.skillById, skillId))
    .filter((skill) => {
      if (skill.targetType !== 'SINGLE_ENEMY' && skill.healingPower === undefined) {
        return false
      }
      return getSkillReachTargetCandidates(battle, actor.battleUnitId, skill).some(
        (target) => {
          const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
          if (
            !canUseSkillWithUsageState({
              usageBook,
              skill,
              actor,
              actorSpecies,
              target,
              targetSpecies,
            })
          ) {
            return false
          }
          return skill.healingPower === undefined || target.hp < targetSpecies.stats.hp
        },
      )
    })
  return Object.freeze(usable)
}"""
replace_once(
    'src/battle/interactive-battle-runner.ts',
    old_usable,
    new_usable,
    'usable skills',
)

old_decisions = """function getConfiguredDecision(
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
new_decisions = """function createRunnerEvaluationInput(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  context: HeadlessBattleContext,
): AiEvaluationInput {
  return Object.freeze({
    battle,
    actorBattleUnitId: actor.battleUnitId,
    speciesById: context.speciesById,
    availableSkills: getUsableSkills(battle, actor, actorSpecies, context),
  })
}

function createHealingSupportProjections(
  input: AiEvaluationInput,
  currentTime: BattleTime,
  recentActorPositionIds: readonly string[] | undefined,
  context: HeadlessBattleContext,
): readonly AiCandidateSupportProjection[] {
  const preliminary = evaluateStandardAiActions({
    input,
    currentTime,
    recentActorPositionIds,
  })
  return Object.freeze(
    preliminary.flatMap((evaluation) => {
      if (evaluation.preview.kind !== 'USE_SKILL') return []
      const skill = getRequiredSkill(
        context.skillById,
        evaluation.preview.candidate.skillId,
      )
      if (skill.healingPower === undefined) return []
      const targets = evaluation.preview.targetResults.map((predicted) => {
        const target = getRequiredUnit(input.battle, predicted.battleUnitId)
        const species = getRequiredSpecies(context.speciesById, target.speciesId)
        const healing = resolveUnitHealing(target, species, skill.healingPower!)
        return Object.freeze({
          battleUnitId: target.battleUnitId,
          rawHealing: healing.modifiedHealing,
          appliedHealing: healing.appliedHealing,
          preventedDamage: 0,
          usefulActionCount: healing.appliedHealing > 0 ? 1 : 0,
        })
      })
      return [
        Object.freeze({
          candidateId: evaluation.preview.candidate.candidateId,
          targets: Object.freeze(targets),
        }),
      ]
    }),
  )
}

function getConfiguredDecision(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  currentTime: BattleTime,
  context: HeadlessBattleContext,
): AiConfiguredDecisionResult {
  const input = createRunnerEvaluationInput(battle, actor, actorSpecies, context)
  const recentActorPositionIds = context.recentPositionIds.get(actor.battleUnitId)
  return evaluateConfiguredAiDecision({
    input,
    currentTime,
    recentActorPositionIds,
    supportProjections: createHealingSupportProjections(
      input,
      currentTime,
      recentActorPositionIds,
      context,
    ),
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
  const input = createRunnerEvaluationInput(battle, actor, actorSpecies, context)
  const recentActorPositionIds = context.recentPositionIds.get(actor.battleUnitId)
  return Object.freeze(
    evaluateStandardAiActions({
      input,
      currentTime,
      recentActorPositionIds,
      supportProjections: createHealingSupportProjections(
        input,
        currentTime,
        recentActorPositionIds,
        context,
      ),
    }).filter(
      (evaluation) =>
        evaluation.preview.kind === 'MOVE' || evaluation.preview.targetResults.length > 0,
    ),
  )
}"""
replace_once(
    'src/battle/interactive-battle-runner.ts',
    old_decisions,
    new_decisions,
    'runner decision scoring',
)

Path('src/battle/interactive-healing.test.ts').write_text("""import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import {
  createInteractiveBattleRunner,
  runHeadlessBattle,
  type HeadlessBattleDefinition,
} from './interactive-battle-runner'

const healer: MonsterSpecies = Object.freeze({
  id: 'species.runner-healer',
  rarity: 1,
  attributeId: 'attribute.earth',
  primarySpeciesId: 'species-group.plant',
  tagIds: Object.freeze([]),
  innateSkillId: 'skill.runner-heal',
  stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 8 }),
})
const ally: MonsterSpecies = Object.freeze({
  id: 'species.runner-ally',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze([]),
  innateSkillId: 'skill.runner-attack',
  stats: Object.freeze({ hp: 100, attack: 20, defense: 10, speed: 3 }),
})
const enemy: MonsterSpecies = Object.freeze({
  id: 'species.runner-enemy',
  rarity: 1,
  attributeId: 'attribute.neutral',
  primarySpeciesId: 'species-group.beast',
  tagIds: Object.freeze([]),
  innateSkillId: 'skill.runner-attack',
  stats: Object.freeze({ hp: 100, attack: 20, defense: 10, speed: 2 }),
})
const healSkill: SkillDefinition = Object.freeze({
  id: 'skill.runner-heal',
  slotType: 'INNATE',
  attributeId: 'attribute.earth',
  actionCost: 90,
  targetType: 'SINGLE_ALLY',
  reachMethod: 'SNIPE',
  damageMultiplierPermille: 1,
  healingPower: 40,
})
const attackSkill: SkillDefinition = Object.freeze({
  id: 'skill.runner-attack',
  slotType: 'INNATE',
  attributeId: 'attribute.neutral',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  reachMethod: 'DIRECT',
  damageMultiplierPermille: 900,
})

function definition(): HeadlessBattleDefinition {
  return Object.freeze({
    species: Object.freeze([healer, ally, enemy]),
    skills: Object.freeze([healSkill, attackSkill]),
    units: Object.freeze([
      Object.freeze({
        battleUnitId: 'ally.healer',
        speciesId: healer.id,
        position: Object.freeze({ side: 'ALLY' as const, row: 0 as const, column: 0 as const }),
        tiePriority: 0,
      }),
      Object.freeze({
        battleUnitId: 'ally.injured',
        speciesId: ally.id,
        position: Object.freeze({ side: 'ALLY' as const, row: 1 as const, column: 0 as const }),
        initialHp: 50,
        tiePriority: 1,
      }),
      Object.freeze({
        battleUnitId: 'enemy.target',
        speciesId: enemy.id,
        position: Object.freeze({ side: 'ENEMY' as const, row: 0 as const, column: 0 as const }),
        tiePriority: 2,
      }),
    ]),
    initialActionCost: 100,
    maxActions: 2,
  })
}

describe('interactive healing resolution', () => {
  it('selects useful healing in AUTO and logs applied healing and overheal', () => {
    const result = runHeadlessBattle(definition())
    const healing = result.log.events.find((event) => event.kind === 'healing_applied')
    expect(healing).toMatchObject({
      kind: 'healing_applied',
      payload: {
        sourceBattleUnitId: 'ally.healer',
        targetBattleUnitId: 'ally.injured',
        appliedHealing: 40,
        overheal: 0,
        hpBefore: 50,
        hpAfter: 90,
      },
    })
  })

  it('offers the same healing action for manual selection and executes it', () => {
    const runner = createInteractiveBattleRunner(definition())
    runner.requestManualAllyAction()
    const pending = runner.step()
    expect(pending.status).toBe('AWAITING_MANUAL_ACTION')
    const healingOption = pending.pendingManualAction?.options.find(
      (option) => option.skillId === 'skill.runner-heal',
    )
    expect(healingOption).toBeDefined()
    const resolved = runner.submitManualAction(healingOption!.candidateId)
    expect(resolved.log.events.some((event) => event.kind === 'healing_applied')).toBe(true)
  })
})
""")

Path('.github/t048-trigger').unlink(missing_ok=True)
Path('.github/t048-support-model.py').unlink()
Path('.github/workflows/t048-support-model.yml').unlink()
