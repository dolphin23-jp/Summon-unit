from pathlib import Path

path = Path('src/battle/interactive-battle-runner.ts')
text = path.read_text()

def replace(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing runner pattern:\n{old[:200]}')
    text = text.replace(old, new, 1)

replace(
"import type { AiActionEvaluation } from '../ai/action-evaluation'\n",
"import type { AiActionEvaluation } from '../ai/action-evaluation'\nimport { evaluateStandardAiActions } from '../ai/standard-scorers'\n",
)
replace(
"import type { SkillDefinition } from '../content/skill-definition'\n",
"import type { SkillDefinition, SkillSlotType } from '../content/skill-definition'\n",
)
replace(
"  registerUnitTurnEvent,\n  type BattleTime,\n",
"  registerUnitTurnEvent,\n  rescheduleUnitActionAfterAction,\n  type BattleTime,\n",
)
replace("import { getDirectEffectiveTarget } from './direct-targeting'\n", "")
replace(
"import { performNormalMovement } from './normal-movement'\nimport { scheduleSingleTargetInnateSkill } from './single-target-damage'\n",
"import { performNormalMovement } from './normal-movement'\nimport { getSkillReachTargetCandidates } from './reach-and-area'\nimport { getModifiedBattleStatValue } from './stat-modifiers'\nimport {\n  createManualActionPreview,\n  createWaitManualActionPreview,\n  type ManualActionCategory,\n  type ManualActionPreview,\n} from './manual-action-preview'\n",
)
replace(
"  readonly initialEffects?: readonly ActiveEffectState[]\n  readonly tiePriority: number\n",
"  readonly initialEffects?: readonly ActiveEffectState[]\n  readonly equippedSkillIds?: readonly string[]\n  readonly tiePriority: number\n",
)
replace(
"export interface InteractiveManualActionOption {\n  readonly candidateId: string\n  readonly kind: 'USE_SKILL' | 'MOVE' | 'WAIT'\n  readonly label: string\n  readonly recommended: boolean\n}\n",
"export interface InteractiveManualActionOption {\n  readonly candidateId: string\n  readonly kind: 'USE_SKILL' | 'MOVE' | 'WAIT'\n  readonly category: ManualActionCategory\n  readonly skillId: string | null\n  readonly label: string\n  readonly targetLabel: string\n  readonly targetPositionId: string | null\n  readonly recommended: boolean\n  readonly preview: ManualActionPreview\n}\n",
)
replace(
"  readonly skillUsageBooks: Map<BattleUnitId, SkillUsageBook>\n  readonly recentPositionIds: Map<BattleUnitId, readonly string[]>\n",
"  readonly skillUsageBooks: Map<BattleUnitId, SkillUsageBook>\n  readonly skillIdsByBattleUnitId: ReadonlyMap<BattleUnitId, readonly string[]>\n  readonly recentPositionIds: Map<BattleUnitId, readonly string[]>\n",
)
replace(
"      readonly kind: 'USE_SKILL'\n      readonly actorBattleUnitId: BattleUnitId\n      readonly skillId: string\n      readonly targetBattleUnitId: BattleUnitId\n",
"      readonly kind: 'USE_SKILL'\n      readonly actorBattleUnitId: BattleUnitId\n      readonly evaluation: AiActionEvaluation\n",
)
replace(
"  readonly currentTime: BattleTime\n  readonly decisionResult: AiConfiguredDecisionResult\n}\n",
"  readonly currentTime: BattleTime\n  readonly decisionResult: AiConfiguredDecisionResult\n  readonly manualEvaluations: readonly AiActionEvaluation[]\n}\n",
)
replace(
"function withTimeline(battle: BattleState, timeline: TimelineQueue): BattleState {\n",
"function getRequiredSkillIds(\n  context: HeadlessBattleContext,\n  battleUnitId: BattleUnitId,\n): readonly string[] {\n  const skillIds = context.skillIdsByBattleUnitId.get(battleUnitId)\n  if (skillIds === undefined) {\n    throw new Error(`skill loadout is missing: ${battleUnitId}`)\n  }\n  return skillIds\n}\n\nfunction withTimeline(battle: BattleState, timeline: TimelineQueue): BattleState {\n",
)
replace(
"  const skillUsageBooks = new Map<BattleUnitId, SkillUsageBook>()\n  const recentPositionIds = new Map<BattleUnitId, readonly string[]>()\n",
"  const skillUsageBooks = new Map<BattleUnitId, SkillUsageBook>()\n  const skillIdsByBattleUnitId = new Map<BattleUnitId, readonly string[]>()\n  const recentPositionIds = new Map<BattleUnitId, readonly string[]>()\n",
)
replace(
"    const species = getRequiredSpecies(speciesById, unit.speciesId)\n    const innateSkill = getRequiredSkill(skillById, species.innateSkillId)\n    schedules.set(\n",
"    const species = getRequiredSpecies(speciesById, unit.speciesId)\n    const skillIds = [species.innateSkillId, ...(unitDefinition.equippedSkillIds ?? [])]\n    if (new Set(skillIds).size !== skillIds.length) {\n      throw new Error(`equipped skill ids must be unique: ${unit.battleUnitId}`)\n    }\n    const skills = skillIds.map((skillId) => getRequiredSkill(skillById, skillId))\n    if (skills[0]?.slotType !== 'INNATE') {\n      throw new Error(`innate skill must use INNATE slot: ${unit.battleUnitId}`)\n    }\n    for (const equipped of skills.slice(1)) {\n      if (equipped.slotType === 'INNATE') {\n        throw new Error(`equipped skill must use GENERIC or BLOOM slot: ${equipped.id}`)\n      }\n    }\n    schedules.set(\n",
)
replace(
"    waitStates.set(unit.battleUnitId, EMPTY_WAIT_ACTION_STATE)\n    skillUsageBooks.set(unit.battleUnitId, createSkillUsageBook([innateSkill]))\n    recentPositionIds.set(\n",
"    waitStates.set(unit.battleUnitId, EMPTY_WAIT_ACTION_STATE)\n    skillUsageBooks.set(unit.battleUnitId, createSkillUsageBook(skills))\n    skillIdsByBattleUnitId.set(unit.battleUnitId, Object.freeze(skillIds))\n    recentPositionIds.set(\n",
)
replace(
"      skillUsageBooks,\n      recentPositionIds,\n",
"      skillUsageBooks,\n      skillIdsByBattleUnitId,\n      recentPositionIds,\n",
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
  const target = getRequiredUnit(battle, decision.targetBattleUnitId)
  const actorSpecies = getRequiredSpecies(context.speciesById, actor.speciesId)
  const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
  const skill = getRequiredSkill(context.skillById, decision.skillId)
  const scheduled = scheduleSingleTargetInnateSkill({
    actor,
    actorSpecies,
    actorSchedule: schedule,
    target,
    targetSpecies,
    skill,
    currentTime,
  })
  const mitigation = resolveBarrierGuardDamage({
    finalDamage: scheduled.calculatedDamage,
    target,
    targetSpecies,
    guard: getLivingGuard(battle, target, context),
  })

  const defeatCountBefore = battle.defeatRecords.length
  let nextBattle = applyRecipientResolution(
    battle,
    mitigation.target,
    actor.battleUnitId,
    currentTime,
  )
  if (mitigation.guardShare !== null) {
    nextBattle = applyRecipientResolution(
      nextBattle,
      mitigation.guardShare.guard,
      actor.battleUnitId,
      currentTime,
    )
  }

  let nextLog = appendBattleEvent(log, {
    kind: 'skill_used',
    virtualTime: currentTime,
    payload: {
      actorBattleUnitId: actor.battleUnitId,
      targetBattleUnitId: target.battleUnitId,
      skillId: skill.id,
    },
  })
  if (mitigation.guardShare !== null) {
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
  for (const defeatRecord of nextBattle.defeatRecords.slice(defeatCountBefore)) {
    nextLog = recordUnitDefeated(nextLog, defeatRecord)
  }
  if (nextBattle.outcome !== 'ONGOING') {
    nextLog = recordBattleEnded(nextLog, nextBattle.outcome, currentTime)
  }

  return Object.freeze({
    battle: withTimeline(nextBattle, nextBattle.timeline),
    log: nextLog,
    schedule: scheduled.actorSchedule,
  })
}
"""
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
}
"""
replace(old_execute, new_execute)
old_usable = """function getUsableDirectSkills(
  battle: BattleState,
  actor: BattleUnitState,
  actorSpecies: MonsterSpecies,
  context: HeadlessBattleContext,
): readonly SkillDefinition[] {
  const skill = getRequiredSkill(context.skillById, actorSpecies.innateSkillId)
  if (skill.targetType !== 'SINGLE_ENEMY') {
    return Object.freeze([])
  }
  const target = getDirectEffectiveTarget(battle, actor.battleUnitId)
  if (target === null) {
    return Object.freeze([])
  }
  const targetSpecies = getRequiredSpecies(context.speciesById, target.speciesId)
  const usable = canUseSkillWithUsageState({
    usageBook: getRequiredSkillUsageBook(context, actor.battleUnitId),
    skill,
    actor,
    actorSpecies,
    target,
    targetSpecies,
  })
  return usable ? Object.freeze([skill]) : Object.freeze([])
}
"""
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
}
"""
replace(old_usable, new_usable)
replace(
"  const innateSkill = getRequiredSkill(context.skillById, actorSpecies.innateSkillId)\n  const usageBook = getRequiredSkillUsageBook(context, actor.battleUnitId)\n",
"  const skillIds = getRequiredSkillIds(context, actor.battleUnitId)\n  if (!skillIds.includes(actorSpecies.innateSkillId)) {\n    throw new Error(`skill loadout must include innate skill: ${actor.battleUnitId}`)\n  }\n  const skills = skillIds.map((skillId) => getRequiredSkill(context.skillById, skillId))\n  const usageBook = getRequiredSkillUsageBook(context, actor.battleUnitId)\n",
)
replace(
"      [innateSkill],\n      decision.kind === 'USE_SKILL' ? decision.skillId : null,\n",
"      skills,\n      decision.kind === 'USE_SKILL'\n        ? decision.evaluation.preview.candidate.kind === 'USE_SKILL'\n          ? decision.evaluation.preview.candidate.skillId\n          : null\n        : null,\n",
)
replace(
"      availableSkills: getUsableDirectSkills(battle, actor, actorSpecies, context),\n",
"      availableSkills: getUsableSkills(battle, actor, actorSpecies, context),\n",
)
insert_after_configured = """function getConfiguredDecision(
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
"""
if insert_after_configured not in text:
    raise SystemExit('configured decision block not found after replacement')
text = text.replace(insert_after_configured, insert_after_configured + """

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
}
""", 1)
replace(
"  if (evaluation.preview.kind !== 'USE_SKILL') {\n    throw new Error('skill candidate must have a skill preview')\n  }\n  const targetBattleUnitId = evaluation.preview.reach.actualTargetBattleUnitId\n  if (targetBattleUnitId === null) {\n    return Object.freeze({ kind: 'WAIT', actorBattleUnitId })\n  }\n  return Object.freeze({\n    kind: 'USE_SKILL',\n    actorBattleUnitId,\n    skillId: candidate.skillId,\n    targetBattleUnitId,\n  })\n",
"  if (evaluation.preview.kind !== 'USE_SKILL') {\n    throw new Error('skill candidate must have a skill preview')\n  }\n  if (evaluation.preview.targetResults.length === 0) {\n    return Object.freeze({ kind: 'WAIT', actorBattleUnitId })\n  }\n  return Object.freeze({ kind: 'USE_SKILL', actorBattleUnitId, evaluation })\n",
)
old_options = """function actionOptionLabel(evaluation: AiActionEvaluation): string {
  if (evaluation.preview.kind === 'MOVE') {
    return `移動 → ${evaluation.preview.toPositionId}`
  }
  const target = evaluation.preview.reach.actualTargetBattleUnitId ?? '対象なし'
  return `${evaluation.preview.candidate.skillId} → ${target}`
}

function createPendingManualAction(
  pending: PendingManualExecution,
): InteractivePendingManualAction {
  const recommendedCandidateId =
    pending.decisionResult.selected?.preview.candidate.candidateId ?? MANUAL_WAIT_CANDIDATE_ID
  const options: InteractiveManualActionOption[] = pending.decisionResult.evaluations.map(
    (evaluation) =>
      Object.freeze({
        candidateId: evaluation.preview.candidate.candidateId,
        kind: evaluation.preview.kind,
        label: actionOptionLabel(evaluation),
        recommended:
          evaluation.preview.candidate.candidateId === recommendedCandidateId,
      }),
  )
  options.push(
    Object.freeze({
      candidateId: MANUAL_WAIT_CANDIDATE_ID,
      kind: 'WAIT',
      label: '待機',
      recommended: recommendedCandidateId === MANUAL_WAIT_CANDIDATE_ID,
    }),
  )
  return Object.freeze({
    actorBattleUnitId: pending.actor.battleUnitId,
    recommendedCandidateId,
    options: Object.freeze(options),
    reasonLog: pending.decisionResult.log,
  })
}
"""
new_options = """function actionOptionLabel(evaluation: AiActionEvaluation): string {
  if (evaluation.preview.kind === 'MOVE') {
    return '通常移動'
  }
  return evaluation.preview.candidate.skillId
}

function optionCategory(
  evaluation: AiActionEvaluation,
  context: HeadlessBattleContext,
): SkillSlotType | 'MOVE' {
  return evaluation.preview.kind === 'MOVE'
    ? 'MOVE'
    : getRequiredSkill(
        context.skillById,
        evaluation.preview.candidate.skillId,
      ).slotType
}

function optionTargetLabel(evaluation: AiActionEvaluation): string {
  if (evaluation.preview.kind === 'MOVE') {
    return evaluation.preview.toPositionId
  }
  const selected = evaluation.preview.candidate.selectedTargetBattleUnitId
  const position = evaluation.preview.candidate.selectedTargetPosition
  return selected ?? (position === null ? '対象なし' : getBoardPositionId(position))
}

function createPendingManualAction(
  pending: PendingManualExecution,
  battle: BattleState,
  context: HeadlessBattleContext,
  nextTimelineSequence: number,
): InteractivePendingManualAction {
  const recommendedCandidateId =
    pending.decisionResult.selected?.preview.candidate.candidateId ?? MANUAL_WAIT_CANDIDATE_ID
  const options: InteractiveManualActionOption[] = pending.manualEvaluations.map(
    (evaluation) => {
      const candidate = evaluation.preview.candidate
      const category = optionCategory(evaluation, context)
      const preview = createManualActionPreview({
        battle,
        actor: pending.actor,
        actorSpecies: pending.actorSpecies,
        actorSchedule: pending.schedule,
        currentTime: pending.currentTime,
        nextTimelineSequence,
        evaluation,
        speciesById: context.speciesById,
        guardShares: context.guardShares,
      })
      return Object.freeze({
        candidateId: candidate.candidateId,
        kind: evaluation.preview.kind,
        category,
        skillId: candidate.kind === 'USE_SKILL' ? candidate.skillId : null,
        label: actionOptionLabel(evaluation),
        targetLabel: optionTargetLabel(evaluation),
        targetPositionId: preview.selectedTargetPositionId,
        recommended: candidate.candidateId === recommendedCandidateId,
        preview,
      })
    },
  )
  const wait = performWaitAction({
    actor: pending.actor,
    actorSpecies: pending.actorSpecies,
    actorSchedule: pending.schedule,
    currentTime: pending.currentTime,
    waitState: getRequiredWaitState(context, pending.actor.battleUnitId),
  })
  options.push(
    Object.freeze({
      candidateId: MANUAL_WAIT_CANDIDATE_ID,
      kind: 'WAIT',
      category: 'WAIT',
      skillId: null,
      label: '待機',
      targetLabel: 'その場で待機',
      targetPositionId: null,
      recommended: recommendedCandidateId === MANUAL_WAIT_CANDIDATE_ID,
      preview: createWaitManualActionPreview({
        battle,
        actor: pending.actor,
        schedule: pending.schedule,
        effectiveActionCost: wait.effectiveActionCost,
        nextSchedule: wait.actorSchedule,
        nextTimelineSequence,
      }),
    }),
  )
  return Object.freeze({
    actorBattleUnitId: pending.actor.battleUnitId,
    recommendedCandidateId,
    options: Object.freeze(options),
    reasonLog: pending.decisionResult.log,
  })
}
"""
replace(old_options, new_options)
replace(
"          : createPendingManualAction(this.pendingManualExecution),\n",
"          : createPendingManualAction(\n              this.pendingManualExecution,\n              this.battle,\n              this.context,\n              this.nextTimelineSequence,\n            ),\n",
)
replace(
"        decisionResult,\n      })\n",
"        decisionResult,\n        manualEvaluations: getManualEvaluations(\n          this.battle,\n          readyActor,\n          actorSpecies,\n          this.currentVirtualTime,\n          this.context,\n        ),\n      })\n",
)
replace(
"      const evaluation = pending.decisionResult.evaluations.find(\n",
"      const evaluation = pending.manualEvaluations.find(\n",
)
path.write_text(text)
