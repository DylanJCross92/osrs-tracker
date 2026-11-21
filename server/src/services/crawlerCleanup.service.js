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
     AND bool_and(name <> 'spa_page_view' OR props->>'page_path' LIKE $2)
     AND bool_or(name = 'item_view' OR props->>'page_path' LIKE $2)
`
/**
 * What is there to remove: { since, min, prefix, visitors, events, minutes: [{ minute (ISO), visitors }], matching, peak, ids }. Deletes
 * nothing. `matching` is every visitor that looks like one (a couple of steps in the same second, only on `prefix` pages) and `peak` the
 * busiest minute of them, so a report with nothing to remove still shows how close it came; only the visitors in minutes with at least
 * `min` of them are removed.
 */
export async function findCrawlerBursts(raw) {
  const opts = cleanBurstOptions(raw)
  const found = await pool.query(`${TINY} ORDER BY first_at`, [opts.since, `${opts.prefix}%`])
  const byMinute = new Map()
  for (const r of found.rows) {
    const key = new Date(Math.floor(new Date(r.first_at).getTime() / 60_000) * 60_000).toISOString()
    ;(byMinute.get(key) || byMinute.set(key, []).get(key)).push(r.visitor_id)
  }
  const bursts = [...byMinute].filter(([, ids]) => ids.length >= opts.min).sort()
  const ids = bursts.flatMap(([, list]) => list)
  const peak = [...byMinute].reduce((best, [minute, list]) => (!best || list.length > best.visitors ? { minute, visitors: list.length } : best), null)
  const events = ids.length ? (await pool.query('SELECT count(*)::int AS n FROM events WHERE visitor_id = ANY($1::text[])', [ids])).rows[0].n : 0
  return {
    ...opts,
    visitors: ids.length,
    events,
    minutes: bursts.map(([minute, list]) => ({ minute, visitors: list.length })),
    matching: found.rowCount,
    peak,
    ids,
  }
}

/** Removes the events of the visitors findCrawlerBursts finds. Returns { visitors, events } removed. */
export async function deleteCrawlerBursts(raw) {
  const found = await findCrawlerBursts(raw)
  if (!found.ids.length) return { visitors: 0, events: 0 }
  const del = await pool.query('DELETE FROM events WHERE visitor_id = ANY($1::text[])', [found.ids])
  await pool.query('DELETE FROM visitor_links WHERE visitor_id = ANY($1::text[])', [found.ids])
  return { visitors: found.ids.length, events: del.rowCount }
}
