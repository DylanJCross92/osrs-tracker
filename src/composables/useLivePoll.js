import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Calls `load` every `ms` while the tab is in view, and straight away when the tab comes back into view after being away for a while,
 * so a page left open in the background is up to date the moment it is looked at again. The first load is left to the page.
 */
export function useLivePoll(load, ms = 30_000) {
  let timer = null
  let last = Date.now()
  const run = () => {
    last = Date.now()
    return load()
  }
  const onVisible = () => {
    if (!document.hidden && Date.now() - last > 10_000) run()
  }
  onMounted(() => {
    timer = setInterval(() => !document.hidden && run(), ms)
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })
}
