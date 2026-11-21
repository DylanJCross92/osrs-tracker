<template>
  <WatchlistCard v-if="rows.length" :rows="rows" variant="dash" class="card dash-card" />
  <section v-else-if="!slugs.length" class="card dash-card" aria-labelledby="dw-watch-h">
    <h2 id="dw-watch-h">Watchlist</h2>
    <p class="dash-empty">Watch Grand Exchange items to see their prices and changes here. Open any item and press Watch.</p>
    <RouterLink class="btn btn-ghost" :to="{ name: 'items' }">Browse GE prices</RouterLink>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import WatchlistCard from '@/components/WatchlistCard.vue'
import { geApi } from '@/api/ge'
import { rowsFromIndex } from '@/utils/geFormat'
import { useWatchlist } from '@/composables/useWatchlist'

// The dashboard's watchlist: loads just the watched items' prices (newest watched first), and shows a short prompt until there is one.
const { slugs } = useWatchlist()
const rows = ref([])
let ticket = 0

async function load() {
  const mine = ++ticket
  const list = [...slugs.value].reverse()
  if (!list.length) {
    rows.value = []
    return
  }
  try {
    const res = await geApi.watch(list)
    if (mine !== ticket) return
    const found = rowsFromIndex(res.items)
    const order = new Map(list.map((s, i) => [s, i]))
    rows.value = found.sort((a, b) => order.get(a.slug) - order.get(b.slug))
  } catch {
    /* the card stays as it was; prices come back with the next change or visit */
  }
}
onMounted(load)
watch(slugs, load, { deep: true })
</script>
