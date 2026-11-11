import { pool } from '../db.js'
import { listPlayers } from './players.service.js'
import { achievementDefinitions } from './milestones.service.js'
import { addNotification, ownerOfPlayer } from './inbox.service.js'

// There is no limit on how many players an account can follow; these only bound a single request.
const SAFETY_MAX = 5000
const FEED_MAX = 200
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

/**
 * Tells the account that owns a profile that someone started following it. The follower is named only when they own a
 * profile themselves (their RSN is public); otherwise it says "Someone", never an email. Once per follower per profile,
 * so unfollowing and following again does not notify twice. Never throws.
 */
async function notifyNewFollower(followerId, playerId) {
  try {
    const ownerId = await ownerOfPlayer(playerId)
    if (!ownerId || ownerId === followerId) return
    const { rows: mine } = await pool.query(
      `SELECT p.username, p.display_name FROM profile_claims c JOIN players p ON p.id = c.player_id WHERE c.user_id = $1 AND c.status = 'verified' ORDER BY c.decided_at ASC LIMIT 1`,
      [followerId],
    )
    const { rows: theirs } = await pool.query('SELECT username FROM players WHERE id = $1', [playerId])
    await addNotification(ownerId, {
      type: 'new_follower',
      text: `${mine[0]?.display_name || 'Someone'} started following you`,
      link: `/player/${encodeURIComponent(mine[0]?.username || theirs[0]?.username || '')}`,
      dedupeKey: `follow:${followerId}:${playerId}`,
      subject: mine[0]?.username || null,
    })
  } catch (err) {
    console.error('[follows] could not notify the owner:', err.message)
  }
}

export async function followPlayer(userId, playerId) {
  const { rowCount } = await pool.query('INSERT INTO follows (user_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, playerId])
  if (rowCount) notifyNewFollower(userId, playerId)
}

export async function unfollowPlayer(userId, playerId) {
  await pool.query('DELETE FROM follows WHERE user_id = $1 AND player_id = $2', [userId, playerId])
}

/**
 * Makes the follow list exactly this set of names (tracked players only). Used when an account signs
 * in, to bring in the list the browser had. Names that are not tracked are skipped.
 */
export async function setFollows(userId, names) {
  const clean = [...new Set((Array.isArray(names) ? names : []).filter((n) => typeof n === 'string' && NAME_RE.test(n.trim())).map((n) => n.trim().toLowerCase()))].slice(0, SAFETY_MAX)
  const { rows } = clean.length ? await pool.query('SELECT id FROM players WHERE lower(username) = ANY($1::text[])', [clean]) : { rows: [] }
  const ids = rows.map((r) => r.id)
  await pool.query('DELETE FROM follows WHERE user_id = $1 AND NOT (player_id = ANY($2::int[]))', [userId, ids])
  for (const id of ids) {
    const { rowCount } = await pool.query('INSERT INTO follows (user_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id])
    if (rowCount) notifyNewFollower(userId, id)
  }
  return listFollows(userId)
}

const TITLES = new Map(achievementDefinitions().map((d) => [`${d.type}|${d.skill}|${d.value}`, d.title]))
const FEED_DAYS = 30

/**
 * The Following strip: for the most recent FEED_MAX names, each player's recent gains and latest milestone, plus the newest
 * milestones across all of them. Public data only, so it works for visitors who follow players in their browser too.
 */
export async function getFollowingFeed(rawNames) {
  const names = [...new Set((Array.isArray(rawNames) ? rawNames : []).map((n) => String(n).trim()).filter((n) => NAME_RE.test(n)))].slice(-FEED_MAX)
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
