import { beforeEach, describe, expect, it } from 'vitest'
import { buildProgress, liveGoalFor, paceSeries } from '@/utils/plannerTools'
import { xpAtLevel } from '@/utils/planner'

const goal = (skill, from, to) => ({ skill, currentXp: xpAtLevel(from), targetXp: xpAtLevel(to) })
// Flat 100k xp/h so hours are easy to reason about.
const plan = (g) => ({ hours: Math.max(0, g.targetXp - g.currentXp) / 100_000 })

describe('liveGoalFor', () => {
  it('moves the start up to tracked xp, capped at the target, and never backwards', () => {
    const g = goal('Mining', 50, 70)
    expect(liveGoalFor(g, xpAtLevel(60)).currentXp).toBe(xpAtLevel(60))
    expect(liveGoalFor(g, xpAtLevel(80)).currentXp).toBe(g.targetXp)
    expect(liveGoalFor(g, xpAtLevel(40))).toBe(g)
    expect(liveGoalFor(g, null)).toBe(g)
  })
})

describe('buildProgress', () => {
  const baseline = new Date('2027-01-01T00:00:00Z')
  const goals = [goal('Mining', 50, 70), goal('Attack', 60, 80)]

  it('measures xp progress against the original starting point and marks completed goals', () => {
    const live = [liveGoalFor(goals[0], xpAtLevel(70)), liveGoalFor(goals[1], xpAtLevel(70))]
    const p = buildProgress(goals, live, goals.map(plan), live.map(plan), 2, baseline, new Date('2027-01-02T00:00:00Z'))
    expect(p.per[0].done).toBe(true)
    expect(p.per[0].pct).toBe(1)
    expect(p.per[1].done).toBe(false)
    expect(p.per[1].gained).toBe(xpAtLevel(70) - xpAtLevel(60))
    expect(p.completedGoals).toBe(1)
    expect(p.pct).toBeGreaterThan(0.3)
    expect(p.pct).toBeLessThan(1)
    expect(p.complete).toBe(false)
  })

  it('carries each goal\'s planned hours and a time-based percent for the timeline', () => {
    const live = [liveGoalFor(goals[0], xpAtLevel(60)), goals[1]]
    const orig = goals.map(plan)
    const p = buildProgress(goals, live, orig, live.map(plan), 2, baseline, new Date('2027-01-02T00:00:00Z'))
    expect(p.per[0].hours).toBeCloseTo(orig[0].hours)
    expect(p.per[0].hoursLeft).toBeLessThan(p.per[0].hours)
    expect(p.per[1].hoursLeft).toBeCloseTo(p.per[1].hours)
    const done = orig[0].hours - plan(live[0]).hours
    expect(p.timePct).toBeCloseTo(done / (orig[0].hours + orig[1].hours))
  })

  it('is complete when every goal is reached', () => {
    const live = goals.map((g) => liveGoalFor(g, g.targetXp))
    const p = buildProgress(goals, live, goals.map(plan), live.map(plan), 2, baseline, new Date('2027-02-01T00:00:00Z'))
    expect(p.complete).toBe(true)
    expect(p.pct).toBe(1)
    expect(p.remainingXp).toBe(0)
  })

  it('reports ahead, on schedule and behind from hours done versus hours expected by now', () => {
    const orig = goals.map(plan)
    const hoursTotal = orig.reduce((a, x) => a + x.hours, 0)
    const noProgress = goals.map((g) => g)
    // Nothing done 10 days in at 2 h/day: expected 20h, did 0.
    const behind = buildProgress(goals, noProgress, orig, noProgress.map(plan), 2, baseline, new Date('2027-01-11T00:00:00Z'))
    expect(behind.schedule).toBe('behind')
    expect(behind.aheadDays).toBeCloseTo(-10)
    // Everything done 1 day in: far ahead.
    const done = goals.map((g) => liveGoalFor(g, g.targetXp))
    const ahead = buildProgress(goals, done, orig, done.map(plan), 2, baseline, new Date('2027-01-02T00:00:00Z'))
    expect(ahead.schedule).toBe('ahead')
    expect(ahead.aheadDays).toBeCloseTo(hoursTotal / 2 - 1)
    // Just started.
    const fresh = buildProgress(goals, noProgress, orig, noProgress.map(plan), 2, baseline, baseline)
    expect(fresh.schedule).toBe('on')
  })

  it('does not change schedule when only the daily playtime changes', () => {
    const orig = goals.map(plan)
    const live = [liveGoalFor(goals[0], xpAtLevel(60)), goals[1]]
    const a = buildProgress(goals, live, orig, live.map(plan), 2, baseline, new Date('2027-01-05T00:00:00Z'))
    expect(a.originalHours).toBeCloseTo(orig.reduce((x, p) => x + p.hours, 0))
    expect(a.liveHours).toBeLessThan(a.originalHours)
  })

  it('has no schedule without a baseline date', () => {
    const p = buildProgress(goals, goals, goals.map(plan), goals.map(plan), 2, null)
    expect(p.schedule).toBeNull()
  })
})

describe('gainedToday', () => {
  const now = new Date('2026-11-11T20:00:00Z').getTime() // 3 PM Eastern, so the game day began at 6 AM Eastern = 11:00 UTC
  const snap = (iso, xp) => ({ capturedAt: iso, skills: { Mining: { xp }, Attack: { xp: 500 } } })

  it('counts XP gained in the goal skills since 6 AM Eastern, largest first', async () => {
    const { gainedToday } = await import('@/utils/plannerTools')
    const rows = [snap('2026-11-10T20:00:00Z', 1000), snap('2026-11-11T10:00:00Z', 1200), snap('2026-11-11T14:00:00Z', 1500)]
    const g = gainedToday(rows, { Mining: 1900, Attack: 800 }, now)
    // Before 11:00 UTC the newest snapshot is 1200 for Mining, 500 for Attack.
    expect(g.total).toBe(700 + 300)
    expect(g.skills.map((s) => s.skill)).toEqual(['Mining', 'Attack'])
  })

  it('is null when nothing was gained today or there is no history', async () => {
    const { gainedToday } = await import('@/utils/plannerTools')
    expect(gainedToday([snap('2026-11-11T10:00:00Z', 1200)], { Mining: 1200 }, now)).toBeNull()
    expect(gainedToday([], { Mining: 1200 }, now)).toBeNull()
  })
})

describe('planFingerprint', () => {
  const base = { hoursPerDay: 2, globalStrategy: 'auto-fast', gpValue: 2_000_000, goals: [{ skill: 'Mining', currentXp: 100, targetXp: 5000, methodId: 'global', customXpPerHour: 0, quests: [] }] }

  it('is the same for a saved copy and the plan on screen, whatever extra fields they carry', async () => {
    const { planFingerprint } = await import('@/utils/plannerTools')
    const saved = { ...base, id: 'p_1', name: 'x', updatedAt: 'now', goals: [{ ...base.goals[0], extra: 1 }] }
    expect(planFingerprint(saved)).toBe(planFingerprint(base))
  })

  it('changes when the goals or the settings that change the numbers change', async () => {
    const { planFingerprint } = await import('@/utils/plannerTools')
    const f = planFingerprint(base)
    expect(planFingerprint({ ...base, hoursPerDay: 3 })).not.toBe(f)
    expect(planFingerprint({ ...base, globalStrategy: 'auto-cheap' })).not.toBe(f)
    expect(planFingerprint({ ...base, goals: [{ ...base.goals[0], targetXp: 6000 }] })).not.toBe(f)
    expect(planFingerprint({ ...base, goals: [{ ...base.goals[0], quests: ['the-grand-tree'] }] })).not.toBe(f)
    expect(planFingerprint({ ...base, goals: [] })).not.toBe(f)
  })
})

describe('projectFinish', () => {
  const now = new Date('2026-11-21T12:00:00Z')
  const day = 86_400_000
  const goals = [{ skill: 'Mining', currentXp: 1_000_000, targetXp: 2_000_000 }]
  const snap = (daysAgo, xp) => ({ capturedAt: new Date(now.getTime() - daysAgo * day).toISOString(), skills: { Mining: { xp } } })

  it('projects the finish from the pace in the last 14 days and says how early it is', async () => {
    const { projectFinish } = await import('@/utils/plannerTools')
    // 140k gained over 14 days = 10k/day, 500k left = 50 more days. The plan was 100 days long, started 20 days ago.
    const r = projectFinish({
      snapshots: [snap(20, 1_000_000), snap(14, 1_360_000), snap(0, 1_500_000)],
      goals, remainingXp: 500_000, plannedDays: 100, baselineAt: new Date(now.getTime() - 20 * day).toISOString(), now,
    })
    expect(r.status).toBe('early')
    expect(Math.round(r.xpPerDay)).toBe(10_000)
    expect(Math.round(r.daysLeft)).toBe(50)
    expect(Math.round(r.diffDays)).toBe(30)
  })

  it('says late when the pace is slower than the plan needs', async () => {
    const { projectFinish } = await import('@/utils/plannerTools')
    const r = projectFinish({
      snapshots: [snap(10, 1_000_000), snap(0, 1_010_000)],
      goals, remainingXp: 990_000, plannedDays: 30, baselineAt: new Date(now.getTime() - 10 * day).toISOString(), now,
    })
    expect(r.status).toBe('late')
    expect(r.diffDays).toBeLessThan(0)
  })

  it('has nothing to say without history, a day of tracking or any gains', async () => {
    const { projectFinish } = await import('@/utils/plannerTools')
    const base = { goals, remainingXp: 500_000, plannedDays: 30, baselineAt: new Date(now.getTime() - 5 * day).toISOString(), now }
    expect(projectFinish({ ...base, snapshots: [] }).status).toBe('none')
    expect(projectFinish({ ...base, snapshots: [snap(5, 1_000_000), snap(0, 1_000_000)] }).reason).toBe('no-gain')
    expect(projectFinish({ ...base, baselineAt: new Date(now.getTime() - 0.2 * day).toISOString(), snapshots: [snap(0.2, 1_000_000), snap(0, 1_001_000)] }).reason).toBe('too-soon')
  })
})

describe('projectFinish by skill', () => {
  const now = new Date('2026-11-21T12:00:00Z')
  const day = 86_400_000
  const goals = [
    { skill: 'Mining', currentXp: 0, targetXp: 1_000_000 }, // planned at 100k xp/h
    { skill: 'Attack', currentXp: 0, targetXp: 1_000_000 }, // planned at 25k xp/h, four times slower
  ]
  const per = [{ total: 1_000_000, hours: 10 }, { total: 1_000_000, hours: 40 }]
  const snap = (daysAgo, mining, attack) => ({ capturedAt: new Date(now.getTime() - daysAgo * day).toISOString(), skills: { Mining: { xp: mining }, Attack: { xp: attack } } })

  it('finishes each skill still to come at its own rate, not at the rate of the skill being trained', async () => {
    const { projectFinish } = await import('@/utils/plannerTools')
    // Mining gained 500k in 10 days: that is 5 hours of planned training, so 0.5 h a day. 5 + 40 hours left = 90 days.
    const r = projectFinish({
      snapshots: [snap(10, 0, 0), snap(0, 500_000, 0)],
      goals, per, liveHours: 45, remainingXp: 1_500_000, plannedDays: 25, baselineAt: new Date(now.getTime() - 10 * day).toISOString(), now,
    })
    expect(r.effHoursPerDay).toBeCloseTo(0.5)
    expect(Math.round(r.daysLeft)).toBe(90)
    // A blended rate (50k XP a day) would have said 30 days.
    expect(Math.round(r.skillGain.Mining)).toBe(50_000)
    expect(r.skillGain.Attack).toBe(0)
  })

  it('draws the projection as one leg per skill and names the skill being trained', () => {
    const baseline = new Date(now.getTime() - 10 * day)
    const live = [{ ...goals[0], currentXp: 500_000 }, goals[1]]
    const progress = buildProgress(goals, live, goals.map((g, i) => ({ hours: per[i].hours })), [{ hours: 5 }, { hours: 40 }], 2, baseline, now)
    const projection = { status: 'late', xpPerDay: 50_000, daysLeft: 90, effHoursPerDay: 0.5, skillGain: { Mining: 50_000, Attack: 0 } }
    const series = paceSeries({ snapshots: [], goals, progress, hoursPerDay: 2, baselineAt: baseline, projection, now })
    expect(series.projected.map((p) => Math.round(p.day))).toEqual([10, 20, 100])
    expect(series.projected[series.projected.length - 1].xp).toBe(2_000_000)
    expect(series.current.skill).toBe('Mining')
    expect(series.current.paceXpPerDay).toBe(50_000)
  })
})

describe('paceSeries', () => {
  const baseline = new Date('2027-01-01T00:00:00Z')
  const now = new Date('2027-01-11T00:00:00Z') // day 10
  const goals = [goal('Mining', 50, 70), goal('Attack', 60, 80)]
  const total = goals.reduce((a, g) => a + g.targetXp - g.currentXp, 0)
  const snap = (day, mining, attack) => ({ capturedAt: new Date(baseline.getTime() + day * 86_400_000).toISOString(), skills: { Mining: { xp: mining }, Attack: { xp: attack } } })
  const make = (live, snapshots, projection = null) => {
    const progress = buildProgress(goals, live, goals.map(plan), live.map(plan), 2, baseline, now)
    return { progress, series: paceSeries({ snapshots, goals, progress, hoursPerDay: 2, baselineAt: baseline, projection, now }) }
  }

  it('draws the plan goal after goal, ending at the full amount on the planned day', () => {
    const { series, progress } = make(goals, [])
    expect(series.planned[0]).toEqual({ day: 0, xp: 0 })
    const last = series.planned[series.planned.length - 1]
    expect(last.xp).toBe(total)
    expect(last.day).toBeCloseTo(progress.originalHours / 2)
    expect(series.plannedDays).toBeCloseTo(last.day)
    expect(series.marks.map((m) => m.skill)).toEqual(['Mining', 'Attack'])
  })

  it('builds the actual line from history, capped at each goal target and never dipping', () => {
    const live = [liveGoalFor(goals[0], xpAtLevel(55)), liveGoalFor(goals[1], goals[1].currentXp)]
    const { series } = make(live, [snap(3, xpAtLevel(52), goals[1].currentXp), snap(5, xpAtLevel(51), goals[1].currentXp), snap(8, xpAtLevel(55), goals[1].currentXp)])
    expect(series.actual.map((p) => Math.round(p.day))).toEqual([0, 3, 5, 8, 10])
    const xps = series.actual.map((p) => p.xp)
    expect(xps).toEqual([...xps].sort((a, b) => a - b))
    expect(xps[xps.length - 1]).toBe(xpAtLevel(55) - goals[0].currentXp)
  })

  it('projects from today at the real pace and says what the plan needs per day', () => {
    const live = [liveGoalFor(goals[0], xpAtLevel(60)), goals[1]]
    const projection = { status: 'late', xpPerDay: 10_000, daysLeft: 50 }
    const { series, progress } = make(live, [], projection)
    expect(series.projected).toEqual([{ day: 10, xp: progress.gainedXp }, { day: 60, xp: total }])
    expect(series.endDay).toBeGreaterThanOrEqual(60)
    expect(series.neededPerDay).toBeCloseTo(progress.remainingXp / (series.plannedDays - 10))
    expect(series.overdue).toBe(false)
  })

  it('flags a plan that is past its planned date and has no projection without a pace', () => {
    const planFor = (g) => ({ hours: Math.max(0, g.targetXp - g.currentXp) / 5_000_000 }) // finishes in under a day
    const progress = buildProgress(goals, goals, goals.map(planFor), goals.map(planFor), 2, baseline, now)
    const series = paceSeries({ snapshots: [], goals, progress, hoursPerDay: 2, baselineAt: baseline, projection: null, now })
    expect(series.overdue).toBe(true)
    expect(series.neededPerDay).toBe(null)
    expect(series.projected).toBe(null)
  })

  it('has nothing to draw without a start date or any goals', () => {
    const progress = buildProgress(goals, goals, goals.map(plan), goals.map(plan), 2, baseline, now)
    expect(paceSeries({ snapshots: [], goals, progress, hoursPerDay: 2, baselineAt: null, now })).toBe(null)
    expect(paceSeries({ snapshots: [], goals: [], progress, hoursPerDay: 2, baselineAt: baseline, now })).toBe(null)
  })
})

describe('paceSeries for one skill', () => {
  const baseline = new Date('2027-01-01T00:00:00Z')
  const now = new Date('2027-01-11T00:00:00Z')
  const goals = [goal('Mining', 50, 70), goal('Attack', 60, 80)]
  const live = [liveGoalFor(goals[0], xpAtLevel(55)), goals[1]]
  const progress = buildProgress(goals, live, goals.map(plan), live.map(plan), 2, baseline, now)
  const projection = { status: 'late', xpPerDay: 20_000, daysLeft: 100, effHoursPerDay: 1, skillGain: { Mining: 20_000, Attack: 0 } }
  const snap = (day, mining) => ({ capturedAt: new Date(baseline.getTime() + day * 86_400_000).toISOString(), skills: { Mining: { xp: mining }, Attack: { xp: goals[1].currentXp } } })

  it('keeps the later skill waiting for its turn and counts only its own XP', () => {
    const series = paceSeries({ snapshots: [snap(5, xpAtLevel(53))], goals, progress, hoursPerDay: 2, baselineAt: baseline, projection, only: 1, now })
    const attack = progress.per[1]
    expect(series.totalXp).toBe(attack.total)
    expect(series.actual.every((p) => p.xp === 0)).toBe(true)
    // Flat at 0 until Mining is finished, then up to Attack's own total on the planned day of the whole plan.
    expect(series.planned[1].xp).toBe(0)
    expect(series.planned[1].day).toBeCloseTo(progress.per[0].hours / 2)
    expect(series.planned[series.planned.length - 1]).toEqual({ day: series.plannedDays, xp: attack.total })
    expect(series.plannedDays).toBeCloseTo((progress.per[0].hours + attack.hours) / 2)
    // Projected: waits out the rest of Mining at the real hours a day, then climbs.
    const miningLeft = progress.per[0].hoursLeft
    expect(series.projected[1].xp).toBe(0)
    expect(series.projected[1].day).toBeCloseTo(10 + miningLeft / 1)
    expect(series.projectedDay).toBeCloseTo(10 + (miningLeft + attack.hoursLeft) / 1)
    expect(series.current.skill).toBe('Attack')
    expect(series.marks).toEqual([])
  })

  it('looks at the first skill alone from its own start', () => {
    const series = paceSeries({ snapshots: [snap(5, xpAtLevel(53))], goals, progress, hoursPerDay: 2, baselineAt: baseline, projection, only: 0, now })
    expect(series.totalXp).toBe(progress.per[0].total)
    expect(series.planned).toHaveLength(2)
    expect(series.actual[series.actual.length - 1].xp).toBe(progress.per[0].gained)
    expect(series.projectedDay).toBeCloseTo(10 + progress.per[0].hoursLeft)
  })
})
