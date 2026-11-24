// "Since you were last here": what changed for the players a visitor follows since they last looked, worked out in the browser. The browser remembers
// each followed player's total XP and the time it last looked, so a visitor with no account still gets a summary when they come back.
const KEY = 'tickgains-last-visit'
export const MIN_GAP_MS = 3 * 3_600_000 // not worth reporting after less than a few hours away
const lower = (s) => String(s).toLowerCase()

export function readVisit(storage = localStorage) {
  try {
    const v = JSON.parse(storage.getItem(KEY) || 'null')
    return v && Number.isFinite(v.at) && v.xp && typeof v.xp === 'object' ? v : null
  } catch {
    return null
  }
}
export function writeVisit(visit, storage = localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(visit))
  } catch {
    /* storage unavailable */
  }
}

/** The feed's players as { name: totalXp } (lower case names), for remembering. */
export const xpMap = (players = []) => Object.fromEntries(players.filter((p) => Number.isFinite(p.overallXp)).map((p) => [lower(p.username), p.overallXp]))

/**
 * What changed since `prev` ({ at, xp }): for each followed player the XP gained and the milestones reached after it, biggest gain first. Returns null when
 * there is nothing to say (no earlier visit, not long enough ago, or nothing changed). `events` are the feed's milestones: { username, title, at }.
 */
export function sinceLastVisit(prev, players = [], events = [], now = Date.now()) {
  if (!prev || now - prev.at < MIN_GAP_MS) return null
  const rows = []
  for (const p of players) {
    const before = prev.xp[lower(p.username)]
    // A player followed since last time has nothing to compare with.
    if (before == null || !Number.isFinite(p.overallXp)) continue
    const gain = Math.max(0, p.overallXp - before)
    const milestones = events.filter((e) => lower(e.username) === lower(p.username) && new Date(e.at).getTime() > prev.at).map((e) => e.title)
    if (gain > 0 || milestones.length) rows.push({ username: p.username, displayName: p.displayName, gain, milestones: [...new Set(milestones)].slice(0, 3) })
  }
  if (!rows.length) return null
  rows.sort((a, b) => b.milestones.length - a.milestones.length || b.gain - a.gain)
  return { since: prev.at, rows, total: rows.reduce((s, r) => s + r.gain, 0) }
}

/** "3 hours ago", "yesterday", "5 days ago". */
export function awayText(since, now = Date.now()) {
  const hours = Math.floor((now - since) / 3_600_000)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
