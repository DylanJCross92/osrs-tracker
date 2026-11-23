import { describe, it, expect } from 'vitest'
import { paceRates, paceSpanDays, weekDaysFrom } from '@/utils/weekDays'
import { skillRates, timelineModel, whatsNext } from '@/utils/dashboard'
import { projectFinish } from '@/utils/plannerTools'
import { xpAtLevel } from '@/utils/planner'

const HOUR = 3_600_000
const DAY = 24 * HOUR
// 6 AM Eastern is 11:00 UTC in November (EST).
const sixAm = Date.UTC(2026, 10, 17, 11, 0, 0)

// A player who gains 100k Slayer XP a day, with a snapshot at 6 AM (the start of each game day) and one at the evening.
const steadyHistory = (upTo) => {
  const snaps = []
  let xp = 1_000_000
  for (let t = sixAm - 9 * DAY; t <= upTo; t += DAY / 2) {
    snaps.push({ capturedAt: new Date(t).toISOString(), overallXp: xp, skills: { Slayer: { xp, level: 90 } } })
    xp += 50_000
  }
  return snaps
}

describe('paceSpanDays', () => {
  it('is the real time between the starting snapshot and the newest one, not a count of days', () => {
    const snaps = steadyHistory(sixAm + 5 * 60_000)
    const span = paceSpanDays(snaps, sixAm + 5 * 60_000)
    expect(span).toBeGreaterThan(6)
    expect(span).toBeLessThan(7.6)
  })

  it('is at least a day and null when there is nothing to measure', () => {
    const now = sixAm + 12 * HOUR
    const snaps = [
      { capturedAt: new Date(now - 2 * HOUR).toISOString(), overallXp: 1, skills: {} },
      { capturedAt: new Date(now).toISOString(), overallXp: 2, skills: {} },
    ]
    expect(paceSpanDays(snaps, now)).toBe(1)
    expect(paceSpanDays([], now)).toBeNull()
  })
})

describe('skillRates over real time', () => {
  const days = [{ skills: [{ skill: 'Slayer', xp: 700_000 }] }, { skills: [] }]
  it('divides by the span when one is given, and by the number of days when not', () => {
    expect(skillRates(days, 7).get('Slayer')).toBeCloseTo(100_000)
    expect(skillRates(days).get('Slayer')).toBeCloseTo(350_000)
  })
})

describe('projected dates do not swing with the time of day', () => {
  const etaAt = (now) => {
    const snaps = steadyHistory(now)
    const days = weekDaysFrom(snaps, now)
    const items = whatsNext({ latest: { skills: { Slayer: { xp: xpAtLevel(96) } } }, days, spanDays: paceSpanDays(snaps, now), limit: 10 })
    return items.find((i) => i.key === 'Slayer:99').etaDays
  }

  it('gives about the same finish just after the 6 AM reset as in the evening', () => {
    const morning = etaAt(sixAm + 5 * 60_000)
    const evening = etaAt(sixAm + 15 * HOUR)
    expect(Number.isFinite(morning)).toBe(true)
    // Counting today as a full day made the morning ETA roughly a seventh longer (and the evening one shorter).
    expect(Math.abs(morning - evening) / evening).toBeLessThan(0.05)
  })

  it('beats the old whole-day divisor in the morning', () => {
    const now = sixAm + 5 * 60_000
    const snaps = steadyHistory(now)
    const days = weekDaysFrom(snaps, now)
    const oldRate = skillRates(days).get('Slayer')
    const newRate = skillRates(days, paceSpanDays(snaps, now)).get('Slayer')
    expect(newRate).toBeGreaterThan(oldRate)
    expect(newRate).toBeGreaterThan(80_000)
  })
})

describe('projectFinish measures up to the newest snapshot', () => {
  const now = new Date('2026-11-21T12:00:00Z')
  const goals = [{ skill: 'Mining', currentXp: 1_000_000, targetXp: 2_000_000 }]
  const snap = (hoursAgo, xp) => ({ capturedAt: new Date(now.getTime() - hoursAgo * HOUR).toISOString(), skills: { Mining: { xp } } })
  it('does not count the hours since the last refresh as time with no gains', () => {
    // 100k gained over the 10 days up to the last snapshot, which was taken 18 hours ago.
    const r = projectFinish({
      snapshots: [snap(10 * 24 + 18, 1_000_000), snap(18, 1_100_000)],
      goals, remainingXp: 900_000, plannedDays: 200, baselineAt: new Date(now.getTime() - (10 * 24 + 18) * HOUR).toISOString(), now,
    })
    expect(Math.round(r.xpPerDay)).toBe(10_000)
  })
})

describe('pace from the last seven full game days', () => {
  // 6 AM Eastern (11:00 UTC) on Monday 23 Nov 2026 starts the current game day; the player gains 300k Agility XP in each of the seven days before it.
  const todayStart = Date.UTC(2026, 10, 23, 11, 0, 0)
  const BASE = 5_000_000
  const snapsAt = (extra = []) => {
    const out = []
    for (let d = 7; d >= 0; d--) {
      const xp = BASE + (7 - d) * 300_000
      out.push({ capturedAt: new Date(todayStart - d * DAY).toISOString(), overallXp: xp, skills: { Agility: { xp, level: 90 } } })
    }
    return [...out, ...extra]
  }
  const AT_EDGE = BASE + 7 * 300_000
  const snap = (t, xp) => ({ capturedAt: new Date(t).toISOString(), overallXp: xp, skills: { Agility: { xp, level: 90 } } })
  it('averages the seven complete days and ignores a morning with nothing played yet', () => {
    const morning = Date.UTC(2026, 10, 23, 13, 54)
    const a = paceRates(snapsAt(), morning)
    const b = paceRates(snapsAt([snap(morning, AT_EDGE)]), morning)
    expect(a.rates.get('Agility')).toBeCloseTo(300_000, 0)
    // The extra snapshot with no gain does not dilute the pace.
    expect(b.rates.get('Agility')).toBeCloseTo(300_000, 0)
    expect(b.today.get('Agility')).toBeUndefined()
  })
  it('counts what was gained so far today separately', () => {
    const now = Date.UTC(2026, 10, 23, 20, 0)
    const p = paceRates(snapsAt([snap(now, AT_EDGE + 120_000)]), now)
    expect(p.today.get('Agility')).toBe(120_000)
    expect(p.rates.get('Agility')).toBeCloseTo(300_000, 0)
  })
  it('dates a goal by game day: the whole of today is still ahead in the morning, so 500K at 300K a day lands tomorrow', () => {
    const now = Date.UTC(2026, 10, 23, 13, 54)
    const pace = paceRates(snapsAt([snap(now, AT_EDGE)]), now)
    const items = whatsNext({ latest: { skills: { Agility: { xp: xpAtLevel(91) - 500_000, level: 90 } } }, days: [], pace, now, limit: 5 })
    const lvl = items.find((i) => i.key === 'Agility:91')
    // Today's average day (300k), then 200k of the next one.
    expect(lvl.dueOffset).toBe(1)
    const g = timelineModel(items, now).groups.find((x) => x.items.some((i) => i.key === 'Agility:91'))
    expect(g.whenText).toBe('tomorrow')
    expect(g.day).toBe(24)
  })
  it('counts XP already gained today against today, and finishes today when the average day covers it', () => {
    const now = Date.UTC(2026, 10, 23, 20, 0)
    const cur = AT_EDGE + 200_000
    const pace = paceRates(snapsAt([snap(now, cur)]), now)
    const near = whatsNext({ latest: { skills: { Agility: { xp: xpAtLevel(91) - 90_000, level: 90 } } }, days: [], pace, now, limit: 5 }).find((i) => i.key === 'Agility:91')
    // 100k are left in today's average day and 90k are needed: still today.
    expect(near.dueOffset).toBe(0)
    const far = whatsNext({ latest: { skills: { Agility: { xp: xpAtLevel(91) - 250_000, level: 90 } } }, days: [], pace, now, limit: 5 }).find((i) => i.key === 'Agility:91')
    // 100k today, then 150k on the next day.
    expect(far.dueOffset).toBe(1)
  })
  it('uses the days it has with a short history, and nothing without any', () => {
    const now = Date.UTC(2026, 10, 23, 13, 54)
    expect(paceRates([], now)).toBeNull()
    const three = [snap(todayStart - 3 * DAY, BASE), snap(todayStart - 2 * DAY, BASE + 300_000), snap(todayStart - DAY, BASE + 600_000), snap(todayStart, BASE + 900_000)]
    expect(paceRates(three, now).rates.get('Agility')).toBeCloseTo(300_000, 0)
  })
})
