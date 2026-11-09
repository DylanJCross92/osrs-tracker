// TickGains counts a "day" from 6:00 AM Eastern to the next 6:00 AM Eastern (not midnight), in
// the same fixed timezone for every visitor so the site, the cards and the server always agree.
// Mirrors server/src/utils/dates.js and the SQL day cutoffs.
export const GAME_TZ = 'America/New_York'
export const DAY_START_HOUR = 6

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: GAME_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function wall(t) {
  const o = {}
  for (const p of partsFmt.formatToParts(new Date(t))) if (p.type !== 'literal') o[p.type] = Number(p.value)
  return o
}

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

/** The 6 AM-to-6 AM day an instant belongs to, as 'YYYY-MM-DD' (the date the day started on). */
export function gameDay(t) {
  const w = wall(t)
  if (w.hour >= DAY_START_HOUR) return keyOf(w.year, w.month, w.day)
  const prev = new Date(Date.UTC(w.year, w.month - 1, w.day) - 86_400_000)
  return keyOf(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate())
}

// Offset of the game timezone from UTC at an instant, in ms (wall clock minus UTC).
function tzOffset(t) {
  const w = wall(t)
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(t / 1000) * 1000
}

/** Instant (ms) the current game day started: the most recent 6:00 AM Eastern. */
export function startOfGameDay(t = Date.now()) {
  const [y, m, d] = gameDay(t).split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, DAY_START_HOUR)
  let instant = guess - tzOffset(guess)
  instant = guess - tzOffset(instant)
  return instant
}

const dayMs = (key) => Date.parse(`${key}T12:00:00Z`)

/** Add whole days to a 'YYYY-MM-DD' key. */
export const addGameDays = (key, n) => new Date(dayMs(key) + n * 86_400_000).toISOString().slice(0, 10)

/** The last n game days ending today, oldest first: [{ key, label }]. */
export function recentGameDays(n, now = Date.now()) {
  const today = gameDay(now)
  return Array.from({ length: n }, (_, i) => {
    const key = addGameDays(today, i - (n - 1))
    return { key, label: formatGameDay(key, { weekday: 'short' }) }
  })
}

/** Format a game-day key for display (no timezone shifting). */
export function formatGameDay(key, options = { month: 'short', day: 'numeric' }) {
  return new Date(dayMs(key)).toLocaleDateString(undefined, { timeZone: 'UTC', ...options })
}

export const gameMonthKey = (key) => key.slice(0, 7)
