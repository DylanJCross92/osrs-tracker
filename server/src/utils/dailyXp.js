// Day-by-day XP gained across the whole site (for the admin view on Discover). Pure, so the gap filling is easy to test.
import { addDays } from './dates.js'

/**
 * rows: [{ day: 'YYYY-MM-DD', xp, players }] (only days that had any gain), today: 'YYYY-MM-DD'.
 * Returns exactly `days` entries, oldest first and ending today, with zeros for quiet days.
 */
export function fillDailyXp(rows, days, today) {
  const byDay = new Map(rows.map((r) => [r.day, r]))
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - (days - 1))
    const r = byDay.get(day)
    return { day, xp: r ? Number(r.xp) : 0, players: r ? Number(r.players) : 0 }
  })
}
