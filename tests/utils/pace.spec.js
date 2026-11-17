import { describe, it, expect } from 'vitest'
import { paceSpanDays, weekDaysFrom } from '@/utils/weekDays'
import { skillRates, whatsNext } from '@/utils/dashboard'
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
