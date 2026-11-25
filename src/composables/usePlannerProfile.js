import { ref, watch } from 'vue'
import { cleanProfile, DEFAULT_PROFILE } from '@/utils/smartPlanner'
import { KEYS, SYNCED_EVENT } from '@/utils/accountData'
import { playHours, usePlayHours } from '@/composables/usePlayHours'
import { buildPref, ironKindPref, ironPref, membersPref, useAccountType } from '@/composables/useAccountType'

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
// Never answered: the hours start as the last amount chosen on a plan's settings.
// The account kind (members, ironman and its kind, the build) is always what was chosen last anywhere on the site, so the Smart Planner never disagrees with
// the account setup above it.
const accountNow = () => ({ members: membersPref(), iron: ironPref(), build: buildPref(), ironKind: ironKindPref() })
const profile = ref(cleanProfile(saved ? { ...saved, ...accountNow() } : { hours: Math.min(12, playHours()), ...accountNow() }))
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

// Another page changed the account kind: the answers follow.
const account = useAccountType()
watch([account.members, account.iron, account.build, account.ironKind], () => {
  const next = cleanProfile({ ...profile.value, ...accountNow() })
  if (JSON.stringify(next) !== JSON.stringify(profile.value)) profile.value = next
})

export function usePlannerProfile() {
  /** Change one answer (or several). The first answer marks the profile as the player's own. */
  function answer(patch) {
    // The hours are the person's play time everywhere, so they are remembered for the Account Planner too.
    if (patch.hours != null) usePlayHours().setPlayHours(patch.hours)
    // So is free-to-play or members: every planner and calculator starts from it.
    if (patch.members != null) useAccountType().setMembersPref(patch.members)
    if (patch.iron != null) useAccountType().setIronPref(patch.iron)
    if (patch.build != null) useAccountType().setBuildPref(patch.build)
    if (patch.ironKind != null) useAccountType().setIronKindPref(patch.ironKind)
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
