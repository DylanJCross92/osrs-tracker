import { describe, expect, it } from 'vitest'
import { averageGpRate, gpRateAt, hasGpTiers, ratePieces } from '@/utils/methodRates'
import { gpPerHourAt } from '@/utils/methodPricing'
import { getMethod } from '@/data/trainingMethods'
import { AUTO_FAST, planGoal, xpAtLevel } from '@/utils/planner'
import { xpAtLevel as xpAt } from '@/utils/xpLevels'

const demo = { xpPerHour: 100, rates: [[10, 100]], gpRates: [[10, 1000], [20, 3000]] }

describe('gp rates that step with level on their own', () => {
  it('reads the step in force at a level, or null without a table', () => {
    expect(hasGpTiers(demo)).toBe(true)
    expect(gpRateAt(demo, 10)).toBe(1000)
    expect(gpRateAt(demo, 19)).toBe(1000)
    expect(gpRateAt(demo, 20)).toBe(3000)
    expect(gpRateAt({ xpPerHour: 5 }, 30)).toBeNull()
  })
  it('cuts a range where the gp steps, even when the xp rate does not', () => {
    const pieces = ratePieces(demo, xpAt(10), xpAt(30))
    expect(pieces.length).toBe(2)
    expect(pieces[0].toXp).toBe(xpAt(20))
    expect(pieces.every((p) => p.rate === 100)).toBe(true)
  })
  it('averages gp over the hours of each step', () => {
    const avg = averageGpRate(demo.rates, demo.gpRates, 10, 29)
    const a = xpAt(20) - xpAt(10)
    const b = xpAt(30) - xpAt(20)
    expect(avg).toBe(Math.round((1000 * a + 3000 * b) / (a + b)))
  })
})

describe('Motherlode Mine', () => {
  const mlm = getMethod('mining-motherlode')
  it('earns more per hour the higher the level, from the wiki money making guide', () => {
    expect(gpPerHourAt(mlm, 31)).toBe(30871)
    expect(gpPerHourAt(mlm, 61)).toBe(49491)
    expect(gpPerHourAt(mlm, 90)).toBe(192958)
    expect(gpPerHourAt(mlm, 99)).toBe(242320)
  })
  it('makes a route through it worth far more than the old flat 20K an hour', () => {
    const plan = planGoal({ skill: 'Mining', currentXp: xpAtLevel(30), targetXp: xpAtLevel(99), methodId: 'mining-motherlode', customXpPerHour: 0, quests: [] })
    const seg = plan.segments.find((s) => s.method.id === 'mining-motherlode')
    expect(seg.netGp / seg.hours).toBeGreaterThan(60000)
  })
})
