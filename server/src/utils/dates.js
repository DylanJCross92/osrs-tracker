// Calendar-day helpers pinned to the app's timezone, so a card's "Nov 5–7"
// matches the days the player actually experienced rather than whatever
// timezone the server process happens to run in.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/New_York'

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }) // YYYY-MM-DD

export function localDay(date) {
  return dayFmt.format(new Date(date))
}

function dayToUtcMs(day) {
  return Date.parse(`${day}T12:00:00Z`)
}

/** Whole calendar days from a to b (b later), both 'YYYY-MM-DD'. */
export function diffDays(a, b) {
  return Math.round((dayToUtcMs(b) - dayToUtcMs(a)) / 86_400_000)
}

export function addDays(day, n) {
  return new Date(dayToUtcMs(day) + n * 86_400_000).toISOString().slice(0, 10)
}

export function weekdayShort(day) {
  return new Date(dayToUtcMs(day)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

/** Inclusive number of calendar days a period touches (Nov 5 -> Nov 7 = 3). */
export function dayCount(startIso, endIso) {
  return diffDays(localDay(startIso), localDay(endIso)) + 1
}

/** "Nov 5–7" within a month, "Oct 30 – Nov 6" across months, plus a year if not this year. */
export function formatRange(startIso, endIso) {
  const s = localDay(startIso)
  const e = localDay(endIso)
  const sd = new Date(dayToUtcMs(s))
  const ed = new Date(dayToUtcMs(e))
  const fmt = (d, opts) => d.toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })
  const thisYear = new Date().getFullYear()
  const yearSuffix = ed.getUTCFullYear() === thisYear ? '' : `, ${ed.getUTCFullYear()}`
  if (s === e) return `${fmt(sd, { month: 'short', day: 'numeric' })}${yearSuffix}`
  if (sd.getUTCMonth() === ed.getUTCMonth() && sd.getUTCFullYear() === ed.getUTCFullYear()) {
    return `${fmt(sd, { month: 'short' })} ${sd.getUTCDate()}–${ed.getUTCDate()}${yearSuffix}`
  }
  return `${fmt(sd, { month: 'short', day: 'numeric' })} – ${fmt(ed, { month: 'short', day: 'numeric' })}${yearSuffix}`
}
