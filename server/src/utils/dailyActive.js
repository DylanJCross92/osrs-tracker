// How many accounts were active on each day, from the events table. Pure, so the gap filling is easy to test.
import { addDays } from './dates.js'

/**
 * rows: [{ day: 'YYYY-MM-DD', active, logins, resumed }] (only days with account activity), today: 'YYYY-MM-DD'.
 * Returns exactly `days` entries, oldest first and ending today, with zeros for quiet days.
 * active = different accounts seen, logins = sign-ins, resumed = accounts that came back without signing in.
 */
export function fillDailyActive(rows, days, today) {
  const byDay = new Map(rows.map((r) => [r.day, r]))
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - (days - 1))
    const r = byDay.get(day)
    return { day, active: r ? Number(r.active) || 0 : 0, logins: r ? Number(r.logins) || 0 : 0, resumed: r ? Number(r.resumed) || 0 : 0 }
  })
}
