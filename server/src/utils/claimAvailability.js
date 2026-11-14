// The window in which someone claiming a profile says they will be in game, so the site owner knows when to log on.
// Times arrive as ISO strings (the browser turns the person's own clock into an exact moment).
export const MAX_WINDOW_HOURS = 72
export const MAX_DAYS_AHEAD = 14

/**
 * Checks a { onlineFrom, onlineUntil } body. Neither given means "no window" (value null). Otherwise both must be real
 * times, in order, not already over, not too far off and not absurdly long.
 * Returns { ok: true, value: null | { from: Date, until: Date } } or { ok: false, error }.
 */
export function parseAvailability(body, now = new Date()) {
  const rawFrom = body?.onlineFrom ?? null
  const rawUntil = body?.onlineUntil ?? null
  if (rawFrom === null && rawUntil === null) return { ok: true, value: null }
  if (typeof rawFrom !== 'string' || typeof rawUntil !== 'string') return { ok: false, error: 'Pick a start and an end time for when you will be online.' }
  const from = new Date(rawFrom)
  const until = new Date(rawUntil)
  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) return { ok: false, error: 'Those times were not understood. Please pick them again.' }
  if (until <= from) return { ok: false, error: 'The end time has to come after the start time.' }
  if (until <= now) return { ok: false, error: 'That window is already over. Pick a time that is still to come.' }
  if (from.getTime() > now.getTime() + MAX_DAYS_AHEAD * 86_400_000) return { ok: false, error: `Pick a time within the next ${MAX_DAYS_AHEAD} days.` }
  if (until.getTime() - from.getTime() > MAX_WINDOW_HOURS * 3_600_000) return { ok: false, error: `Keep the window to ${MAX_WINDOW_HOURS} hours or less.` }
  return { ok: true, value: { from, until } }
}

/** Minutes left until a ping is allowed again, or 0 when it is allowed now. */
export function pingWaitMinutes(lastPingAt, cooldownMinutes, now = new Date()) {
  if (!lastPingAt) return 0
  const left = new Date(lastPingAt).getTime() + cooldownMinutes * 60_000 - now.getTime()
  return left > 0 ? Math.ceil(left / 60_000) : 0
}
