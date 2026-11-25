import { ref } from 'vue'
import { KEYS, SYNCED_EVENT } from '@/utils/accountData'
import { mirrorToMain } from '@/utils/profilePrefs'

// What kind of account the person plays, from the last time they chose it (on a plan's settings, in the add-goal window, a skill calculator or the Smart
// Planner): free-to-play or members, and whether it is an ironman. Every planner and calculator starts from it, so nobody is asked again. Kept in this
// browser and, when signed in, in the account with the other planner preferences (see utils/accountData.js and usePlayHours.js, which share the object).
const KEY = KEYS.plannerPrefs

function readPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}
function writePrefs(patch) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), ...patch }))
  } catch {
    /* storage unavailable */
  }
}

// Members and not an ironman until the person says otherwise.
const members = ref(readPrefs().members !== false)
const iron = ref(readPrefs().iron === true)
// Whether the page being looked at is for an ironman: the person's choice, unless a plan that says otherwise is open (see useIronMode in PlannerView).
const ironMode = ref(iron.value)
if (typeof window !== 'undefined') {
  window.addEventListener(SYNCED_EVENT, () => {
    members.value = readPrefs().members !== false
    iron.value = readPrefs().iron === true
    ironMode.value = iron.value
  })
}

/** The account type a new plan or calculator starts with. */
export const membersPref = () => members.value
export const ironPref = () => iron.value
/** True when what is on screen is for an ironman: gp is left out and supplies are things to gather. */
export const ironModeRef = ironMode
/** A plan or page for a different account type than the person's own sets what is shown while it is open; null goes back to the person's choice. */
export function setIronMode(value) {
  ironMode.value = value == null ? iron.value : value === true
}

export function useAccountType() {
  /** Remember a choice (true: members, false: free-to-play). Returns the value kept. */
  function setMembersPref(value) {
    const next = value !== false
    if (next === members.value) return next
    members.value = next
    writePrefs({ members: next })
    mirrorToMain({ members: next })
    return next
  }
  /** Remember whether the account is an ironman. Pages that follow the person's choice change at once. */
  function setIronPref(value) {
    const next = value === true
    if (next === iron.value) return next
    const following = ironMode.value === iron.value
    iron.value = next
    if (following) ironMode.value = next
    writePrefs({ iron: next })
    mirrorToMain({ iron: next })
    return next
  }
  return { members, iron, ironMode, membersPref, ironPref, setMembersPref, setIronPref }
}
