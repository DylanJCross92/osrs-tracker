import { pool } from '../db.js'
import { computeRecords } from '../utils/records.js'

// Records only move when new snapshots land (about hourly), and every profile view and share preview asks for them,
// so a short in-memory cache keeps the snapshot scan off the hot path.
const CACHE_MS = 60_000
const cache = new Map()

/** { since, trackedDays, today, records } for a player (see utils/records.js). */
export async function getPlayerRecords(player) {
  const hit = cache.get(player.id)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value

  const { rows } = await pool.query(
    'SELECT captured_at, overall_xp, overall_level, skills FROM snapshots WHERE player_id = $1 ORDER BY captured_at ASC',
    [player.id],
  )
  const value = computeRecords(
    rows.map((r) => ({ capturedAt: r.captured_at, overallXp: Number(r.overall_xp), overallLevel: r.overall_level, skills: r.skills })),
    { createdAt: player.createdAt },
  )
  cache.set(player.id, { at: Date.now(), value })
  return value
}

/** One record by key, or null. */
export async function getPlayerRecord(player, key) {
  const { records } = await getPlayerRecords(player)
  return records.find((r) => r.key === key && !r.locked) || null
}
