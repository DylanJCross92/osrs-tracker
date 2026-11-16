import { describe, expect, it } from 'vitest'
import { buildSteps, groupBySkill, nextSteps, NEXT_STEPS } from '@/utils/planSteps'
import { planGoal, xpAtLevel, AUTO_FAST } from '@/utils/planner'
import { buildTimeline } from '@/utils/plannerTools'

const goal = (skill, from, to) => ({ skill, currentXp: xpAtLevel(from), targetXp: xpAtLevel(to), methodId: AUTO_FAST, quests: [], customXpPerHour: 0 })
const build = (goals, hpd = 2) => {
  const plans = goals.map((g) => planGoal({ ...g, gpValuePerHour: 2_000_000 }))
  const timeline = buildTimeline(goals, plans, hpd)
  return { plans, timeline, steps: buildSteps(goals, plans, timeline, hpd) }
}

describe('buildSteps', () => {
  const goals = [goal('Mining', 1, 60), goal('Fishing', 1, 40), goal('Woodcutting', 99, 99)]
  const { plans, timeline, steps } = build(goals)

  it('lists every step goal by goal in the plan order and skips goals that are already reached', () => {
    expect(steps.length).toBeGreaterThan(2)
    expect(steps.every((s) => s.skill !== 'Woodcutting')).toBe(true)
    const order = steps.map((s) => s.skill)
    expect(order.indexOf('Fishing')).toBeGreaterThan(order.lastIndexOf('Mining'))
    expect(steps.map((s) => s.number)).toEqual(steps.map((_, i) => i + 1))
  })

  it('has steps that run end to end and add up to the timeline', () => {
    for (let i = 1; i < steps.length; i++) expect(steps[i].startHours).toBeCloseTo(steps[i - 1].endHours, 6)
    expect(steps.at(-1).endHours).toBeCloseTo(timeline.totalHours, 6)
    const planHours = plans.reduce((sum, p) => sum + (p.hours || 0), 0)
    expect(steps.reduce((sum, s) => sum + s.hours, 0)).toBeCloseTo(planHours, 6)
  })

  it('gives each step the dates for the daily playtime', () => {
    const slow = build(goals, 1).steps.at(-1).endDate.getTime()
    const fast = build(goals, 4).steps.at(-1).endDate.getTime()
    expect(slow).toBeGreaterThan(fast)
    expect(buildSteps(goals, plans, timeline, 0)[0].startDate).toBeNull()
  })
})

describe('nextSteps and groupBySkill', () => {
  const goals = [goal('Mining', 1, 60), goal('Fishing', 1, 40)]
  const { steps } = build(goals)

  it('takes the first few steps', () => {
    expect(nextSteps(steps)).toHaveLength(NEXT_STEPS)
    expect(nextSteps(steps)[0]).toBe(steps[0])
    expect(nextSteps(steps.slice(0, 2))).toHaveLength(2)
  })

  it('groups steps under their skill with totals, keeping the order', () => {
    const groups = groupBySkill(steps)
    expect(groups.map((g) => g.skill)).toEqual(['Mining', 'Fishing'])
    expect(groups.reduce((n, g) => n + g.steps.length, 0)).toBe(steps.length)
    expect(groups[0].hours).toBeCloseTo(steps.filter((s) => s.skill === 'Mining').reduce((a, s) => a + s.hours, 0), 6)
    expect(groups[0].startLevel).toBe(1)
    expect(groups[0].endLevel).toBe(60)
  })

  it('works on just the first steps (a partly shown route)', () => {
    const groups = groupBySkill(nextSteps(steps))
    expect(groups.reduce((n, g) => n + g.steps.length, 0)).toBe(NEXT_STEPS)
  })
})

describe('withCompleted and goalStatus', () => {
  const goals = [goal('Mining', 1, 60), goal('Fishing', 1, 40)]
  const original = goals.map((g) => planGoal({ ...g, gpValuePerHour: 2_000_000 }))
  const { steps } = build(goals)

  it('adds nothing when nobody is tracked, and numbers the steps', async () => {
    const { withCompleted } = await import('@/utils/planSteps')
    const all = withCompleted(steps, goals, original, null)
    expect(all).toHaveLength(steps.length)
    expect(all.every((s) => s.done === false)).toBe(true)
    expect(all.map((s) => s.number)).toEqual(all.map((_, i) => i + 1))
  })

  it('puts the finished stretches of a tracked player in front of the goal, marked done, in the plan order', async () => {
    const { withCompleted } = await import('@/utils/planSteps')
    // The player has trained Mining to 30 since the plan began: the plan from there on is what is left.
    const liveGoals = [{ ...goals[0], currentXp: xpAtLevel(30) }, goals[1]]
    const livePlans = liveGoals.map((g) => planGoal({ ...g, gpValuePerHour: 2_000_000 }))
    const liveSteps = buildSteps(liveGoals, livePlans, buildTimeline(liveGoals, livePlans, 2), 2)
    const all = withCompleted(liveSteps, goals, original, (skill) => (skill === 'Mining' ? xpAtLevel(30) : xpAtLevel(1)))
    const done = all.filter((s) => s.done)
    expect(done.length).toBeGreaterThan(0)
    expect(done.every((s) => s.skill === 'Mining' && s.seg.toXp <= xpAtLevel(30))).toBe(true)
    // Done Mining steps, then the remaining Mining steps, then Fishing.
    const firstTodo = all.findIndex((s) => !s.done)
    expect(all.slice(0, firstTodo).every((s) => s.done)).toBe(true)
    expect(all.at(-1).skill).toBe('Fishing')
    expect(all.map((s) => s.number)).toEqual(all.map((_, i) => i + 1))
  })

  it('says where a goal stands', async () => {
    const { goalStatus } = await import('@/utils/planSteps')
    expect(goalStatus({ remainingXp: 0 }, null)).toBe('done')
    expect(goalStatus({ remainingXp: 10 }, { done: true })).toBe('done')
    expect(goalStatus({ remainingXp: 10 }, { done: false, gained: 5 })).toBe('active')
    expect(goalStatus({ remainingXp: 10 }, { done: false, gained: 0 })).toBe('todo')
    expect(goalStatus({ remainingXp: 10 }, null)).toBe('todo')
  })
})
