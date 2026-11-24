import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { SYNCED_EVENT } from '@/utils/accountData'
import { listSavedPlans } from '@/utils/plannerTools'
import { useRequirements } from '@/composables/useRequirements'
import { useFollowing } from '@/composables/useFollowing'
import { useWatchlist } from '@/composables/useWatchlist'

// What a visitor who is not signed in has built up in this browser, and whether to suggest installing the site to the home screen on an iPhone (Safari does
// not clear an installed app after a week away the way it does for websites).
export function useKeepData() {
  const { questStats, diaryStats } = useRequirements()
  const { following } = useFollowing()

  const { slugs: watched } = useWatchlist()

  const plans = ref(0)
  const inProgress = ref(false)
  const read = () => {
    try {
      plans.value = listSavedPlans().length
      // A plan being worked on that was never saved.
      inProgress.value = (JSON.parse(localStorage.getItem('tickgains-planner-v1') || 'null')?.goals?.length || 0) > 0
    } catch {
      plans.value = 0
      inProgress.value = false
    }
  }
  const onChange = () => read()
  // Saving a plan in this tab does not raise a storage event, so it is looked at again every few seconds (a quick read of the browser's own storage).
  let timer = null
  onMounted(() => {
    read()
    timer = setInterval(read, 2500)
    window.addEventListener(SYNCED_EVENT, onChange)
    window.addEventListener('storage', onChange)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    window.removeEventListener(SYNCED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  })

  const counts = computed(() => ({ plans: plans.value, quests: questStats.value.done, diaries: diaryStats.value.done, following: following.value.length, watching: watched.value.length, inProgress: inProgress.value ? 1 : 0 }))
  const total = computed(() => Object.values(counts.value).reduce((a, b) => a + b, 0))
  /** "4 plans, 6 quests and 2 followed players" */
  const summary = computed(() => {
    const c = counts.value
    const parts = []
    if (c.plans) parts.push(`${c.plans} plan${c.plans === 1 ? '' : 's'}`)
    if (c.quests) parts.push(`${c.quests} quest${c.quests === 1 ? '' : 's'}`)
    if (c.diaries) parts.push(`${c.diaries} diary tier${c.diaries === 1 ? '' : 's'}`)
    if (c.following) parts.push(`${c.following} followed player${c.following === 1 ? '' : 's'}`)
    if (c.watching) parts.push(`${c.watching} watched item${c.watching === 1 ? '' : 's'}`)
    if (c.inProgress && !c.plans) parts.push('a plan in progress')
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || ''
  })

  // An iPhone or iPad in Safari, not yet installed to the home screen.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isApple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
  const standalone = typeof window !== 'undefined' && (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches)
  const suggestInstall = isApple && !standalone

  return { counts, total, summary, suggestInstall }
}
