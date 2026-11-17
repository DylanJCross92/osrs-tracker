import { BASE_URL } from '@/api/client'

// The site's own record of product events (see server/src/utils/events.js). Events are gathered for a few seconds and sent
// together, so a busy page makes one request, not dozens. Nothing is stored in the browser: no cookie, no id. Who the person
// is (when signed in) is worked out on the server from the sign-in session that is already there.
const FLUSH_MS = 3000
const BATCH = 20

let queue = []
let timer = 0
let hooked = false

// A browser that asks not to be tracked is still counted, but never against an account.
const askedNotToTrack = () => {
  try {
    return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true
  } catch {
    return false
  }
}

// Only flat primitive details are sent; the server checks them again.
function plain(params) {
  const out = {}
  for (const [k, v] of Object.entries(params || {})) if (['string', 'number', 'boolean'].includes(typeof v)) out[k] = v
  return out
}

export function logEvent(name, params = {}) {
  if (typeof fetch !== 'function' || typeof document === 'undefined') return
  queue.push({ name, props: plain(params) })
  if (!hooked) {
    hooked = true
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushEvents())
    window.addEventListener('pagehide', flushEvents)
  }
  if (queue.length >= BATCH) flushEvents()
  else if (!timer) timer = setTimeout(flushEvents, FLUSH_MS)
}

export function flushEvents() {
  clearTimeout(timer)
  timer = 0
  while (queue.length) {
    const events = queue.slice(0, BATCH)
    queue = queue.slice(BATCH)
    // keepalive lets the last batch finish while the page is closing.
    fetch(`${BASE_URL}/stats/events`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, anon: askedNotToTrack() }),
    }).catch(() => {})
  }
}
