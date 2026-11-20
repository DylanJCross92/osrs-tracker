import { onBeforeUnmount, onMounted } from 'vue'
import { priceStatus, usePrices } from '@/utils/priceBook'
import { PRICE_NAMES } from '@/utils/priceNames'

/**
 * For a page that shows gp: loads the Grand Exchange prices the planners use when it opens, keeps them fresh while it is open, and
 * returns their status ({ loaded, updatedAt, stale }). Without prices everything keeps using the saved figures.
 */
export function useLivePrices() {
  let stop = null
  onMounted(() => {
    stop = usePrices(PRICE_NAMES)
  })
  onBeforeUnmount(() => stop?.())
  return { priceStatus }
}
