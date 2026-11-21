import { pool } from '../db.js'

// Finds (and removes) the visitor records a crawler left behind before crawlers were ignored (see isCrawler in utils/events.js). A
// crawler that runs the site's scripts shows up as hundreds of "visitors" in the same minute, each with a couple of steps all in the
// same second, all on item pages. Used by the admin Visitors tab and by scripts/remove-crawler-bursts.mjs.

const DAY = /^\d{4}-\d{2}-\d{2}$/
const PREFIX = /^\/[a-z0-9\-_/]{0,60}$/

/** The settings with defaults and limits applied: { since (a UTC date), min (visitors in one minute), prefix (the pages looked at) }. */
export function cleanBurstOptions(raw = {}) {
  const since = typeof raw.since === 'string' && DAY.test(raw.since) ? raw.since : new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
  const min = Math.max(20, Math.min(100_000, Number(raw.min) || 150))
  const prefix = typeof raw.prefix === 'string' && PREFIX.test(raw.prefix) ? raw.prefix : '/items/'
  return { since, min, prefix }
}

// Visitors with no account, at most four steps, all within five seconds, and nothing but item views and page views of `prefix`.
const TINY = `
  SELECT visitor_id, min(at) AS first_at
  FROM events
  WHERE visitor_id IS NOT NULL AND at >= $1::date
  GROUP BY visitor_id
  HAVING count(*) <= 4
     AND max(at) - min(at) < interval '5 seconds'
     AND bool_and(account_id IS NULL)
     AND bool_and(name IN ('item_view', 'spa_page_view'))
     AND bool_and(name <> 'spa_page_view' OR props->>'page_path' LIKE $3)
     AND bool_or(name = 'item_view' OR props->>'page_path' LIKE $3)
`
const FOUND = `
  WITH tiny AS (${TINY}),
  bursts AS (SELECT date_trunc('minute', first_at) AS minute, count(*) AS visitors FROM tiny GROUP BY 1 HAVING count(*) >= $2)
  SELECT t.visitor_id, b.minute FROM tiny t JOIN bursts b ON date_trunc('minute', t.first_at) = b.minute
`

/** What is there to remove: { since, min, prefix, visitors, events, minutes: [{ minute (ISO), visitors }], ids }. Deletes nothing. */
export async function findCrawlerBursts(raw) {
  const opts = cleanBurstOptions(raw)
  const found = await pool.query(FOUND, [opts.since, opts.min, `${opts.prefix}%`])
  const byMinute = new Map()
  for (const r of found.rows) {
    const key = r.minute.toISOString()
    byMinute.set(key, (byMinute.get(key) || 0) + 1)
  }
  const ids = found.rows.map((r) => r.visitor_id)
  const events = ids.length ? (await pool.query('SELECT count(*)::int AS n FROM events WHERE visitor_id = ANY($1::text[])', [ids])).rows[0].n : 0
  return { ...opts, visitors: ids.length, events, minutes: [...byMinute].sort().map(([minute, visitors]) => ({ minute, visitors })), ids }
}

/** Removes the events of the visitors findCrawlerBursts finds. Returns { visitors, events } removed. */
export async function deleteCrawlerBursts(raw) {
  const found = await findCrawlerBursts(raw)
  if (!found.ids.length) return { visitors: 0, events: 0 }
  const del = await pool.query('DELETE FROM events WHERE visitor_id = ANY($1::text[])', [found.ids])
  await pool.query('DELETE FROM visitor_links WHERE visitor_id = ANY($1::text[])', [found.ids])
  return { visitors: found.ids.length, events: del.rowCount }
}
