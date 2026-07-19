import { describe, expect, it } from 'vitest'
import type { AiDecisionConfiguration } from '../ai/strategy-presets'
import type { MonsterSpecies } from '../content/monster-species'
import type { SkillDefinition } from '../content/skill-definition'
import { MemoryPlayerDataRepository } from '../save/memory-player-data-repository'
import type { PlayerSaveSlotId } from '../save/player-data-repository'
import {
  createPlayerData,
  getFormationMemberEquippedSkillIds,
  type FormationMember,
  type PlayerData,
  type PlayerDataContentCatalog,
  type PlayerFormation,
  type PlayerUnitInstance,
} from './player-data'

const INNATE_A: SkillDefinition = Object.freeze({
  id: 'skill.innate.a',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})
const INNATE_B: SkillDefinition = Object.freeze({
  id: 'skill.innate.b',
  slotType: 'INNATE',
  actionCost: 100,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1000,
})
const GENERIC_A: SkillDefinition = Object.freeze({
  id: 'skill.generic.a',
  slotType: 'GENERIC',
  actionCost: 90,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 900,
})
const GENERIC_B: SkillDefinition = Object.freeze({
  id: 'skill.generic.b',
  slotType: 'GENERIC',
  actionCost: 110,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1200,
})
const GENERIC_C: SkillDefinition = Object.freeze({
  id: 'skill.generic.c',
  slotType: 'GENERIC',
  actionCost: 105,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1100,
})
const BLOOM_A: SkillDefinition = Object.freeze({
  id: 'skill.bloom.a',
  slotType: 'BLOOM',
  actionCost: 150,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1800,
})
const BLOOM_B: SkillDefinition = Object.freeze({
  id: 'skill.bloom.b',
  slotType: 'BLOOM',
  actionCost: 150,
  targetType: 'SINGLE_ENEMY',
  damageMultiplierPermille: 1800,
})

const SPECIES_A: MonsterSpecies = Object.freeze({
  id: 'species.a',
  rarity: 3,
  attributeId: 'attribute.fire',
  primarySpeciesId: 'species.a',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 100, attack: 30, defense: 20, speed: 25 }),
  innateSkillId: INNATE_A.id,
  bloomSkillIds: Object.freeze([BLOOM_A.id]),
})
const SPECIES_B: MonsterSpecies = Object.freeze({
  id: 'species.b',
  rarity: 2,
  attributeId: 'attribute.water',
  primarySpeciesId: 'species.b',
  tagIds: Object.freeze([]),
  stats: Object.freeze({ hp: 120, attack: 24, defense: 25, speed: 20 }),
  innateSkillId: INNATE_B.id,
  bloomSkillIds: Object.freeze([BLOOM_B.id]),
})

const CATALOG: PlayerDataContentCatalog = Object.freeze({
  species: Object.freeze([SPECIES_B, SPECIES_A]),
  skills: Object.freeze([
    GENERIC_C,
    BLOOM_B,
    INNATE_B,
    GENERIC_B,
    BLOOM_A,
    GENERIC_A,
    INNATE_A,
  ]),
})

function standardAi(
  skillPolicies: AiDecisionConfiguration['skillPolicies'] = [],
): AiDecisionConfiguration {
  return {
    individualStrategy: 'STANDARD',
    teamStrategy: 'STABLE_CLEAR',
    skillPolicies,
  }
}

function instanceA(): PlayerUnitInstance {
  return {
    instanceId: 'instance.a',
    speciesId: SPECIES_A.id,
    learnedGenericSkillIds: [GENERIC_B.id, GENERIC_A.id],
    nickname: 'Alpha',
    favorite: true,
    locked: false,
    conditionBasisPoints: 10_000,
  }
}

function instanceB(): PlayerUnitInstance {
  return {
    instanceId: 'instance.b',
    speciesId: SPECIES_B.id,
    learnedGenericSkillIds: [],
    nickname: null,
    favorite: false,
    locked: true,
    conditionBasisPoints: 8_500,
  }
}

function memberA(overrides: Partial<FormationMember> = {}): FormationMember {
  return {
    instanceId: 'instance.a',
    position: { row: 0, column: 0 },
    loadout: { genericSkillId: GENERIC_A.id, bloomSkillId: BLOOM_A.id },
    tiePriority: 1,
    ai: standardAi([
      { skillId: INNATE_A.id, policy: 'STANDARD' },
      { skillId: GENERIC_A.id, policy: 'CONSERVE' },
      { skillId: BLOOM_A.id, policy: 'AGGRESSIVE_USE' },
    ]),
    ...overrides,
  }
}

function memberB(overrides: Partial<FormationMember> = {}): FormationMember {
  return {
    instanceId: 'instance.b',
    position: { row: 0, column: 1 },
    loadout: { genericSkillId: null, bloomSkillId: null },
    tiePriority: 0,
    ai: standardAi(),
    ...overrides,
  }
}

function formation(
  formationId: string,
  members: readonly FormationMember[],
  name = formationId,
): PlayerFormation {
  return { formationId, name, members }
}

function createInput(): PlayerData {
  return {
    schemaVersion: 1,
    gameVersion: '0.0.0',
    contentVersion: 'content.test.1',
    collection: {
      speciesStates: [
        {
          speciesId: SPECIES_B.id,
          blueprintUnlocked: false,
          analysisBasisPoints: 1250,
          bloomSkillIds: [],
          encyclopediaStageId: 'encyclopedia.hinted',
          statistics: { victories: 1 },
        },
        {
          speciesId: SPECIES_A.id,
          blueprintUnlocked: true,
          analysisBasisPoints: 7500,
          bloomSkillIds: [BLOOM_A.id],
          encyclopediaStageId: 'encyclopedia.known',
          statistics: { victories: 3, encounters: 8 },
        },
      ],
      unitInstances: [instanceB(), instanceA()],
    },
    formations: {
      activeFormationId: 'formation.main',
      formations: [
        formation('formation.reserve', [
          memberA({
            loadout: { genericSkillId: GENERIC_B.id, bloomSkillId: null },
            ai: {
              individualStrategy: 'CAUTIOUS',
              teamStrategy: 'LOSS_MINIMIZATION',
              skillPolicies: [{ skillId: GENERIC_B.id, policy: 'AUTO_DISABLED' }],
            },
          }),
        ]),
        formation('formation.main', [memberB(), memberA()], 'Main'),
      ],
    },
  }
}

describe('player data and formation model', () => {
  it('normalizes fixed IDs and keeps equipment on each formation member', () => {
    const input = createInput()
    const normalized = createPlayerData(input, CATALOG)

    expect(normalized.collection.speciesStates.map((state) => state.speciesId)).toEqual([
      SPECIES_A.id,
      SPECIES_B.id,
    ])
    expect(normalized.collection.unitInstances.map((instance) => instance.instanceId)).toEqual([
      'instance.a',
      'instance.b',
    ])
    expect(normalized.formations.formations.map((item) => item.formationId)).toEqual([
      'formation.main',
      'formation.reserve',
    ])
    expect(normalized.formations.formations[0]?.members.map((member) => member.instanceId)).toEqual([
      'instance.a',
      'instance.b',
    ])
    expect(
      getFormationMemberEquippedSkillIds(
        normalized,
        'formation.main',
        'instance.a',
        CATALOG,
      ),
    ).toEqual([INNATE_A.id, GENERIC_A.id, BLOOM_A.id])
    expect(
      getFormationMemberEquippedSkillIds(
        normalized,
        'formation.reserve',
        'instance.a',
        CATALOG,
      ),
    ).toEqual([INNATE_A.id, GENERIC_B.id])

    expect(Object.isFrozen(normalized)).toBe(true)
    expect(Object.isFrozen(normalized.collection.unitInstances)).toBe(true)
    expect(Object.isFrozen(normalized.formations.formations[0]?.members)).toBe(true)
    expect(input.collection.unitInstances[0]?.instanceId).toBe('instance.b')
  })

  it('rejects duplicate owned instance IDs', () => {
    const input = createInput()
    const duplicate: PlayerData = {
      ...input,
      collection: {
        ...input.collection,
        unitInstances: [...input.collection.unitInstances, instanceA()],
      },
    }

    expect(() => createPlayerData(duplicate, CATALOG)).toThrow(
      'unit instance id must be unique: instance.a',
    )
  })

  it('rejects duplicate formation instances, positions, and tie priorities', () => {
    const input = createInput()
    const replaceMain = (members: readonly FormationMember[]): PlayerData => ({
      ...input,
      formations: {
        activeFormationId: 'formation.main',
        formations: [formation('formation.main', members)],
      },
    })

    expect(() =>
      createPlayerData(
        replaceMain([
          memberA(),
          memberA({ position: { row: 1, column: 0 }, tiePriority: 2 }),
        ]),
        CATALOG,
      ),
    ).toThrow('formation instance must be unique: instance.a')

    expect(() =>
      createPlayerData(
        replaceMain([memberA(), memberB({ position: { row: 0, column: 0 } })]),
        CATALOG,
      ),
    ).toThrow('formation position must be unique: 0:0')

    expect(() =>
      createPlayerData(
        replaceMain([memberA(), memberB({ tiePriority: 1 })]),
        CATALOG,
      ),
    ).toThrow('formation tiePriority must be unique: 1')
  })

  it('rejects unlearned generic and locked bloom loadouts', () => {
    const input = createInput()
    const withMember = (member: FormationMember): PlayerData => ({
      ...input,
      formations: {
        activeFormationId: 'formation.main',
        formations: [formation('formation.main', [member])],
      },
    })

    expect(() =>
      createPlayerData(
        withMember(
          memberA({ loadout: { genericSkillId: GENERIC_C.id, bloomSkillId: BLOOM_A.id } }),
        ),
        CATALOG,
      ),
    ).toThrow(`equipped generic skill is not learned: ${GENERIC_C.id}`)

    expect(() =>
      createPlayerData(
        withMember(
          memberA({ loadout: { genericSkillId: GENERIC_A.id, bloomSkillId: BLOOM_B.id } }),
        ),
        CATALOG,
      ),
    ).toThrow(`equipped bloom skill is not unlocked: ${BLOOM_B.id}`)
  })

  it('limits AI policies to innate and currently equipped skills', () => {
    const input = createInput()
    const invalid: PlayerData = {
      ...input,
      formations: {
        activeFormationId: 'formation.main',
        formations: [
          formation('formation.main', [
            memberA({
              loadout: { genericSkillId: GENERIC_A.id, bloomSkillId: null },
              ai: standardAi([{ skillId: GENERIC_B.id, policy: 'STANDARD' }]),
            }),
          ]),
        ],
      },
    }

    expect(() => createPlayerData(invalid, CATALOG)).toThrow(
      `skill policy references unavailable skill: ${GENERIC_B.id}`,
    )
  })
})

describe('memory player data repository', () => {
  it('stores detached immutable snapshots in the three fixed slots', async () => {
    const source = createPlayerData(createInput(), CATALOG)
    const repository = new MemoryPlayerDataRepository(CATALOG)

    expect(await repository.listSlots()).toEqual([])
    await repository.save('slot-2', source)
    await repository.save('slot-1', source)
    expect(await repository.listSlots()).toEqual(['slot-1', 'slot-2'])

    const firstLoad = await repository.load('slot-1')
    const secondLoad = await repository.load('slot-1')
    expect(firstLoad).toEqual(source)
    expect(firstLoad).not.toBe(source)
    expect(secondLoad).not.toBe(firstLoad)
    expect(Object.isFrozen(firstLoad)).toBe(true)

    await repository.delete('slot-1')
    expect(await repository.load('slot-1')).toBeNull()
    expect(await repository.listSlots()).toEqual(['slot-2'])
  })

  it('rejects invalid runtime slot IDs and invalid player snapshots', async () => {
    const repository = new MemoryPlayerDataRepository(CATALOG)
    await expect(repository.load('slot-4' as PlayerSaveSlotId)).rejects.toThrow(
      'invalid player save slot id: slot-4',
    )

    const invalid: PlayerData = {
      ...createInput(),
      schemaVersion: 0,
    }
    await expect(repository.save('slot-1', invalid)).rejects.toThrow(
      'playerData.schemaVersion must be a safe integer from 1',
    )
  })
})
