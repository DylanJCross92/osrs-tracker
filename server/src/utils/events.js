// Rules for the site's own product events. Pure (no database), so what is allowed in is easy to test. Everything that
// arrives from a browser is untrusted: names and detail keys must look like plain identifiers, details are a few short
// primitives, and anything that could identify someone (names, emails, search text, links) is dropped here.

export const MAX_BATCH = 25
export const MAX_PROPS = 12
export const MAX_STRING = 80
export const MAX_JSON = 1000
export const RETENTION_DAYS = 400

const NAME = /^[a-z][a-z0-9_]{1,63}$/
const KEY = /^[a-z][a-z0-9_]{0,39}$/
// Detail keys that may carry personal text. (username_length is fine, it is a number.)
const PERSONAL_KEY = /^(name|username|rsn|email|password|token|query|q|text|message|url|phone|address)$|_(name|email|rsn|password|token|url)$/

// Counted by the server itself (see services/events.service.js), so a browser cannot send them and sign-ins are not counted twice.
export const SERVER_ONLY_EVENTS = new Set(['login', 'session_resumed'])

// Crawlers and scripts that run the site's JavaScript (Google renders pages this way) would each count as a new visitor, because a
// crawler keeps no browser storage between pages. They identify themselves in the User-Agent, so those requests are not counted.
const CRAWLER = /\bbot\b|[a-z]bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|inspectiontool|googleother|facebookexternalhit|bingpreview|embedly|pingdom|uptimerobot|statuscake|python-requests|python-urllib|go-http-client|curl\/|wget\/|libwww|httpclient|okhttp|scrapy|puppeteer|playwright|phantomjs/i

/** True when the User-Agent belongs to a crawler or script (a missing one counts too: browsers always send one). */
export function isCrawler(userAgent) {
  const ua = String(userAgent || '').trim()
  return !ua || CRAWLER.test(ua)
}

// Files that phones, browsers and scanners fetch from the site by themselves (Apple's app link file, security.txt and the like). They
// are not people, and the app answers them like any page, so they must not count as a visitor.
export const isAutomaticPath = (path) => /^\/\.well-known(\/|$|\?)/i.test(String(path || ''))

/** True when the request carries Do Not Track or Global Privacy Control. */
export const askedNotToTrack = (headers = {}) => headers.dnt === '1' || headers['sec-gpc'] === '1'

const snake = (key) => String(key).replace(/([A-Z])/g, '_$1').toLowerCase()

/** The details of one event: a flat object of short strings, numbers and booleans, or {} when there is nothing usable. */
export function cleanProps(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [rawKey, value] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_PROPS) break
    const key = snake(rawKey)
    if (!KEY.test(key) || PERSONAL_KEY.test(key)) continue
    if (typeof value === 'boolean') out[key] = value
    else if (typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = value
    } else if (typeof value === 'string') {
      const text = value.trim().slice(0, MAX_STRING)
      // Anything that looks like an email address is left out, whatever the key is called.
      if (text && !text.includes('@')) out[key] = text
    }
  }
  return JSON.stringify(out).length > MAX_JSON ? {} : out
}

/** The random id a browser keeps: 32 hex characters, or null. */
export const cleanVisitorId = (v) => (typeof v === 'string' && /^[a-f0-9]{32}$/.test(v) ? v : null)

/** { events: [{ name, props }], anon, vid } from a request body. Unknown or malformed events are skipped, never an error. */
export function cleanEvents(body) {
  const list = Array.isArray(body?.events) ? body.events.slice(0, MAX_BATCH) : []
  const events = []
  for (const e of list) {
    const name = typeof e?.name === 'string' ? e.name.trim().toLowerCase() : ''
    if (!NAME.test(name) || SERVER_ONLY_EVENTS.has(name)) continue
    if (isAutomaticPath(e.props?.page_path)) continue
    events.push({ name, props: cleanProps(e.props) })
  }
  // The browser asked not to be tracked (Do Not Track / Global Privacy Control): count the event, but not against an account.
  const anon = body?.anon === true
  // A browser that asked not to be tracked never has an id, whatever it sends.
  return { events, anon, vid: anon ? null : cleanVisitorId(body?.vid) }
}

/** The days between two YYYY-MM-DD dates, oldest first, ending at `today`. */
function lastDays(days, today) {
  const end = new Date(`${today}T00:00:00Z`)
  return Array.from({ length: days }, (_, i) => new Date(end.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10))
}

/**
 * The admin overview. dayRows: [{ name, day, n }] (one per event and day), totalRows: [{ name, total, accounts, accounts_today }].
 * Returns [{ name, total, accounts, accountsToday, today, daily: [n per day, oldest first] }], busiest first.
 */
export function summarizeEvents(dayRows, totalRows, days, today) {
  const dates = lastDays(days, today)
  const index = new Map(dates.map((d, i) => [d, i]))
  const byName = new Map()
  for (const r of totalRows) byName.set(r.name, { name: r.name, total: Number(r.total) || 0, accounts: Number(r.accounts) || 0, accountsToday: Number(r.accounts_today) || 0, today: 0, daily: dates.map(() => 0) })
  for (const r of dayRows) {
    const e = byName.get(r.name)
    const i = index.get(r.day)
    if (!e || i == null) continue
    e.daily[i] = Number(r.n) || 0
    if (r.day === today) e.today = e.daily[i]
  }
  return [...byName.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

/** The most common values for each detail of one event: rows [{ k, v, n }] -> { key: [{ value, n }] } (top `limit` each). */
export function summarizeBreakdown(rows, limit = 6) {
  const out = {}
  for (const r of [...rows].sort((a, b) => Number(b.n) - Number(a.n))) {
    const list = (out[r.k] ||= [])
    if (list.length < limit) list.push({ value: r.v, n: Number(r.n) || 0 })
  }
  return out
}
