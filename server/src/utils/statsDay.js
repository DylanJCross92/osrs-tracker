// The days the admin statistics are counted by: midnight to midnight Eastern time, whatever timezone the server runs in.
// (Not the 6 AM game day in dates.js, which is for players' gains.) The database default for events.day cuts at the same
// moment, see schema.sql. Fixed to Eastern on purpose, so the figures never shift with a server setting.
export const STATS_TZ = 'America/New_York'

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: STATS_TZ }) // YYYY-MM-DD

/** The statistics day (YYYY-MM-DD, Eastern) an instant falls in. Defaults to now. */
export function statsDay(date = new Date()) {
  return dayFmt.format(new Date(date))
}

/** SQL for today's statistics day. */
export const SQL_STATS_TODAY = `(now() AT TIME ZONE '${STATS_TZ}')::date`

/** SQL for the statistics day of a timestamp column or expression. */
export const sqlStatsDay = (ts) => `((${ts}) AT TIME ZONE '${STATS_TZ}')::date`
