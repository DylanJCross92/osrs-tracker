import { pool } from '../db.js'
import { getPlayerRecords } from './records.service.js'
import { recordHeadline } from '../utils/records.js'
import { addOrRefreshNotification, dayStamp, ownerOfPlayer } from './inbox.service.js'
import { checkGoals } from './goals.service.js'
import { localDay, APP_TIMEZONE } from '../utils/dates.js'

/**
 * After a new snapshot: if the profile has an owner and one of its records went up, tell them. The first check only
 * stores the starting values, so nobody gets a flood of notices for records that already existed.
 */
export async function checkRecords(playerId) {
  const ownerId = await ownerOfPlayer(playerId)
  if (!ownerId) return
  // Goals the owner set on the profile may have just been reached.
  await checkGoals(playerId).catch((err) => console.error('[goals] check failed:', err.message))
  const { rows } = await pool.query('SELECT id, username, display_name, created_at, records_state, records_day FROM players WHERE id = $1', [playerId])
  if (!rows[0]) return
  const player = { id: rows[0].id, createdAt: rows[0].created_at }
  const { records } = await getPlayerRecords(player, { fresh: true })
  const previous = rows[0].records_state
  const next = {}
  for (const r of records) if (!r.locked && Number.isFinite(Number(r.value))) next[r.key] = Number(r.value)

  if (previous && typeof previous === 'object') {
    const improved = []
    for (const r of records) {
      if (r.locked || !(r.key in next)) continue
      if (r.key in previous && next[r.key] > Number(previous[r.key])) improved.push(r)
    }
    if (improved.length) await announceRecords(ownerId, rows[0], improved)
  }
  await pool.query('UPDATE players SET records_state = $2::jsonb WHERE id = $1', [playerId, JSON.stringify(next)])
}

/** Fire-and-forget wrapper: a records failure must never break saving a snapshot. */
export function checkRecordsSafe(playerId) {
  checkRecords(playerId).catch((err) => console.error(`[records] notify check failed for player ${playerId}:`, err.message))
}

const MAX_SHOWN = 3

/**
 * One notice per profile per day (the site's 6 AM to 6 AM day), however many records improve or how many times: it lists
 * the records that went up today and always shows their latest figures. Nothing is added on a day when no record moved.
 */
async function announceRecords(ownerId, player, improved) {
  const day = localDay(new Date())
  const stored = player.records_day && player.records_day.day === day ? player.records_day.headlines || {} : {}
  const headlines = { ...stored }
  for (const r of improved) headlines[r.key] = recordHeadline(r)
  await pool.query('UPDATE players SET records_day = $2::jsonb WHERE id = $1', [player.id, JSON.stringify({ day, headlines })])

  const list = Object.values(headlines)
  const shown = list.slice(0, MAX_SHOWN).join(', ')
  const more = list.length > MAX_SHOWN ? ` and ${list.length - MAX_SHOWN} more` : ''
  const keys = Object.keys(headlines)
  const base = `/player/${encodeURIComponent(player.username)}?tab=records`
  const dedupeKey = `record:${player.id}:${day}`
  await addOrRefreshNotification(ownerId, {
    type: 'record',
    text: `${list.length === 1 ? 'New personal record' : 'New personal records'}: ${shown}${more}`,
    link: keys.length === 1 ? `${base}&record=${encodeURIComponent(keys[0])}` : base,
    dedupeKey,
    subject: player.username,
  })
  // Notices from before this was one a day (one per record, or none sharing a key) are folded into today's.
  await pool
    .query(
      `DELETE FROM notifications
       WHERE user_id = $1 AND type = 'record' AND link LIKE $2 AND dedupe_key IS DISTINCT FROM $3
         AND created_at >= (date_trunc('day', (now() AT TIME ZONE $4) - interval '6 hours') + interval '6 hours') AT TIME ZONE $4`,
      [ownerId, `${base.replace(/[%_\\]/g, '\\$&')}%`, dedupeKey, APP_TIMEZONE],
    )
    .catch((err) => console.error('[records] could not fold earlier notices:', err.message))
}
