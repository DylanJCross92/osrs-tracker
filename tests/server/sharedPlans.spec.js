import { describe, expect, it } from 'vitest'
import { SharePlanError, cleanSharedPlan, isSlug, newSlug, publicShape } from '../../server/src/utils/sharedPlans.js'

const goal = (skill, extra = {}) => ({ skill, currentXp: 1000, targetXp: 13_034_431, methodId: 'global', customXpPerHour: 0, quests: [], ...extra })
const body = (over = {}) => ({
  planId: 'p_abc123',
  name: 'Road to Max',
  rsn: 'Dylanz297',
  mode: 'static',
  plan: { hoursPerDay: 2, globalStrategy: 'auto-fast', gpValue: 2_000_000, statsAt: '2026-11-10T00:00:00Z', goals: [goal('Mining'), goal('Agility')] },
  summary: { totalHours: 123.4, netGp: 5_000_000, days: 62, totalXp: 26_000_000, goals: [{ skill: 'Mining', fromLevel: 1, toLevel: 99 }] },
  ...over,
})

describe('cleanSharedPlan', () => {
  it('keeps a valid plan in a tidy shape', () => {
    const row = cleanSharedPlan(body())
    expect(row).toMatchObject({ planId: 'p_abc123', name: 'Road to Max', rsn: 'Dylanz297', mode: 'static' })
    expect(row.plan.goals.map((g) => g.skill)).toEqual(['Mining', 'Agility'])
    expect(row.summary.totalHours).toBeCloseTo(123.4)
  })

  it('drops unknown skills and duplicates, clamps numbers, and cleans the name', () => {
    const row = cleanSharedPlan(body({
      name: '  <b>Hello</b>\n there  ',
      plan: { hoursPerDay: 99, goals: [goal('Mining', { targetXp: 9e12, methodId: 'BAD ID!' }), goal('Mining'), goal('Basketweaving')] },
    }))
    expect(row.name).toBe('bHello/b there')
    expect(row.plan.hoursPerDay).toBe(24)
    expect(row.plan.goals).toHaveLength(1)
    expect(row.plan.goals[0].targetXp).toBe(200_000_000)
    expect(row.plan.goals[0].methodId).toBe('global')
  })

  it('requires a saved plan id and at least one valid goal', () => {
    expect(() => cleanSharedPlan(body({ planId: 'no spaces!' }))).toThrow(SharePlanError)
    expect(() => cleanSharedPlan(body({ plan: { goals: [goal('Basketweaving')] } }))).toThrow(/at least one/)
    expect(() => cleanSharedPlan(null)).toThrow(SharePlanError)
  })

  it('live progress needs a valid player name; a bad name is dropped from static plans', () => {
    expect(() => cleanSharedPlan(body({ mode: 'live', rsn: '' }))).toThrow(/player name/)
    expect(() => cleanSharedPlan(body({ mode: 'live', rsn: 'way too long a name' }))).toThrow(/player name/)
    expect(cleanSharedPlan(body({ mode: 'static', rsn: 'bad<name>' })).rsn).toBe('')
    expect(cleanSharedPlan(body({ mode: 'live' })).mode).toBe('live')
  })

  it('refuses oversized plans', () => {
    const goals = Array.from({ length: 24 }, (_, i) => goal('Mining', { quests: Array.from({ length: 20 }, (_, k) => `quest-${i}-${k}-${'x'.repeat(30)}`) }))
    // Duplicates collapse to one goal, so build with every skill instead.
    const skills = ['Attack', 'Defence', 'Strength', 'Hitpoints', 'Ranged', 'Prayer', 'Magic', 'Cooking', 'Woodcutting', 'Fletching', 'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving', 'Slayer', 'Farming', 'Runecraft', 'Hunter', 'Construction']
    const big = skills.map((s) => goal(s, { quests: Array.from({ length: 20 }, (_, k) => `${'q'.repeat(38)}${k}`) }))
    expect(goals.length).toBe(24)
    expect(() => cleanSharedPlan(body({ plan: { goals: big } }))).toThrow(/too large/)
  })
})

describe('slugs and public shape', () => {
  it('makes unguessable slugs from an unambiguous alphabet', () => {
    const slugs = new Set(Array.from({ length: 200 }, () => newSlug()))
    expect(slugs.size).toBe(200)
    for (const s of slugs) {
      expect(isSlug(s)).toBe(true)
      expect(s).not.toMatch(/[01oli]/)
    }
    expect(isSlug('../etc')).toBe(false)
    expect(isSlug('ab')).toBe(false)
  })

  it('never exposes the owner account or the owner plan id', () => {
    const shape = publicShape({ slug: 'abcdefghjk', name: 'x', rsn: 'y', mode: 'static', plan: {}, summary: {}, created_at: 'a', updated_at: 'b', user_id: 7, plan_id: 'p_1' })
    expect(Object.keys(shape).sort()).toEqual(['createdAt', 'mode', 'name', 'plan', 'rsn', 'slug', 'summary', 'updatedAt'])
  })
})

describe('summarizeStats', () => {
  it('totals the counts, takes the last 7 days, and fills a 14-day series with zeros for quiet days', async () => {
    const { summarizeStats } = await import('../../server/src/utils/sharedPlans.js')
    const rows = [
      { day: '2026-11-01', views: 10, uses: 2 },
      { day: '2026-11-08', views: 4, uses: 1 },
      { day: '2026-11-11', views: 6, uses: 3 },
    ]
    const s = summarizeStats(rows, '2026-11-11')
    expect(s.views).toBe(20)
    expect(s.uses).toBe(6)
    // The last 7 days are Nov 5 to Nov 11.
    expect(s.viewsWeek).toBe(10)
    expect(s.usesWeek).toBe(4)
    expect(s.series).toHaveLength(14)
    expect(s.series[0].day).toBe('2026-10-29')
    expect(s.series[13]).toEqual({ day: '2026-11-11', views: 6, uses: 3 })
    expect(s.series[12]).toEqual({ day: '2026-11-10', views: 0, uses: 0 })
  })

  it('is all zeros for a plan nobody has opened', async () => {
    const { summarizeStats } = await import('../../server/src/utils/sharedPlans.js')
    expect(summarizeStats([], '2026-11-11')).toMatchObject({ views: 0, uses: 0, viewsWeek: 0, usesWeek: 0 })
  })
})
