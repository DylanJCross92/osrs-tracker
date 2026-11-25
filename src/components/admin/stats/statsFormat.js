// Number and date wording shared by the statistics charts and tables.
export const fmt = (n) => Number(n || 0).toLocaleString('en-US')
export const count = (n, word) => `${fmt(n)} ${word}${Number(n) === 1 ? '' : 's'}`

/** 1,234 -> 1.2k, 2,500,000 -> 2.5M. Small numbers stay whole. */
export function compact(n) {
  const v = Number(n) || 0
  const a = Math.abs(v)
  if (a >= 1e9) return `${+(v / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`
  if (a >= 1e4) return `${Math.round(v / 1e3)}k`
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}k`
  return String(Math.round(v * 10) / 10)
}

export const dayLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const dayLong = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

/** A round top for a four-step axis, so every gridline is a friendly number: 80 -> 80 (20 a step), 100 -> 100, 7 -> 8, 1,240 -> 1,250. */
export function niceMax(max) {
  if (!(max > 4)) return 4
  const raw = max / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const f = raw / p
  return 4 * p * (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10)
}

/** Relative time for the activity feed: "just now", "5 min ago", "3 h ago", "2 d ago". */
export function ago(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

const statsDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })

/** The last `n` days as 'YYYY-MM-DD', oldest first, ending today: midnight to midnight Eastern, the days the statistics are counted by. */
export function lastDays(n, now = Date.now()) {
  const end = Date.parse(`${statsDayFmt.format(new Date(now))}T12:00:00Z`)
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10))
}

// The first part of a page address, as the owner reads it ('/player/Zezima' is stored as 'player').
const AREA_LABELS = {
  home: 'Home and dashboard',
  player: 'Player profiles',
  planner: 'Account Planner',
  plan: 'Shared plans',
  plans: 'Plan guides',
  items: 'GE prices',
  quests: 'Quest and diary tracker',
  calculators: 'Skill calculators',
  discover: 'Discover',
  leaderboard: 'Leaderboards',
  clans: 'Clans',
  competitions: 'Competitions',
  challenge: 'Challenges',
  join: 'Clan invites',
  compare: 'Compare',
  account: 'Account',
  login: 'Log in',
  signup: 'Sign up',
  'osrs-xp-table': 'XP table',
  'release-notes': 'Release notes',
}

/** An area name ('player') as the owner reads it ('Player profiles'); any other name is shown as plain words. */
export function areaLabel(name) {
  const key = String(name || '')
  if (AREA_LABELS[key]) return AREA_LABELS[key]
  const words = key.replace(/[-_]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Other'
}

/** The busiest of the hours ({ at, people }), or null when nobody was around. Ties go to the later hour. */
export function busiestHour(hours) {
  let best = null
  for (const h of hours || []) if (h.people > 0 && (!best || h.people >= best.people)) best = h
  return best
}
