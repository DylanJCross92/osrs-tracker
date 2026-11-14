import { describe, expect, it } from 'vitest'
import { AUTO_FAST, cleanOverrides, decodePlan, encodePlan, planGoal, setOverrideRange, xpAtLevel } from '@/utils/planner'
import { snapshotPlan, validatePlan, planFingerprint } from '@/utils/plannerTools'
import { methodsForSkill } from '@/data/trainingMethods'
import { SKILL_NAMES } from '@/utils/osrsSkills'

const skill = 'Mining'
const base = { skill, currentXp: xpAtLevel(1), targetXp: xpAtLevel(60), methodId: AUTO_FAST, customXpPerHour: 0, quests: [] }
// A method that works for levels 30 to 39 and is not what the fastest route would use there.
const auto = planGoal(base)
const usedAt30 = new Set(auto.segments.filter((s) => s.startLevel < 40 && s.endLevel > 30).map((s) => s.method?.id))
const pick = methodsForSkill(skill).find((m) => m.minLevel <= 30 && (m.maxLevel == null || m.maxLevel >= 39) && !usedAt30.has(m.id))

describe('manual methods for sets of levels', () => {
  it('has a method to test with', () => {
    expect(pick).toBeTruthy()
  })

  it('uses the chosen method for those levels and the recommended route everywhere else', () => {
    const plan = planGoal({ ...base, overrides: [{ fromLevel: 30, toLevel: 40, methodId: pick.id }] })
    const manual = plan.segments.filter((s) => s.kind === 'manual')
    expect(manual).toHaveLength(1)
    expect(manual[0].method.id).toBe(pick.id)
    expect([manual[0].startLevel, manual[0].endLevel]).toEqual([30, 40])
    // The pieces still add up to the whole goal, with nothing counted twice.
    expect(plan.segments.reduce((a, s) => a + s.xp, 0)).toBe(base.targetXp - base.currentXp)
    for (let i = 1; i < plan.segments.length; i++) expect(plan.segments[i].fromXp).toBe(plan.segments[i - 1].toXp)
    // Outside the range the route is the one the strategy gave.
    expect(plan.segments.filter((s) => s.kind !== 'manual').map((s) => s.method?.id)).toEqual(expect.arrayContaining([auto.segments[0].method.id]))
    expect(plan.hours).not.toBe(auto.hours)
  })

  it('ignores choices outside the goal and unknown methods', () => {
    const same = planGoal({ ...base, overrides: [{ fromLevel: 70, toLevel: 80, methodId: pick.id }, { fromLevel: 10, toLevel: 20, methodId: 'no-such-method' }] })
    expect(same.hours).toBe(auto.hours)
    expect(same.segments.some((s) => s.kind === 'manual')).toBe(false)
  })

  it('replaces, trims and joins ranges', () => {
    let list = setOverrideRange([], 20, 40, 'a')
    list = setOverrideRange(list, 30, 50, 'b')
    expect(list).toEqual([{ fromLevel: 20, toLevel: 30, methodId: 'a' }, { fromLevel: 30, toLevel: 50, methodId: 'b' }])
    list = setOverrideRange(list, 25, 35, 'b')
    expect(list).toEqual([{ fromLevel: 20, toLevel: 25, methodId: 'a' }, { fromLevel: 25, toLevel: 50, methodId: 'b' }])
    list = setOverrideRange(list, 22, 45, null)
    expect(list).toEqual([{ fromLevel: 20, toLevel: 22, methodId: 'a' }, { fromLevel: 45, toLevel: 50, methodId: 'b' }])
    expect(cleanOverrides([{ fromLevel: 5, toLevel: 5, methodId: 'x' }, { fromLevel: 'a', toLevel: 9, methodId: 'x' }])).toEqual([])
  })

  it('survives a plan link and a saved plan', () => {
    const goal = { ...base, overrides: [{ fromLevel: 30, toLevel: 40, methodId: pick.id }] }
    const params = encodePlan({ username: '', hoursPerDay: 2, goals: [goal], strategy: AUTO_FAST, gpValue: 2_000_000, budget: null, statsAt: null })
    const back = decodePlan(Object.fromEntries(params), SKILL_NAMES)
    expect(back.goals[0].overrides).toEqual(goal.overrides)

    const saved = snapshotPlan({ rsn: '', playerId: null, statsAt: null, globalStrategy: AUTO_FAST, gpValue: 2_000_000, hoursPerDay: 2, goals: [goal] }, 'Test')
    expect(saved.goals[0].overrides).toEqual(goal.overrides)
    const checked = validatePlan(JSON.parse(JSON.stringify(saved)))
    expect(checked.plan.goals[0].overrides).toEqual(goal.overrides)
    // A manual choice is a change worth saving.
    expect(planFingerprint(saved)).not.toBe(planFingerprint({ ...saved, goals: [{ ...goal, overrides: [] }] }))
  })
})
