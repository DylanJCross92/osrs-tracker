// How many different people were active in the last hour, day and week, for the owner's statistics page. Pure helpers (no database)
// that shape the counts the query returns, so the figures and the hour-by-hour chart are easy to test.
//
// A person is an account, or a browser that is not signed in (the random id kept for 90 days). A browser that signed in is counted
// as the account, not twice. Visits by you and other admins are never recorded, and a browser that sends Do Not Track / Global
// Privacy Control has no id, so it cannot be counted as a person (its events are counted separately, as `untracked`).

export const WINDOWS = [
  { key: 'hour', label: 'Last hour' },
  { key: 'day', label: 'Last 24 hours' },
  { key: 'week', label: 'Last 7 days' },
]

const n = (v) => Number(v) || 0

/**
 * row: the counts one query returns, named `<window>_<what>` (hour_people, day_signed, week_events ...), plus `online` and the
 * per-window `*_new_accounts` and `*_logins`. Returns { online, windows: [{ key, label, people, signedIn, visitors, newAccounts, logins, events,
 * untracked }] } with signedIn + visitors = people.
 */
export function shapeWindows(row = {}) {
  return {
    online: n(row.online),
    windows: WINDOWS.map(({ key, label }) => {
      const people = n(row[`${key}_people`])
      const signedIn = Math.min(people, n(row[`${key}_signed`]))
      return {
        key,
        label,
        people,
        signedIn,
        visitors: people - signedIn,
        newAccounts: n(row[`${key}_new_accounts`]),
        logins: n(row[`${key}_logins`]),
        events: n(row[`${key}_events`]),
        untracked: n(row[`${key}_untracked`]),
      }
    }),
  }
}

const HOUR_MS = 3_600_000

/**
 * rows: [{ hour: Date | ISO (start of the hour), people, signed_in, actions }] (only hours with someone). Returns `hours` entries, oldest
 * first and ending with the hour `now` is in (so the last one is still filling up), zero for quiet hours:
 * [{ at: ISO, people, signedIn, actions }].
 */
export function fillHourly(rows, now = new Date(), hours = 24) {
  const end = Math.floor(new Date(now).getTime() / HOUR_MS) * HOUR_MS
  const byHour = new Map(rows.map((r) => [Math.floor(new Date(r.hour).getTime() / HOUR_MS) * HOUR_MS, r]))
  return Array.from({ length: hours }, (_, i) => {
    const at = end - (hours - 1 - i) * HOUR_MS
    const r = byHour.get(at)
    const people = n(r?.people)
    return { at: new Date(at).toISOString(), people, signedIn: Math.min(people, n(r?.signed_in)), actions: n(r?.actions) }
  })
}

/** rows: [{ area, people, views }] -> the busiest areas, without empty names, at most `limit`. */
export function shapeAreas(rows, limit = 8) {
  return rows
    .filter((r) => r.area)
    .map((r) => ({ area: String(r.area), people: n(r.people), views: n(r.views) }))
    .sort((a, b) => b.people - a.people || b.views - a.views || a.area.localeCompare(b.area))
    .slice(0, limit)
}
