import cron from 'node-cron'
import { pool } from '../db.js'
import { fetchHiscores, HiscoresUnavailableError, PlayerNotFoundError } from '../services/osrsHiscores.service.js'
import { recordSnapshot } from '../services/players.service.js'
import { invalidateDiscoverCache, getDiscover } from '../services/discover.service.js'
import { invalidateHomeCache } from '../services/home.service.js'

// Hourly, on the hour. Override in .env (e.g. a shorter interval while
// testing) via SYNC_CRON.
const SYNC_CRON = process.env.SYNC_CRON || '0 * * * *'

// Pause between players so a big tracked list never bursts at Jagex's
// hiscores endpoint — a base delay plus a little random jitter so requests
// aren't perfectly periodic.
const BASE_DELAY_MS = 1000
const JITTER_MS = 400

// If the hiscores themselves are down or rate-limiting us (each failed fetch
// has already retried with backoff), keep hammering would only make it
// worse: after this many in a row, end the run and try again next hour.
const MAX_CONSECUTIVE_OUTAGES = 3

// Arbitrary constant key for the Postgres advisory lock that keeps two
// instances (or two overlapping runs) from syncing at the same time.
const SYNC_LOCK_KEY = 872_431_001

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let running = false

/**
 * One sweep over every tracked player. Never runs concurrently with itself:
 * if the previous sweep is still going (in this process, or in another
 * instance holding the advisory lock) this returns immediately.
 */
export async function syncAllPlayers() {
  if (running) {
    console.log('[sync] previous run still in progress — skipping')
    return { skipped: true }
  }
  running = true

  // Advisory locks belong to a session, so hold one dedicated connection for the whole run.
  const lockClient = await pool.connect()
  try {
    const { rows } = await lockClient.query('SELECT pg_try_advisory_lock($1) AS ok', [SYNC_LOCK_KEY])
    if (!rows[0].ok) {
      console.log('[sync] another instance is already syncing — skipping')
      return { skipped: true }
    }

    const startedAt = Date.now()
    const { rows: players } = await pool.query('SELECT id, username FROM players ORDER BY id ASC')
    const summary = { total: players.length, saved: 0, unchanged: 0, notFound: 0, failed: 0, aborted: false }
    let outages = 0

    for (const player of players) {
      try {
        const stats = await fetchHiscores(player.username)
        const result = await recordSnapshot(player.id, stats)
        result.saved ? summary.saved++ : summary.unchanged++
        outages = 0
      } catch (err) {
        if (err instanceof HiscoresUnavailableError) {
          summary.failed++
          outages++
          console.error(`[sync] "${player.username}": ${err.message}`)
          if (outages >= MAX_CONSECUTIVE_OUTAGES) {
            summary.aborted = true
            console.error(`[sync] hiscores unavailable ${outages}x in a row — ending this run early`)
            break
          }
        } else if (err instanceof PlayerNotFoundError) {
          // Renamed / banned / never-logged-in accounts aren't an outage.
          summary.notFound++
          outages = 0
          console.error(`[sync] "${player.username}": ${err.message}`)
        } else {
          // One player's bad data shouldn't stop the rest of the batch.
          summary.failed++
          console.error(`[sync] failed to sync "${player.username}": ${err.message}`)
        }
      }
      await delay(BASE_DELAY_MS + Math.random() * JITTER_MS)
    }

    console.log(
      `[sync] done in ${Math.round((Date.now() - startedAt) / 1000)}s — ${summary.total} players: ` +
        `${summary.saved} new snapshots, ${summary.unchanged} unchanged, ${summary.notFound} not found, ${summary.failed} failed` +
        (summary.aborted ? ' (run ended early: hiscores unavailable)' : ''),
    )

    // Fresh data landed — rebuild Discover's cached sections now, not on the next visitor's request.
    invalidateDiscoverCache()
    invalidateHomeCache()
    getDiscover().catch((err) => console.error('[discover] warm failed:', err.message))
    return summary
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock($1)', [SYNC_LOCK_KEY]).catch(() => {})
    lockClient.release()
    running = false
  }
}

export function startScheduler() {
  cron.schedule(SYNC_CRON, () => {
    console.log('[sync] running scheduled hiscores sync...')
    syncAllPlayers().catch((err) => console.error('[sync] sync run failed:', err))
  })
  console.log(`[sync] hiscores sync scheduled ("${SYNC_CRON}")`)
}
