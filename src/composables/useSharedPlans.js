import { ref, watch } from 'vue'
import { sharedPlansApi } from '@/api/sharedPlans'
import { useAuth } from '@/composables/useAuth'
import { sharePayload } from '@/utils/plannerTools'

// The signed-in person's public plans. Plans are private until shared here; turning sharing off removes the link.
const shares = ref([])
const loaded = ref(false)
let started = false

async function load() {
  try {
    shares.value = (await sharedPlansApi.mine()).shares
  } catch {
    shares.value = []
  } finally {
    loaded.value = true
  }
}

export function useSharedPlans() {
  const { loggedIn } = useAuth()
  if (!started) {
    started = true
    watch(
      loggedIn,
      (on) => {
        if (on) load()
        else {
          shares.value = []
          loaded.value = false
        }
      },
      { immediate: true },
    )
  }

  const shareFor = (planId) => shares.value.find((s) => s.planId === planId) || null

  /** Makes a saved plan public, or refreshes its public copy. mode: 'static' | 'live'. Returns the share. */
  async function share(saved, mode) {
    const { share: s } = await sharedPlansApi.share(sharePayload(saved, mode))
    shares.value = [s, ...shares.value.filter((x) => x.planId !== s.planId)]
    return s
  }
  async function stop(slug) {
    await sharedPlansApi.stop(slug)
    shares.value = shares.value.filter((x) => x.slug !== slug)
  }

  return { shares, loaded, shareFor, share, stop, reload: load }
}
