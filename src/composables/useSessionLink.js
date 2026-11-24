import { collectBackup, encodeBackup } from '@/utils/guestBackup'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

// "Copy link to save session": one link that holds everything this browser keeps (plans, quests, diaries, followed players, watched items, settings).
// Opening it anywhere restores all of it (see views/RestoreView.vue). The data is in the part of the address after the #, which is never sent to the site.
const LONG = 6000

export function useSessionLink() {
  const { showToast } = useToast()

  /** The link for what is in this browser now, or '' when nothing is saved yet. */
  async function sessionLink() {
    const backup = collectBackup()
    if (!Object.keys(backup.data).length) return ''
    return `${window.location.origin}/restore#${await encodeBackup(backup)}`
  }

  async function copySessionLink(place = 'dashboard') {
    const link = await sessionLink()
    if (!link) {
      showToast('Nothing is saved in this browser yet. Make a plan or tick some quests first.')
      return false
    }
    try {
      await navigator.clipboard.writeText(link)
      showToast(link.length > LONG ? 'Link copied. It is long, so some apps may cut it off: open it to check.' : 'Link copied. Open it on any device to bring everything back.')
      track('session_link_copy', { place, long: link.length > LONG })
      return true
    } catch {
      // No clipboard access (an insecure page, a blocked permission): let the person copy it by hand.
      window.prompt('Copy this link to save your session:', link)
      return false
    }
  }
  return { sessionLink, copySessionLink }
}
