import cron from 'node-cron'
import { pool } from '../db.js'
import { backfillHistory, isEmpty, refreshHourly, refreshLatest, refreshMapping } from '../services/ge.service.js'

// Keeps the Grand Exchange data up to date (see services/ge.service.js): latest prices every 5 minutes, the last hour of trades every hour,
// the item list once a day, and some earlier history for the busiest items. Set GE_DISABLED=1 to turn it off.
// Every kind of run has its own lock, so one at a time of each kind, even across instances, and the history fill (which takes
// a while, as it asks the wiki politely for one item after another) never holds up the price refresh.
// The keys are their own: 872_431_001 is the hiscores sync (jobs/sync.js) and 872_431_002 the competitions job (services/competitions.service.js,
// which runs every minute). Sharing one of those made a price refresh lose the lock at every 5-minute tick.
const LOCKS = { latest: 872_431_102, hourly: 872_431_103, daily: 872_431_104, history: 872_431_105 }
const running = new Set()

function withLock(kind, label, fn) {
  return (async () => {
    // A run of this kind still going means this tick is skipped; say so rather than staying silent.
    if (running.has(kind)) return console.log(`[ge] ${label} skipped: the previous run is still going`)
    running.add(kind)
    let client = null
    try {
      client = await pool.connect()
      const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCKS[kind]])
      if (!rows[0].ok) return console.log(`[ge] ${label} skipped: another instance holds the lock`)
      try {
        console.log(`[ge] ${label}: ${JSON.stringify(await fn())}`)
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [LOCKS[kind]])
      }
    } catch (err) {
      console.error(`[ge] ${label} failed: ${err.message}`)
    } finally {
      client?.release()
      running.delete(kind)
    }
  })()
}

const latest = () => withLock('latest', 'latest prices', refreshLatest)
const hourly = () => withLock('hourly', 'hourly trades', refreshHourly)
const mapping = () => withLock('daily', 'item list', refreshMapping)
const history = () => withLock('history', 'history fill', backfillHistory)

export function startGePricesJob() {
  if (process.env.GE_DISABLED === '1') return console.log('[ge] price updates are turned off')
  cron.schedule('*/5 * * * *', latest)
  cron.schedule('5 * * * *', hourly)
  cron.schedule('10 4 * * *', mapping)
  // The history fill is tried every hour: it skips items it has already tried, so most runs have nothing to do.
  cron.schedule('20 * * * *', history)
  console.log('[ge] price updates scheduled (every 5 minutes)')
  // After a start: the item list when there is none, then the newest prices and trades, and the history fill on its own so it never delays them.
  setTimeout(async () => {
    try {
      if (await isEmpty()) await mapping()
      await latest()
      await hourly()
    } catch (err) {
      console.error('[ge] first run failed:', err.message)
    }
    history()
  }, 5000)
}
