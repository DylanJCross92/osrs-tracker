import { computed } from 'vue'
import { ApiError } from '@/api/client'
import { followsApi } from '@/api/follows'
import { useAuth } from '@/composables/useAuth'
import { useRivals } from '@/composables/useRivals'
import { useToast } from '@/composables/useToast'

// Following a player. The list is the same one that used to be called "rivals": signed out it lives in this browser,
// signed in it is kept on the account too, which is what lets the site tell you when a player you follow hits a 99.
export function useFollowing() {
  const { rivals, isRival, addRival, removeRival } = useRivals()
  const { loggedIn } = useAuth()
  const { showToast } = useToast()

  const following = computed(() => rivals.value)

  /** Follow a player. Returns true when they are followed afterwards. */
  async function follow(name) {
    const n = String(name || '').trim()
    if (!n) return false
    if (!isRival(n)) addRival(n)
    if (loggedIn.value) {
      try {
        await followsApi.follow(n)
      } catch (err) {
        removeRival(n)
        showToast(err instanceof ApiError ? err.message : 'Could not follow that player right now.')
        return false
      }
    }
    return true
  }

  async function unfollow(name) {
    removeRival(name)
    if (loggedIn.value) {
      try {
        await followsApi.unfollow(name)
      } catch {
        // The browser copy is already updated; the account copy catches up on the next sign-in.
      }
    }
  }

  const toggle = (name) => (isRival(name) ? unfollow(name).then(() => false) : follow(name))

  return { following, isFollowing: isRival, follow, unfollow, toggle }
}
