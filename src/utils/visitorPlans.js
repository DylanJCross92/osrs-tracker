import { isInternalTraffic } from '@/utils/analytics'
import { getVisitorId } from '@/utils/visitorId'
import { statsApi } from '@/api/stats'

// For a visitor who is not signed in, the plans saved in this browser are copied to the site owner's records under the visitor's
// random number (see visitorId.js), so the Player plans page can show what is being planned by people without an account. Signed in,
// the plans already sync to the account. Nothing is sent when the browser asks not to be tracked, and only when the plans changed.
const PLANS = 'tickgains-saved-plans-v1'
const PLANNER = 'tickgains-planner-v1'
const SENT = 'tickgains-vplans-sent'
const EVERY_MS = 15_000

const read = (key) => {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

/** A short fingerprint of a string (it only has to tell "changed" from "same"). */
export function fingerprint(text) {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return `${text.length}:${h.toString(36)}`
}

/** What to send, or null when there is nothing new. `env` is for tests: { read, sent, vid }. */
export function planPayload(env = {}) {
  const plans = (env.read || read)(PLANS)
  const planner = (env.read || read)(PLANNER)
  const print = fingerprint(`${plans}|${planner}`)
  const last = env.sent ?? read(SENT)
  if (print === last || (!plans && !planner && !last)) return null
  let parsedPlans = []
  let parsedPlanner = null
  try {
    parsedPlans = plans ? JSON.parse(plans) : []
    parsedPlanner = planner ? JSON.parse(planner) : null
  } catch {
    return null
  }
  if (!Array.isArray(parsedPlans)) parsedPlans = []
  return { print, plans: parsedPlans.slice(0, 30), planner: parsedPlanner && typeof parsedPlanner === 'object' ? parsedPlanner : null }
}

let timer = 0
let busy = false
async function check(signedIn) {
  if (busy || signedIn() || isInternalTraffic()) return
  const vid = getVisitorId()
  if (!vid) return
  const payload = planPayload()
  if (!payload) return
  busy = true
  try {
    await statsApi.visitorPlans(vid, payload.plans, payload.planner)
    try {
      localStorage.setItem(SENT, payload.print)
    } catch {
      /* without storage it is simply sent again next time */
    }
  } catch {
    /* tried again at the next check */
  } finally {
    busy = false
  }
}

/** Starts watching: once soon after load, then every 15 seconds while the page is open, and when it is hidden. */
export function startVisitorPlans(signedIn) {
  if (timer || typeof window === 'undefined') return
  setTimeout(() => check(signedIn), 4000)
  timer = setInterval(() => document.visibilityState === 'visible' && check(signedIn), EVERY_MS)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && check(signedIn))
}
