// What counts as a share and as a visit through a shared link. Only these words are ever stored, so a request cannot
// fill the table with anything else.

// What was shared. Visits use the same kinds, plus 'site' for any first visit of the day.
export const KIND_LABELS = {
  weekly_card: 'Weekly card',
  challenge: 'Challenge',
  record: 'Record',
  goal: 'Goal',
  plan: 'Plan',
  calculator: 'Calculator',
  compare: 'Compare',
  clan: 'Clan invite',
}
export const KINDS = Object.keys(KIND_LABELS)

// How it was shared: a link copied, an image saved or copied, or a post (X, Reddit or the phone's share sheet).
export const SHARE_METHODS = ['link', 'image', 'social']

// Where a visitor came from, as far as the browser tells us.
export const SOURCE_LABELS = {
  discord: 'Discord',
  x: 'X / Twitter',
  reddit: 'Reddit',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitch: 'Twitch',
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  wiki: 'OSRS Wiki',
  other: 'Other sites',
  direct: 'Direct or app',
}
export const SOURCES = Object.keys(SOURCE_LABELS)

/**
 * What was shared, as a short label ("zezima", "The Skilling Clan", "my 99 plan"): a player's name, a clan or plan name, a skill.
 * Control characters go, runs of spaces collapse, and it is cut to 80 characters. '' when there is nothing usable.
 */
export function cleanItem(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

/** { kind, method, item } from a request body (item only when there is one), or null when it is not a known share. */
export function cleanShare(body) {
  const kind = body?.kind
  const method = body?.method
  if (!KINDS.includes(kind) || !SHARE_METHODS.includes(method)) return null
  const item = cleanItem(body?.item)
  return item ? { kind, method, item } : { kind, method }
}

// A referring site's name ('l.facebook.com'): lower case letters, digits, dots and dashes only, so nothing else is ever stored.
const HOST = /^[a-z0-9]([a-z0-9.-]{0,78}[a-z0-9])?$/
export const cleanHost = (value) => (typeof value === 'string' && HOST.test(value.trim().toLowerCase()) ? value.trim().toLowerCase() : '')

/** { kind, source, item } from a request body, or null. A missing or unknown source counts as direct. A site visit's item is the referring site's name. */
export function cleanVisit(body) {
  const kind = body?.kind
  if (kind !== 'site' && !KINDS.includes(kind)) return null
  const source = SOURCES.includes(body?.source) ? body.source : 'direct'
  const out = { kind, source }
  const item = kind === 'site' ? (source === 'direct' ? '' : cleanHost(body?.item)) : cleanItem(body?.item)
  return item ? { ...out, item } : out
}

/**
 * The most shared items from the stored rows ({ type, kind, item, n }): one line per kind and item with its shares and the
 * visits it brought, busiest first. [{ kind, label, item, shares, visits }].
 */
export function summarizeItems(rows, limit = 40) {
  const out = new Map()
  for (const r of rows) {
    const label = KIND_LABELS[r.kind]
    if (!label || !r.item) continue
    const key = `${r.kind}\u0000${r.item}`
    const line = out.get(key) || { kind: r.kind, label, item: r.item, shares: 0, visits: 0 }
    line[r.type === 'share' ? 'shares' : 'visits'] += Number(r.n) || 0
    out.set(key, line)
  }
  return [...out.values()].sort((a, b) => b.shares + b.visits - (a.shares + a.visits) || b.shares - a.shares || a.item.localeCompare(b.item)).slice(0, limit)
}

/**
 * Turns the stored rows ({ day, type, kind, detail, n }) into what the admin page shows: totals, a line per kind, where
 * visitors came from and one point per day. `days` is the window, ending at `today` (YYYY-MM-DD).
 */
export function summarize(rows, days, today) {
  const totals = { shares: 0, link: 0, image: 0, social: 0, visits: 0, siteVisits: 0 }
  const byKind = new Map(KINDS.map((k) => [k, { kind: k, label: KIND_LABELS[k], shares: 0, link: 0, image: 0, social: 0, visits: 0 }]))
  const sources = new Map()
  const daily = new Map()
  const end = new Date(`${today}T00:00:00Z`)
  for (let i = days - 1; i >= 0; i--) daily.set(new Date(end.getTime() - i * 86_400_000).toISOString().slice(0, 10), { day: '', shares: 0, visits: 0, site: 0 })
  for (const [d, v] of daily) v.day = d

  for (const r of rows) {
    const n = Number(r.n) || 0
    const day = daily.get(r.day)
    if (r.type === 'share') {
      const k = byKind.get(r.kind)
      if (!k) continue
      k.shares += n
      if (r.detail in k) k[r.detail] += n
      totals.shares += n
      if (r.detail in totals) totals[r.detail] += n
      if (day) day.shares += n
    } else if (r.kind === 'site') {
      totals.siteVisits += n
      if (day) day.site += n
    } else {
      const k = byKind.get(r.kind)
      if (!k) continue
      k.visits += n
      totals.visits += n
      sources.set(r.detail, (sources.get(r.detail) || 0) + n)
      if (day) day.visits += n
    }
  }
  return {
    days,
    totals,
    byKind: [...byKind.values()].sort((a, b) => b.shares + b.visits - (a.shares + a.visits)),
    sources: SOURCES.map((s) => ({ source: s, label: SOURCE_LABELS[s], visits: sources.get(s) || 0 })).filter((s) => s.visits > 0).sort((a, b) => b.visits - a.visits),
    daily: [...daily.values()],
  }
}

/**
 * Where people who opened the site came from, from the stored rows: `rows` are one per day and source ({ day, detail, n }, type 'visit',
 * kind 'site'), `itemRows` the referring sites ({ item, n }) and `previous` the visits in the period before (a number).
 * A visit is one browser's first visit of the day. Returns the total, how many were direct and how many came from other sites,
 * each source with its share, the sites that sent the most people, and one point per day.
 */
export function summarizeTraffic(rows, itemRows, days, today, previous = 0) {
  const bySource = new Map()
  const daily = new Map()
  const end = new Date(`${today}T00:00:00Z`)
  for (let i = days - 1; i >= 0; i--) daily.set(new Date(end.getTime() - i * 86_400_000).toISOString().slice(0, 10), { day: '', total: 0, referred: 0 })
  for (const [d, v] of daily) v.day = d
  let total = 0
  for (const r of rows) {
    const n = Number(r.n) || 0
    const source = SOURCES.includes(r.detail) ? r.detail : 'direct'
    bySource.set(source, (bySource.get(source) || 0) + n)
    total += n
    const day = daily.get(r.day)
    if (day) {
      day.total += n
      if (source !== 'direct') day.referred += n
    }
  }
  const direct = bySource.get('direct') || 0
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0)
  const sites = new Map()
  for (const r of itemRows) {
    const host = cleanHost(r.item)
    if (host) sites.set(host, (sites.get(host) || 0) + (Number(r.n) || 0))
  }
  return {
    days,
    total,
    previous: Number(previous) || 0,
    direct,
    referred: total - direct,
    sources: SOURCES.map((s) => ({ source: s, label: SOURCE_LABELS[s], visits: bySource.get(s) || 0, pct: pct(bySource.get(s) || 0) }))
      .filter((s) => s.visits > 0)
      .sort((a, b) => b.visits - a.visits || a.label.localeCompare(b.label)),
    sites: [...sites.entries()].map(([site, visits]) => ({ site, visits })).sort((a, b) => b.visits - a.visits || a.site.localeCompare(b.site)).slice(0, 12),
    daily: [...daily.values()],
  }
}
