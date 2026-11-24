import { ref } from 'vue'
import { KEYS, SYNCED_EVENT } from '@/utils/accountData'

// How many hours a day the person plays, from the last time they chose it (on a plan's settings, or in the Smart Planner). New plans start with it, so it
// never goes back to a default of 2. Kept in this browser and, when signed in, in the account (see utils/accountData.js).
export const MIN_PLAY_HOURS = 0.5
export const MAX_PLAY_HOURS = 24
export const DEFAULT_PLAY_HOURS = 2
const KEY = KEYS.plannerPrefs

const clean = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(MAX_PLAY_HOURS, Math.max(MIN_PLAY_HOURS, Math.round(n * 2) / 2)) : null
}
function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    return clean(raw?.hours)
  } catch {
    return null
  }
}

// null until the person has ever chosen one.
const chosen = ref(read())
if (typeof window !== 'undefined') window.addEventListener(SYNCED_EVENT, () => (chosen.value = read()))

/** The hours a new plan starts with: the last choice, else 2. */
export const playHours = () => chosen.value ?? DEFAULT_PLAY_HOURS

export function usePlayHours() {
  /** Remember a choice (on a half hour step, 0.5 to 24). Returns the value kept. */
  function setPlayHours(v) {
    const hours = clean(v)
    if (hours == null || hours === chosen.value) return chosen.value
    chosen.value = hours
    try {
      let other = {}
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) other = raw
      } catch {
        /* none yet */
      }
      localStorage.setItem(KEY, JSON.stringify({ ...other, hours }))
    } catch {
      /* storage unavailable */
    }
    return hours
  }
  return { chosen, playHours, setPlayHours }
}
