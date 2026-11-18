import { pool } from '../db.js'
import { summarize, summarizeItems } from '../utils/shareStats.js'
import { APP_TIMEZONE, localDay } from '../utils/dates.js'
import { fillDailyXp } from '../utils/dailyXp.js'
import { playersByDay } from '../utils/dailyPlayers.js'
import { groupPlansByPlayer } from '../utils/adminPlans.js'

const today = () => new Date().toISOString().slice(0, 10)

// One row per day, type, kind and detail, counted up. No identifiers are stored.
const bump = (type, kind, detail) =>
  pool.query(
    `INSERT INTO share_stats (day, type, kind, detail, n) VALUES ((now() AT TIME ZONE 'utc')::date, $1, $2, $3, 1)
     ON CONFLICT (day, type, kind, detail) DO UPDATE SET n = share_stats.n + 1`,
    [type, kind, detail],
  )

// The most different items kept for one day: a script cannot fill the table, and a real day is far below it.
const MAX_ITEMS_PER_DAY = 3000
const bumpItem = (type, kind, item) =>
  pool.query(
    `INSERT INTO share_items (day, type, kind, item, n)
     SELECT (now() AT TIME ZONE 'utc')::date, $1, $2, $3, 1
     WHERE (SELECT count(*) FROM share_items WHERE day = (now() AT TIME ZONE 'utc')::date) < $4
     ON CONFLICT (day, type, kind, item) DO UPDATE SET n = share_items.n + 1`,
    [type, kind, item, MAX_ITEMS_PER_DAY],
  )

export async function recordShare({ kind, method, item }) {
  await bump('share', kind, method)
  if (item) await bumpItem('share', kind, item)
}
export async function recordVisit({ kind, source, item }) {
  await bump('visit', kind, source)
  if (item) await bumpItem('visit', kind, item)
}

/** Shares and shared-link visits for the last `days` days (including today). */
export async function shareOverview(days) {
  const [{ rows }, { rows: itemRows }] = await Promise.all([
    pool.query(`SELECT day::text AS day, type, kind, detail, n FROM share_stats WHERE day > (now() AT TIME ZONE 'utc')::date - $1::int`, [days]),
    pool.query(`SELECT type, kind, item, sum(n)::int AS n FROM share_items WHERE day > (now() AT TIME ZONE 'utc')::date - $1::int GROUP BY type, kind, item`, [days]),
  ])
  return { ...summarize(rows, days, today()), items: summarizeItems(itemRows) }
}

/** The players most recently added to the tracker, newest first, with where they stand now (for the admin view on Discover). */
export async function recentPlayers(limit = 25) {
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 25, 1), 100)
  const [{ rows }, { rows: total }] = await Promise.all([
    pool.query(
      `SELECT p.username, p.display_name, p.badge, p.created_at, s.overall_level, s.overall_xp,
              EXISTS (SELECT 1 FROM profile_claims pc WHERE pc.player_id = p.id AND pc.status = 'verified') AS claimed
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
      badge: r.badge,
      claimed: Boolean(r.claimed),
      trackedAt: r.created_at,
      level: r.overall_level ?? null,
      xp: r.overall_xp == null ? null : Number(r.overall_xp),
    })),
  }
}

/** How many players were being tracked at the end of each of the last `days` game days, oldest first, ending today. */
export async function dailyPlayers(days = 30) {
  const n = Math.min(Math.max(Math.floor(Number(days)) || 30, 7), 60)
  const { rows } = await pool.query('SELECT created_at FROM players')
  return { days: playersByDay(rows.map((r) => r.created_at), n, localDay(Date.now())) }
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

/** Every plan accounts have saved (and the planner left in progress), grouped by player name. For the site owner only. */
export async function plansByPlayer() {
  const [{ rows }, { rows: visitorRows }] = await Promise.all([
    pool.query(`SELECT data->'plans' AS plans, data->'planner' AS planner FROM users WHERE data ? 'plans' OR data ? 'planner'`),
    // Visitors who later signed in are left out: their plans are already in their account's data.
    pool.query(
      `SELECT v.visitor_id AS id, v.plans, v.planner, v.updated_at
       FROM visitor_data v WHERE NOT EXISTS (SELECT 1 FROM visitor_links l WHERE l.visitor_id = v.visitor_id)`,
    ),
  ])
  return groupPlansByPlayer(rows, visitorRows.map((v) => ({ ...v, updatedAt: v.updated_at ? new Date(v.updated_at).toISOString() : null })))
}

const MAX_VISITOR_PLANS = 30
const MAX_VISITOR_JSON = 150_000

/**
 * Keeps the plans saved in a signed-out visitor's browser under their visitor id (replacing what was there). An empty set removes
 * the row. Returns false when what was sent is too large to keep.
 */
export async function saveVisitorPlans(visitorId, plans, planner) {
  const list = (Array.isArray(plans) ? plans : []).filter((p) => p && typeof p === 'object').slice(0, MAX_VISITOR_PLANS)
  const draft = planner && typeof planner === 'object' && !Array.isArray(planner) && Array.isArray(planner.goals) && planner.goals.length ? planner : null
  if (!list.length && !draft) {
    await pool.query('DELETE FROM visitor_data WHERE visitor_id = $1', [visitorId])
    return true
  }
  const json = JSON.stringify({ list, draft })
  if (json.length > MAX_VISITOR_JSON) return false
  await pool.query(
    `INSERT INTO visitor_data (visitor_id, plans, planner, updated_at) VALUES ($1, $2::jsonb, $3::jsonb, now())
     ON CONFLICT (visitor_id) DO UPDATE SET plans = EXCLUDED.plans, planner = EXCLUDED.planner, updated_at = now()`,
    [visitorId, JSON.stringify(list), draft ? JSON.stringify(draft) : null],
  )
  return true
}
