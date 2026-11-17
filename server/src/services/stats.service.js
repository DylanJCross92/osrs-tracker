import { pool } from '../db.js'
import { summarize } from '../utils/shareStats.js'
import { APP_TIMEZONE, localDay } from '../utils/dates.js'
import { fillDailyXp } from '../utils/dailyXp.js'

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

/**
 * XP gained across every tracked player on each of the last `days` game days (6 AM to 6 AM Eastern), oldest first, ending with
 * today so far. Worked out from the gains between saved snapshots, so a day's figure is what players gained during it.
 */
export async function dailyXp(days = 30) {
  const n = Math.min(Math.max(Math.floor(Number(days)) || 30, 7), 60)
  const { rows } = await pool.query(
    `WITH tracked AS (
       SELECT s.player_id, s.captured_at, s.overall_xp
       FROM snapshots s JOIN players p ON p.id = s.player_id
       -- A few days of padding, so the first snapshot in the window still has one before it to measure against.
       WHERE s.captured_at >= now() - ($2::int + 10) * interval '1 day'
         AND s.captured_at >= p.created_at - interval '1 minute'
     ), deltas AS (
       SELECT player_id,
              (date_trunc('day', (captured_at AT TIME ZONE $1) - interval '6 hours'))::date AS day,
              overall_xp - LAG(overall_xp) OVER (PARTITION BY player_id ORDER BY captured_at) AS delta
       FROM tracked
     )
     SELECT to_char(day, 'YYYY-MM-DD') AS day, SUM(GREATEST(delta, 0))::bigint AS xp, COUNT(DISTINCT player_id) FILTER (WHERE delta > 0)::int AS players
     FROM deltas WHERE delta IS NOT NULL GROUP BY day`,
    [APP_TIMEZONE, n],
  )
  return { days: fillDailyXp(rows, n, localDay(Date.now())) }
}
