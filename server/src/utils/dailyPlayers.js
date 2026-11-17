// How many players the site is tracking on each day, from when each was added. Pure, so the counting is easy to test.
// A day is the 6 AM to 6 AM Eastern game day used everywhere else (see dates.js).
import { addDays, localDay } from './dates.js'

/**
 * createdAts: when each tracked player was added; today: 'YYYY-MM-DD'.
 * Returns `days` entries, oldest first and ending today: { day, total, added } (total = players tracked by the end of that day).
 */
export function playersByDay(createdAts, days, today) {
  const added = new Map()
  for (const t of createdAts) {
    const d = localDay(t)
    added.set(d, (added.get(d) || 0) + 1)
  }
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)))
  // Everyone added before the window is already on the site when it starts.
  let total = 0
  for (const [d, n] of added) if (d < dates[0]) total += n
  return dates.map((day) => {
    const n = added.get(day) || 0
    total += n
    return { day, total, added: n }
  })
}
