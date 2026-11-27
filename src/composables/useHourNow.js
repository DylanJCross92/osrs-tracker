import { onBeforeUnmount, onMounted, ref } from 'vue'

const HOUR = 3_600_000

/** The start of the current hour, as a ref that changes once an hour, so things drawn from the time of day move on while a page stays open. */
export function useHourNow() {
  const hour = ref(Math.floor(Date.now() / HOUR) * HOUR)
  let timer = null
  onMounted(() => {
    timer = setInterval(() => {
      const next = Math.floor(Date.now() / HOUR) * HOUR
      if (next !== hour.value) hour.value = next
    }, 30_000)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return hour
}
