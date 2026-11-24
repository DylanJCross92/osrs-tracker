import { ref } from 'vue'
import { KEYS, SYNCED_EVENT } from '@/utils/accountData'

// Free-to-play or members, from the last time the person chose it (on a plan's settings, in the add-goal window, a skill calculator or the Smart
// Planner). Every planner and calculator starts from it, so a free-to-play player is not asked again. Kept in this browser and, when signed in, in the
// account with the other planner preferences (see utils/accountData.js and usePlayHours.js, which shares the same stored object).
const KEY = KEYS.plannerPrefs

function readPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

// Members until the person says otherwise.
const members = ref(readPrefs().members !== false)
if (typeof window !== 'undefined') window.addEventListener(SYNCED_EVENT, () => (members.value = readPrefs().members !== false))

/** The account type a new plan or calculator starts with. */
export const membersPref = () => members.value

export function useAccountType() {
  /** Remember a choice (true: members, false: free-to-play). Returns the value kept. */
  function setMembersPref(value) {
    const next = value !== false
    if (next === members.value) return next
    members.value = next
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), members: next }))
    } catch {
      /* storage unavailable */
    }
    return next
  }
  return { members, membersPref, setMembersPref }
}
