// A random id each browser keeps, so the site owner can follow one visitor's steps in order (see the Visitors tab of the admin
// statistics). It is 128 random bits with no link to the person, it is replaced after 90 days, and a browser that sends Do Not
// Track or Global Privacy Control never gets one (an id it already had is removed). Without storage there is no id.
const KEY = 'tickgains-vid-v1'
export const VISITOR_ID_DAYS = 90

const askedNotToTrack = () => {
  try {
    return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true
  } catch {
    return false
  }
}

/** 32 random hex characters, from the browser's secure random source. */
export function newVisitorId(cryptoApi = globalThis.crypto) {
  const bytes = new Uint8Array(16)
  cryptoApi.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * This browser's id, made on first use and replaced when it is older than 90 days; null when the browser asks not to be tracked
 * or cannot keep one. `env` is only for tests: { storage, now, dnt, crypto }.
 */
export function getVisitorId(env = {}) {
  try {
    if (env.dnt ?? askedNotToTrack()) {
      ;(env.storage ?? window.localStorage).removeItem(KEY)
      return null
    }
    const storage = env.storage ?? window.localStorage
    const now = env.now ?? Date.now()
    try {
      const saved = JSON.parse(storage.getItem(KEY) || 'null')
      if (saved && /^[a-f0-9]{32}$/.test(saved.id) && now - Number(saved.at) < VISITOR_ID_DAYS * 86_400_000 && now >= Number(saved.at)) return saved.id
    } catch {
      /* a damaged value is replaced below */
    }
    const id = newVisitorId(env.crypto)
    storage.setItem(KEY, JSON.stringify({ id, at: now }))
    return id
  } catch {
    return null
  }
}
