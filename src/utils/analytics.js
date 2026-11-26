import { statsApi } from '@/api/stats'
import { shareFromEvent } from '@/utils/shareEvents'
import { logEvent } from '@/utils/eventLog'

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
    // Something fetching a file the site answers by itself (/.well-known/...) is not a person.
    if (/^\/\.well-known(\/|$)/i.test(env.pathname ?? (typeof window === 'undefined' ? '' : window.location.pathname))) return true
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
    // The site's own share count (anonymous, just a tally): a link or image being shared.
    const share = shareFromEvent(event, params)
    if (share) statsApi.share(share.kind, share.method, share.item).catch(() => {})
    // What was shared (a name) is only for that count; it is not sent on to analytics or the event log.
    const { item: _item, ...rest } = params
    // The player a search was for is kept in the site's own record only (so the owner can read a visit in order), not sent to analytics.
    // The same goes for the code of a shared plan (only the site's owner reads it, to see whose plan a link was).
    const { player: _player, plan: _plan, ...forAnalytics } = rest
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, ...forAnalytics })
    // The site's own record of the same event (no IP address, no cookie; see eventLog.js).
    logEvent(event, rest)
  } catch {
    /* analytics must never break the app */
  }
}

// A real person leaves a trace on the page: a click, a key, a touch, a scroll or the mouse moving, made by the browser itself (a script that
// only loads the page, as a link scanner does, makes none). The first one on a page is recorded once, so the owner can tell a person who
// looked and left from something that only opened the link. Nothing about the interaction is kept, only that it happened.
let watchingInteraction = false
export function watchInteraction() {
  if (watchingInteraction || typeof window === 'undefined') return
  watchingInteraction = true
  const kinds = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll', 'mousemove']
  const onFirst = (e) => {
    if (e && e.isTrusted === false) return
    kinds.forEach((k) => window.removeEventListener(k, onFirst, true))
    try {
      if (!isInternalTraffic()) logEvent('page_interacted')
    } catch {
      /* analytics must never break the app */
    }
  }
  kinds.forEach((k) => window.addEventListener(k, onFirst, { capture: true, passive: true }))
}
