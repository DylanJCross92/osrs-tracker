import { computed, ref, watch } from 'vue'
import { goalsApi } from '@/api/goals'
import { ApiError } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()
const ownedBy = (profiles, name) => profiles.find((p) => same(p.username, name) || same(p.displayName, name))?.username || ''

/**
 * Showing a whole plan as the goal on your profile. `username` is a ref to the player the plan is for, `planId` a ref to the plan's
 * id. Only works when you are signed in and own that profile. One plan is on a profile at a time.
 * { available, ready, isPublic, other, busy, publish(plan), unpublish() }
 */
export function useProfilePlan(username, planId) {
  const { loggedIn, profiles } = useAuth()
  const owned = computed(() => (loggedIn.value ? ownedBy(profiles.value, username.value) : ''))
  const available = computed(() => !!owned.value)
  // The plan the profile shows right now: { planId, name, ... } or null.
  const plan = ref(null)
  const busy = ref(false)
  // True once the profile's current plan has been read, so a new plan is never put on top of one that was not seen yet.
  const ready = ref(false)

  watch(
    owned,
    async (name) => {
      plan.value = null
      ready.value = false
      if (!name) return
      try {
        plan.value = (await goalsApi.list(name)).plan
        ready.value = true
      } catch {
        plan.value = null
      }
    },
    { immediate: true },
  )

  const isPublic = computed(() => !!plan.value && !!planId.value && plan.value.planId === planId.value)
  // The name of a different plan that is on the profile (turning this one on replaces it), or ''.
  const other = computed(() => (plan.value && !isPublic.value ? plan.value.name : ''))

  /** Shows this plan ({ planId, name, goals: [{ skill, targetXp }] }) on the profile, or refreshes it. Throws a readable Error on failure. */
  async function publish(payload) {
    if (!available.value) return
    busy.value = true
    try {
      plan.value = (await goalsApi.setPlan(owned.value, payload)).plan
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : 'Could not update your profile. Please try again.')
    } finally {
      busy.value = false
    }
  }
  async function unpublish() {
    if (!available.value) return
    busy.value = true
    try {
      plan.value = (await goalsApi.clearPlan(owned.value)).plan
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : 'Could not update your profile. Please try again.')
    } finally {
      busy.value = false
    }
  }

  return { available, ready, isPublic, other, busy, publish, unpublish }
}

/** A saved plan was deleted: if it was the one on its player's profile, take it off the profile too. Never throws. */
export async function dropProfilePlan(planId, rsn) {
  try {
    const { loggedIn, profiles } = useAuth()
    const name = loggedIn.value ? ownedBy(profiles.value, rsn) : ''
    if (!name) return
    const { plan } = await goalsApi.list(name)
    if (plan && plan.planId === planId) await goalsApi.clearPlan(name)
  } catch {
    // The profile just keeps showing it until the next change.
  }
}

/**
 * For the list of saved plans: which one is on its player's profile, and a way to show or remove one from there. `plans` is a ref
 * to the saved plans. A plan is only offered when you are signed in and own the profile it is for.
 * { available(id), isOn(id), busy, toggle(id) }
 */
export function useProfilePlansFor(plans) {
  const { loggedIn, profiles } = useAuth()
  const { showToast } = useToast()
  // The plan each owned profile shows right now, by lower-case profile name: { planId, name } or null.
  const shown = ref({})
  const busy = ref(false)
  const find = (id) => plans.value.find((p) => p.id === id) || null
  const ownerOf = (plan) => (plan && loggedIn.value ? ownedBy(profiles.value, plan.player?.rsn) : '')
  const key = (name) => String(name).toLowerCase()

  async function load() {
    const names = new Set(plans.value.map(ownerOf).filter(Boolean))
    for (const name of names) {
      if (key(name) in shown.value) continue
      shown.value = { ...shown.value, [key(name)]: null }
      try {
        shown.value = { ...shown.value, [key(name)]: (await goalsApi.list(name)).plan }
      } catch {
        // Not shown as on until it can be read.
      }
    }
  }
  watch([plans, profiles, loggedIn], load, { immediate: true })

  const available = (id) => !!ownerOf(find(id))
  const isOn = (id) => {
    const owner = ownerOf(find(id))
    return !!owner && shown.value[key(owner)]?.planId === id
  }

  /** Shows the plan on its profile (replacing whichever plan was there), or takes it off if it already is. */
  async function toggle(id) {
    const plan = find(id)
    const owner = ownerOf(plan)
    if (!owner || busy.value) return
    busy.value = true
    try {
      if (isOn(id)) {
        shown.value = { ...shown.value, [key(owner)]: (await goalsApi.clearPlan(owner)).plan }
        showToast('Removed from your profile.')
      } else {
        const payload = { planId: plan.id, name: plan.name, goals: plan.goals.map((g) => ({ skill: g.skill, targetXp: g.targetXp })) }
        shown.value = { ...shown.value, [key(owner)]: (await goalsApi.setPlan(owner, payload)).plan }
        showToast(`"${plan.name}" is now the goal on your profile.`)
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update your profile. Please try again.', 4000)
    } finally {
      busy.value = false
    }
  }

  return { available, isOn, busy, toggle }
}
