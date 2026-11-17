// How much XP a player usually has gained by this time of the day, for the "today" bar in the week chart. Weekdays and weekends
// are measured apart (people play at different times), over the last few weeks of the same kind of day. The day is the site's
// 6 AM to 6 AM game day (see gameDay.js).
//
// A snapshot is only saved when XP changed, so the XP at any moment is the XP of the newest snapshot at or before it. That gives
// the hourly resolution the sync runs at, with no guessing between snapshots.
import { addGameDays, gameDay, startOfGameDay } from '@/utils/gameDay'

const dayType = (key) => {
  const dow = new Date(`${key}T12:00:00Z`).getUTCDay()
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
}
const median = (list) => {
  const s = [...list].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * snapshots: the player's own tracked snapshots (capturedAt, overallXp), any order.
 * Returns { dayType: 'weekday' | 'weekend', expected, fullDay, samples } or null when there are too few comparable days:
 *   expected - the usual XP gained from 6 AM to the same time of day now (up to the newest snapshot, so a stale player is not
 *              shown as behind), the median over past days of the same kind
 *   fullDay  - the usual XP for a whole day of that kind
 *   samples  - how many past days it is based on
 */
export function usualByNow(snapshots, now = Date.now(), { lookbackDays = 42, minSamples = 3 } = {}) {
  const pts = (snapshots || [])
    .map((s) => ({ t: Date.parse(s.capturedAt), xp: Number(s.overallXp) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.xp))
    .sort((a, b) => a.t - b.t)
  if (pts.length < 2) return null
  const xpAt = (t) => {
    let lo = 0
    let hi = pts.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (pts[mid].t <= t) {
        found = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return found < 0 ? null : pts[found].xp
  }

  const todayKey = gameDay(now)
  const type = dayType(todayKey)
  const elapsed = Math.max(Math.min(now, pts[pts.length - 1].t) - startOfGameDay(now), 0)
  const byNow = []
  const wholeDay = []
  for (let k = 1; k <= lookbackDays; k++) {
    const key = addGameDays(todayKey, -k)
    if (dayType(key) !== type) continue
    const start = startOfGameDay(Date.parse(`${key}T12:00:00Z`))
    const end = startOfGameDay(Date.parse(`${addGameDays(key, 1)}T12:00:00Z`))
    const base = xpAt(start)
    // Days from before the player was tracked have nothing to measure from.
    if (base == null) continue
    byNow.push(Math.max((xpAt(start + elapsed) ?? base) - base, 0))
    wholeDay.push(Math.max((xpAt(end) ?? base) - base, 0))
  }
  if (byNow.length < minSamples) return null
  return { dayType: type, expected: Math.round(median(byNow)), fullDay: Math.round(median(wholeDay)), samples: byNow.length }
}

/**
 * How today compares with the usual: { status: 'ahead' | 'behind' | 'on', diff, pct }, or null when it is too early to say.
 * diff is how many XP off (always positive), pct the same as a share of the usual; within the band counts as on pace.
 */
export function compareToUsual(actual, usual, { band = 0.1, minExpected = 1000 } = {}) {
  if (!usual || !(usual.expected >= minExpected)) return null
  const ratio = (actual - usual.expected) / usual.expected
  const diff = Math.round(Math.abs(actual - usual.expected))
  const pct = Math.round(Math.abs(ratio) * 100)
  if (Math.abs(ratio) <= band) return { status: 'on', diff, pct }
  return { status: ratio > 0 ? 'ahead' : 'behind', diff, pct }
}
