// The site's own weekly race: an overall-XP competition that anyone can enter, running Monday midnight to the next Monday midnight in the
// app's time zone (Eastern). Pure (no database): it works out the window and the title, so it is easy to test, including the weeks the
// clocks change.
import { APP_TIMEZONE } from './dates.js'

export const WEEKLY_CLAN = { slug: 'tickgains-weekly', name: 'TickGains Weekly', description: 'The site\'s own weekly XP race. Join with your RuneScape name and see who gains the most overall XP from Monday to Monday. Everyone is welcome.' }

const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', weekday: 'short' })
const WEEKDAYS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** The calendar date, weekday (Monday = 1) and hour of an instant in the app's time zone. */
function zoned(ms) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), weekday: WEEKDAYS[p.weekday], hour: Number(p.hour) }
}

/** The instant midnight starts the calendar date y-m-d in the app's time zone. Midnight is never skipped or repeated by a clock change. */
function midnightOf(y, m, d) {
  // Midnight Eastern is 04:00 or 05:00 UTC depending on summer time: try 05:00 and step back an hour when that lands at 01:00.
  const guess = Date.UTC(y, m - 1, d, 5, 0, 0)
  return zoned(guess).hour === 1 ? guess - 3_600_000 : guess
}

const addDays = (y, m, d, n) => {
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = ({ m, d }) => `${MONTH[m - 1]} ${d}`

/**
 * The race for the week `now` falls in: it starts now (or at Monday midnight when that is later, which it never is for a call made during
 * the week) and ends at the next Monday midnight. The title names its first and last day. { startsAt, endsAt, title } with the dates as Date objects.
 */
export function weeklyRaceWindow(now = Date.now()) {
  const { y, m, d, weekday } = zoned(now)
  const monday = addDays(y, m, d, -(weekday - 1))
  const nextMonday = addDays(monday.y, monday.m, monday.d, 7)
  const sunday = addDays(monday.y, monday.m, monday.d, 6)
  const mondayStart = midnightOf(monday.y, monday.m, monday.d)
  const startsAt = Math.max(now, mondayStart)
  // Made on time, the race is named for its Monday; made part way through the week (the first one, or after the job was down), for the day it really starts.
  const first = startsAt - mondayStart > 3_600_000 ? { m, d } : monday
  return {
    startsAt: new Date(startsAt),
    endsAt: new Date(midnightOf(nextMonday.y, nextMonday.m, nextMonday.d)),
    title: `Weekly XP race, ${label(first)} to ${label(sunday)}`,
  }
}
