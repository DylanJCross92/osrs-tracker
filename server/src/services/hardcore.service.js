import { pool } from '../db.js'
import { nextMiss, lifeSummary } from '../utils/hardcore.js'
import { addNotification, dayStamp, followersOfPlayer, ownerOfPlayer } from './inbox.service.js'

// Hardcore Worlds characters (see schema.sql and utils/hardcore.js). The character is its own `players` row (mode 'hardcore'); these are the things
// that only make sense for one: lives, resets, leaving, and telling the people who follow the account.

const num = (v) => (v == null ? null : Number(v))
const mapEvent = (r) => ({
  id: r.id,
  kind: r.kind,
  occurredAt: r.occurred_at,
  life: r.life,
  prevLevel: r.prev_level,
  prevXp: num(r.prev_xp),
  newLevel: r.new_level,
  newXp: num(r.new_xp),
  summary: r.summary || null,
})

/** A character's events, oldest first. */
export async function getHardcoreEvents(playerId) {
  const { rows } = await pool.query('SELECT * FROM hardcore_events WHERE player_id = $1 ORDER BY occurred_at ASC, id ASC', [playerId])
  return rows.map(mapEvent)
}

/**
 * The character started again: record what the ended life had earned, clear the milestones (and the cheers and seen-celebrations that go with them) so the new
 * life can earn them again, and tell the people who follow the account. Returns the new life number. `prev` is the last snapshot row (with its life).
 */
export async function startNewLife(playerId, prev, stats) {
  const life = Number(prev.life) || 1
  const timelineRes = await pool.query(
    'SELECT milestone_type, skill, value, occurred_at FROM player_milestones WHERE player_id = $1 ORDER BY occurred_at ASC NULLS FIRST',
    [playerId],
  )
  const timeline = timelineRes.rows.map((r) => ({ type: r.milestone_type, skill: r.skill, value: Number(r.value), occurredAt: r.occurred_at }))
  const summary = lifeSummary(prev, timeline)
  const ins = await pool.query(
    `INSERT INTO hardcore_events (player_id, kind, life, prev_level, prev_xp, new_level, new_xp, summary)
     VALUES ($1, 'reset', $2, $3, $4, $5, $6, $7) RETURNING id, occurred_at`,
    [playerId, life, prev.overall_level, prev.overall_xp, stats.overall.level, stats.overall.xp, JSON.stringify(summary)],
  )
  await pool.query('DELETE FROM player_milestones WHERE player_id = $1', [playerId])
  await pool.query('DELETE FROM milestone_cheers WHERE player_id = $1', [playerId])
  await pool.query('DELETE FROM celebration_seen WHERE player_id = $1', [playerId])
  notifyReset(playerId, { life, level: prev.overall_level, eventId: ins.rows[0].id }).catch((err) => console.error('[hardcore] notify failed:', err.message))
  return life + 1
}

/** Followers and the owner hear about a reset: one note per character per day, however many times it happens. */
async function notifyReset(playerId, { life, level }) {
  const { rows } = await pool.query('SELECT username, display_name FROM players WHERE id = $1', [playerId])
  if (!rows[0]) return
  const ownerId = await ownerOfPlayer(playerId)
  const followers = (await followersOfPlayer(playerId)).filter((id) => id !== ownerId)
  const link = `/player/${encodeURIComponent(rows[0].username)}?world=hardcore`
  const key = `hcw-reset:${playerId}:${dayStamp()}`
  const total = Number(level) ? ` at total level ${Number(level).toLocaleString('en-US')}` : ''
  if (ownerId) await addNotification(ownerId, { type: 'hardcore_reset', text: `Your Hardcore Worlds character started again${total}. That was life ${life}.`, link, dedupeKey: key, subject: rows[0].username })
  for (const id of followers) await addNotification(id, { type: 'follow_hardcore_reset', text: `${rows[0].display_name} reset their Hardcore Worlds character${total}`, link, dedupeKey: key, subject: rows[0].username })
}

/** The Hardcore Worlds hiscores did not have the character on this check. Two misses a day apart mark it as having left. */
export async function recordHardcoreMiss(playerId) {
  const { rows } = await pool.query('SELECT hardcore_status, hardcore_misses, hardcore_miss_at FROM players WHERE id = $1', [playerId])
  const row = rows[0]
  if (!row || row.hardcore_status === 'left') return { left: false }
  const next = nextMiss({ misses: row.hardcore_misses, missAt: row.hardcore_miss_at })
  if (!next.left) {
    await pool.query('UPDATE players SET hardcore_misses = $2, hardcore_miss_at = $3, last_checked_at = now() WHERE id = $1', [playerId, next.misses, next.missAt])
    return { left: false }
  }
  const last = await pool.query('SELECT overall_level, overall_xp, life FROM snapshots WHERE player_id = $1 ORDER BY captured_at DESC LIMIT 1', [playerId])
  await pool.query("UPDATE players SET hardcore_status = 'left', hardcore_misses = $2, hardcore_miss_at = $3, last_checked_at = now() WHERE id = $1", [playerId, next.misses, next.missAt])
  await pool.query(
    "INSERT INTO hardcore_events (player_id, kind, life, prev_level, prev_xp) VALUES ($1, 'left', $2, $3, $4)",
    [playerId, last.rows[0]?.life ?? 1, last.rows[0]?.overall_level ?? null, last.rows[0]?.overall_xp ?? null],
  )
  return { left: true }
}

/** A character that had left is on the table again. */
export async function markHardcoreJoined(playerId) {
  await pool.query("UPDATE players SET hardcore_status = 'active', hardcore_misses = 0, hardcore_miss_at = NULL WHERE id = $1", [playerId])
  const last = await pool.query('SELECT overall_level, overall_xp, life FROM snapshots WHERE player_id = $1 ORDER BY captured_at DESC LIMIT 1', [playerId])
  await pool.query("INSERT INTO hardcore_events (player_id, kind, life, new_level, new_xp) VALUES ($1, 'joined', $2, $3, $4)", [playerId, last.rows[0]?.life ?? 1, last.rows[0]?.overall_level ?? null, last.rows[0]?.overall_xp ?? null])
}

/**
 * The Hardcore Worlds character of a name, for a profile: { id, status, life, lives, resets, events } or null when the name has none. `life` is
 * the current life (resets + 1), `resets` how many times it started again.
 */
export async function getHardcoreCharacter(username) {
  const { rows } = await pool.query(
    `SELECT p.id, p.hardcore_status,
            (SELECT COALESCE(MAX(life), 1) FROM snapshots WHERE player_id = p.id) AS life,
            (SELECT overall_rank FROM snapshots WHERE player_id = p.id ORDER BY captured_at DESC LIMIT 1) AS rank
     FROM players p WHERE p.username = $1 AND p.mode = 'hardcore'`,
    [username],
  )
  if (!rows[0]) return null
  const events = await getHardcoreEvents(rows[0].id)
  return {
    id: rows[0].id,
    status: rows[0].hardcore_status || 'active',
    life: Number(rows[0].life),
    resets: events.filter((e) => e.kind === 'reset').length,
    rank: rows[0].rank,
    events,
  }
}
