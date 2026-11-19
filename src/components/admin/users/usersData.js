// What the Users tab works out from the account list. Pure functions, so they are easy to test.

/**
 * How active an account was over a range of `days`, from how many different days it did anything:
 * 'team' (admins are not counted), 'high' (about 2 days in 5 or more), 'regular' (about 1 day in 7 or more), 'light' (some)
 * or 'quiet' (nothing recorded). { level, label, share } where share is 0 to 1 for a small meter.
 */
export function activityLevel(account, days) {
  if (account.team) return { level: 'team', label: 'Team', share: 0 }
  const active = Math.max(0, Number(account.activeDays) || 0)
  const share = days ? Math.min(1, active / days) : 0
  if (!active) return { level: 'quiet', label: 'Quiet', share: 0 }
  if (share >= 0.4) return { level: 'high', label: 'Very active', share }
  if (share >= 0.15) return { level: 'regular', label: 'Regular', share }
  return { level: 'light', label: 'Light', share }
}

/** The headline numbers: how many accounts, how many confirmed their email, how many claimed a player, how many were active. */
export function usersSummary(accounts, days) {
  const list = accounts || []
  const verified = list.filter((a) => a.verifiedAt).length
  const claimed = list.filter((a) => a.players.length).length
  const active = list.filter((a) => !a.team && a.activeDays > 0).length
  const people = list.filter((a) => !a.team).length
  const pct = (n, of) => (of ? `${Math.round((n / of) * 100)}%` : '-')
  return {
    total: list.length,
    verified,
    verifiedPct: pct(verified, list.length),
    claimed,
    claimedPct: pct(claimed, list.length),
    waiting: list.filter((a) => !a.players.length && a.pending > 0).length,
    active,
    activePct: pct(active, people),
    days,
  }
}

export const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'unverified', label: 'Email not confirmed' },
  { key: 'noclaim', label: 'No player claimed' },
  { key: 'claimed', label: 'Claimed a player' },
  { key: 'active', label: 'Active' },
  { key: 'quiet', label: 'Quiet' },
]

export const SORTS = [
  { key: 'seen', label: 'Last seen' },
  { key: 'joined', label: 'Signed up' },
  { key: 'active', label: 'Most active' },
]

const time = (iso) => (iso ? new Date(iso).getTime() : 0)

/** The accounts matching the search text and the filter, in the chosen order. */
export function filterUsers(accounts, { query = '', filter = 'all', sort = 'seen' } = {}) {
  const q = String(query).trim().toLowerCase()
  const keep = {
    all: () => true,
    unverified: (a) => !a.verifiedAt,
    noclaim: (a) => !a.players.length,
    claimed: (a) => a.players.length > 0,
    active: (a) => !a.team && a.activeDays > 0,
    quiet: (a) => !a.team && !a.activeDays,
  }[filter] || (() => true)
  const out = (accounts || []).filter((a) => keep(a) && (!q || a.email.toLowerCase().includes(q) || a.players.some((p) => p.toLowerCase().includes(q))))
  const by = {
    seen: (a, b) => time(b.lastSeen) - time(a.lastSeen),
    joined: (a, b) => time(b.createdAt) - time(a.createdAt),
    active: (a, b) => b.activeDays - a.activeDays || b.steps - a.steps || time(b.lastSeen) - time(a.lastSeen),
  }[sort] || (() => 0)
  return out.sort(by)
}

/** The claim email can go to an account once a day: how many milliseconds are left before it can be sent again (0 when it can). */
export const CLAIM_EMAIL_COOLDOWN_MS = 24 * 3_600_000
export function claimEmailWait(account, now = Date.now()) {
  if (!account?.nudgedAt) return 0
  return Math.max(0, new Date(account.nudgedAt).getTime() + CLAIM_EMAIL_COOLDOWN_MS - now)
}
