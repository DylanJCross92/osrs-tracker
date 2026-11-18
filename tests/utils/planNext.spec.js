import { describe, expect, it } from 'vitest'
import { planNext } from '@/utils/planNext'
import { buildTimeline } from '@/utils/plannerTools'
import { xpAtLevel } from '@/utils/planner'

const plan = (startLevel, targetLevel, xpPerHour) => {
  const startXp = xpAtLevel(startLevel)
  const targetXp = xpAtLevel(targetLevel)
  const hours = Math.max(0, (targetXp - startXp) / xpPerHour)
  return { startXp, targetXp, hours, netGp: 0, segments: [{ fromXp: startXp, toXp: targetXp, hours }] }
}
// A route that changes method at the given levels: [{ name, from }] with each running until the next one starts.
const route = (methods, targetLevel, xpPerHour) => {
  const bounds = [...methods.map((m) => xpAtLevel(m.from)), xpAtLevel(targetLevel)]
  const segments = methods.map((m, n) => ({ method: { id: m.name, name: m.name }, fromXp: bounds[n], toXp: bounds[n + 1], hours: (bounds[n + 1] - bounds[n]) / xpPerHour }))
  return { startXp: bounds[0], targetXp: bounds[bounds.length - 1], hours: segments.reduce((t, x) => t + x.hours, 0), netGp: 0, segments }
}
const run = (goals, plans, hpd = 2) => planNext(goals, plans, buildTimeline(goals, plans, hpd), hpd)

describe('planNext', () => {
  it('lists the next level, the next method it unlocks and the goal, soonest first', () => {
    const p = route([{ name: 'Iron ore', from: 45 }, { name: 'Motherlode Mine', from: 60 }, { name: 'Amethyst', from: 80 }], 99, 100_000)
    const items = run([{ skill: 'Mining' }], [p])
    expect(items.map((i) => i.kind)).toEqual(['level', 'milestone', 'goal'])
    expect(items[0].title).toBe('Reach level 46 Mining')
    expect(items[1].title).toBe('Unlock Motherlode Mine')
    expect(items[1].detail).toMatch(/^Level 60 Mining · /)
    expect(items[2].title).toBe('Reach level 99 Mining')
    expect(items.every((it, n) => n === 0 || items[n - 1].etaDays <= it.etaDays)).toBe(true)
  })

  it('dates an unlock at the hours it takes to get there, and only shows the next one', () => {
    const p = route([{ name: 'A', from: 50 }, { name: 'B', from: 70 }, { name: 'C', from: 85 }], 99, 100_000)
    const items = run([{ skill: 'Mining' }], [p], 4)
    const unlocks = items.filter((i) => i.kind === 'milestone')
    expect(unlocks).toHaveLength(1)
    expect(unlocks[0].etaDays).toBeCloseTo(p.segments[0].hours / 4)
  })

  it("has no milestone when a skill stays on one method, and finds the next skill's switch instead", () => {
    const one = plan(45, 99, 100_000)
    one.segments[0].method = { id: 'only', name: 'Only method' }
    expect(run([{ skill: 'Mining' }], [one]).some((i) => i.kind === 'milestone')).toBe(false)
    const two = route([{ name: 'X', from: 1 }, { name: 'Y', from: 40 }], 70, 100_000)
    const items = run([{ skill: 'Mining' }, { skill: 'Attack' }], [one, two])
    expect(items.find((i) => i.kind === 'milestone')).toMatchObject({ skill: 'Attack', title: 'Unlock Y' })
  })

  it('dates the goal at the end of the skill, at the hours a day', () => {
    const p = plan(1, 99, 100_000)
    const [goal] = run([{ skill: 'Mining' }], [p], 4).filter((i) => i.kind === 'goal')
    expect(goal.etaDays).toBeCloseTo(p.hours / 4)
  })

  it('marks the last skill as the end of the plan, and goes through skills in order', () => {
    const items = run([{ skill: 'Mining' }, { skill: 'Attack' }], [plan(80, 99, 100_000), plan(80, 99, 100_000)])
    const goals = items.filter((i) => i.kind === 'goal')
    expect(goals.map((g) => g.skill)).toEqual(['Mining', 'Attack'])
    expect(goals.map((g) => g.tag)).toEqual(['Goal', 'Plan complete'])
  })

  it('does not repeat a level that is also the goal, and skips skills with nothing left', () => {
    const items = run([{ skill: 'Mining' }, { skill: 'Attack' }], [plan(98, 99, 100_000), plan(99, 99, 100_000)])
    expect(items.map((i) => i.title)).toEqual(['Reach level 99 Mining'])
  })

  it('names an XP target by its XP when it is not a whole level', () => {
    const p = plan(1, 99, 100_000)
    p.targetXp = 10_000_000
    const goal = run([{ skill: 'Mining' }], [p]).find((i) => i.kind === 'goal')
    expect(goal.title).toMatch(/^Reach 10(\.0)?M Mining XP$/)
  })

  it('has nothing without a pace or a plan', () => {
    expect(planNext([], [], { entries: [] }, 2)).toEqual([])
    const g = [{ skill: 'Mining' }]
    const p = [plan(1, 99, 100_000)]
    expect(planNext(g, p, buildTimeline(g, p, 0), 0)).toEqual([])
  })

  it('keeps the list short but always ends with the plan complete', () => {
    const skills = ['Mining', 'Attack', 'Fishing', 'Cooking', 'Smithing', 'Magic', 'Prayer', 'Crafting', 'Farming', 'Hunter']
    const goals = skills.map((skill) => ({ skill }))
    const items = run(goals, goals.map(() => plan(80, 99, 100_000)))
    expect(items.length).toBeLessThanOrEqual(8)
    expect(items.at(-1).tag).toBe('Plan complete')
  })
})
