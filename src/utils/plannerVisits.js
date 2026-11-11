// Remembers, per player, the XP of the goal skills the last time the planner was open, so the next visit can say what
// has been gained since. Browser-only (it describes this browser's last visit), never sent anywhere.
const KEY = 'tickgains-planner-visits-v1'
// Reloading the page right away must not wipe the "since your last visit" highlight, so a finished visit only becomes the
// new baseline once a later visit starts at least this long after it.
export const VISIT_GRACE_MS = 30 * 60 * 1000

function readAll() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}')
    return all && typeof all === 'object' ? all : {}
  } catch {
    return {}
  }
}

function saveAll(all) {
  // Keep the list from growing forever: the 30 most recently used players.
  const stamp = (v) => String((v.next && v.next.at) || v.at || '')
  const keys = Object.keys(all).sort((a, b) => stamp(all[b]).localeCompare(stamp(all[a]))).slice(0, 30)
  const trimmed = {}
  for (const k of keys) trimmed[k] = all[k]
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch {
    /* storage unavailable */
  }
}

const valid = (v) => v && typeof v.at === 'string' && v.xp && typeof v.xp === 'object'

/**
 * The XP snapshot "since your last visit" is measured against. What is stored when a visit ends is only promoted to the
 * baseline once a later visit starts at least VISIT_GRACE_MS after it, so reloading the page keeps the highlight.
 */
export function readVisit(rsn, now = new Date()) {
  const key = String(rsn || '').toLowerCase()
  const all = readAll()
  const v = all[key]
  if (!v) return null
  if (valid(v.next) && now - new Date(v.next.at) >= VISIT_GRACE_MS) {
    all[key] = { at: v.next.at, xp: v.next.xp }
    saveAll(all)
    return all[key]
  }
  return valid(v) ? { at: v.at, xp: v.xp } : null
}

/** Called when a visit ends: remember today's XP for the next visit. */
export function writeVisit(rsn, xp, now = new Date()) {
  const key = String(rsn || '').toLowerCase()
  if (!key) return
  const all = readAll()
  const prev = all[key] || {}
  all[key] = { ...(valid(prev) ? { at: prev.at, xp: prev.xp } : {}), next: { at: now.toISOString(), xp } }
  saveAll(all)
}

/** XP gained per skill since a stored visit. Only skills that were in the stored snapshot count. Null when nothing changed. */
export function gainedSince(visit, currentXp) {
  if (!visit) return null
  const skills = []
  for (const [skill, before] of Object.entries(visit.xp)) {
    const now = currentXp[skill]
    if (Number.isFinite(before) && Number.isFinite(now) && now > before) skills.push({ skill, gained: now - before })
  }
  if (!skills.length) return null
  skills.sort((a, b) => b.gained - a.gained)
  return { at: visit.at, total: skills.reduce((a, x) => a + x.gained, 0), skills }
}
