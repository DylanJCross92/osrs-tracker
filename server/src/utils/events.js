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

/** { events: [{ name, props }], anon } from a request body. Unknown or malformed events are skipped, never an error. */
export function cleanEvents(body) {
  const list = Array.isArray(body?.events) ? body.events.slice(0, MAX_BATCH) : []
  const events = []
  for (const e of list) {
    const name = typeof e?.name === 'string' ? e.name.trim().toLowerCase() : ''
    if (!NAME.test(name) || SERVER_ONLY_EVENTS.has(name)) continue
    events.push({ name, props: cleanProps(e.props) })
  }
  // The browser asked not to be tracked (Do Not Track / Global Privacy Control): count the event, but not against an account.
  return { events, anon: body?.anon === true }
}

/** The days between two YYYY-MM-DD dates, oldest first, ending at `today`. */
function lastDays(days, today) {
  const end = new Date(`${today}T00:00:00Z`)
  return Array.from({ length: days }, (_, i) => new Date(end.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10))
}

/**
 * The admin overview. dayRows: [{ name, day, n }] (one per event and day), totalRows: [{ name, total, accounts }].
 * Returns [{ name, total, accounts, today, daily: [n per day, oldest first] }], busiest first.
 */
export function summarizeEvents(dayRows, totalRows, days, today) {
  const dates = lastDays(days, today)
  const index = new Map(dates.map((d, i) => [d, i]))
  const byName = new Map()
  for (const r of totalRows) byName.set(r.name, { name: r.name, total: Number(r.total) || 0, accounts: Number(r.accounts) || 0, today: 0, daily: dates.map(() => 0) })
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
