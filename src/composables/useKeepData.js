import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { SYNCED_EVENT } from '@/utils/accountData'
import { listSavedPlans } from '@/utils/plannerTools'
import { useRequirements } from '@/composables/useRequirements'
import { useFollowing } from '@/composables/useFollowing'

// What a visitor who is not signed in has built up in this browser, and the ways to make it last: ask the browser not to clear it, and (on an iPhone)
// install the site to the home screen, which Safari does not clear after a week away the way it does for websites.
export function useKeepData() {
  const { questStats, diaryStats } = useRequirements()
  const { following } = useFollowing()

  const plans = ref(0)
  const read = () => {
    try {
      plans.value = listSavedPlans().length
    } catch {
      plans.value = 0
    }
  }
  const onChange = () => read()
  onMounted(() => {
    read()
    window.addEventListener(SYNCED_EVENT, onChange)
    window.addEventListener('storage', onChange)
    checkPersisted()
  })
  onBeforeUnmount(() => {
    window.removeEventListener(SYNCED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  })

  const counts = computed(() => ({ plans: plans.value, quests: questStats.value.done, diaries: diaryStats.value.done, following: following.value.length }))
  const total = computed(() => Object.values(counts.value).reduce((a, b) => a + b, 0))
  /** "4 plans, 6 quests and 2 followed players" */
  const summary = computed(() => {
    const c = counts.value
    const parts = []
    if (c.plans) parts.push(`${c.plans} plan${c.plans === 1 ? '' : 's'}`)
    if (c.quests) parts.push(`${c.quests} quest${c.quests === 1 ? '' : 's'}`)
    if (c.diaries) parts.push(`${c.diaries} diary tier${c.diaries === 1 ? '' : 's'}`)
    if (c.following) parts.push(`${c.following} followed player${c.following === 1 ? '' : 's'}`)
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || ''
  })

  // Asking the browser to keep this site's data. Some browsers ask the person, so it is only done when they press the button.
  const canPersist = typeof navigator !== 'undefined' && !!navigator.storage?.persist
  const persisted = ref(false)
  async function checkPersisted() {
    try {
      persisted.value = !!(await navigator.storage?.persisted?.())
    } catch {
      persisted.value = false
    }
  }
  /** Returns true when the browser agreed to keep the data. */
  async function keepOnDevice() {
    try {
      persisted.value = !!(await navigator.storage.persist())
    } catch {
      persisted.value = false
    }
    return persisted.value
  }

  // An iPhone or iPad in Safari, not yet installed to the home screen.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isApple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
  const standalone = typeof window !== 'undefined' && (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches)
  const suggestInstall = isApple && !standalone

  return { counts, total, summary, canPersist, persisted, keepOnDevice, suggestInstall }
}
