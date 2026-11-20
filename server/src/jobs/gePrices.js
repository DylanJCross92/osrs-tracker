import cron from 'node-cron'
import { pool } from '../db.js'
import { backfillHistory, isEmpty, refreshHourly, refreshLatest, refreshMapping } from '../services/ge.service.js'

// Keeps the Grand Exchange data up to date (see services/ge.service.js): latest prices every 5 minutes, the last hour of trades every hour,
// the item list and some earlier history once a day. Set GE_DISABLED=1 to turn it off. One run at a time, even across instances.
const LOCK_KEY = 872_431_002
let running = false

async function withLock(label, fn) {
  // A run still going (the daily history fill can take several minutes) means this tick is skipped; say so rather than staying silent.
  if (running) return console.log(`[ge] ${label} skipped: the previous run is still going`)
  running = true
  const client = await pool.connect()
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY])
    if (!rows[0].ok) return console.log(`[ge] ${label} skipped: another instance holds the lock`)
    try {
      const summary = await fn()
      console.log(`[ge] ${label}: ${JSON.stringify(summary)}`)
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY])
    }
  } catch (err) {
    console.error(`[ge] ${label} failed: ${err.message}`)
  } finally {
    client.release()
    running = false
  }
}

const everything = async () => ({ mapping: await refreshMapping(), latest: await refreshLatest(), hourly: await refreshHourly(), history: await backfillHistory() })

export function startGePricesJob() {
  if (process.env.GE_DISABLED === '1') return console.log('[ge] price updates are turned off')
  cron.schedule('*/5 * * * *', () => withLock('latest prices', refreshLatest))
  cron.schedule('5 * * * *', () => withLock('hourly trades', refreshHourly))
  cron.schedule('10 4 * * *', () => withLock('daily refresh', everything))
  console.log('[ge] price updates scheduled (every 5 minutes)')
  // First run: fetch everything shortly after boot, and fill in earlier days for the busiest items when the data is new.
  setTimeout(() => {
    isEmpty()
      .then((empty) => (empty ? withLock('first fill', everything) : withLock('catch-up', async () => ({ latest: await refreshLatest(), hourly: await refreshHourly(), history: await backfillHistory() }))))
      .catch((err) => console.error('[ge] first run failed:', err.message))
  }, 5000)
}
