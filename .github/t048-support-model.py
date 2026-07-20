from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'src/balance/vertical-slice-benchmark.ts',
    'export const VERTICAL_SLICE_BALANCE_REPORT_VERSION = 1',
    'export const VERTICAL_SLICE_BALANCE_REPORT_VERSION = 2',
    'report version',
)
replace_once(
    'src/balance/vertical-slice-benchmark.ts',
    """  readonly capabilities: {
    readonly healingResolutionAvailable: false
    readonly overhealRateBasisPoints: null
    readonly note: string
  }
""",
    """  readonly capabilities: {
    readonly healingResolutionAvailable: true
    readonly overhealRateBasisPoints: number
    readonly totalModifiedHealing: number
    readonly totalAppliedHealing: number
    readonly totalOverheal: number
    readonly note: string
  }
""",
    'report capabilities',
)

benchmark = Path('src/balance/vertical-slice-t046-benchmark.ts')
text = benchmark.read_text()
text = text.replace(
    """  readonly calculatedDamage: number
  readonly overkillDamage: number
}""",
    """  readonly calculatedDamage: number
  readonly overkillDamage: number
  readonly modifiedHealing: number
  readonly appliedHealing: number
  readonly overheal: number
}""",
    1,
)
text = text.replace(
    """  appliedDamage: number
  redirectedDamage: number
""",
    """  appliedDamage: number
  healing: number
  redirectedDamage: number
""",
    1,
)
text = text.replace(
    """    appliedDamage: 0,
    redirectedDamage: 0,
""",
    """    appliedDamage: 0,
    healing: 0,
    redirectedDamage: 0,
""",
    1,
)
text = text.replace(
    """  let calculatedDamage = 0
  let overkillDamage = 0
""",
    """  let calculatedDamage = 0
  let overkillDamage = 0
  let modifiedHealing = 0
  let appliedHealing = 0
  let overheal = 0
""",
    1,
)
text = text.replace(
    """    } else if (event.kind === 'guard_shared') {
""",
    """    } else if (event.kind === 'healing_applied') {
      modifiedHealing += event.payload.modifiedHealing
      appliedHealing += event.payload.appliedHealing
      overheal += event.payload.overheal
      const species = speciesMap.get(event.payload.sourceBattleUnitId)
      const side = sideMap.get(event.payload.sourceBattleUnitId)
      if (species !== undefined && side !== undefined) {
        contribution(contributions, side, species).healing += event.payload.appliedHealing
      }
    } else if (event.kind === 'guard_shared') {
""",
    1,
)
text = text.replace(
    """    calculatedDamage,
    overkillDamage,
  })
""",
    """    calculatedDamage,
    overkillDamage,
    modifiedHealing,
    appliedHealing,
    overheal,
  })
""",
    1,
)
text = text.replace(
    """        const totalActionValue = value.appliedDamage + value.redirectedDamage + value.barrierAbsorbed
        return Object.freeze({
          ...value,
          healing: 0,
          totalActionValue,
""",
    """        const totalActionValue =
          value.appliedDamage + value.healing + value.redirectedDamage + value.barrierAbsorbed
        return Object.freeze({
          ...value,
          totalActionValue,
""",
    1,
)
text = text.replace(
    """  const totalSkillUses = [...skillUses.values()].reduce((total, uses) => total + uses, 0)
  const contributions = freezeContributions(mutableContributions)

  return Object.freeze({
""",
    """  const totalSkillUses = [...skillUses.values()].reduce((total, uses) => total + uses, 0)
  const contributions = freezeContributions(mutableContributions)
  const totalModifiedHealing = allSamples.reduce(
    (total, sample) => total + sample.modifiedHealing,
    0,
  )
  const totalAppliedHealing = allSamples.reduce(
    (total, sample) => total + sample.appliedHealing,
    0,
  )
  const totalOverheal = allSamples.reduce((total, sample) => total + sample.overheal, 0)

  return Object.freeze({
""",
    1,
)
text = text.replace(
    """    capabilities: Object.freeze({
      healingResolutionAvailable: false,
      overhealRateBasisPoints: null,
      note: 'The current runner executes SINGLE_ENEMY skills only; healing and overheal are explicitly unavailable.',
    }),
""",
    """    capabilities: Object.freeze({
      healingResolutionAvailable: true,
      overhealRateBasisPoints: basisPoints(totalOverheal, totalModifiedHealing),
      totalModifiedHealing,
      totalAppliedHealing,
      totalOverheal,
      note: 'Healing is resolved by the same interactive/headless runner and measured from healing_applied events.',
    }),
""",
    1,
)
benchmark.write_text(text)

release_test = Path('src/release/t048-release-readiness.test.ts')
text = release_test.read_text()
old = """  it('records support resolution as unavailable until the runner accepts ally-target skills', () => {
    expect(RELEASE_BALANCE_REPORT.capabilities).toEqual({
      healingResolutionAvailable: false,
      overhealRateBasisPoints: null,
      note: 'The current runner executes SINGLE_ENEMY skills only; healing and overheal are explicitly unavailable.',
    })
  })
"""
new = """  it('records resolved healing and a bounded overheal rate', () => {
    expect(RELEASE_BALANCE_REPORT.capabilities.healingResolutionAvailable).toBe(true)
    expect(RELEASE_BALANCE_REPORT.capabilities.totalModifiedHealing).toBeGreaterThan(0)
    expect(RELEASE_BALANCE_REPORT.capabilities.totalAppliedHealing).toBeGreaterThan(0)
    expect(RELEASE_BALANCE_REPORT.capabilities.totalOverheal).toBeGreaterThanOrEqual(0)
    expect(RELEASE_BALANCE_REPORT.capabilities.overhealRateBasisPoints).toBeLessThanOrEqual(3500)
  })
"""
if old not in text:
    raise SystemExit('release healing capability test anchor not found')
release_test.write_text(text.replace(old, new, 1))

balance_test = Path('src/balance/vertical-slice-t046-benchmark.test.ts')
text = balance_test.read_text()
text = text.replace(
    """    expect(REPORT.capabilities.healingResolutionAvailable).toBe(false)
    expect(REPORT.capabilities.overhealRateBasisPoints).toBeNull()
""",
    """    expect(REPORT.capabilities.healingResolutionAvailable).toBe(true)
    expect(REPORT.capabilities.totalModifiedHealing).toBeGreaterThan(0)
    expect(REPORT.capabilities.totalAppliedHealing).toBeGreaterThan(0)
    expect(REPORT.capabilities.overhealRateBasisPoints).toBeLessThanOrEqual(3500)
""",
    1,
)
balance_test.write_text(text)

Path('.github/t048-support-model.py').unlink()
Path('.github/workflows/t048-support-model.yml').unlink(missing_ok=True)
