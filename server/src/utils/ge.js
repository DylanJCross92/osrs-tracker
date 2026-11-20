// Grand Exchange helpers: reading the OSRS Wiki price API, working out tax and margins, and shaping history for charts.
// Pure (no database, no network), so it is easy to test. The wiki's API is documented at https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices

// --- tax -------------------------------------------------------------------------------------------------------------------
// Most sales pay 2%, rounded down to a whole coin (so a sale under 50 coins pays nothing), capped at 5M coins per item. A short list
// of items is exempt. Source: https://oldschool.runescape.wiki/w/Grand_Exchange (checked 20 Nov 2026). The wiki marks that page as
// due to change with a later Grand Exchange update, so keep these in one place and check them again when it ships.
export const GE_TAX_RATE = 0.02
export const GE_TAX_CAP = 5_000_000
export const TAX_EXEMPT_NAMES = new Set(
  [
    'Old school bond', 'Energy potion', 'Bronze arrow', 'Bronze dart', 'Iron arrow', 'Iron dart', 'Mind rune', 'Steel arrow', 'Steel dart',
    'Bass', 'Bread', 'Cake', 'Cooked chicken', 'Cooked meat', 'Herring', 'Lobster', 'Mackerel', 'Meat pie', 'Pike', 'Salmon', 'Shrimps', 'Tuna',
    'Ardougne teleport', 'Camelot teleport', 'Civitas illa fortis teleport', 'Falador teleport', 'Games necklace(8)', 'Kourend castle teleport',
    'Lumbridge teleport', 'Ring of dueling(8)', 'Teleport to house', 'Varrock teleport', 'Chisel', 'Gardening trowel', 'Glassblowing pipe',
    'Hammer', 'Needle', 'Pestle and mortar', 'Rake', 'Saw', 'Secateurs', 'Seed dibber', 'Shears', 'Spade', 'Watering can',
  ].map((n) => n.toLowerCase()),
)

/** The tax on selling one item at `price`, in coins. */
export function geTax(price, name = '') {
  const p = Math.floor(Number(price))
  if (!(p > 0) || TAX_EXEMPT_NAMES.has(String(name).toLowerCase())) return 0
  return Math.min(Math.floor(p * GE_TAX_RATE), GE_TAX_CAP)
}

/** What a seller keeps from one item sold at `price`. */
export const afterTax = (price, name = '') => (Number(price) > 0 ? Math.floor(Number(price)) - geTax(price, name) : 0)

// --- prices ---------------------------------------------------------------------------------------------------------------------
// In the wiki's data `high` is the latest price paid by someone buying instantly (what you pay to buy at once) and `low` the latest
// price received by someone selling instantly (what you get selling at once).

/** The middle of the two prices, or whichever one exists. null when there is neither. */
export function midPrice(high, low) {
  const h = Number(high) > 0 ? Number(high) : null
  const l = Number(low) > 0 ? Number(low) : null
  if (h != null && l != null) return Math.round((h + l) / 2)
  return h ?? l
}

/**
 * What a flip makes: buy at `low`, sell at `high`, after tax. { margin, roi } where roi is a percentage of the buy price; null when
 * either price is missing.
 */
export function flipMargin(high, low, name = '') {
  if (!(Number(high) > 0) || !(Number(low) > 0)) return null
  const margin = afterTax(high, name) - Number(low)
  return { margin, roi: Math.round((margin / Number(low)) * 1000) / 10 }
}

/** Percentage change from `before` to `now`, one decimal place; null when either is missing or `before` is zero. */
export function percentChange(now, before) {
  const a = Number(now)
  const b = Number(before)
  if (!(a > 0) || !(b > 0)) return null
  return Math.round(((a - b) / b) * 1000) / 10
}

// --- the wiki's payloads --------------------------------------------------------------------------------------------------

/** A readable address for an item: "Dragon bones" -> "dragon-bones", "Ring of dueling(8)" -> "ring-of-dueling-8". */
export function slugify(name) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'item'
}

/**
 * Gives each item an address that is not used by another: the lowest id keeps the plain one, the others get "-<id>" added. `taken` is
 * the set of addresses that already belong to other items, so items that already have one keep it.
 */
export function assignSlugs(items, taken = new Set()) {
  const used = new Set(taken)
  return [...items]
    .sort((a, b) => a.id - b.id)
    .map((item) => {
      const base = slugify(item.name)
      const slug = used.has(base) ? `${base}-${item.id}` : base
      used.add(slug)
      return { ...item, slug }
    })
}

/** The wiki's /mapping list as clean item rows: [{ id, name, examine, members, limit, value, highAlch, lowAlch, icon }]. */
export function parseMapping(json) {
  const list = Array.isArray(json) ? json : []
  return list
    .filter((x) => x && Number.isInteger(x.id) && typeof x.name === 'string' && x.name.trim())
    .map((x) => ({
      id: x.id,
      name: x.name.trim(),
      examine: typeof x.examine === 'string' ? x.examine : '',
      members: x.members === true,
      limit: Number.isInteger(x.limit) ? x.limit : null,
      value: Number.isInteger(x.value) ? x.value : null,
      highAlch: Number.isInteger(x.highalch) ? x.highalch : null,
      lowAlch: Number.isInteger(x.lowalch) ? x.lowalch : null,
      icon: typeof x.icon === 'string' ? x.icon : '',
    }))
}

const seconds = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? new Date(Number(n) * 1000) : null)

/** The wiki's /latest as rows: [{ id, high, highAt, low, lowAt }] for items with at least one price. */
export function parseLatest(json) {
  const data = json && typeof json === 'object' ? json.data : null
  if (!data || typeof data !== 'object') return []
  const out = []
  for (const [key, v] of Object.entries(data)) {
    const id = Number(key)
    if (!Number.isInteger(id) || !v || typeof v !== 'object') continue
    const high = Number.isInteger(v.high) && v.high > 0 ? v.high : null
    const low = Number.isInteger(v.low) && v.low > 0 ? v.low : null
    if (high == null && low == null) continue
    out.push({ id, high, highAt: high != null ? seconds(v.highTime) : null, low, lowAt: low != null ? seconds(v.lowTime) : null })
  }
  return out
}

/**
 * The wiki's /1h (one hour of trades for every item) as rows with the sums a daily total is built from:
 * { bucket: Date, rows: [{ id, highSum, highVol, lowSum, lowVol }] } where highSum is the average high price times the volume.
 */
export function parseHourly(json) {
  const bucket = seconds(json?.timestamp)
  const data = json?.data
  if (!bucket || !data || typeof data !== 'object') return { bucket: null, rows: [] }
  const rows = []
  for (const [key, v] of Object.entries(data)) {
    const id = Number(key)
    if (!Number.isInteger(id) || !v) continue
    const highVol = Number.isInteger(v.highPriceVolume) && v.avgHighPrice > 0 ? v.highPriceVolume : 0
    const lowVol = Number.isInteger(v.lowPriceVolume) && v.avgLowPrice > 0 ? v.lowPriceVolume : 0
    if (!highVol && !lowVol) continue
    rows.push({ id, highSum: highVol * v.avgHighPrice, highVol, lowSum: lowVol * v.avgLowPrice, lowVol })
  }
  return { bucket, rows }
}

// --- history -------------------------------------------------------------------------------------------------------------------

/** The ranges a chart can show: the wiki step to ask for and how many of its points to keep, newest last. */
export const HISTORY_RANGES = {
  '1d': { step: '5m', keep: 288, ttlMs: 300_000 },
  '1w': { step: '1h', keep: 168, ttlMs: 900_000 },
  '1m': { step: '6h', keep: 124, ttlMs: 1_800_000 },
  '3m': { step: '24h', keep: 92, ttlMs: 3_600_000 },
  '1y': { step: '24h', keep: 365, ttlMs: 3_600_000 },
}

/** The wiki's /timeseries as chart points: [{ t (ms), high, low, vol }] oldest first, limited to the newest `keep`. */
export function parseTimeseries(json, keep = 365) {
  const list = Array.isArray(json?.data) ? json.data : []
  const points = list
    .filter((p) => p && Number.isFinite(Number(p.timestamp)))
    .map((p) => ({
      t: Number(p.timestamp) * 1000,
      high: Number.isInteger(p.avgHighPrice) ? p.avgHighPrice : null,
      low: Number.isInteger(p.avgLowPrice) ? p.avgLowPrice : null,
      vol: (Number.isInteger(p.highPriceVolume) ? p.highPriceVolume : 0) + (Number.isInteger(p.lowPriceVolume) ? p.lowPriceVolume : 0),
    }))
    .sort((a, b) => a.t - b.t)
  return points.slice(-Math.max(1, keep))
}

/** A day's average price from its running sums: the middle of the average high and average low. null when nothing traded. */
export function dailyMid(row) {
  if (!row) return null
  const high = Number(row.high_vol) > 0 ? Number(row.high_sum) / Number(row.high_vol) : null
  const low = Number(row.low_vol) > 0 ? Number(row.low_sum) / Number(row.low_vol) : null
  return midPrice(high, low)
}

/** The sums for one backfilled day from the wiki's 24h step: { highSum, highVol, lowSum, lowVol } (zeros when nothing traded). */
export function dayFromTimeseriesPoint(p) {
  const highVol = Number.isInteger(p?.highPriceVolume) && p.avgHighPrice > 0 ? p.highPriceVolume : 0
  const lowVol = Number.isInteger(p?.lowPriceVolume) && p.avgLowPrice > 0 ? p.lowPriceVolume : 0
  return { highSum: highVol * (highVol ? p.avgHighPrice : 0), highVol, lowSum: lowVol * (lowVol ? p.avgLowPrice : 0), lowVol }
}

// --- lists ------------------------------------------------------------------------------------------------------------------------

/** The kinds of list the Items page can show besides all items: biggest rises and falls over a week, and the items traded most. */
export const MOVER_KINDS = ['risers', 'fallers', 'traded']

/**
 * Picks the items for a movers view from rows { id, name, slug, price, change7, volume }. Risers and fallers only count items that trade
 * enough for a change to mean something (`minVolume` coins of volume a day).
 */
export function pickMovers(rows, kind, { limit = 50, minVolume = 500 } = {}) {
  const usable = rows.filter((r) => r.price != null)
  if (kind === 'traded') return usable.filter((r) => r.volume > 0).sort((a, b) => b.volume - a.volume || b.price - a.price).slice(0, limit)
  const moving = usable.filter((r) => r.change7 != null && r.volume >= minVolume)
  const sorted = moving.sort((a, b) => (kind === 'fallers' ? a.change7 - b.change7 : b.change7 - a.change7))
  return sorted.filter((r) => (kind === 'fallers' ? r.change7 < 0 : r.change7 > 0)).slice(0, limit)
}
