import { describe, expect, it } from 'vitest'
import { applyMembership, freeMethodIds, skillsWithoutFreeRoute } from '@/utils/membership'
import { encodePlan, decodePlan, planGoal, xpAtLevel, AUTO_FAST } from '@/utils/planner'
import { snapshotPlan, validatePlan, planFingerprint } from '@/utils/plannerTools'
import { F2P_METHOD_IDS } from '@/data/plannerMilestones'
import { SKILL_NAMES } from '@/utils/osrsSkills'

const goal = (skill, from = 1, to = 70, extra = {}) => ({ skill, currentXp: xpAtLevel(from), targetXp: xpAtLevel(to), methodId: 'global', customXpPerHour: 0, quests: [], ...extra })

describe('free-to-play plans', () => {
  it('limits every goal that has free methods to them, and leaves members-only skills alone', () => {
    const out = applyMembership([goal('Smithing'), goal('Agility')], false)
    expect(out[0].allowedMethodIds.length).toBeGreaterThan(0)
    for (const id of out[0].allowedMethodIds) expect(F2P_METHOD_IDS.has(id)).toBe(true)
    expect(out[1].allowedMethodIds).toBeUndefined()
    expect(skillsWithoutFreeRoute([goal('Smithing'), goal('Agility'), goal('Slayer')])).toEqual(['Agility', 'Slayer'])
  })

  it('works the goal out with free methods only', () => {
    const free = applyMembership([goal('Smithing', 1, 99)], false)[0]
    const plan = planGoal({ ...free, methodId: AUTO_FAST })
    for (const seg of plan.segments) if (seg.method) expect(F2P_METHOD_IDS.has(seg.method.id)).toBe(true)
  })

  it('takes the free-to-play limit off again for members, but keeps a limit chosen for another reason', () => {
    const free = applyMembership([goal('Smithing')], false)
    expect(applyMembership(free, true)[0].allowedMethodIds).toBeUndefined()
    const afk = [goal('Smithing', 1, 70, { allowedMethodIds: ['smithing-giants-foundry'] })]
    expect(applyMembership(afk, true)[0].allowedMethodIds).toEqual(['smithing-giants-foundry'])
    // free-to-play on a goal already limited keeps the free ones of that limit, or all the free ones if none are free
    expect(applyMembership(afk, false)[0].allowedMethodIds).toEqual(freeMethodIds('Smithing'))
  })

  it('is kept in the address, in a saved plan and in what makes two plans the same', () => {
    const base = { username: '', hoursPerDay: 2, goals: [goal('Smithing')], strategy: AUTO_FAST, gpValue: 2_000_000, budget: null, statsAt: null }
    expect(encodePlan({ ...base, members: false }).get('m')).toBe('0')
    expect(encodePlan(base).has('m')).toBe(false)
    const q = Object.fromEntries(encodePlan({ ...base, members: false }))
    expect(decodePlan(q, SKILL_NAMES).members).toBe(false)
    expect(decodePlan(Object.fromEntries(encodePlan(base)), SKILL_NAMES).members).toBe(true)

    const state = { rsn: '', playerId: null, statsAt: null, globalStrategy: AUTO_FAST, gpValue: 2_000_000, budget: null, hoursPerDay: 2, goals: [goal('Smithing')] }
    const free = snapshotPlan({ ...state, members: false }, 'Free plan')
    const mem = snapshotPlan(state, 'Members plan')
    expect(free.members).toBe(false)
    expect('members' in mem).toBe(false)
    expect(validatePlan(free).plan.members).toBe(false)
    expect(validatePlan(mem).plan.members).toBeUndefined()
    expect(planFingerprint(free)).not.toBe(planFingerprint(mem))
  })
})
