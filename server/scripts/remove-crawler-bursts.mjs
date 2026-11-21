// Finds and (optionally) removes the visitor records a crawler left behind before crawlers were ignored (see isCrawler in
// src/utils/events.js). A crawler that runs the site's scripts shows up as hundreds of "visitors" in the same minute, each with a
// couple of steps all in the same second, all on item pages. Run from the server folder with the database the site uses:
//
//   node scripts/remove-crawler-bursts.mjs                      shows what it found, deletes nothing
//   node scripts/remove-crawler-bursts.mjs --since=2026-11-20   look from this date (UTC) on; the default is the last 3 days
//   node scripts/remove-crawler-bursts.mjs --min=150            how many such visitors in one minute make a burst (default 150)
//   node scripts/remove-crawler-bursts.mjs --prefix=/items/     the pages the burst looked at (default /items/)
//   node scripts/remove-crawler-bursts.mjs --delete             removes the events of the visitors found
import { pool } from '../src/db.js'

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const remove = process.argv.includes('--delete')
const min = Math.max(20, Number(arg('min', 150)) || 150)
const prefix = arg('prefix', '/items/')
const since = arg('since', new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10))

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

try {
  const found = await pool.query(FOUND, [since, min, `${prefix}%`])
  const byMinute = new Map()
  for (const r of found.rows) byMinute.set(r.minute.toISOString(), (byMinute.get(r.minute.toISOString()) || 0) + 1)
  console.log(`Since ${since}: ${found.rowCount} visitors in ${byMinute.size} burst minute(s) of at least ${min}.`)
  for (const [minute, n] of [...byMinute].sort()) console.log(`  ${minute}  ${n} visitors`)
  if (!found.rowCount) process.exit(0)
  const ids = found.rows.map((r) => r.visitor_id)
  const count = await pool.query('SELECT count(*)::int AS n FROM events WHERE visitor_id = ANY($1::text[])', [ids])
  console.log(`Their events: ${count.rows[0].n}.`)
  if (!remove) {
    console.log('Nothing was deleted. Run again with --delete to remove them.')
  } else {
    const del = await pool.query('DELETE FROM events WHERE visitor_id = ANY($1::text[])', [ids])
    await pool.query('DELETE FROM visitor_links WHERE visitor_id = ANY($1::text[])', [ids])
    console.log(`Deleted ${del.rowCount} events.`)
  }
} finally {
  await pool.end()
}
