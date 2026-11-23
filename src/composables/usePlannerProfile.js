import { ref, watch } from 'vue'
import { cleanProfile, DEFAULT_PROFILE } from '@/utils/smartPlanner'
import { KEYS, SYNCED_EVENT } from '@/utils/accountData'

// The answers to the Smart Planner's questions. Kept in this browser and, when signed in, in the account (see utils/accountData.js), so a
// returning player finds them as they left them. `touched` is whether anything was ever answered (until then the steps are for a typical player).
const KEY = KEYS.plannerProfile

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

const saved = read()
const profile = ref(cleanProfile(saved))
const touched = ref(!!saved && Object.keys(saved).length > 0)

watch(
  profile,
  (v) => {
    if (!touched.value) return
    try {
      localStorage.setItem(KEY, JSON.stringify(v))
    } catch {
      /* storage unavailable */
    }
  },
  { deep: true },
)
// Another device changed them (account sync): pick that up.
if (typeof window !== 'undefined') {
  window.addEventListener(SYNCED_EVENT, () => {
    const next = read()
    if (next && Object.keys(next).length) {
      profile.value = cleanProfile(next)
      touched.value = true
    }
  })
}

export function usePlannerProfile() {
  /** Change one answer (or several). The first answer marks the profile as the player's own. */
  function answer(patch) {
    profile.value = cleanProfile({ ...profile.value, ...patch })
    touched.value = true
  }
  function reset() {
    profile.value = { ...DEFAULT_PROFILE }
    touched.value = false
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* storage unavailable */
    }
  }
  return { profile, touched, answer, reset }
}
