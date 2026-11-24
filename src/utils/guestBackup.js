// A save code: everything a visitor keeps in this browser (plans, quests and diaries, followed players, watched items, the hours they play...) in one
// piece of text they can copy to another device or keep for later. No account, nothing sent to the site. The code is the data itself (compressed
// when the browser can), so whoever has it can read it: it holds nothing secret, only what the person chose to keep.
import { KEYS } from '@/utils/accountData'

export const BACKUP_VERSION = 1
// What is kept besides the synced pieces: the player the visitor said is theirs, and the players they follow.
const EXTRA = { me: 'tickgains:me', rivals: 'tickgains:rivals' }
const FILES = { ...KEYS, ...EXTRA }
const NAMES = Object.keys(FILES)
// Small settings saved as plain text (not JSON): the player the tracker is tailored to, which profile the dashboard is about, the gain period, and whether the
// planner skips methods whose requirements are missing. Only taken on another device when it has no value of its own.
const RAW = {
  trackerPlayer: 'tickgains-tracker-player',
  dashboardProfile: 'tickgains-dashboard-profile',
  ownProfile: 'tickgains-planner-own-profile',
  gainPeriod: 'tickgains:gain-period',
  respect: 'tickgains-planner-respect-requirements',
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0) || (isObj(v) && Object.keys(v).length === 0) || (isObj(v) && Array.isArray(v.goals) && v.goals.length === 0 && Object.keys(v).length <= 1)

function read(storage, key) {
  try {
    const raw = storage.getItem(key)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

/** The pieces in storage that hold something: { name: value }. */
export function collectBackup(storage = localStorage) {
  const data = {}
  for (const name of NAMES) {
    const value = read(storage, FILES[name])
    if (!empty(value)) data[name] = value
  }
  for (const [name, key] of Object.entries(RAW)) {
    try {
      const text = storage.getItem(key)
      if (text) data[name] = text
    } catch {
      /* storage unavailable */
    }
  }
  return { v: BACKUP_VERSION, app: 'tickgains', at: new Date().toISOString(), data }
}

/** A short list of what a backup holds, for showing before it is applied: [{ name, label, count }]. */
export function describeBackup(backup) {
  const d = backup?.data || {}
  const count = (v) => (Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : v ? 1 : 0)
  const rows = []
  if (d.plans) rows.push({ name: 'plans', label: 'saved plans', count: count(d.plans) })
  if (d.planner?.goals?.length) rows.push({ name: 'planner', label: 'a plan in progress', count: null })
  if (d.requirements) {
    const done = Object.entries(d.requirements).filter(([, v]) => v === 'have')
    const diaries = done.filter(([k]) => k.startsWith('diary:')).length
    const quests = done.filter(([k]) => k.startsWith('quest:') && !k.endsWith(':partial')).length
    if (quests) rows.push({ name: 'quests', label: 'quests done', count: quests })
    if (diaries) rows.push({ name: 'diaries', label: 'diary tiers done', count: diaries })
  }
  if (d.rivals) rows.push({ name: 'rivals', label: 'followed players', count: count(d.rivals) })
  if (d.watch) rows.push({ name: 'watch', label: 'watched items', count: count(d.watch) })
  if (d.me) rows.push({ name: 'me', label: 'your player saved', count: null })
  if (d.plannerPrefs?.hours) rows.push({ name: 'hours', label: `${d.plannerPrefs.hours} hours a day`, count: null })
  return rows
}

// --- text form ---------------------------------------------------------------------------------------------------------

const toB64Url = (bytes) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64Url = (text) => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}
const canGzip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

/** The backup as text: "TG1." + gzip, or "TG0." + plain when the browser cannot compress. */
export async function encodeBackup(backup) {
  const bytes = new TextEncoder().encode(JSON.stringify(backup))
  if (canGzip()) {
    try {
      return `TG1.${toB64Url(await pipe(bytes, new CompressionStream('gzip')))}`
    } catch {
      /* fall through to plain */
    }
  }
  return `TG0.${toB64Url(bytes)}`
}

/** The backup in a piece of text, or null when it is not a TickGains save code (extra spaces and line breaks are fine). */
export async function decodeBackup(text) {
  const m = String(text || '').replace(/\s+/g, '').match(/(TG[01])\.([A-Za-z0-9_-]+)/)
  if (!m) return null
  try {
    let bytes = fromB64Url(m[2])
    if (m[1] === 'TG1') {
      if (!canGzip()) return null
      bytes = await pipe(bytes, new DecompressionStream('gzip'))
    }
    const backup = JSON.parse(new TextDecoder().decode(bytes))
    return backup?.app === 'tickgains' && isObj(backup.data) ? backup : null
  } catch {
    return null
  }
}

// --- applying ----------------------------------------------------------------------------------------------------------

const union = (a, b) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])]
const byId = (a, b, newest) => {
  const map = new Map()
  for (const p of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!p || typeof p !== 'object') continue
    const have = map.get(p.id)
    if (!have || (newest && String(p.updatedAt) > String(have.updatedAt))) map.set(p.id, p)
  }
  return [...map.values()]
}

/**
 * Adds a backup to what is in this browser, never taking anything away: lists are joined, plans with the same id keep the newer one, quest and diary
 * answers from the backup are added (and win where both have one), and a single value (your player, the hours) is only taken when none is set here.
 * Returns what changed: [{ name, label, count }].
 */
export function applyBackup(backup, storage = localStorage) {
  const d = backup?.data || {}
  const put = (name, value) => {
    storage.setItem(FILES[name], JSON.stringify(value))
  }
  for (const name of NAMES) {
    if (!(name in d) || empty(d[name])) continue
    const incoming = d[name]
    const local = read(storage, FILES[name])
    if (name === 'plans') put(name, byId(local, incoming, true).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 50))
    else if (name === 'recents') put(name, byId(local ? local.map((r) => ({ ...r, id: String(r.username).toLowerCase() })) : [], incoming.map((r) => ({ ...r, id: String(r.username).toLowerCase() })), false).map(({ id, ...r }) => r).slice(0, 10))
    else if (['cheered', 'dismissed', 'watch', 'rivals'].includes(name)) put(name, union(local, incoming).slice(0, 5000))
    else if (name === 'requirements') put(name, { ...(isObj(local) ? local : {}), ...incoming })
    else if (empty(local)) put(name, incoming)
  }
  for (const [name, key] of Object.entries(RAW)) {
    if (typeof d[name] === 'string' && d[name] && storage.getItem(key) == null) storage.setItem(key, d[name])
  }
  return describeBackup(backup)
}
