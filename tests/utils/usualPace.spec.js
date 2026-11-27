import { describe, it, expect } from 'vitest'
import { compareToUsual, usualByNow } from '@/utils/usualPace'
import { addGameDays, gameDay, startOfGameDay } from '@/utils/gameDay'

const HOUR = 3_600_000
// Tuesday 2026-11-17, 3 PM Eastern (EST = UTC-5, so 20:00 UTC). The game day started at 6 AM = 11:00 UTC.
const now = Date.UTC(2026, 10, 17, 20, 0, 0)
const dayStart = (key) => startOfGameDay(Date.parse(`${key}T12:00:00Z`))

// One snapshot per hour of gain: `byHour[h]` XP is gained in the hour after (6 AM + h).
function history(todayKey, weekdayHours, weekendHours, days = 28) {
  const snaps = []
  let xp = 1_000_000
  snaps.push({ capturedAt: new Date(dayStart(addGameDays(todayKey, -days)) - HOUR).toISOString(), overallXp: xp })
  for (let k = days; k >= 1; k--) {
    const key = addGameDays(todayKey, -k)
    const dow = new Date(`${key}T12:00:00Z`).getUTCDay()
    const hours = dow === 0 || dow === 6 ? weekendHours : weekdayHours
    hours.forEach((gain, h) => {
      xp += gain
      snaps.push({ capturedAt: new Date(dayStart(key) + (h + 1) * HOUR - 60_000).toISOString(), overallXp: xp })
    })
  }
  return snaps
}

// Today's own newest snapshot, `at` ms after the game day began (the measuring stops there).
const withToday = (snaps, key, at) => [...snaps, { capturedAt: new Date(dayStart(key) + at).toISOString(), overallXp: snaps[snaps.length - 1].overallXp + 5_000 }]

describe('usualByNow', () => {
  // Weekdays: 10k an hour from 6 AM to 4 PM (hours 0-9), then 30k an hour in the evening (hours 11-14). Weekends: 50k an hour from 6 AM.
  const weekday = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 0, 30, 30, 30, 30].map((n) => n * 1000)
  const weekend = Array(10).fill(50_000)

  it('uses the XP gained by this time of day on past weekdays, not the whole-day total', () => {
    const snaps = withToday(history(gameDay(now), weekday, weekend), gameDay(now), 9 * HOUR)
    const u = usualByNow(snaps, now)
    // 3 PM is 9 hours after 6 AM: nine snapshots of 10k each have landed.
    expect(u.dayType).toBe('weekday')
    expect(u.expected).toBe(90_000)
    expect(u.fullDay).toBe(100_000 + 120_000)
    expect(u.samples).toBeGreaterThanOrEqual(3)
  })

  it('compares with weekends separately on a weekend', () => {
    const sat = Date.UTC(2026, 10, 21, 20, 0, 0) // Saturday 3 PM Eastern
    const snaps = withToday(history(gameDay(sat), weekday, weekend), gameDay(sat), 9 * HOUR)
    const u = usualByNow(snaps, sat)
    expect(u.dayType).toBe('weekend')
    expect(u.expected).toBe(450_000)
  })

  it('is null without enough comparable days', () => {
    const snaps = withToday(history(gameDay(now), weekday, weekend, 3), gameDay(now), 9 * HOUR)
    expect(usualByNow(snaps, now)).toBeNull()
    expect(usualByNow([], now)).toBeNull()
  })

  it('follows the clock by the hour, not the newest snapshot', () => {
    // Today's own snapshots stop 3 hours in (9 AM), though it is now 3 PM: the line is still at the 3 PM usual.
    const stale = withToday(history(gameDay(now), weekday, weekend), gameDay(now), 3 * HOUR)
    expect(usualByNow(stale, now).expected).toBe(90_000)
  })

  it('steps up once per full hour, not between hours', () => {
    const snaps = withToday(history(gameDay(now), weekday, weekend), gameDay(now), 9 * HOUR)
    expect(usualByNow(snaps, now + 30 * 60_000).expected).toBe(90_000) // 3:30 PM still shows the 3 PM figure
    expect(usualByNow(snaps, now + HOUR).expected).toBe(100_000) // 4 PM
  })

  it('ignores days from before the player was tracked', () => {
    const snaps = withToday(history(gameDay(now), weekday, weekend, 10), gameDay(now), 9 * HOUR)
    const u = usualByNow(snaps, now, { minSamples: 1 })
    expect(u.samples).toBeLessThanOrEqual(10)
  })
})

describe('compareToUsual', () => {
  const usual = { expected: 100_000 }
  it('says ahead, behind or on pace with how far off', () => {
    expect(compareToUsual(150_000, usual)).toEqual({ status: 'ahead', diff: 50_000, pct: 50 })
    expect(compareToUsual(60_000, usual)).toEqual({ status: 'behind', diff: 40_000, pct: 40 })
    expect(compareToUsual(105_000, usual).status).toBe('on')
  })
  it('has nothing to say early in the day or without a usual', () => {
    expect(compareToUsual(0, { expected: 200 })).toBeNull()
    expect(compareToUsual(0, null)).toBeNull()
  })
})
