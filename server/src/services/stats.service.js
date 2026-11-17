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

/** The players most recently added to the tracker, newest first, with where they stand now (for the admin view on Discover). */
export async function recentPlayers(limit = 50) {
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 50, 1), 100)
  const [{ rows }, { rows: total }] = await Promise.all([
    pool.query(
      `SELECT p.username, p.display_name, p.created_at, s.overall_level, s.overall_xp
       FROM players p
       LEFT JOIN LATERAL (SELECT overall_level, overall_xp FROM snapshots WHERE player_id = p.id ORDER BY captured_at DESC LIMIT 1) s ON true
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $1`,
      [n],
    ),
    pool.query('SELECT count(*)::int AS n FROM players'),
  ])
  return {
    total: total[0].n,
    players: rows.map((r) => ({
      username: r.username,
      displayName: r.display_name,
      trackedAt: r.created_at,
      level: r.overall_level ?? null,
      xp: r.overall_xp == null ? null : Number(r.overall_xp),
    })),
  }
}
