<template>
  <PageSkeleton v-if="loading" kind="items" />
  <p v-else-if="error" class="card empty-hint">{{ error }}</p>
  <ItemsBrowse v-else-if="browsing" :rows="rows" :updated-at="updatedAt" :stale="stale" />
  <div v-else class="gx gxh">
    <p v-if="stale" class="gx-stale" role="status">Prices are a little behind right now. They update every few minutes.</p>

    <section class="gxh-hero">
      <p class="gxh-eyebrow">OSRS Grand Exchange</p>
      <h1>Grand Exchange prices</h1>
      <p class="gxh-tag">Search any item, spot what is moving and flip smarter.</p>
      <ItemSearch :rows="rows" size="hero" :placeholder="`Search ${rows.length.toLocaleString('en-US')} items`" autofocus @pick="goItem" @submit="goBrowse" />
      <p class="gxh-try">
        <span>Popular</span>
        <RouterLink v-for="r in popular" :key="r.id" :to="{ name: 'item', params: { slug: r.slug } }" class="gxh-chip" @click="track('items_item_click', { source: 'popular' })">{{ r.name }}</RouterLink>
      </p>
    </section>

    <ItemTicker :rows="tickerRows" />

    <WatchlistCard v-if="watched.length" class="gxh-watch" :rows="watched" variant="ge" />

    <div class="gx-seg gxh-seg" role="group" aria-label="Time range">
      <button type="button" :class="{ on: period === 'day' }" :aria-pressed="period === 'day'" @click="setPeriod('day')">Today</button>
      <button type="button" :class="{ on: period === 'week' }" :aria-pressed="period === 'week'" @click="setPeriod('week')">This week</button>
    </div>

    <div class="gxh-grid">
      <TrendCard class="gxh-left" kind="rise" :title="period === 'day' ? 'Heating up' : 'Climbing this week'" :subtitle="period === 'day' ? 'Biggest rises since yesterday' : 'Biggest rises over 7 days'" :rows="trends.risers" :metric="changeMetric" :period="period" @open="opened('risers')" />
      <TrendCard class="gxh-mid" kind="traded" :title="period === 'day' ? 'Most traded' : 'Biggest markets'" :subtitle="period === 'day' ? 'Items bought and sold most yesterday' : 'Most coins changing hands in a day'" :rows="trends.traded" :metric="tradedMetric" :period="period" @open="opened('traded')" />
      <TrendCard class="gxh-right" kind="fall" :title="period === 'day' ? 'Cooling off' : 'Sliding this week'" :subtitle="period === 'day' ? 'Biggest drops since yesterday' : 'Biggest drops over 7 days'" :rows="trends.fallers" :metric="changeMetric" :period="period" @open="opened('fallers')" />
    </div>

    <div class="gxh-browse">
      <button type="button" class="btn btn-primary" @click="goBrowse('')">Browse all {{ rows.length.toLocaleString('en-US') }} items</button>
      <span class="gx-updated">Prices from the OSRS Wiki, updated {{ ago(updatedAt) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageSkeleton from '@/components/PageSkeleton.vue'
import ItemsBrowse from '@/components/ItemsBrowse.vue'
import ItemSearch from '@/components/ItemSearch.vue'
import ItemTicker from '@/components/ItemTicker.vue'
import TrendCard from '@/components/TrendCard.vue'
import WatchlistCard from '@/components/WatchlistCard.vue'
import { useWatchlist } from '@/composables/useWatchlist'
import { geApi } from '@/api/ge'
import { ApiError } from '@/api/client'
import { track } from '@/utils/analytics'
import { ago } from '@/components/admin/stats/statsFormat'
import { gpAxis, pctText, rowsFromIndex } from '@/utils/geFormat'
import { trending } from '@/utils/geTrending'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({
  title: 'OSRS Grand Exchange Prices and Trends',
  description: 'Live Old School RuneScape Grand Exchange prices for every tradeable item, with price history, trends, buy limits and flipping margins after tax.',
  path: '/items',
})

const route = useRoute()
const router = useRouter()

const rows = ref([])
const updatedAt = ref('')
const stale = ref(false)
const loading = ref(true)
const error = ref('')
const period = ref('day')

// Any of these in the address means the full table is open; the plain address is the home view.
const browsing = computed(() => ['browse', 'q', 'show', 'sort', 'dir'].some((k) => k in route.query))

const trends = computed(() => trending(rows.value, period.value, 8))
const tickerRows = computed(() => trending(rows.value, 'day', 24).traded)
const popular = computed(() => trending(rows.value, 'day', 6).traded)
// The items you watch, newest first, with the same prices as the rest of the page.
const { slugs: watchedSlugs } = useWatchlist()
const watched = computed(() => {
  const bySlug = new Map(rows.value.map((r) => [r.slug, r]))
  return [...watchedSlugs.value].reverse().map((s) => bySlug.get(s)).filter(Boolean)
})

const changeMetric = (r) => {
  const p = period.value === 'week' ? r.change7 : r.change1
  return { text: pctText(p), tone: p > 0 ? 'up' : p < 0 ? 'down' : 'flat' }
}
const tradedMetric = (r) => (period.value === 'week' ? { text: `${gpAxis((r.volume || 0) * (r.price || 0))} gp`, tone: 'flat' } : { text: `${gpAxis(r.volume || 0)} traded`, tone: 'flat' })

let ticket = 0
async function load() {
  const mine = ++ticket
  try {
    const res = await geApi.index()
    if (mine !== ticket) return
    rows.value = rowsFromIndex(res.items)
    updatedAt.value = res.updatedAt || ''
    stale.value = !!res.stale
    error.value = ''
  } catch (err) {
    if (mine !== ticket) return
    if (!rows.value.length) error.value = err instanceof ApiError && err.status === 503 ? 'Prices are not available right now. Try again in a minute.' : 'Could not load the prices.'
  } finally {
    if (mine === ticket) loading.value = false
  }
}

function goItem(r) {
  track('items_item_click', { source: 'search' })
  router.push({ name: 'item', params: { slug: r.slug } })
}
function goBrowse(q) {
  router.push({ name: 'items', query: q ? { browse: '1', q } : { browse: '1' } })
}
function setPeriod(p) {
  if (period.value === p) return
  period.value = p
  track('items_period', { period: p })
}
const opened = (list) => track('items_item_click', { source: list })

let refreshTimer = null
onMounted(() => {
  track('items_view')
  load()
  // Prices change every few minutes; a page left open catches up quietly.
  refreshTimer = setInterval(load, 5 * 60_000)
})
onBeforeUnmount(() => clearInterval(refreshTimer))
</script>
