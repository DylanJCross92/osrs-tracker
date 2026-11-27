// How the notification bell presents things: an icon and colour for each kind of notice, the "Today / Yesterday" headings,
// and the folding of a run of similar notices into one line. Pure functions, so they are easy to test.

const I = {
  trophy: ['M8 21h8M12 17v4', 'M7 4h10v5a5 5 0 01-10 0V4z', 'M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  target: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 8a4 4 0 100 8 4 4 0 000-8z', 'M12 11.5a.5.5 0 100 1 .5.5 0 000-1z'],
  heart: ['M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z'],
  userPlus: ['M15 20v-1.5a4 4 0 00-4-4H7a4 4 0 00-4 4V20', 'M9 10.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', 'M19 8v6M16 11h6'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  shieldCheck: ['M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z', 'M8.5 12l2.5 2.5 4.5-5'],
  shieldX: ['M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z', 'M9.5 9.5l5 5M14.5 9.5l-5 5'],
  clock: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 7v5l3 2'],
  users: ['M16 20v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 18.5V20', 'M10 12a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z', 'M20 20v-1.4a3.5 3.5 0 00-2.5-3.3M15.5 5.8a3.2 3.2 0 010 6'],
  bell: ['M6 8a6 6 0 0112 0c0 7 3 8.5 3 8.5H3S6 15 6 8', 'M10.3 20a1.9 1.9 0 003.4 0'],
}

// type -> { icon, tone, action }. `action` is the short verb shown on notices that are waiting for you to do something.
const KINDS = {
  record: { icon: 'trophy', tone: 'gold' },
  milestone: { icon: 'star', tone: 'gold' },
  follow_milestone: { icon: 'star', tone: 'gold' },
  goal_reached: { icon: 'target', tone: 'gold' },
  follow_goal: { icon: 'target', tone: 'gold' },
  // A Hardcore Worlds character started again (a death followed by Reset).
  hardcore_reset: { icon: 'shieldX', tone: 'rose' },
  follow_hardcore_reset: { icon: 'shieldX', tone: 'rose' },
  cheer: { icon: 'heart', tone: 'rose' },
  new_follower: { icon: 'userPlus', tone: 'green' },
  challenge_accepted: { icon: 'bolt', tone: 'blue' },
  claim_approved: { icon: 'shieldCheck', tone: 'green' },
  claim_rejected: { icon: 'shieldX', tone: 'rose' },
  claims_waiting: { icon: 'clock', tone: 'gold', action: 'Review' },
  claim_ping: { icon: 'clock', tone: 'gold', action: 'Review' },
  claim_reminder: { icon: 'clock', tone: 'gold' },
  claim_code: { icon: 'clock', tone: 'gold', action: 'Finish' },
  clan_request: { icon: 'users', tone: 'blue', action: 'Respond' },
  clan_requests: { icon: 'users', tone: 'blue', action: 'Open' },
  clan_added: { icon: 'users', tone: 'blue' },
  // A one-off notice from the site to everyone (the weekly race).
  race_open: { icon: 'trophy', tone: 'gold', action: 'Join' },
}

/** { paths, tone, action } for a notice type. Unknown types get a plain bell. */
export function noticeKind(type) {
  const k = KINDS[type] || { icon: 'bell', tone: 'gold' }
  return { paths: I[k.icon], tone: k.tone, action: k.action || '' }
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Which heading a time belongs under: Today, Yesterday, This week (the last 7 days) or Earlier. */
export function dayBucket(iso, now = new Date()) {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'This week'
  return 'Earlier'
}

/**
 * Folds a run of three or more notices of the same kind about the same player (the daily "personal record" notices are
 * the usual case) into one line: the newest stays, the rest hide behind "Show N earlier". `open` is the set of run keys the
 * person has expanded. Each returned row is { n, runKey?, more?: { count, open }, child? }.
 */
export function foldRuns(items, open = new Set(), minRun = 3) {
  const rows = []
  let i = 0
  while (i < items.length) {
    const head = items[i]
    let j = i + 1
    if (head.subject) while (j < items.length && items[j].type === head.type && items[j].subject === head.subject) j++
    const len = j - i
    if (len >= minRun) {
      const runKey = `run-${head.id}`
      const isOpen = open.has(runKey)
      rows.push({ n: head, runKey, more: { count: len - 1, open: isOpen } })
      if (isOpen) for (let k = i + 1; k < j; k++) rows.push({ n: items[k], child: true })
      i = j
    } else {
      rows.push({ n: head })
      i++
    }
  }
  return rows
}

/** Rows grouped under their day heading, in order: [{ label, rows }]. */
export function sectionsByDay(rows, now = new Date()) {
  const out = []
  for (const r of rows) {
    const label = dayBucket(r.n.createdAt, now)
    const last = out[out.length - 1]
    if (last && last.label === label) last.rows.push(r)
    else out.push({ label, rows: [r] })
  }
  return out
}

// --- Claims waiting for the site owner --------------------------------------------------------------------------------
// A claim waiting for a code check stays in the list until it is dealt with, but the red number on the bell should only
// shout about it once: after the owner has opened the menu and seen it, it stops counting as new. (The "Profile claims"
// line in the account menu keeps its own number.)

/** Key for a "claims waiting" line, or null for any other notice. A new claim changes the line, so it counts as new again. */
export const seenKey = (n) => (n.type === 'claims_waiting' ? `${n.id}:${n.count}` : null)

/** The bell's number: everything outstanding except claim lines already seen. */
export function bellTotal(notifications, seen) {
  const hidden = notifications.items.reduce((sum, n) => (seen.has(seenKey(n)) ? sum + n.count : sum), 0)
  return Math.max(notifications.total - hidden, 0)
}

/** The set of keys to remember after the menu was opened: every claim line showing right now. */
export const seenNow = (items) => new Set(items.map(seenKey).filter(Boolean))

const storeKey = (userId) => `tg-seen-claims:${userId}`
export function loadSeen(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(storeKey(userId)) || '[]'))
  } catch {
    return new Set()
  }
}
export function saveSeen(userId, set) {
  try {
    localStorage.setItem(storeKey(userId), JSON.stringify([...set]))
  } catch {
    // Storage can be blocked; the number then simply comes back next time.
  }
}
