// The numbers the Overview tab pulls out of what the other tabs load. Pure functions, so they are easy to test.
import { SEARCH_FUNNEL } from '@/utils/eventGroups'

/**
 * How the latest stretch compares with the one before it, for a list of daily numbers: the last half against the half
 * before. { now, before, pct, dir } where dir is 'up', 'down', 'flat', 'new' (nothing before, something now) or 'none'
 * (too few days to say anything).
 */
export function trend(values) {
  const list = (values || []).map((v) => Number(v) || 0)
  const half = Math.floor(list.length / 2)
  if (half < 2) return { now: 0, before: 0, pct: null, dir: 'none' }
  const sum = (a) => a.reduce((s, v) => s + v, 0)
  const now = sum(list.slice(-half))
  const before = sum(list.slice(-half * 2, -half))
  if (!before && !now) return { now, before, pct: null, dir: 'none' }
  if (!before) return { now, before, pct: null, dir: 'new' }
  const pct = Math.round(((now - before) / before) * 100)
  return { now, before, pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

/** Short wording for a trend chip: "▲ 12%", "▼ 8%", "▲ new", or '' when there is nothing to say. */
export function trendLabel(t) {
  if (t.dir === 'up') return `▲ ${t.pct}%`
  if (t.dir === 'down') return `▼ ${Math.abs(t.pct)}%`
  if (t.dir === 'flat') return '● same'
  if (t.dir === 'new') return '▲ new'
  return ''
}

const dayOf = (iso) => String(iso).slice(0, 10)

/**
 * A summary of the people the Visitors tab lists ({ visitors: [{ key, kind, label, players, events, first, last }] }, newest
 * first): how many, how many signed in, how many came back on another day, and who to look at.
 */
export function peopleSummary(list, limit = 150) {
  const all = list?.visitors || []
  const accounts = all.filter((v) => v.kind === 'account').length
  const returning = all.filter((v) => dayOf(v.first) !== dayOf(v.last)).length
  const events = all.reduce((s, v) => s + (Number(v.events) || 0), 0)
  return {
    total: all.length,
    capped: all.length >= limit,
    accounts,
    anonymous: all.length - accounts,
    returning,
    avgSteps: all.length ? Math.round(events / all.length) : 0,
    latest: all.slice(0, 4),
    busiest: [...all].sort((a, b) => b.events - a.events).slice(0, 3),
  }
}

/** The search-to-tracked-player steps with how far each carried on from the one before, from the events list. */
export function funnelRows(events) {
  const by = new Map((events || []).map((e) => [e.name, e.total]))
  return SEARCH_FUNNEL.map((s, i) => {
    const value = by.get(s.name) || 0
    const prev = i ? by.get(SEARCH_FUNNEL[i - 1].name) || 0 : 0
    return { key: s.name, label: s.label, value, sub: i && prev ? `${Math.min(100, Math.round((value / prev) * 100))}% of the step before` : '' }
  })
}

/** What the Sharing tab shows, boiled down: totals, how much of the traffic it brings, and what is shared most. */
export function sharingSummary(data) {
  if (!data) return null
  const t = data.totals
  const pct = t.siteVisits ? (t.visits / t.siteVisits) * 100 : null
  return {
    shares: t.shares,
    link: t.link,
    image: t.image,
    social: t.social,
    visits: t.visits,
    pct: pct == null ? '-' : `${pct > 0 && pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`,
    perShare: t.shares ? (t.visits / t.shares).toFixed(1) : null,
    topItems: (data.items || []).slice(0, 4),
    topSources: (data.sources || []).filter((s) => s.visits > 0).slice(0, 3),
  }
}

/** Sign-ups as a share of visitors, e.g. "3.2%", or '-' without visitors. */
export function conversion(signups, visitors) {
  if (!visitors) return '-'
  const p = (signups / visitors) * 100
  return `${p > 0 && p < 10 ? p.toFixed(1) : Math.round(p)}%`
}
