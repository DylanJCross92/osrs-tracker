// Thin wrapper over Google Tag Manager's dataLayer. The container itself
// (GTM-K6756RQ3) is loaded in index.html; this just pushes events to it, and
// is a safe no-op if the tag is blocked (ad blockers, privacy settings).
//
// Nothing from the people building the site should reach Google Analytics, only real visitors. These count as internal:
//  - any local address (localhost, 127.0.0.1, *.localhost, *.local, a private network address),
//  - a browser marked with /?internal=1 (and cleared with /?internal=0),
//  - any browser while an admin or owner account is signed in (a hint kept only while signed in).
// index.html applies the same rules before Tag Manager loads, so internal traffic never loads the tag at all.
const INTERNAL_KEY = 'tickgains-internal'
const ACCOUNT_KEY = 'tickgains-internal-account'

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.+\.(localhost|local|test))$/i

export function isLocalHost(hostname) {
  return LOCAL_HOST.test(String(hostname || ''))
}

/** True for traffic that must not be counted. `env` is only for tests. */
export function isInternalTraffic(env = {}) {
  try {
    const hostname = env.hostname ?? window.location.hostname
    const storage = env.storage ?? window.localStorage
    return isLocalHost(hostname) || storage.getItem(INTERNAL_KEY) === '1' || storage.getItem(ACCOUNT_KEY) === '1'
  } catch {
    return false
  }
}

/** Called whenever the signed-in account changes: admin and owner accounts are the site's own people. */
export function setAccountInternal(on) {
  try {
    if (on) localStorage.setItem(ACCOUNT_KEY, '1')
    else localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    /* storage unavailable */
  }
}

export function track(event, params = {}) {
  try {
    if (isInternalTraffic()) return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, ...params })
  } catch {
    /* analytics must never break the app */
  }
}
