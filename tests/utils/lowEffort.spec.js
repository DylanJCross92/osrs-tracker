import { describe, expect, it } from 'vitest'
import { AUTO_AFK, AUTO_FAST, GLOBAL_STRATEGIES, planGoal, xpAtLevel } from '@/utils/planner'
import { encodePlan, decodePlan } from '@/utils/planner'
import { STRATEGY_LABELS } from '@/utils/plannerTools'

const goal = (skill, from, to, methodId) => ({ skill, currentXp: xpAtLevel(from), targetXp: xpAtLevel(to), methodId, customXpPerHour: 0, quests: [] })

describe('the low effort training style', () => {
  it('is one of the plan strategies, with a label', () => {
    expect(GLOBAL_STRATEGIES).toContain(AUTO_AFK)
    expect(STRATEGY_LABELS[AUTO_AFK]).toBe('Low effort')
  })
  it('only uses AFK or low-effort methods where there are any, and is never faster than the fastest route', () => {
    for (const skill of ['Fishing', 'Woodcutting', 'Mining', 'Hunter']) {
      const afk = planGoal(goal(skill, 30, 90, AUTO_AFK))
      const fast = planGoal(goal(skill, 30, 90, AUTO_FAST))
      expect(afk.segments.length).toBeGreaterThan(0)
      expect(afk.hours).toBeGreaterThanOrEqual(fast.hours - 1e-6)
      const low = afk.segments.filter((s) => s.method && ['AFK', 'Low'].includes(s.method.intensity))
      expect(low.length).toBeGreaterThan(0)
    }
  })
  it('still covers every level (no gap) and lands on the goal', () => {
    const plan = planGoal(goal('Mining', 1, 99, AUTO_AFK))
    expect(plan.complete).toBe(true)
    expect(plan.segments[0].fromXp).toBe(xpAtLevel(1))
    expect(plan.segments[plan.segments.length - 1].toXp).toBe(xpAtLevel(99))
  })
  it('is kept in a plan link', () => {
    const goals = [goal('Mining', 1, 60, 'global')]
    const params = encodePlan({ goals, strategy: AUTO_AFK, hoursPerDay: 2 })
    expect(params.get('s')).toBe(AUTO_AFK)
    expect(decodePlan(Object.fromEntries(params), ['Mining']).strategy).toBe(AUTO_AFK)
  })
})
