import cron from 'node-cron'
import { pool } from '../db.js'
import { fetchHiscores, HiscoresUnavailableError, PlayerNotFoundError } from '../services/osrsHiscores.service.js'
import { recordSnapshot, ensureHardcoreRow } from '../services/players.service.js'
import { recordHardcoreMiss } from '../services/hardcore.service.js'
import { invalidateDiscoverCache, getDiscover } from '../services/discover.service.js'
import { invalidateHomeCache } from '../services/home.service.js'

// Hourly, on the hour. Override in .env (e.g. a shorter interval while
// testing) via SYNC_CRON.
const SYNC_CRON = process.env.SYNC_CRON || '0 * * * *'

// A few players are fetched at once (each worker waits between its own requests, a base delay plus a little random jitter so
// requests are not perfectly periodic). The total request rate is about CONCURRENCY / (the delay + the fetch time): 3 workers is
// roughly 2.5 requests a second, a third of the time a one-at-a-time sweep takes. Set SYNC_CONCURRENCY=1 to go back to one at a time.
const CONCURRENCY = Math.max(1, Number(process.env.SYNC_CONCURRENCY) || 3)
const BASE_DELAY_MS = 1000
const JITTER_MS = 400

// If the hiscores themselves are down or rate-limiting us (each failed fetch
// has already retried with backoff), keep hammering would only make it
// worse: after this many in a row, end the run and try again next hour.
const MAX_CONSECUTIVE_OUTAGES = 3

// --- Sync tiers --------------------------------------------------------
// How often a player is checked follows how recently they gained XP:
//   hot   gained within HOT_HOURS: every hourly run
//   warm  gained within ACTIVE_WINDOW_DAYS: every few hours (WARM_MIN_GAP_MINUTES)
//   idle  anyone else: about once a day
// A profile view or "Refresh now" also resets a player's last-checked time, so anyone recently looked at isn't re-fetched
// redundantly. All the thresholds are env-tunable.
const HOT_HOURS = Number(process.env.SYNC_HOT_HOURS) || 6
const ACTIVE_WINDOW_DAYS = Number(process.env.SYNC_ACTIVE_DAYS) || 3
const HOT_MIN_GAP_MINUTES = Number(process.env.SYNC_ACTIVE_MIN_GAP_MINUTES) || 45
// 2h45 rather than 3h: with hourly runs, a check at 10:00:30 is due at the 13:00 run instead of slipping to 14:00.
const WARM_MIN_GAP_MINUTES = Number(process.env.SYNC_WARM_MIN_GAP_MINUTES) || 165
// 23.5h rather than 24h, for the same reason.
const IDLE_RECHECK_MINUTES = Number(process.env.SYNC_IDLE_RECHECK_MINUTES) || 23.5 * 60

// Arbitrary constant key for the Postgres advisory lock that keeps two
// instances (or two overlapping runs) from syncing at the same time.
const SYNC_LOCK_KEY = 872_431_001

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let running = false

/**
 * Which players this run should check, and which tier each is in. Never-checked players always qualify; hot players unless they
 * were fetched very recently; warm players every few hours; idle players (no XP gain seen for ACTIVE_WINDOW_DAYS, falling back to
 * when they were added) only once their daily re-check is due.
 */
export async function selectDuePlayers() {
  const { rows } = await pool.query(
    `WITH p AS (
       SELECT id, username, mode, last_checked_at,
              EXISTS (SELECT 1 FROM profile_claims pc WHERE pc.player_id = players.id AND pc.status = 'verified') AS claimed,
              COALESCE(last_xp_gain_at, created_at) AS seen,
              -- Anyone in a running competition is checked as often as a hot player, however quiet they have been.
              (id IN (SELECT cm.player_id FROM competition_members cm JOIN competitions c ON c.id = cm.competition_id WHERE c.status = 'running')) AS racing
       FROM players
     ), t AS (
       SELECT *, CASE
                   WHEN racing OR seen >= now() - ($1::numeric * interval '1 hour') THEN 'hot'
                   WHEN seen >= now() - ($2::int * interval '1 day') THEN 'warm'
                   ELSE 'idle'
                 END AS tier
       FROM p
     )
     SELECT id, username, mode, claimed, tier, (tier <> 'idle') AS active
     FROM t
     WHERE last_checked_at IS NULL
        OR (tier = 'hot'  AND last_checked_at <= now() - ($3::numeric * interval '1 minute'))
        OR (tier = 'warm' AND last_checked_at <= now() - ($4::numeric * interval '1 minute'))
        OR (tier = 'idle' AND last_checked_at <= now() - ($5::numeric * interval '1 minute'))
     ORDER BY id ASC`,
    [HOT_HOURS, ACTIVE_WINDOW_DAYS, HOT_MIN_GAP_MINUTES, WARM_MIN_GAP_MINUTES, IDLE_RECHECK_MINUTES],
  )
  const { rows: total } = await pool.query('SELECT COUNT(*)::int AS n FROM players')
  return { due: rows, total: total[0].n }
}

/**
 * One sweep over every tracked player. Never runs concurrently with itself:
 * if the previous sweep is still going (in this process, or in another
 * instance holding the advisory lock) this returns immediately.
 */
export async function syncAllPlayers() {
  if (running) {
    console.log('[sync] previous run still in progress, skipping')
    return { skipped: true }
  }
  running = true

  // Advisory locks belong to a session, so hold one dedicated connection for the whole run.
  const lockClient = await pool.connect()
  try {
    const { rows } = await lockClient.query('SELECT pg_try_advisory_lock($1) AS ok', [SYNC_LOCK_KEY])
    if (!rows[0].ok) {
      console.log('[sync] another instance is already syncing, skipping')
      return { skipped: true }
    }

    const startedAt = Date.now()
    const { due: players, total } = await selectDuePlayers()
    const count = (tier) => players.filter((p) => p.tier === tier).length
    const summary = { total, checked: players.length, skippedUntilDue: total - players.length, saved: 0, unchanged: 0, notFound: 0, failed: 0, aborted: false }
    console.log(`[sync] ${players.length} of ${total} players due (${count('hot')} hot, ${count('warm')} warm, ${count('idle')} idle daily re-checks); ${summary.skippedUntilDue} not due yet; ${CONCURRENCY} at a time`)
    let outages = 0

    async function checkPlayer(player) {
      try {
        const stats = await fetchHiscores(player.username, player.mode)
        const result = await recordSnapshot(player.id, stats)
        result.saved ? summary.saved++ : summary.unchanged++
        outages = 0
        // Owners of a claimed profile get their Hardcore Worlds character found without anyone having to open the page (at most one look a day).
        if (player.mode === 'main' && player.claimed) await ensureHardcoreRow(player.id).catch((err) => console.error(`[sync] hardcore lookup for "${player.username}": ${err.message}`))
      } catch (err) {
        if (err instanceof HiscoresUnavailableError) {
          summary.failed++
          outages++
          console.error(`[sync] "${player.username}": ${err.message}`)
          if (outages >= MAX_CONSECUTIVE_OUTAGES && !summary.aborted) {
            summary.aborted = true
            console.error(`[sync] hiscores unavailable ${outages}x in a row, ending this run early`)
          }
        } else if (err instanceof PlayerNotFoundError) {
          // Renamed / banned / never-logged-in accounts aren't an outage. A Hardcore Worlds character that is no longer on its table
          // has probably left (a Transfer): two misses a day apart mark it, see services/hardcore.service.js.
          summary.notFound++
          outages = 0
          if (player.mode === 'hardcore') await recordHardcoreMiss(player.id).catch((e) => console.error(`[sync] hardcore miss for "${player.username}": ${e.message}`))
          console.error(`[sync] "${player.username}": ${err.message}`)
        } else {
          // One player's bad data shouldn't stop the rest of the batch.
          summary.failed++
          console.error(`[sync] failed to sync "${player.username}": ${err.message}`)
        }
      }
    }

    // Workers take the next player from the shared list; each pauses between its own requests. A run of outages stops all of them.
    let next = 0
    const worker = async () => {
      while (!summary.aborted && next < players.length) {
        await checkPlayer(players[next++])
        await delay(BASE_DELAY_MS + Math.random() * JITTER_MS)
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, players.length) }, worker))

    console.log(
      `[sync] done in ${Math.round((Date.now() - startedAt) / 1000)}s, checked ${summary.checked}/${summary.total}: ` +
        `${summary.saved} new snapshots, ${summary.unchanged} unchanged, ${summary.notFound} not found, ${summary.failed} failed` +
        (summary.aborted ? ' (run ended early: hiscores unavailable)' : ''),
    )

    // Fresh data landed, rebuild Discover's cached sections now, not on the next visitor's request.
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
