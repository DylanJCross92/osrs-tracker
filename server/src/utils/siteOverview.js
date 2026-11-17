// Pure helpers for the admin overview: one count per day, and a merged "latest activity" list. No database here, so the
// gap filling and ordering are easy to test.
import { addDays } from './dates.js'

/** rows: [{ day: 'YYYY-MM-DD', n }]; returns exactly `days` counts, oldest first and ending `today`, zero on quiet days. */
export function fillCounts(rows, days, today) {
  const byDay = new Map()
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) || 0) + (Number(r.n) || 0))
  return Array.from({ length: days }, (_, i) => byDay.get(addDays(today, i - (days - 1))) || 0)
}

/** The oldest-first list of day labels that fillCounts lines up with. */
export const dayLabels = (days, today) => Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)))

/**
 * defs: [{ key, label }], totals: { key: n }, rows: [{ key, day, n }] (only days with something).
 * Returns [{ key, label, total, added, daily }]: how many exist, how many were added in the window, and one count per day.
 */
export function growthItems(defs, totals, rows, days, today) {
  return defs.map((d) => {
    const daily = fillCounts(rows.filter((r) => r.key === d.key), days, today)
    return { key: d.key, label: d.label, total: Number(totals[d.key]) || 0, added: daily.reduce((s, n) => s + n, 0), daily }
  })
}

/** Several lists of { at, ... } merged newest first, cut to `limit`. Entries without a usable time are dropped. */
export function mergeFeed(lists, limit = 30) {
  return lists
    .flat()
    .filter((e) => e.at != null)
    .map((e) => ({ ...e, time: new Date(e.at).getTime() }))
    .filter((e) => Number.isFinite(e.time))
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(({ time, at, ...rest }) => ({ ...rest, at: new Date(time).toISOString() }))
}
