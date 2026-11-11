import { pool } from '../db.js'
import { listPlayers } from './players.service.js'
import { achievementDefinitions } from './milestones.service.js'

export const MAX_FOLLOWS = 25
const NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/

export class FollowError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

/** The players an account follows, oldest first: [{ username, displayName }]. */
export async function listFollows(userId) {
  const { rows } = await pool.query(
    `SELECT p.username, p.display_name FROM follows f JOIN players p ON p.id = f.player_id WHERE f.user_id = $1 ORDER BY f.created_at ASC`,
    [userId],
  )
  return rows.map((r) => ({ username: r.username, displayName: r.display_name }))
}

export async function followPlayer(userId, playerId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM follows WHERE user_id = $1', [userId])
  const already = await pool.query('SELECT 1 FROM follows WHERE user_id = $1 AND player_id = $2', [userId, playerId])
  if (!already.rowCount && rows[0].n >= MAX_FOLLOWS) throw new FollowError(`You can follow up to ${MAX_FOLLOWS} players. Unfollow one first.`)
  await pool.query('INSERT INTO follows (user_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, playerId])
}

export async function unfollowPlayer(userId, playerId) {
  await pool.query('DELETE FROM follows WHERE user_id = $1 AND player_id = $2', [userId, playerId])
}

/**
 * Makes the follow list exactly this set of names (tracked players only, up to MAX_FOLLOWS). Used when an account signs
 * in, to bring in the list the browser had. Names that are not tracked are skipped.
 */
export async function setFollows(userId, names) {
  const clean = [...new Set((Array.isArray(names) ? names : []).filter((n) => typeof n === 'string' && NAME_RE.test(n.trim())).map((n) => n.trim().toLowerCase()))].slice(0, MAX_FOLLOWS)
  const { rows } = clean.length ? await pool.query('SELECT id FROM players WHERE lower(username) = ANY($1::text[])', [clean]) : { rows: [] }
  const ids = rows.map((r) => r.id)
  await pool.query('DELETE FROM follows WHERE user_id = $1 AND NOT (player_id = ANY($2::int[]))', [userId, ids])
  for (const id of ids) await pool.query('INSERT INTO follows (user_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id])
  return listFollows(userId)
}

const TITLES = new Map(achievementDefinitions().map((d) => [`${d.type}|${d.skill}|${d.value}`, d.title]))
const FEED_DAYS = 30

/**
 * The Following strip: for up to MAX_FOLLOWS names, each player's recent gains and latest milestone, plus the newest
 * milestones across all of them. Public data only, so it works for visitors who follow players in their browser too.
 */
export async function getFollowingFeed(rawNames) {
  const names = [...new Set((Array.isArray(rawNames) ? rawNames : []).map((n) => String(n).trim()).filter((n) => NAME_RE.test(n)))].slice(0, MAX_FOLLOWS)
  if (!names.length) return { players: [], events: [] }
  const found = await pool.query('SELECT id FROM players WHERE lower(username) = ANY($1::text[])', [names.map((n) => n.toLowerCase())])
  const ids = found.rows.map((r) => r.id)
  if (!ids.length) return { players: [], events: [] }

  const [players, milestones] = await Promise.all([
    listPlayers({ ids }),
    pool.query(
      `SELECT player_id, milestone_type, skill, value, occurred_at FROM player_milestones
       WHERE player_id = ANY($1::int[]) AND occurred_at IS NOT NULL AND occurred_at > now() - make_interval(days => $2)
       ORDER BY occurred_at DESC`,
      [ids, FEED_DAYS],
    ),
  ])
  const byId = new Map(players.map((p) => [p.id, p]))
  const events = []
  for (const m of milestones.rows) {
    const p = byId.get(m.player_id)
    const title = TITLES.get(`${m.milestone_type}|${m.skill}|${Number(m.value)}`)
    if (!p || !title) continue
    events.push({ username: p.username, displayName: p.displayName, badge: p.badge, claimed: p.claimed, title, at: m.occurred_at })
  }
  const latest = new Map()
  for (const e of events) if (!latest.has(e.username)) latest.set(e.username, { title: e.title, at: e.at })

  return {
    players: players
      .map((p) => ({
        username: p.username,
        displayName: p.displayName,
        badge: p.badge,
        claimed: p.claimed,
        overallLevel: p.latest?.overallLevel ?? null,
        dayGain: p.gains?.day?.xp > 0 ? p.gains.day.xp : 0,
        weekGain: p.gains?.week?.xp > 0 ? p.gains.week.xp : 0,
        topSkill: p.gains?.week?.topSkill ?? null,
        latest: latest.get(p.username) || null,
      }))
      .sort((a, b) => b.dayGain - a.dayGain || b.weekGain - a.weekGain),
    events: events.slice(0, 15),
  }
}
