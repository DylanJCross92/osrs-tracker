import { describe, expect, it } from 'vitest'
import { planGoal, xpAtLevel, AUTO_CHEAP } from '@/utils/planner'

const goal = (extra = {}) => ({ skill: 'Agility', currentXp: 0, targetXp: xpAtLevel(99), methodId: AUTO_CHEAP, customXpPerHour: 0, quests: [], ...extra })

describe('the levels already trained', () => {
  it('plans a goal up to where the player is, with the methods picked for those levels', () => {
    const picks = [{ fromLevel: 1, toLevel: 98, methodId: 'agility-ardougne' }]
    const done = planGoal({ ...goal({ overrides: picks }), targetXp: xpAtLevel(98) })
    expect(done.segments.at(-1).endLevel).toBe(98)
    expect(done.segments.every((s) => s.method?.id === 'agility-ardougne' || s.kind === 'manual')).toBe(true)
    const whole = planGoal(goal({ overrides: picks }))
    // the same methods, so the part already done is a slice of the whole route
    expect(done.hours).toBeLessThan(whole.hours)
    expect(done.netGp).not.toBeNull()
  })

  it('makes less on rooftops than on the planner\'s own pick for the high levels', () => {
    const own = planGoal({ ...goal(), targetXp: xpAtLevel(98) })
    const roofs = planGoal({ ...goal({ overrides: [{ fromLevel: 1, toLevel: 98, methodId: 'agility-ardougne' }] }), targetXp: xpAtLevel(98) })
    expect(roofs.netGp).toBeLessThan(own.netGp)
  })
})

import { routeOverrides, withRouteOverrides, methodFamily, familiesFor, setOverrideRange } from '@/utils/planner'
import { getMethod } from '@/data/trainingMethods'

describe('staying with one way of training', () => {
  it('knows which courses are rooftops', () => {
    expect(methodFamily(getMethod('agility-ardougne')).id).toBe('rooftop')
    expect(methodFamily(getMethod('agility-sepulchre-5')).id).toBe('sepulchre')
    expect(methodFamily(getMethod('agility-brimhaven'))).toBeNull()
    expect(familiesFor('Agility').map((f) => f.id)).toEqual(['rooftop', 'sepulchre', 'pyramid'])
    expect(familiesFor('Cooking')).toEqual([])
  })

  it('trains every level on rooftops when asked, and the plan then follows it', () => {
    const picks = routeOverrides(goal(), 0, xpAtLevel(99), { family: 'rooftop' })
    expect(picks[0].fromLevel).toBe(1)
    expect(picks.at(-1).toLevel).toBe(99)
    expect(picks.every((o) => methodFamily(getMethod(o.methodId))?.id === 'rooftop')).toBe(true)
    const plan = planGoal(goal({ overrides: withRouteOverrides([], picks) }))
    expect(plan.segments.every((s) => methodFamily(s.method)?.id === 'rooftop')).toBe(true)
    expect(plan.segments.at(-1).method.id).toBe('agility-ardougne')
  })

  it('carries a method on only where it covers the levels, and keeps what was chosen for earlier levels', () => {
    const before = [{ fromLevel: 1, toLevel: 90, methodId: 'agility-rellekka' }]
    const next = routeOverrides(goal(), xpAtLevel(90), xpAtLevel(99), { methodId: 'agility-ardougne' })
    expect(next).toEqual([{ fromLevel: 90, toLevel: 99, methodId: 'agility-ardougne' }])
    expect(withRouteOverrides(before, next)).toEqual([...before, ...next])
    expect(routeOverrides(goal(), xpAtLevel(20), xpAtLevel(40), { methodId: 'agility-ardougne' })).toEqual([])
    expect(setOverrideRange([], 1, 2, null)).toEqual([])
  })
})
