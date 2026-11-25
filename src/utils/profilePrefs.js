// Settings kept for each RuneScape profile an account owns (members or free-to-play, ironman, hours played a day), inside the planner
// preferences object that is already kept in this browser and in the account (see utils/accountData.js). The plain members / iron / hours
// in that object are what everything starts from; the one saved for the person's main profile is kept in step with them, so choosing
// "ironman" in a planner and choosing it in the account page are the same thing.
//
// Plain functions on localStorage (no Vue), so the preference modules can call them without importing each other.
import { KEYS } from '@/utils/accountData'
import { cleanBuild, cleanIronKind, cleanWorld } from '@/data/builds'

const KEY = KEYS.plannerPrefs
const ME_KEY = 'tickgains:me'

/** The key a profile's settings are kept under: its name, lower case. */
export const profileKey = (name) => String(name || '').trim().toLowerCase()

function readPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}
function writePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* storage unavailable */
  }
}

const hoursOf = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(24, Math.max(0.5, Math.round(n * 2) / 2)) : null
}
function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const out = {}
  if (typeof raw.members === 'boolean') out.members = raw.members
  if (typeof raw.iron === 'boolean') out.iron = raw.iron
  if (typeof raw.build === 'string') out.build = cleanBuild(raw.build)
  if (typeof raw.ironKind === 'string') out.ironKind = cleanIronKind(raw.ironKind)
  if (typeof raw.world === 'string') out.world = cleanWorld(raw.world)
  const hours = hoursOf(raw.hours)
  if (hours != null) out.hours = hours
  return out
}

/** The name kept as "you" in this browser, lower case ('' when none). */
export function mainProfileKey() {
  try {
    const v = JSON.parse(localStorage.getItem(ME_KEY) || '""')
    return typeof v === 'string' ? profileKey(v) : ''
  } catch {
    return ''
  }
}

/** What was saved for a profile ({ members, iron, build, ironKind, world, hours }, any of them), or null when nothing was. */
export function profileEntry(name) {
  const entry = cleanEntry(readPrefs().profiles?.[profileKey(name)])
  return entry && Object.keys(entry).length ? entry : null
}

/** What the plain preferences say: members unless chosen otherwise, not an ironman, 2 hours until chosen. */
export function plainSettings() {
  const prefs = readPrefs()
  return { members: prefs.members !== false, iron: prefs.iron === true, build: cleanBuild(prefs.build), ironKind: cleanIronKind(prefs.ironKind), world: cleanWorld(prefs.world), hours: hoursOf(prefs.hours) ?? 2 }
}

/** Saves some of a profile's settings (merged with what was saved). Returns the entry kept, or null for a name that cannot be kept. */
export function saveProfileEntry(name, patch) {
  const key = profileKey(name)
  if (!key) return null
  const prefs = readPrefs()
  const entry = { ...(cleanEntry(prefs.profiles?.[key]) || {}), ...(cleanEntry(patch) || {}) }
  prefs.profiles = { ...(prefs.profiles || {}), [key]: entry }
  writePrefs(prefs)
  return entry
}

/**
 * A choice made through the plain preferences (a planner's switch, the hours slider): keep the main profile's saved settings in step,
 * but only when there are some (the account page makes them), so a visitor's choices never grow a profile out of nothing.
 */
export function mirrorToMain(patch) {
  const key = mainProfileKey()
  if (!key) return
  const prefs = readPrefs()
  const entry = cleanEntry(prefs.profiles?.[key])
  if (!entry) return
  prefs.profiles = { ...prefs.profiles, [key]: { ...entry, ...(cleanEntry(patch) || {}) } }
  writePrefs(prefs)
}
