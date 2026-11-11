import { pool } from '../db.js'
import { getPlayerRecords } from './records.service.js'
import { recordHeadline } from '../utils/records.js'
import { addNotification, ownerOfPlayer } from './inbox.service.js'
import { checkGoals } from './goals.service.js'

/**
 * After a new snapshot: if the profile has an owner and one of its records went up, tell them. The first check only
 * stores the starting values, so nobody gets a flood of notices for records that already existed.
 */
export async function checkRecords(playerId) {
  const ownerId = await ownerOfPlayer(playerId)
  if (!ownerId) return
  // Goals the owner set on the profile may have just been reached.
  await checkGoals(playerId).catch((err) => console.error('[goals] check failed:', err.message))
  const { rows } = await pool.query('SELECT id, username, display_name, created_at, records_state FROM players WHERE id = $1', [playerId])
  if (!rows[0]) return
  const player = { id: rows[0].id, createdAt: rows[0].created_at }
  const { records } = await getPlayerRecords(player, { fresh: true })
  const previous = rows[0].records_state
  const next = {}
  for (const r of records) if (!r.locked && Number.isFinite(Number(r.value))) next[r.key] = Number(r.value)

  if (previous && typeof previous === 'object') {
    for (const r of records) {
      if (r.locked || !(r.key in next)) continue
      if (r.key in previous && next[r.key] > Number(previous[r.key])) {
        await addNotification(ownerId, {
          type: 'record',
          text: `New personal record: ${recordHeadline(r)}`,
          link: `/player/${encodeURIComponent(rows[0].username)}?tab=records&record=${encodeURIComponent(r.key)}`,
          dedupeKey: `record:${playerId}:${r.key}:${next[r.key]}`,
          subject: rows[0].username,
        })
      }
    }
  }
  await pool.query('UPDATE players SET records_state = $2::jsonb WHERE id = $1', [playerId, JSON.stringify(next)])
}

/** Fire-and-forget wrapper: a records failure must never break saving a snapshot. */
export function checkRecordsSafe(playerId) {
  checkRecords(playerId).catch((err) => console.error(`[records] notify check failed for player ${playerId}:`, err.message))
}
