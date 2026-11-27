import { describe, expect, it } from 'vitest'
import { hasTiers, averageBetween, averageRate, hoursForXp, rateAt, rateLabel, rateRange, rateRangeBetween, ratePieces, rateSteps, segmentMethod, shortRate, stepRangeText } from '@/utils/methodRates'
import { AUTO_FAST, planGoal, xpAtLevel } from '@/utils/planner'
import { TRAINING_METHODS, getMethod } from '@/data/trainingMethods'
import { gpPerHourAt } from '@/utils/methodPricing'

// A method that is 100K an hour from level 70 and 200K from level 80, open until 89.
const tiered = { id: 'test-tiered', skill: 'Hunter', minLevel: 70, maxLevel: 89, xpPerHour: 150_000, rates: [[70, 100_000], [80, 200_000]] }
const flat = { id: 'test-flat', skill: 'Hunter', minLevel: 1, maxLevel: null, xpPerHour: 50_000 }

describe('rateAt', () => {
  it('takes the last tier that has started, and the first rate before any has', () => {
    expect(rateAt(tiered, 70)).toBe(100_000)
    expect(rateAt(tiered, 79)).toBe(100_000)
    expect(rateAt(tiered, 80)).toBe(200_000)
    expect(rateAt(tiered, 99)).toBe(200_000)
    expect(rateAt(tiered, 60)).toBe(100_000)
  })
  it('is the one rate for a method without tiers', () => {
    expect(rateAt(flat, 1)).toBe(50_000)
    expect(rateAt(flat, 99)).toBe(50_000)
  })
})

describe('hoursForXp', () => {
  it('adds up tier by tier across a step', () => {
    const a = xpAtLevel(75)
    const b = xpAtLevel(80)
    const c = xpAtLevel(85)
    expect(hoursForXp(tiered, a, b)).toBeCloseTo((b - a) / 100_000, 6)
    expect(hoursForXp(tiered, a, c)).toBeCloseTo((b - a) / 100_000 + (c - b) / 200_000, 6)
    expect(ratePieces(tiered, a, c)).toHaveLength(2)
  })
  it('is plain xp over rate for a flat method, and null with no rate', () => {
    expect(hoursForXp(flat, 0, 100_000)).toBe(2)
    expect(hoursForXp({ ...flat, xpPerHour: 0 }, 0, 100)).toBeNull()
  })
})

describe('averages and ranges', () => {
  it('the average over the method is hours-weighted, so it sits between the tiers', () => {
    const avg = averageRate(tiered.rates, 70, 89)
    expect(avg).toBeGreaterThan(100_000)
    expect(avg).toBeLessThan(200_000)
    // most of the xp in 70 to 89 is gained from 80, so the average is nearer the top tier
    expect(avg).toBeGreaterThan(150_000)
  })
  it('averages only the levels asked for', () => {
    expect(averageBetween(tiered, 70, 80)).toBeCloseTo(100_000, 0)
    expect(averageBetween(tiered, 80, 85)).toBeCloseTo(200_000, 0)
    expect(averageBetween(flat, 1, 50)).toBe(50_000)
  })
  it('reads as a range for a tiered method and a figure for a flat one', () => {
    expect(rateRange(tiered).text).toBe('100K-200K')
    expect(rateLabel(tiered)).toBe('100K-200K')
    expect(rateLabel(flat)).toBe('50,000')
    expect(rateRangeBetween(tiered, 70, 75).text).toBe('100K')
    expect(rateRangeBetween(tiered, 75, 85).text).toBe('100K-200K')
    expect(stepRangeText(tiered, 70, 76)).toBe('')
    expect(stepRangeText(tiered, 72, 90)).toBe('100K-200K')
    expect(shortRate(98_050)).toBe('98K')
    expect(shortRate(1250)).toBe('1.3K')
  })
  it('lists the steps inside the method, with tiers below its first level folded in', () => {
    expect(rateSteps(tiered)).toEqual([{ level: 70, rate: 100_000 }, { level: 80, rate: 200_000 }])
    const early = { ...tiered, minLevel: 9, rates: [[5, 20_000], [14, 30_000]] }
    expect(rateSteps(early)).toEqual([{ level: 9, rate: 20_000 }, { level: 14, rate: 30_000 }])
  })
})

describe('a tiered method in a plan', () => {
  it('takes more hours early than a flat average would, and the segment shows its average rate', () => {
    const goal = { skill: 'Hunter', currentXp: xpAtLevel(73), targetXp: xpAtLevel(99), methodId: AUTO_FAST, quests: [] }
    const plan = planGoal(goal)
    expect(plan.complete).toBe(true)
    const seg = plan.segments.find((s) => s.method?.id === 'hunter-black-chins')
    expect(seg).toBeTruthy()
    const m = getMethod('hunter-black-chins')
    expect(seg.xpPerHour).toBeGreaterThan(m.rates[0][1])
    expect(seg.xpPerHour).toBeLessThan(m.rates[m.rates.length - 1][1])
    expect(seg.hours).toBeCloseTo(hoursForXp(m, seg.fromXp, seg.toXp), 6)
    // the segment as the gp breakdown sees it: the segment's own average rate
    expect(segmentMethod(seg).xpPerHour).toBe(seg.xpPerHour)
  })

  it('keeps the catalog numbers real: the Hunter methods with tiers average between their lowest and highest rate', () => {
    for (const id of ['hunter-carnivorous-chins', 'hunter-black-chins', 'hunter-rumours', 'hunter-black-salamanders', 'hunter-falconry']) {
      const m = getMethod(id)
      const rates = m.rates.map((r) => r[1])
      expect(m.xpPerHour).toBeGreaterThanOrEqual(Math.min(...rates))
      expect(m.xpPerHour).toBeLessThanOrEqual(Math.max(...rates))
      expect(m.rates.every((r, i) => i === 0 || r[0] > m.rates[i - 1][0])).toBe(true)
    }
  })
})

describe('every tiered method in the catalog', () => {
  const all = TRAINING_METHODS.filter((m) => hasTiers(m))
  it('has ascending levels, positive rates, and an average inside its own range', () => {
    expect(all.length).toBeGreaterThan(40)
    for (const m of all) {
      expect(m.rates.every(([l, r], i) => Number.isInteger(l) && l >= 1 && l <= 99 && r > 0 && (i === 0 || l > m.rates[i - 1][0])), m.id).toBe(true)
      const inside = rateSteps(m).map((s) => s.rate)
      const rates = inside.length ? inside : [m.xpPerHour]
      expect(m.xpPerHour, m.id).toBeGreaterThanOrEqual(Math.min(...rates))
      expect(m.xpPerHour, m.id).toBeLessThanOrEqual(Math.max(...rates))
    }
  })
  it('never makes a plan incomplete or empty for a skill that was complete before', () => {
    for (const skill of ['Fishing', 'Woodcutting', 'Mining', 'Thieving', 'Cooking', 'Runecraft', 'Hunter', 'Firemaking']) {
      const plan = planGoal({ skill, currentXp: 0, targetXp: xpAtLevel(99), methodId: AUTO_FAST, quests: [] })
      expect(plan.hours, skill).toBeGreaterThan(5)
      expect(plan.hours, skill).toBeLessThan(2000)
    }
  })
})

describe('gp at a level', () => {
  it('follows the rate for a typed-in figure, so a faster level makes proportionally more or costs more', () => {
    const m = { id: 'test-x', minLevel: 1, maxLevel: null, xpPerHour: 100_000, savedGpPerHour: 200_000, rates: [[1, 50_000], [50, 150_000]] }
    expect(gpPerHourAt(m, 10)).toBe(100_000)
    expect(gpPerHourAt(m, 60)).toBe(300_000)
    expect(gpPerHourAt({ ...m, savedGpPerHour: null }, 60)).toBeNull()
    expect(gpPerHourAt({ ...m, savedGpPerHour: 0 }, 60)).toBe(0)
  })
})

describe('route stability with stepped rates', () => {
  it('does not swap between two methods that are within 5% of each other every few levels', () => {
    const plan = planGoal({ skill: 'Fishing', currentXp: 0, targetXp: xpAtLevel(99), methodId: AUTO_FAST, quests: [] })
    const ids = plan.segments.map((s) => s.method?.id)
    // no method comes back after it has been left
    const seen = new Set()
    ids.forEach((id, i) => {
      if (i > 0 && ids[i - 1] !== id) expect(seen.has(id), `${id} came back`).toBe(false)
      seen.add(id)
    })
  })
})
