from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'src/content/skill-definition.ts',
    "  readonly damageMultiplierPermille: number\n  readonly cooldownActions?: number",
    "  readonly damageMultiplierPermille: number\n  readonly healingPower?: number\n  readonly cooldownActions?: number",
    'skill interface',
)
replace_once(
    'src/content/skill-definition.ts',
    """  assertSafeIntegerAtLeast(
    skill.damageMultiplierPermille,
    1,
    'skill.damageMultiplierPermille',
  )

  if (skill.cooldownActions !== undefined) {""",
    """  assertSafeIntegerAtLeast(
    skill.damageMultiplierPermille,
    1,
    'skill.damageMultiplierPermille',
  )
  if (skill.healingPower !== undefined) {
    assertSafeIntegerAtLeast(skill.healingPower, 1, 'skill.healingPower')
    if (resolveSkillTargetSelector(skill).side === 'ENEMY') {
      throw new Error('skill.healingPower requires an ALLY or SELF target selector')
    }
  }

  if (skill.cooldownActions !== undefined) {""",
    'skill validation',
)
replace_once(
    'src/content/vertical-slice-content.ts',
    """function defineSkill(record: VerticalSliceSkillRecord): VerticalSliceSkillRecord {
  return Object.freeze({
    ...record,
    definition: Object.freeze({ ...record.definition }),
    effectTags: freezeStrings(record.effectTags),
  })
}""",
    """function defineSkill(record: VerticalSliceSkillRecord): VerticalSliceSkillRecord {
  const healingPower = record.effectTags.includes('HEAL')
    ? Math.max(1, Math.floor(record.definition.actionCost / 2))
    : undefined
  return Object.freeze({
    ...record,
    definition: Object.freeze({
      ...record.definition,
      ...(healingPower === undefined ? {} : { healingPower }),
    }),
    effectTags: freezeStrings(record.effectTags),
  })
}""",
    'vertical defineSkill',
)
replace_once(
    'src/battle/event-log.ts',
    "  'damage_applied',\n  'effect_applied',",
    "  'damage_applied',\n  'healing_applied',\n  'effect_applied',",
    'event kind',
)
replace_once(
    'src/battle/event-log.ts',
    """export interface DamageAppliedPayload {
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId | null
  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly hpBefore: number
  readonly hpAfter: number
}

export interface EffectAppliedPayload {""",
    """export interface DamageAppliedPayload {
  readonly sourceBattleUnitId: BattleUnitId | null
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId | null
  readonly calculatedDamage: number
  readonly appliedDamage: number
  readonly hpBefore: number
  readonly hpAfter: number
}

export interface HealingAppliedPayload {
  readonly sourceBattleUnitId: BattleUnitId
  readonly targetBattleUnitId: BattleUnitId
  readonly skillId: SkillId
  readonly baseHealing: number
  readonly modifiedHealing: number
  readonly appliedHealing: number
  readonly overheal: number
  readonly hpBefore: number
  readonly hpAfter: number
}

export interface EffectAppliedPayload {""",
    'healing payload',
)
replace_once(
    'src/battle/event-log.ts',
    "export type DamageAppliedEvent = BattleEventBase<'damage_applied', DamageAppliedPayload>\nexport type EffectAppliedEvent",
    "export type DamageAppliedEvent = BattleEventBase<'damage_applied', DamageAppliedPayload>\nexport type HealingAppliedEvent = BattleEventBase<'healing_applied', HealingAppliedPayload>\nexport type EffectAppliedEvent",
    'healing event type',
)
replace_once(
    'src/battle/event-log.ts',
    "  | DamageAppliedEvent\n  | EffectAppliedEvent",
    "  | DamageAppliedEvent\n  | HealingAppliedEvent\n  | EffectAppliedEvent",
    'healing event union',
)
replace_once(
    'src/battle/event-log.ts',
    """    case 'damage_applied': {
      const payload = event.payload
      if (payload.sourceBattleUnitId !== null) {
        assertNonEmptyId(payload.sourceBattleUnitId, 'sourceBattleUnitId')
      }
      if (payload.skillId !== null) {
        assertNonEmptyId(payload.skillId, 'skillId')
      }
      assertNonEmptyId(payload.targetBattleUnitId, 'targetBattleUnitId')
      assertSafeIntegerAtLeast(payload.calculatedDamage, 1, 'calculatedDamage')
      assertSafeIntegerAtLeast(payload.appliedDamage, 1, 'appliedDamage')
      assertSafeIntegerAtLeast(payload.hpBefore, 1, 'hpBefore')
      assertSafeIntegerAtLeast(payload.hpAfter, 0, 'hpAfter')
      if (payload.appliedDamage > payload.calculatedDamage) {
        throw new Error('appliedDamage must not exceed calculatedDamage')
      }
      if (payload.hpBefore - payload.hpAfter !== payload.appliedDamage) {
        throw new Error('hpBefore - hpAfter must equal appliedDamage')
      }
      return
    }
    case 'effect_applied':""",
    """    case 'damage_applied': {
      const payload = event.payload
      if (payload.sourceBattleUnitId !== null) {
        assertNonEmptyId(payload.sourceBattleUnitId, 'sourceBattleUnitId')
      }
      if (payload.skillId !== null) {
        assertNonEmptyId(payload.skillId, 'skillId')
      }
      assertNonEmptyId(payload.targetBattleUnitId, 'targetBattleUnitId')
      assertSafeIntegerAtLeast(payload.calculatedDamage, 1, 'calculatedDamage')
      assertSafeIntegerAtLeast(payload.appliedDamage, 1, 'appliedDamage')
      assertSafeIntegerAtLeast(payload.hpBefore, 1, 'hpBefore')
      assertSafeIntegerAtLeast(payload.hpAfter, 0, 'hpAfter')
      if (payload.appliedDamage > payload.calculatedDamage) {
        throw new Error('appliedDamage must not exceed calculatedDamage')
      }
      if (payload.hpBefore - payload.hpAfter !== payload.appliedDamage) {
        throw new Error('hpBefore - hpAfter must equal appliedDamage')
      }
      return
    }
    case 'healing_applied': {
      const payload = event.payload
      assertNonEmptyId(payload.sourceBattleUnitId, 'sourceBattleUnitId')
      assertNonEmptyId(payload.targetBattleUnitId, 'targetBattleUnitId')
      assertNonEmptyId(payload.skillId, 'skillId')
      assertSafeIntegerAtLeast(payload.baseHealing, 1, 'baseHealing')
      assertSafeIntegerAtLeast(payload.modifiedHealing, 0, 'modifiedHealing')
      assertSafeIntegerAtLeast(payload.appliedHealing, 0, 'appliedHealing')
      assertSafeIntegerAtLeast(payload.overheal, 0, 'overheal')
      assertSafeIntegerAtLeast(payload.hpBefore, 1, 'hpBefore')
      assertSafeIntegerAtLeast(payload.hpAfter, 1, 'hpAfter')
      if (payload.appliedHealing + payload.overheal !== payload.modifiedHealing) {
        throw new Error('appliedHealing + overheal must equal modifiedHealing')
      }
      if (payload.hpAfter - payload.hpBefore !== payload.appliedHealing) {
        throw new Error('hpAfter - hpBefore must equal appliedHealing')
      }
      return
    }
    case 'effect_applied':""",
    'healing validation',
)

Path('src/battle/healing.ts').write_text("""import type { MonsterSpecies } from '../content/monster-species'
import { applyHealingReceivedModifier } from './stat-modifiers'
import { assertValidBattleUnitState, type BattleUnitState } from './unit-state'

export interface HealingResolution {
  readonly before: BattleUnitState
  readonly after: BattleUnitState
  readonly baseHealing: number
  readonly modifiedHealing: number
  readonly appliedHealing: number
  readonly overheal: number
}

function assertSafeIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer greater than or equal to ${minimum}`)
  }
}

export function resolveUnitHealing(
  target: BattleUnitState,
  targetSpecies: MonsterSpecies,
  baseHealing: number,
): HealingResolution {
  assertValidBattleUnitState(target, targetSpecies)
  assertSafeIntegerAtLeast(baseHealing, 1, 'baseHealing')
  if (target.defeated) throw new Error('defeated unit cannot receive healing')
  const modifiedHealing = applyHealingReceivedModifier(baseHealing, target.effects)
  const missingHp = Math.max(0, targetSpecies.stats.hp - target.hp)
  const appliedHealing = Math.min(modifiedHealing, missingHp)
  const after = Object.freeze({ ...target, hp: target.hp + appliedHealing })
  assertValidBattleUnitState(after, targetSpecies)
  return Object.freeze({
    before: target,
    after,
    baseHealing,
    modifiedHealing,
    appliedHealing,
    overheal: modifiedHealing - appliedHealing,
  })
}
""")
Path('src/battle/healing.test.ts').write_text("""import { describe, expect, it } from 'vitest'
import type { MonsterSpecies } from '../content/monster-species'
import { appendBattleEvent, EMPTY_BATTLE_EVENT_LOG } from './event-log'
import { resolveUnitHealing } from './healing'
import { createBattleUnitState } from './unit-state'

const species: MonsterSpecies = Object.freeze({
  id: 'species.healing-test',
  rarity: 1,
  attributeId: 'attribute.earth',
  primarySpeciesId: 'species-group.plant',
  tagIds: Object.freeze([]),
  innateSkillId: 'skill.healing-test',
  stats: Object.freeze({ hp: 100, attack: 10, defense: 10, speed: 3 }),
})

describe('unit healing', () => {
  it('applies missing HP and reports overheal deterministically', () => {
    const target = createBattleUnitState(species, {
      battleUnitId: 'ally.healing-target',
      position: { side: 'ALLY', row: 1, column: 1 },
      initialHp: 75,
    })
    const result = resolveUnitHealing(target, species, 40)
    expect(result).toMatchObject({
      baseHealing: 40,
      modifiedHealing: 40,
      appliedHealing: 25,
      overheal: 15,
    })
    expect(result.after.hp).toBe(100)
    expect(target.hp).toBe(75)
  })

  it('records a validated healing event including overheal', () => {
    const log = appendBattleEvent(EMPTY_BATTLE_EVENT_LOG, {
      kind: 'healing_applied',
      virtualTime: 100,
      payload: {
        sourceBattleUnitId: 'ally.healer',
        targetBattleUnitId: 'ally.target',
        skillId: 'skill.heal',
        baseHealing: 40,
        modifiedHealing: 40,
        appliedHealing: 25,
        overheal: 15,
        hpBefore: 75,
        hpAfter: 100,
      },
    })
    expect(log.events[0]).toMatchObject({
      kind: 'healing_applied',
      payload: { appliedHealing: 25, overheal: 15 },
    })
  })
})
""")

Path('.github/t048-support-model.py').unlink()
Path('.github/workflows/t048-support-model.yml').unlink()
