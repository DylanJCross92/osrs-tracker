import { pool } from '../db.js'

// The stored notification inbox (see the notifications table in schema.sql). Producers call addNotification; nothing
// here can throw into a visitor's request, because a notification must never break the action that caused it.

const MAX_TEXT = 200
const KEEP_PER_USER = 200

/** Adds one notification. A repeat of the same dedupeKey for the same account is ignored. Returns true when added. */
export async function addNotification(userId, { type, text, link = '', dedupeKey = null }) {
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO notifications (user_id, type, text, link, dedupe_key) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [userId, String(type).slice(0, 40), String(text).slice(0, MAX_TEXT), String(link).slice(0, 300), dedupeKey],
    )
    if (rowCount) {
      // Keep the inbox from growing forever: the newest KEEP_PER_USER stay.
      pool.query(`DELETE FROM notifications WHERE user_id = $1 AND id NOT IN (SELECT id FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2)`, [userId, KEEP_PER_USER]).catch(() => {})
    }
    return rowCount > 0
  } catch (err) {
    console.error('[inbox] could not add notification:', err.message)
    return false
  }
}

/** The account that owns a profile (verified claim), or null. */
export async function ownerOfPlayer(playerId) {
  const { rows } = await pool.query(`SELECT user_id FROM profile_claims WHERE player_id = $1 AND status = 'verified'`, [playerId])
  return rows[0]?.user_id ?? null
}

/** Accounts that follow a player. */
export async function followersOfPlayer(playerId) {
  const { rows } = await pool.query('SELECT user_id FROM follows WHERE player_id = $1', [playerId])
  return rows.map((r) => r.user_id)
}

export async function listInbox(userId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, type, text, link, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(Math.max(Number(limit) || 50, 1), 100)],
  )
  return rows.map((r) => ({ id: r.id, type: r.type, text: r.text, link: r.link, createdAt: r.created_at, read: Boolean(r.read_at) }))
}

export async function unreadCount(userId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId])
  return rows[0].n
}

/** Marks some (ids) or all notifications read. */
export async function markRead(userId, { ids = null, all = false } = {}) {
  if (all) {
    await pool.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId])
    return
  }
  const clean = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100)
  if (!clean.length) return
  await pool.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = ANY($2::int[]) AND read_at IS NULL', [userId, clean])
}
