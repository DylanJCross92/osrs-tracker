import { authApi } from '@/api/auth'

// Keeps a few things the browser saves (planner plans and goals, recent searches, congratulation clicks) in step
// with the signed-in account, so they follow the person to other devices. Signed out, nothing here runs and the
// browser storage works exactly as before.
//
// Each piece is stored under its usual localStorage key. While signed in, every change to one of those keys is
// noticed (by wrapping localStorage.setItem) and sent to the account a moment later. On sign-in the two sides are
// merged: sets are joined, and for the rest the side that changed last wins.

export const KEYS = {
  plans: 'tickgains-saved-plans-v1',
  planner: 'tickgains-planner-v1',
  recents: 'tickgains:recent-searches',
  cheered: 'tickgains-congrats-cheered',
  dismissed: 'tickgains-congrats-dismissed',
  requirements: 'tickgains-planner-requirements-v1',
}
const NAMES = Object.keys(KEYS)
const BY_STORAGE_KEY = Object.fromEntries(NAMES.map((n) => [KEYS[n], n]))
const META_KEY = 'tickgains:sync-meta'
export const SYNCED_EVENT = 'tickgains:data-synced'

let enabled = false
let applying = false
let timer = null
const dirty = new Set()

// --- local storage helpers (all safe when storage is blocked) ---------------------------------------------------------

function readRaw(name) {
  try {
    const raw = localStorage.getItem(KEYS[name])
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}
function writeRaw(name, value) {
  applying = true
  try {
    if (value == null) localStorage.removeItem(KEYS[name])
    else localStorage.setItem(KEYS[name], JSON.stringify(value))
  } catch {
    // Storage unavailable, nothing to keep.
  } finally {
    applying = false
  }
}
function readMeta() {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    return meta && typeof meta === 'object' ? meta : {}
  } catch {
    return {}
  }
}
function writeMeta(meta) {
  applying = true
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // ignore
  } finally {
    applying = false
  }
}
const nowIso = () => new Date().toISOString()
const isEmpty = (name, value) => {
  if (value == null) return true
  if (name === 'planner') return !Array.isArray(value.goals) || value.goals.length === 0
  if (name === 'requirements') return typeof value !== 'object' || Object.keys(value).length === 0
  return Array.isArray(value) && value.length === 0
}

// --- change detection ---------------------------------------------------------------------------------------------------

let patched = false
function patchStorage() {
  if (patched || typeof Storage === 'undefined') return
  patched = true
  const setItem = Storage.prototype.setItem
  const removeItem = Storage.prototype.removeItem
  const note = (storage, key) => {
    const name = BY_STORAGE_KEY[key]
    if (storage !== localStorage || !name || applying) return
    const meta = readMeta()
    meta[name] = { ...(meta[name] || {}), ts: nowIso() }
    writeMeta(meta)
    if (enabled) schedulePush(name)
  }
  Storage.prototype.setItem = function (key, value) {
    setItem.call(this, key, value)
    note(this, key)
  }
  Storage.prototype.removeItem = function (key) {
    removeItem.call(this, key)
    note(this, key)
  }
}

function schedulePush(name) {
  dirty.add(name)
  clearTimeout(timer)
  timer = setTimeout(flush, 1200)
}

/** Sends the pieces that changed locally to the account. */
export async function flush() {
  if (!enabled || !dirty.size) return
  const names = [...dirty]
  dirty.clear()
  const meta = readMeta()
  const payload = {}
  for (const name of names) {
    const value = readRaw(name)
    // An emptied piece is still sent, so clearing it on one device clears it everywhere.
    payload[name] = { value: value ?? (name === 'planner' ? { goals: [] } : name === 'requirements' ? {} : []), updatedAt: meta[name]?.ts || nowIso() }
  }
  try {
    await authApi.saveData(payload)
  } catch {
    names.forEach((n) => dirty.add(n))
  }
}

// --- merging --------------------------------------------------------------------------------------------------------------

const union = (a = [], b = []) => [...new Set([...a, ...b])].slice(-200)

function mergeRecents(local, server) {
  const seen = new Set()
  const out = []
  for (const r of [...(Array.isArray(local) ? local : []), ...(Array.isArray(server) ? server : [])]) {
    const k = String(r?.username || '').toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out.slice(0, 10)
}

function unionPlans(local, server) {
  const byId = new Map()
  for (const p of [...(Array.isArray(server) ? server : []), ...(Array.isArray(local) ? local : [])]) {
    const have = byId.get(p.id)
    if (!have || String(p.updatedAt) > String(have.updatedAt)) byId.set(p.id, p)
  }
  return [...byId.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 50)
}

/**
 * Brings this browser and the account in step. Returns true when this browser's data changed (so open screens can
 * re-read it). Never throws: a failed sync leaves the browser exactly as it was.
 */
export async function linkAccountData() {
  patchStorage()
  let server = {}
  try {
    server = (await authApi.getData()).data || {}
  } catch {
    enabled = true
    return false
  }
  const meta = readMeta()
  const toPush = {}
  let changedLocal = false

  for (const name of NAMES) {
    const local = readRaw(name)
    const remote = server[name]
    const remoteValue = remote?.value
    const localTs = meta[name]?.ts || null
    const linked = Boolean(meta[name]?.linked)
    let merged = local
    let pushIt = false

    if (name === 'cheered' || name === 'dismissed') {
      merged = union(Array.isArray(local) ? local : [], Array.isArray(remoteValue) ? remoteValue : [])
      pushIt = JSON.stringify(merged) !== JSON.stringify(remoteValue || [])
    } else if (name === 'requirements') {
      // Answers about quests and gear: keep those from both sides, this browser's answer winning where both have one.
      const remoteMap = remoteValue && typeof remoteValue === 'object' && !Array.isArray(remoteValue) ? remoteValue : {}
      merged = { ...remoteMap, ...(local && typeof local === 'object' && !Array.isArray(local) ? local : {}) }
      pushIt = JSON.stringify(merged) !== JSON.stringify(remoteMap)
    } else if (name === 'recents') {
      merged = mergeRecents(local, remoteValue)
      pushIt = JSON.stringify(merged) !== JSON.stringify(remoteValue || [])
    } else if (name === 'plans' && !linked) {
      // First time this browser meets the account: keep plans from both sides.
      merged = unionPlans(local, remoteValue)
      pushIt = JSON.stringify(merged) !== JSON.stringify(remoteValue || [])
    } else if (remote === undefined || isEmpty(name, remoteValue) && !isEmpty(name, local) && (!remote || !linked)) {
      // The account has nothing (or only an empty placeholder) and this browser does: this browser's copy goes up.
      merged = local
      pushIt = !isEmpty(name, local)
    } else if (isEmpty(name, local) && !localTs) {
      merged = remoteValue
    } else if (localTs && String(localTs) > String(remote.updatedAt)) {
      merged = local
      pushIt = true
    } else if (!localTs && !isEmpty(name, local) && !isEmpty(name, remoteValue)) {
      // Both have data and this browser never recorded when it changed: the account is the source of truth.
      merged = remoteValue
    } else {
      merged = remoteValue
    }

    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      writeRaw(name, merged)
      changedLocal = true
    }
    meta[name] = { ts: pushIt ? nowIso() : remote?.updatedAt || localTs || nowIso(), linked: true }
    if (pushIt) toPush[name] = { value: merged ?? (name === 'requirements' ? {} : []), updatedAt: meta[name].ts }
  }

  writeMeta(meta)
  enabled = true
  if (Object.keys(toPush).length) {
    try {
      await authApi.saveData(toPush)
    } catch {
      // Will go up with the next change.
    }
  }
  if (changedLocal && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNCED_EVENT))
  return changedLocal
}

/** Stops syncing and clears the synced pieces from this browser (used on sign-out, so a shared computer keeps nothing). */
export function unlinkAccountData() {
  enabled = false
  clearTimeout(timer)
  dirty.clear()
  for (const name of NAMES) writeRaw(name, null)
  writeMeta({})
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNCED_EVENT))
}
