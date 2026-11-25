import { ref } from 'vue'
import { SYNCED_EVENT } from '@/utils/accountData'
import { mainProfileKey, plainSettings, profileEntry, profileKey, saveProfileEntry } from '@/utils/profilePrefs'
import { useAccountType } from '@/composables/useAccountType'
import { usePlayHours } from '@/composables/usePlayHours'

// The settings of each RuneScape profile the account owns: members or free-to-play, ironman (and which kind), build, and hours played a day. They carry across
// every feature: the main profile's settings are what planners and calculators start from, and the planner uses a profile's own when that
// profile is loaded. Saved with the account's other planner preferences (see utils/profilePrefs.js).
const version = ref(0)
const bump = () => version.value++
if (typeof window !== 'undefined') window.addEventListener(SYNCED_EVENT, bump)

/** { members, iron, build, ironKind, hours } for a profile: what was saved for it, else what the plain preferences say. */
export function settingsOf(name) {
  void version.value
  return { ...plainSettings(), ...(profileEntry(name) || {}) }
}

export function useProfileSettings() {
  const type = useAccountType()
  const hours = usePlayHours()

  const isMain = (name) => !!name && profileKey(name) === mainProfileKey()

  // The plain preferences everything else reads follow the main profile.
  function applyToPlain(s) {
    type.setMembersPref(s.members)
    type.setIronPref(s.iron)
    type.setBuildPref(s.build)
    type.setIronKindPref(s.ironKind)
    hours.setPlayHours(s.hours)
  }

  /** Change some of a profile's settings. The main profile's also become what new plans and calculators start from. */
  function set(name, patch) {
    const entry = saveProfileEntry(name, patch)
    if (!entry) return null
    if (isMain(name)) applyToPlain({ ...plainSettings(), ...entry })
    bump()
    return entry
  }

  /** Gives every profile in the list settings of its own (the main one starts from the current plain preferences), once. */
  function seed(profiles) {
    let changed = false
    for (const p of profiles) {
      const name = p.displayName || p.username
      if (profileEntry(name)) continue
      saveProfileEntry(name, plainSettings())
      changed = true
    }
    if (changed) bump()
  }

  /** The profile just became the main one: its settings are what everything starts from now. */
  function becameMain(name) {
    applyToPlain({ ...plainSettings(), ...(profileEntry(name) || {}) })
    bump()
  }

  return { settingsOf, set, seed, becameMain, isMain }
}
