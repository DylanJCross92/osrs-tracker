import { sharedPlansApi } from '@/api/sharedPlans'
import { gameDay } from '@/utils/gameDay'

// Tells the server that a public plan was opened ('view') or used as a starting point ('use'). Only a count is kept, never
// who it was. This browser remembers what it already reported so refreshing the page or using the plan twice is not counted
// twice: a view counts once a day, a use once ever.
const KEY = 'tickgains-plan-events-v1'
const MAX_REMEMBERED = 200

function read() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}')
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {}
  } catch {
    return {}
  }
}

/** Whether this browser still owes the server this event; remembers it as reported when it does. */
export function claimPlanEvent(slug, type, now = Date.now()) {
  if (!slug || (type !== 'view' && type !== 'use')) return false
  const all = read()
  const seen = all[slug] || {}
  const today = gameDay(now)
  if (type === 'view' ? seen.view === today : seen.use) return false
  all[slug] = { ...seen, ...(type === 'view' ? { view: today } : { use: true }), at: now }
  const keep = Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0)).slice(0, MAX_REMEMBERED)
  const trimmed = {}
  for (const k of keep) trimmed[k] = all[k]
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch {
    /* storage unavailable: it may be counted again, which is harmless */
  }
  return true
}

export function recordPlanEvent(slug, type) {
  if (!claimPlanEvent(slug, type)) return
  sharedPlansApi.event(slug, type).catch(() => {})
}
