import { pool } from '../db.js'
import { summarize } from '../utils/shareStats.js'

const today = () => new Date().toISOString().slice(0, 10)

// One row per day, type, kind and detail, counted up. No identifiers are stored.
const bump = (type, kind, detail) =>
  pool.query(
    `INSERT INTO share_stats (day, type, kind, detail, n) VALUES ((now() AT TIME ZONE 'utc')::date, $1, $2, $3, 1)
     ON CONFLICT (day, type, kind, detail) DO UPDATE SET n = share_stats.n + 1`,
    [type, kind, detail],
  )

export const recordShare = ({ kind, method }) => bump('share', kind, method)
export const recordVisit = ({ kind, source }) => bump('visit', kind, source)

/** Shares and shared-link visits for the last `days` days (including today). */
export async function shareOverview(days) {
  const { rows } = await pool.query(
    `SELECT day::text AS day, type, kind, detail, n FROM share_stats WHERE day > (now() AT TIME ZONE 'utc')::date - $1::int`,
    [days],
  )
  return summarize(rows, days, today())
}
