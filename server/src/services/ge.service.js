import { pool } from '../db.js'
import {
  HISTORY_RANGES, assignSlugs, dailyMid, dayFromTimeseriesPoint, flipMargin, midPrice, parseHourly, parseLatest, parseMapping, parseTimeseries,
  percentChange,
} from '../utils/ge.js'

// Grand Exchange prices from the OSRS Wiki real-time price API: https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices
// Only this server talks to the wiki (never a visitor's browser), a few requests an hour, and every request says who is asking.
const WIKI_URL = 'https://prices.runescape.wiki/api/v1/osrs'
const USER_AGENT = process.env.GE_USER_AGENT || 'TickGains (https://tickgains.com) - Grand Exchange prices for the Items page'
const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 20_000
export const GE_RETENTION_DAYS = 400
const NATURE_RUNE_ID = 561
export const MAX_PRICE_NAMES = 400
const STALE_AFTER_MS = 30 * 60_000

// Most items' picture is "<name>.png"; some (stackable ones such as runes and logs) use another file, so that one is sent along.
const iconIfDifferent = (icon, name) => (icon && icon !== `${name}.png` ? icon : null)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const n = (v) => (v == null ? null : Number(v))

export class GeUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GeUnavailableError'
    this.status = 503
  }
}

// Fetches with a timeout and retries 429, 5xx and network errors with backoff (the same approach as the hiscores client).
async function wikiGet(path) {
  let reason = 'unknown error'
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${WIKI_URL}${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      if (res.ok) return await res.json()
      reason = `status ${res.status}`
      if (res.status !== 429 && res.status < 500) break
    } catch (err) {
      reason = err?.name === 'TimeoutError' ? 'request timed out' : `network error (${err?.message || err})`
    }
    if (attempt < MAX_ATTEMPTS) await sleep(1000 * 3 ** (attempt - 1) + Math.random() * 500)
  }
  throw new GeUnavailableError(`Grand Exchange prices are unavailable right now (${reason}).`)
}

// --- caches ------------------------------------------------------------------------------------------------------------------
// Rebuilt at most every few minutes and dropped when new prices arrive. A single in-flight build is shared and the old copy is served meanwhile.
const caches = { index: { value: null, at: 0, promise: null } }

async function cached(cache, ttl, build) {
  if (cache.value && Date.now() - cache.at < ttl) return cache.value
  if (cache.promise) return cache.value || cache.promise
  cache.promise = build()
    .then((v) => {
      cache.value = v
      cache.at = Date.now()
      return v
    })
    .finally(() => {
      cache.promise = null
    })
  return cache.value || cache.promise
}

export function invalidateGeCache() {
  for (const c of Object.values(caches)) c.at = 0
}

// --- keeping the data up to date -----------------------------------------------------------------------------------------------

/** Refreshes the list of items (names, limits, alchemy values). Slugs are given once and never change. */
export async function refreshMapping() {
  const items = parseMapping(await wikiGet('/mapping'))
  if (items.length < 1000) throw new GeUnavailableError(`The item list looks wrong (${items.length} items), so it was not used.`)
  const { rows: existing } = await pool.query('SELECT item_id, slug FROM ge_items')
  const slugOf = new Map(existing.map((r) => [r.item_id, r.slug]))
  const fresh = assignSlugs(items.filter((i) => !slugOf.has(i.id)), new Set(slugOf.values()))
  for (const i of fresh) slugOf.set(i.id, i.slug)
  await pool.query(
    `INSERT INTO ge_items (item_id, name, slug, examine, members, buy_limit, value, high_alch, low_alch, icon, updated_at)
     SELECT t.id, t.name, t.slug, t.examine, t.members, t.lim, t.value, t.hi, t.lo, t.icon, now()
     FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::bool[], $6::int[], $7::bigint[], $8::bigint[], $9::bigint[], $10::text[])
       AS t(id, name, slug, examine, members, lim, value, hi, lo, icon)
     ON CONFLICT (item_id) DO UPDATE SET name = EXCLUDED.name, examine = EXCLUDED.examine, members = EXCLUDED.members, buy_limit = EXCLUDED.buy_limit,
       value = EXCLUDED.value, high_alch = EXCLUDED.high_alch, low_alch = EXCLUDED.low_alch, icon = EXCLUDED.icon, updated_at = now()`,
    [
      items.map((i) => i.id), items.map((i) => i.name), items.map((i) => slugOf.get(i.id)), items.map((i) => i.examine), items.map((i) => i.members),
      items.map((i) => i.limit), items.map((i) => i.value), items.map((i) => i.highAlch), items.map((i) => i.lowAlch), items.map((i) => i.icon),
    ],
  )
  invalidateGeCache()
  return { items: items.length, added: fresh.length }
}

/** Stores the newest price of every item (only the ones that changed). */
export async function refreshLatest() {
  const rows = parseLatest(await wikiGet('/latest'))
  if (!rows.length) throw new GeUnavailableError('The latest prices came back empty, so they were not used.')
  const { rowCount } = await pool.query(
    `INSERT INTO ge_prices (item_id, high, high_at, low, low_at, updated_at)
     SELECT t.id, t.high, t.high_at, t.low, t.low_at, now()
     FROM unnest($1::int[], $2::bigint[], $3::timestamptz[], $4::bigint[], $5::timestamptz[]) AS t(id, high, high_at, low, low_at)
     WHERE EXISTS (SELECT 1 FROM ge_items i WHERE i.item_id = t.id)
     ON CONFLICT (item_id) DO UPDATE SET high = EXCLUDED.high, high_at = EXCLUDED.high_at, low = EXCLUDED.low, low_at = EXCLUDED.low_at, updated_at = now()
     WHERE (ge_prices.high, ge_prices.high_at, ge_prices.low, ge_prices.low_at) IS DISTINCT FROM (EXCLUDED.high, EXCLUDED.high_at, EXCLUDED.low, EXCLUDED.low_at)`,
    [rows.map((r) => r.id), rows.map((r) => r.high), rows.map((r) => r.highAt), rows.map((r) => r.low), rows.map((r) => r.lowAt)],
  )
  // A refresh with nothing new still shows the data is current.
  await pool.query('INSERT INTO ge_status (id, latest_at) VALUES (1, now()) ON CONFLICT (id) DO UPDATE SET latest_at = now()')
  invalidateGeCache()
  return { prices: rows.length, changed: rowCount }
}

/** Adds the last hour of trades to today's totals (an hour already added is ignored). */
export async function refreshHourly() {
  const { bucket, rows } = parseHourly(await wikiGet('/1h'))
  if (!bucket || !rows.length) return { rows: 0 }
  const { rowCount } = await pool.query(
    `INSERT INTO ge_daily (item_id, day, high_sum, high_vol, low_sum, low_vol, last_bucket)
     SELECT t.id, ($2::timestamptz AT TIME ZONE 'utc')::date, t.hs, t.hv, t.ls, t.lv, $2::timestamptz
     FROM unnest($1::int[], $3::bigint[], $4::bigint[], $5::bigint[], $6::bigint[]) AS t(id, hs, hv, ls, lv)
     WHERE EXISTS (SELECT 1 FROM ge_items i WHERE i.item_id = t.id)
     ON CONFLICT (item_id, day) DO UPDATE SET high_sum = ge_daily.high_sum + EXCLUDED.high_sum, high_vol = ge_daily.high_vol + EXCLUDED.high_vol,
       low_sum = ge_daily.low_sum + EXCLUDED.low_sum, low_vol = ge_daily.low_vol + EXCLUDED.low_vol, last_bucket = EXCLUDED.last_bucket
     WHERE ge_daily.last_bucket < EXCLUDED.last_bucket`,
    [rows.map((r) => r.id), bucket, rows.map((r) => r.highSum), rows.map((r) => r.highVol), rows.map((r) => r.lowSum), rows.map((r) => r.lowVol)],
  )
  invalidateGeCache()
  return { rows: rows.length, added: rowCount }
}

/**
 * Fills in earlier days for the busiest items from the wiki's daily history, one polite request at a time, so changes over a week or a
 * month are known from the start. Each item is tried once a month at most; days already stored are left alone.
 */
export async function backfillHistory({ limit = 400, delayMs = 800 } = {}) {
  const { rows: due } = await pool.query(
    `SELECT i.item_id
     FROM ge_items i JOIN ge_daily d ON d.item_id = i.item_id AND d.day = (now() AT TIME ZONE 'utc')::date
     WHERE (i.history_at IS NULL OR i.history_at < now() - interval '30 days')
       AND (SELECT count(*) FROM ge_daily o WHERE o.item_id = i.item_id AND o.day < (now() AT TIME ZONE 'utc')::date) < 5
     ORDER BY (d.high_sum + d.low_sum) DESC
     LIMIT $1`,
    [limit],
  )
  let filled = 0
  for (const { item_id } of due) {
    try {
      const json = await wikiGet(`/timeseries?timestep=24h&id=${item_id}`)
      const today = Math.floor(Date.now() / 86_400_000) * 86_400
      const days = (Array.isArray(json?.data) ? json.data : []).filter((p) => Number.isFinite(Number(p.timestamp)) && Number(p.timestamp) < today).map((p) => ({ t: Number(p.timestamp), ...dayFromTimeseriesPoint(p) })).filter((d) => d.highVol || d.lowVol)
      if (days.length) {
        await pool.query(
          `INSERT INTO ge_daily (item_id, day, high_sum, high_vol, low_sum, low_vol, last_bucket)
           SELECT $1, (to_timestamp(t.ts) AT TIME ZONE 'utc')::date, t.hs, t.hv, t.ls, t.lv, to_timestamp(t.ts + 86400)
           FROM unnest($2::bigint[], $3::bigint[], $4::bigint[], $5::bigint[], $6::bigint[]) AS t(ts, hs, hv, ls, lv)
           ON CONFLICT (item_id, day) DO NOTHING`,
          [item_id, days.map((d) => d.t), days.map((d) => d.highSum), days.map((d) => d.highVol), days.map((d) => d.lowSum), days.map((d) => d.lowVol)],
        )
        filled++
      }
    } catch (err) {
      if (err instanceof GeUnavailableError) console.error(`[ge] history for item ${item_id} failed: ${err.message}`)
    }
    await pool.query('UPDATE ge_items SET history_at = now() WHERE item_id = $1', [item_id])
    await sleep(delayMs)
  }
  if (filled) invalidateGeCache()
  return { tried: due.length, filled }
}

/** Deletes day totals older than the retention period. Returns how many rows went. */
export async function purgeOldPrices() {
  const { rowCount } = await pool.query(`DELETE FROM ge_daily WHERE day <= (now() AT TIME ZONE 'utc')::date - $1::int`, [GE_RETENTION_DAYS])
  return rowCount
}

/** True when there are no items yet, so the first run has to fetch everything. */
export async function isEmpty() {
  const { rows } = await pool.query('SELECT EXISTS (SELECT 1 FROM ge_items) AS has')
  return !rows[0].has
}

async function latestAt() {
  const { rows } = await pool.query('SELECT latest_at FROM ge_status WHERE id = 1')
  return rows[0]?.latest_at ? new Date(rows[0].latest_at).getTime() : 0
}
const isStale = (at) => !at || Date.now() - at > STALE_AFTER_MS

// --- reading -----------------------------------------------------------------------------------------------------------------------

const MID = (a) => `(CASE WHEN ${a}.high_vol > 0 AND ${a}.low_vol > 0 THEN (${a}.high_sum::float8 / ${a}.high_vol + ${a}.low_sum::float8 / ${a}.low_vol) / 2
  WHEN ${a}.high_vol > 0 THEN ${a}.high_sum::float8 / ${a}.high_vol WHEN ${a}.low_vol > 0 THEN ${a}.low_sum::float8 / ${a}.low_vol END)`
const TODAY = `(now() AT TIME ZONE 'utc')::date`

async function buildIndex() {
  const { rows } = await pool.query(
    `SELECT i.item_id AS id, i.name, i.slug, i.members, i.buy_limit, i.icon, p.high, p.low,
            COALESCE(y.high_vol + y.low_vol, t.high_vol + t.low_vol) AS vol,
            ${MID('y')} AS mid1, ${MID('d7')} AS mid7, ${MID('d30')} AS mid30
     FROM ge_items i
     LEFT JOIN ge_prices p ON p.item_id = i.item_id
     LEFT JOIN ge_daily t ON t.item_id = i.item_id AND t.day = ${TODAY}
     LEFT JOIN ge_daily y ON y.item_id = i.item_id AND y.day = ${TODAY} - 1
     LEFT JOIN ge_daily d7 ON d7.item_id = i.item_id AND d7.day = ${TODAY} - 7
     LEFT JOIN ge_daily d30 ON d30.item_id = i.item_id AND d30.day = ${TODAY} - 30
     ORDER BY i.name`,
  )
  const updatedAt = await latestAt()
  const items = rows.map((r) => {
    const high = n(r.high)
    const low = n(r.low)
    const price = midPrice(high, low)
    return {
      id: r.id, name: r.name, slug: r.slug, members: r.members, limit: r.buy_limit, icon: iconIfDifferent(r.icon, r.name), high, low, price, volume: n(r.vol) || 0,
      change1: percentChange(price, r.mid1), change7: percentChange(price, r.mid7), change30: percentChange(price, r.mid30),
      // What buying at the sell price and selling at the buy price makes, after tax.
      margin: flipMargin(high, low, r.name)?.margin ?? null,
    }
  })
  return { updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null, stale: isStale(updatedAt), items }
}

/** Every item with its price, volume and changes, for the Items page (searched in the browser). */
export const getItemIndex = () => cached(caches.index, 5 * 60_000, buildIndex)

/**
 * The prices of the items with these names, for the planners and calculators: { updatedAt, stale, prices: { "lower case name": [high, low, slug, icon file or null] } }.
 * Names with no price are left out. Where two items share a name the one with the lowest id is used.
 */
export async function getPricesByName(names) {
  const wanted = [...new Set(names.map((n) => String(n).trim().toLowerCase()).filter(Boolean))].slice(0, MAX_PRICE_NAMES)
  const [{ rows }, updatedAt] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (lower(i.name)) lower(i.name) AS name, i.name AS real_name, p.high, p.low, i.slug, i.icon
       FROM ge_items i JOIN ge_prices p ON p.item_id = i.item_id
       WHERE lower(i.name) = ANY($1::text[]) AND (p.high IS NOT NULL OR p.low IS NOT NULL)
       ORDER BY lower(i.name), i.item_id`,
      [wanted],
    ),
    latestAt(),
  ])
  const prices = {}
  for (const r of rows) prices[r.name] = [n(r.high), n(r.low), r.slug, iconIfDifferent(r.icon, r.real_name)]
  return { updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null, stale: isStale(updatedAt), prices }
}

/** One item by its address: details, latest price, changes, flip margin and alchemy profit. null when there is none. */
export async function getItemBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT i.*, p.high, p.low, p.high_at, p.low_at
     FROM ge_items i LEFT JOIN ge_prices p ON p.item_id = i.item_id WHERE i.slug = $1`,
    [slug],
  )
  const r = rows[0]
  if (!r) return null
  const [{ rows: days }, { rows: nature }, checkedAt] = await Promise.all([
    pool.query(`SELECT (${TODAY} - day)::int AS ago, high_sum, high_vol, low_sum, low_vol FROM ge_daily WHERE item_id = $1 AND day >= ${TODAY} - 30 ORDER BY day`, [r.item_id]),
    pool.query('SELECT high FROM ge_prices WHERE item_id = $1', [NATURE_RUNE_ID]),
    latestAt(),
  ])
  const high = n(r.high)
  const low = n(r.low)
  const price = midPrice(high, low)
  const ago = (d) => dailyMid(days.find((x) => x.ago === d))
  const yesterday = days.find((x) => x.ago === 1)
  const volume = yesterday ? Number(yesterday.high_vol) + Number(yesterday.low_vol) : null
  const natureRune = n(nature[0]?.high)
  const highAlch = n(r.high_alch)
  return {
    id: r.item_id, name: r.name, slug: r.slug, examine: r.examine, members: r.members, limit: r.buy_limit, icon: r.icon,
    value: n(r.value), highAlch, lowAlch: n(r.low_alch),
    high, low, price, highAt: r.high_at, lowAt: r.low_at, updatedAt: checkedAt ? new Date(checkedAt).toISOString() : null,
    volume,
    change1: percentChange(price, ago(1)), change7: percentChange(price, ago(7)), change30: percentChange(price, ago(30)),
    flip: flipMargin(high, low, r.name),
    // Casting High Level Alchemy costs a nature rune; the profit is what the coins are worth minus the item and the rune.
    alchProfit: highAlch != null && high != null && natureRune != null ? highAlch - high - natureRune : null,
    stale: isStale(checkedAt),
  }
}

// History for the chart comes from the wiki on demand, kept for a while so a busy item is asked about only now and then.
const historyCache = new Map()
const HISTORY_CACHE_MAX = 1500

/** { range, points: [{ t, high, low, vol }] } for an item over one of the ranges in HISTORY_RANGES, or null for an unknown range. */
export async function getHistory(itemId, range) {
  const spec = HISTORY_RANGES[range]
  if (!spec) return null
  const key = `${itemId}:${range}`
  const hit = historyCache.get(key)
  if (hit && Date.now() - hit.at < spec.ttlMs) return hit.body
  const body = { range, points: parseTimeseries(await wikiGet(`/timeseries?timestep=${spec.step}&id=${Number(itemId)}`), spec.keep) }
  if (historyCache.size >= HISTORY_CACHE_MAX) historyCache.delete(historyCache.keys().next().value)
  historyCache.set(key, { at: Date.now(), body })
  return body
}

/** { slugs: [...], updatedAt } of every item that has a price, for the sitemap. */
export async function listItemsForSitemap() {
  const [{ rows }, at] = await Promise.all([pool.query('SELECT i.slug FROM ge_items i JOIN ge_prices p ON p.item_id = i.item_id ORDER BY i.item_id'), latestAt()])
  return { slugs: rows.map((r) => r.slug), updatedAt: at ? new Date(at).toISOString() : null }
}

/** The id of the item with this address, or null. */
export async function getItemIdBySlug(slug) {
  const { rows } = await pool.query('SELECT item_id FROM ge_items WHERE slug = $1', [slug])
  return rows[0]?.item_id ?? null
}
