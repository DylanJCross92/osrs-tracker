import { computed } from 'vue'
import { ApiError } from '@/api/client'
import { followsApi } from '@/api/follows'
import { useAuth } from '@/composables/useAuth'
import { useRivals } from '@/composables/useRivals'
import { useToast } from '@/composables/useToast'
import { askSignIn } from '@/composables/useSignInPrompt'
import { track } from '@/utils/analytics'

// Following a player. The list is the same one that used to be called "rivals": signed out it lives in this browser,
// signed in it is kept on the account too, which is what lets the site tell you when a player you follow hits a 99.
export function useFollowing() {
  const { rivals, isRival, addRival, removeRival } = useRivals()
  const { loggedIn } = useAuth()
  const { showToast } = useToast()

  const following = computed(() => rivals.value)

  /**
   * Follow a player. Returns true when they are followed afterwards, false when it did not work, and null when nothing happened because the visitor is not
   * signed in (following needs an account: they are asked to create one or log in).
   */
  async function follow(name) {
    const n = String(name || '').trim()
    if (!n) return false
    if (!loggedIn.value) {
      askSignIn({
        title: 'Create a free account to follow players',
        text: `Following ${n} needs a TickGains account. It is free and takes a minute.`,
        points: ['See their gains and milestones on your home page', 'Get a notification when they reach a 99', 'Keep your list on every device'],
      })
      track('follow_needs_account')
      return null
    }
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

  // Unfollowing is always allowed (including for a list kept from before following needed an account). Returns true / false, or null when an account is needed.
  const toggle = (name) => (isRival(name) ? unfollow(name).then(() => false) : follow(name))

  return { following, isFollowing: isRival, follow, unfollow, toggle }
}
