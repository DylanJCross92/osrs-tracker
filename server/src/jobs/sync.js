import cron from 'node-cron'
import { pool } from '../db.js'
import { fetchHiscores } from '../services/osrsHiscores.service.js'
import { recordSnapshot } from '../services/players.service.js'

// Every 6 hours, on the hour: 00:00, 06:00, 12:00, 18:00. Override in .env
// (e.g. for a short interval while testing) via SYNC_CRON.
const SYNC_CRON = process.env.SYNC_CRON || '0 */6 * * *'

// A short pause between players, so a big tracked list doesn't hammer
// Jagex's hiscores endpoint with a burst of simultaneous requests.
const DELAY_BETWEEN_PLAYERS_MS = 1000

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function syncAllPlayers() {
  const { rows: players } = await pool.query('SELECT id, username FROM players ORDER BY id ASC')
  if (!players.length) return

  for (const player of players) {
    try {
      const stats = await fetchHiscores(player.username)
      await recordSnapshot(player.id, stats)
      console.log(`[sync] synced "${player.username}"`)
    } catch (err) {
      // One player's bad RSN or a transient hiscores error shouldn't stop
      // the rest of the batch from syncing.
      console.error(`[sync] failed to sync "${player.username}": ${err.message}`)
    }
    await delay(DELAY_BETWEEN_PLAYERS_MS)
  }
}

export function startScheduler() {
  cron.schedule(SYNC_CRON, () => {
    console.log('[sync] running scheduled hiscores sync...')
    syncAllPlayers().catch((err) => console.error('[sync] sync run failed:', err))
  })
  console.log(`[sync] hiscores sync scheduled ("${SYNC_CRON}")`)
}
