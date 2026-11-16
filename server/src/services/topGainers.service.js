import { pool } from '../db.js'
import { APP_TIMEZONE, localDay } from '../utils/dates.js'
import { pickTopGainer, summarizeTopGainer } from '../utils/topGainers.js'

let backfilled = false

/**
 * Fills in earlier days from the saved snapshots, once per process and only while the table is empty. A day's winner is
 * whoever gained the most XP that game day, worked out the same way as the Records tab (sum of the gains between snapshots).
 * Today is left to recordTopGainer, since it is not over yet.
 */
export async function backfillTopGainers() {
  if (backfilled) return
  backfilled = true
  const { rows } = await pool.query('SELECT 1 FROM daily_top_gainers LIMIT 1')
  if (rows.length) return
  await pool.query(
    `WITH tracked AS (
       SELECT s.player_id, s.captured_at, s.overall_xp,
              (date_trunc('day', (s.captured_at AT TIME ZONE $1) - interval '6 hours'))::date AS day
       FROM snapshots s JOIN players p ON p.id = s.player_id
       WHERE s.captured_at >= p.created_at - interval '1 minute'
     ), deltas AS (
       SELECT player_id, day, overall_xp - LAG(overall_xp) OVER (PARTITION BY player_id ORDER BY captured_at) AS delta
       FROM tracked
     ), per_day AS (
       SELECT player_id, day, SUM(GREATEST(delta, 0))::bigint AS xp
       FROM deltas WHERE delta IS NOT NULL
       GROUP BY player_id, day
     ), winners AS (
       SELECT DISTINCT ON (day) day, player_id, xp
       FROM per_day
       WHERE xp > 0 AND day < $2::date
       ORDER BY day, xp DESC, player_id
     )
     INSERT INTO daily_top_gainers (day, player_id, xp)
     SELECT day, player_id, xp FROM winners
     ON CONFLICT (day) DO NOTHING`,
    [APP_TIMEZONE, localDay(Date.now())],
  )
}

/**
 * Notes who leads today. Called with the player list the Discover page was just built from, so it costs one small write.
 * The row only moves forward (a lower number never replaces a higher one), so a quirk in the hiscores cannot undo a lead.
 */
export async function recordTopGainer(players) {
  await backfillTopGainers()
  const top = pickTopGainer(players)
  if (!top) return
  await pool.query(
    `INSERT INTO daily_top_gainers (day, player_id, xp, top_skill) VALUES ($1, $2, $3, $4)
     ON CONFLICT (day) DO UPDATE SET player_id = EXCLUDED.player_id, xp = EXCLUDED.xp, top_skill = EXCLUDED.top_skill, updated_at = now()
     WHERE daily_top_gainers.xp <= EXCLUDED.xp`,
    [localDay(Date.now()), top.player.id, top.xp, top.topSkill],
  )
}

/** { days, streak, longest, bestXp, bestDay, firstDay, lastDay, leadingNow } for a player (days is 0 if never). */
export async function getTopGainerStats(player) {
  const { rows } = await pool.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, xp FROM daily_top_gainers WHERE player_id = $1 ORDER BY day ASC`,
    [player.id],
  )
  return summarizeTopGainer(
    rows.map((r) => ({ day: r.day, xp: Number(r.xp) })),
    localDay(Date.now()),
  )
}
