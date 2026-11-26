// Turns one visitor's events into a journey: what they did, in order, split into visits, with a count per day. Pure (no
// database), so it is easy to test. The rows come from the events table, oldest or newest first.

import { statsDay } from './statsDay.js'

export const SESSION_GAP_MINUTES = 30
/** The event a browser sends once, when something a person does (a click, a key, a scroll) happens on a page. It is not a step of the journey. */
export const INTERACTION_EVENT = 'page_interacted'

/**
 * Whether a visitor looks like something that only opened the link: no interaction recorded although the site was already recording it
 * when they came (`shipAt`, the first interaction ever seen). Accounts signed in, so they are people. Unknown (null) before that.
 */
export function silentVisitor({ interacted, first, shipAt, kind }) {
  if (kind !== 'visitor' || interacted || !shipAt || !first) return false
  return new Date(first).getTime() >= new Date(shipAt).getTime()
}

/** 'a:12' (an account) or 'v:<32 hex>' (a browser) -> { kind, id }, or null. */
export const ANON_KEY = 'n:anon'

export function parsePersonKey(key) {
  const k = String(key || '')
  // Everyone who cannot be told apart (Do Not Track, a blocked request, no storage): one entry, several people mixed together.
  if (k === ANON_KEY) return { kind: 'anon', id: null }
  let m = /^a:(\d{1,9})$/.exec(k)
  if (m) return { kind: 'account', id: Number(m[1]) }
  m = /^v:([a-f0-9]{32})$/.exec(k)
  return m ? { kind: 'visitor', id: m[1] } : null
}

const dayOf = (d) => statsDay(d)

/**
 * rows: [{ at, name, props }]. days/today: the window shown in the per-day chart (Eastern days, ending today).
 * Returns { count, pages, first, last, daily: [{ day, n }], sessions: [{ start, end, events: [{ at, name, props }] }] } with
 * the newest visit first and each visit's events newest first too. A new visit starts after a quiet gap.
 */
export function buildJourney(rows, days, today, gapMinutes = SESSION_GAP_MINUTES) {
  const interacted = rows.some((r) => r.name === INTERACTION_EVENT)
  const events = [...rows].filter((r) => r.name !== INTERACTION_EVENT && r.at && !Number.isNaN(new Date(r.at).getTime())).sort((a, b) => new Date(a.at) - new Date(b.at))
  const end = new Date(`${today}T00:00:00Z`)
  const daily = new Map(Array.from({ length: days }, (_, i) => [new Date(end.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10), 0]))
  const sessions = []
  let pages = 0
  for (const e of events) {
    const t = new Date(e.at).getTime()
    const d = dayOf(t)
    if (daily.has(d)) daily.set(d, daily.get(d) + 1)
    if (e.name === 'spa_page_view') pages++
    const last = sessions[sessions.length - 1]
    const item = { at: new Date(t).toISOString(), name: e.name, props: e.props || {} }
    if (last && t - new Date(last.end).getTime() <= gapMinutes * 60_000) {
      last.events.push(item)
      last.end = item.at
    } else sessions.push({ start: item.at, end: item.at, events: [item] })
  }
  return {
    interacted,
    count: events.length,
    pages,
    first: events.length ? new Date(events[0].at).toISOString() : null,
    last: events.length ? new Date(events[events.length - 1].at).toISOString() : null,
    daily: [...daily].map(([day, n]) => ({ day, n })),
    sessions: sessions.reverse().map((s) => ({ ...s, events: s.events.reverse() })),
  }
}
