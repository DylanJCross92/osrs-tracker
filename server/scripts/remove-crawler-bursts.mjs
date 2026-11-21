// Finds and (optionally) removes the visitor records a crawler left behind before crawlers were ignored. The same thing is on the
// admin Visitors tab. Run from the server folder with the database the site uses:
//
//   node scripts/remove-crawler-bursts.mjs                      shows what it found, deletes nothing
//   node scripts/remove-crawler-bursts.mjs --since=2026-11-20   look from this date (UTC) on; the default is the last 3 days
//   node scripts/remove-crawler-bursts.mjs --min=150            how many such visitors in one minute make a burst (default 150)
//   node scripts/remove-crawler-bursts.mjs --prefix=/items/     the pages the burst looked at (default /items/)
//   node scripts/remove-crawler-bursts.mjs --delete             removes the events of the visitors found
import { pool } from '../src/db.js'
import { deleteCrawlerBursts, findCrawlerBursts } from '../src/services/crawlerCleanup.service.js'

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const options = { since: arg('since'), min: arg('min'), prefix: arg('prefix') }

try {
  const found = await findCrawlerBursts(options)
  console.log(`Since ${found.since}: ${found.visitors} visitors in ${found.minutes.length} burst minute(s) of at least ${found.min}.`)
  for (const m of found.minutes) console.log(`  ${m.minute}  ${m.visitors} visitors`)
  if (found.visitors) console.log(`Their events: ${found.events}.`)
  else if (found.matching) console.log(`${found.matching} visitors looked like it, but the busiest minute had ${found.peak.visitors}, under ${found.min}. Try a lower --min.`)
  if (found.visitors && process.argv.includes('--delete')) {
    const done = await deleteCrawlerBursts(options)
    console.log(`Deleted ${done.events} events.`)
  } else if (found.visitors) {
    console.log('Nothing was deleted. Run again with --delete to remove them.')
  }
} finally {
  await pool.end()
}
