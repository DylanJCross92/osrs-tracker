import { ref } from 'vue'
import { ApiError } from '@/api/client'

/** One piece of the statistics page: { data, error, load } where load(...args) fetches again and keeps the old data on screen meanwhile. */
export function useStatsLoad(fetcher, failure = 'Could not load this.') {
  const data = ref(null)
  const error = ref('')
  let ticket = 0
  async function load(...args) {
    const mine = ++ticket
    error.value = ''
    try {
      const res = await fetcher(...args)
      if (mine === ticket) data.value = res
    } catch (err) {
      if (mine !== ticket) return
      data.value = null
      error.value = err instanceof ApiError ? err.message : failure
    }
  }
  return { data, error, load }
}
