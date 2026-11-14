import { describe, it, expect } from 'vitest'
import { dashboardGoals, planBadge, planStatus } from '@/utils/dashboard'
import { weekDaysFrom } from '@/utils/weekDays'
import { xpAtLevel } from '@/utils/planner'

const now = new Date('2026-11-14T15:00:00Z')
const daysAgo = (n) => new Date(now.getTime() - n * 86_400_000).toISOString()
const plan = (over = {}) => ({
  name: 'Mining plan',
  hoursPerDay: 2,
  globalStrategy: 'auto-fast',
  gpValue: 2_000_000,
  statsAt: daysAgo(10),
  goals: [{ skill: 'Mining', currentXp: xpAtLevel(50), targetXp: xpAtLevel(70), methodId: 'global', customXpPerHour: 0, quests: [] }],
  ...over,
})
const latestAt = (xp) => ({ skills: { Mining: { xp, level: 60 } } })

describe('planStatus', () => {
  it('has nothing to measure without stats or a starting point', () => {
    expect(planStatus(plan(), { latest: null }, now).tracked).toBe(false)
    expect(planStatus(plan({ statsAt: null }), { latest: latestAt(xpAtLevel(55)) }, now).tracked).toBe(false)
    expect(planStatus(plan({ goals: [] }), { latest: latestAt(1) }, now).tracked).toBe(false)
  })
  it('measures progress from where the plan started', () => {
    const mid = (xpAtLevel(50) + xpAtLevel(70)) / 2
    const s = planStatus(plan(), { latest: latestAt(mid) }, now)
    expect(s.tracked).toBe(true)
    expect(s.progress.pct).toBeCloseTo(0.5, 2)
    expect(s.progress.completedGoals).toBe(0)
    expect(s.next.skill).toBe('Mining')
  })
  it('is complete when every goal has reached its target', () => {
    const s = planStatus(plan(), { latest: latestAt(xpAtLevel(70)) }, now)
    expect(s.progress.complete).toBe(true)
    expect(s.next).toBeNull()
    expect(planBadge(s)).toBeNull()
  })
  it('does not count XP below the starting point as progress', () => {
    const s = planStatus(plan(), { latest: latestAt(xpAtLevel(40)) }, now)
    expect(s.progress.gainedXp).toBe(0)
  })
  it('reports a pace from the history when there is one', () => {
    const history = [
      { capturedAt: daysAgo(10), skills: { Mining: { xp: xpAtLevel(50) } } },
      { capturedAt: daysAgo(5), skills: { Mining: { xp: xpAtLevel(53) } } },
      { capturedAt: daysAgo(0.1), skills: { Mining: { xp: xpAtLevel(56) } } },
    ]
    const s = planStatus(plan(), { latest: latestAt(xpAtLevel(56)), history }, now)
    expect(['early', 'late', 'on', 'none']).toContain(s.projection.status)
    if (s.projection.status !== 'none') expect(planBadge(s)).not.toBeNull()
  })
  it('falls back to the schedule when there is no history', () => {
    const s = planStatus(plan(), { latest: latestAt(xpAtLevel(51)) }, now)
    expect(s.projection).toBeNull()
    const b = planBadge(s)
    expect(b === null || ['ahead', 'behind', 'on'].includes(b.kind)).toBe(true)
  })
})

describe('dashboardGoals', () => {
  const g = (id, pinned, reached, percent) => ({ id, pinned, reached, percent })
  it('puts pinned first, then the closest to done, with finished goals last', () => {
    const out = dashboardGoals([g(1, false, false, 20), g(2, false, true, 100), g(3, true, false, 5), g(4, false, false, 80)], 10)
    expect(out.map((x) => x.id)).toEqual([3, 4, 1, 2])
  })
  it('keeps only the number asked for', () => {
    expect(dashboardGoals([g(1, false, false, 1), g(2, false, false, 2), g(3, false, false, 3)], 2)).toHaveLength(2)
    expect(dashboardGoals(undefined)).toEqual([])
  })
})

describe('weekDaysFrom', () => {
  const snap = (daysBack, overallXp, mining) => ({ capturedAt: daysAgo(daysBack), overallXp, overallLevel: 100, skills: { Mining: { xp: mining, level: 50 } } })
  it('is empty without enough snapshots', () => {
    expect(weekDaysFrom([], now.getTime())).toEqual([])
    expect(weekDaysFrom([snap(1, 1000, 500)], now.getTime())).toEqual([])
  })
  it('gives seven days that add up to the XP gained', () => {
    const days = weekDaysFrom([snap(3, 1000, 500), snap(2, 1600, 1100), snap(0.2, 2000, 1500)], now.getTime())
    expect(days).toHaveLength(7)
    expect(days.reduce((a, d) => a + d.xp, 0)).toBe(1000)
    expect(days.some((d) => d.skills.some((s) => s.skill === 'Mining'))).toBe(true)
  })
})

import { etaText, recentMilestones, skillRates, whenText, whatsNext } from '@/utils/dashboard'

describe('etaText', () => {
  it('words a number of days, and gives up on far-off ones', () => {
    expect(etaText(0.3)).toBe('under a day')
    expect(etaText(1)).toBe('about 1 day')
    expect(etaText(9.2)).toBe('about 9 days')
    expect(etaText(120)).toBe('about 4 months')
    expect(etaText(2000)).toBe('')
    expect(etaText(Infinity)).toBe('')
    expect(etaText(-1)).toBe('')
  })
})

describe('whatsNext', () => {
  const days = Array.from({ length: 7 }, (_, i) => ({ key: `d${i}`, xp: 0, skills: i === 6 ? [{ skill: 'Slayer', xp: 700_000 }, { skill: 'Mining', xp: 70_000 }] : [] }))
  const latest = { skills: { Slayer: { xp: xpAtLevel(96) + 100_000 }, Mining: { xp: xpAtLevel(60) + 1000 }, Cooking: { xp: xpAtLevel(90) } } }
  it('works out the pace per skill from the week', () => {
    expect(skillRates(days).get('Slayer')).toBeCloseTo(100_000, 0)
    expect(skillRates([]).size).toBe(0)
  })
  it('finds the nearest level-ups and 99s with an ETA at the current pace', () => {
    const items = whatsNext({ latest, days })
    const slayer99 = items.find((i) => i.key === 'Slayer:99')
    expect(slayer99.title).toBe('Reach 99 Slayer')
    expect(slayer99.eta).toMatch(/^about \d+ days?$|^under a day$/)
    expect(items.find((i) => i.key === 'Slayer:97').title).toBe('Reach level 97 Slayer')
  })
  it('lists a 99 without an ETA for a skill that was not trained this week', () => {
    const cooking = whatsNext({ latest, days }).find((i) => i.key === 'Cooking:99')
    expect(cooking.eta).toBe('')
    expect(cooking.detail).toContain('XP to go')
  })
  it('includes nearly earned achievements but never ones already done or skill-level ones', () => {
    const achievements = [
      { key: 'total_level::2000', type: 'total_level', value: 2000, current: 1980, progress: 0.99, completed: false, title: '2,000 Overall', skill: '' },
      { key: 'skill_level:Slayer:99', type: 'skill_level', value: 99, current: 96, progress: 0.97, completed: false, title: '99 Slayer', skill: 'Slayer' },
      { key: 'total_level::1500', type: 'total_level', value: 1500, current: 1980, progress: 1, completed: true, title: '1,500 Overall', skill: '' },
    ]
    const items = whatsNext({ latest, achievements, days, limit: 10 })
    expect(items.find((i) => i.key === 'total_level::2000')).toMatchObject({ title: 'Reach total level 2,000', detail: '20 levels to go', eta: '' })
    expect(items.some((i) => i.key === 'skill_level:Slayer:99')).toBe(false)
    expect(items.some((i) => i.key === 'total_level::1500')).toBe(false)
  })
  it('words experience goals as something to reach', () => {
    const achievements = [
      { key: 'skill_xp:Slayer:10000000', type: 'skill_xp', skill: 'Slayer', value: 10_000_000, current: 9_000_000, progress: 0.9, completed: false, title: '10M Slayer XP' },
      { key: 'total_xp::50000000', type: 'total_xp', skill: '', value: 50_000_000, current: 45_000_000, progress: 0.9, completed: false, title: '50M Total XP' },
    ]
    const titles = whatsNext({ latest, achievements, days, limit: 10 }).map((i) => i.title)
    expect(titles).toContain('Reach 10M Slayer XP')
    expect(titles).toContain('Reach 50M total XP')
  })
  it('is empty with no stats', () => {
    expect(whatsNext({ latest: null, days: [] })).toEqual([])
  })
})

describe('recentMilestones', () => {
  const at = Date.parse('2026-11-14T15:00:00Z')
  it('lists recent achievements with their congratulations, newest first', () => {
    const out = recentMilestones({
      now: at,
      timeline: [
        { key: 'skill_level:Mining:99', type: 'skill_level', skill: 'Mining', value: 99, title: '99 Mining', occurredAt: '2026-11-13T10:00:00Z' },
        { key: 'skill_level:Fishing:90', type: 'skill_level', skill: 'Fishing', value: 90, title: '90 Fishing', occurredAt: '2026-11-01T10:00:00Z' },
        { key: 'old', type: 'skill_level', skill: 'Cooking', value: 70, title: '70 Cooking', occurredAt: '2026-08-01T10:00:00Z' },
      ],
      celebrations: [{ type: 'skill_level', skill: 'Mining', value: 99, cheers: 4 }],
    })
    expect(out.map((e) => e.title)).toEqual(['99 Mining', '90 Fishing'])
    expect(out[0].cheers).toBe(4)
  })
  it('adds this week\'s level-ups but not ones that are already an achievement', () => {
    const out = recentMilestones({
      now: at,
      timeline: [{ key: 'skill_level:Mining:90', type: 'skill_level', skill: 'Mining', value: 90, title: '90 Mining', occurredAt: '2026-11-13T10:00:00Z' }],
      days: [{ key: '2026-11-13', skills: [{ skill: 'Mining', levels: 1, level: 90 }, { skill: 'Fishing', levels: 2, level: 61 }] }],
    })
    expect(out.map((e) => e.title)).toContain('Fishing level 61')
    expect(out.filter((e) => e.title.includes('Mining'))).toHaveLength(1)
  })
  it('adds fresh records only', () => {
    const rec = (over) => ({ key: 'best-day', title: 'Biggest day', unit: 'xp', value: 1_800_000, fresh: true, locked: false, end: '2026-11-14', ...over })
    expect(recentMilestones({ now: at, records: [rec(), rec({ key: 'x', fresh: false }), rec({ key: 'y', locked: true })] }).map((e) => e.id)).toEqual(['r:best-day'])
  })
  it('keeps to the limit', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ key: `2026-11-${8 + i}`, skills: [{ skill: 'Mining', levels: 1, level: 50 + i }] }))
    expect(recentMilestones({ now: at, days, limit: 3 })).toHaveLength(3)
  })
  it('words when something happened', () => {
    expect(whenText(at, at)).toBe('today')
    expect(whenText(at - 86_400_000, at)).toBe('yesterday')
    expect(whenText(at - 3 * 86_400_000, at)).toBe('3 days ago')
  })
})

import { timelineModel } from '@/utils/dashboard'

describe('timelineModel', () => {
  // Saturday 14 Nov 2026, local noon.
  const now = new Date(2026, 10, 14, 12, 0).getTime()
  const item = (key, etaDays, extra = {}) => ({ key, skill: 'Mining', title: key, detail: 'x', eta: etaDays == null ? '' : 'about', etaDays, pct: 0.5, ...extra })
  it('makes one stop per day, soonest first, with the month, day and weekday', () => {
    const m = timelineModel([item('later', 9), item('soon', 2)], now)
    expect(m.groups.map((g) => g.items[0].key)).toEqual(['soon', 'later'])
    expect(m.groups[0]).toMatchObject({ month: 'Nov', day: 16, whenText: 'in 2 days' })
    expect(m.groups[1]).toMatchObject({ month: 'Nov', day: 23 })
    expect(m.groups[0].weekday).toBe(new Date(2026, 10, 16).toLocaleDateString(undefined, { weekday: 'short' }))
  })
  it('counts an item due within the day as today, and the next day as tomorrow', () => {
    expect(timelineModel([item('now', 0.2)], now).groups[0].whenText).toBe('today')
    expect(timelineModel([item('t', 1.1)], now).groups[0].whenText).toBe('tomorrow')
  })
  it('groups items due the same day into one stop', () => {
    const m = timelineModel([item('a', 3), item('b', 3.2)], now)
    expect(m.groups).toHaveLength(1)
    expect(m.groups[0].items.map((i) => i.key)).toEqual(['a', 'b'])
  })
  it('crosses into the next month', () => {
    const m = timelineModel([item('far', 20)], now)
    expect(m.groups[0]).toMatchObject({ month: 'Dec', day: 4 })
  })
  it('puts items with no pace, or further than about three months, in later', () => {
    const m = timelineModel([item('near', 1), item('beyond', 120), item('nopace', null)], now)
    expect(m.groups.map((g) => g.items[0].key)).toEqual(['near'])
    expect(m.later.map((i) => i.key)).toEqual(['beyond', 'nopace'])
  })
  it('is empty with nothing to show', () => {
    expect(timelineModel([], now)).toEqual({ groups: [], later: [] })
    expect(timelineModel(undefined, now)).toEqual({ groups: [], later: [] })
  })
})

import { finishDays } from '@/utils/dashboard'

describe('finishDays', () => {
  const hours = (over = {}) => ({ hoursPerDay: 2, ...over })
  const tracked = (extra) => ({ tracked: true, progress: { complete: false }, projection: null, hoursLeft: 40, ...extra })
  it('uses the pace the player has really kept when there is one', () => {
    expect(finishDays(hours(), tracked({ projection: { status: 'late', daysLeft: 33 } }))).toBe(33)
  })
  it('falls back to the plan\'s own hours at its daily playtime', () => {
    expect(finishDays(hours(), tracked())).toBe(20)
    expect(finishDays(hours(), tracked({ projection: { status: 'none', reason: 'no-history' } }))).toBe(20)
  })
  it('estimates a plan that is not tracked from its total hours, after every plan being followed', () => {
    const notStarted = finishDays(hours(), { tracked: false, summary: { totalHours: 120 } })
    const followedFar = finishDays(hours(), tracked({ hoursLeft: 8000 }))
    expect(notStarted).toBeGreaterThan(followedFar)
    const shorter = finishDays(hours(), { tracked: false, summary: { totalHours: 20 } })
    expect(shorter).toBeLessThan(notStarted)
  })
  it('puts finished plans last and unmeasurable ones just before them', () => {
    const done = finishDays(hours(), tracked({ progress: { complete: true } }))
    const unknown = finishDays(hours({ hoursPerDay: 0 }), tracked())
    const soon = finishDays(hours(), tracked())
    expect(soon).toBeLessThan(unknown)
    expect(unknown).toBeLessThan(done)
    expect(finishDays(hours(), null)).toBe(unknown)
  })
  it('sorts plans soonest first', () => {
    const plans = [
      { id: 'far', soon: finishDays(hours(), tracked({ hoursLeft: 400 })) },
      { id: 'done', soon: finishDays(hours(), tracked({ progress: { complete: true } })) },
      { id: 'near', soon: finishDays(hours(), tracked({ hoursLeft: 10 })) },
    ]
    expect(plans.sort((a, b) => a.soon - b.soon).map((p) => p.id)).toEqual(['near', 'far', 'done'])
  })
})
