<template>
  <div class="gx gx-browse">
    <header class="pgh gx-pgh">
      <div class="pgh-title">
        <RouterLink :to="{ name: 'items' }" class="gx-back">← GE Prices</RouterLink>
        <h1>All items</h1>
        <p class="pgh-sub">Every tradeable item, sorted any way you like.</p>
      </div>
      <div class="pgh-actions"><span class="gx-updated">{{ rows.length.toLocaleString('en-US') }} items · updated {{ ago(updatedAt) }}</span></div>
    </header>

    <section class="gxi-card gxb-board">
      <div class="gxb-tools">
        <div class="gxs is-compact gxb-field">
          <div class="gxs-box">
            <svg class="gxs-ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input v-model.trim="query" class="gxs-input" type="search" placeholder="Filter items" aria-label="Filter items" autocomplete="off" data-1p-ignore />
            <button v-if="query" type="button" class="gxs-clear" aria-label="Clear the filter" @click="query = ''">×</button>
          </div>
        </div>
        <div class="gx-seg" role="group" aria-label="Which items">
          <button v-for="m in memberChoices" :key="m.key" type="button" :class="{ on: members === m.key }" :aria-pressed="members === m.key" @click="members = m.key">{{ m.label }}</button>
        </div>
      </div>

      <p v-if="stale" class="gx-stale" role="status">Prices are a little behind right now. They update every few minutes.</p>
      <p v-if="!shown.length" class="empty-hint">{{ query ? `No item matches "${query}".` : 'Nothing to show here.' }}</p>
      <div v-else class="gx-scroll">
        <table class="planner-table gx-table">
          <thead>
            <tr>
              <th v-for="c in columns" :key="c.key" :class="[c.num ? 'num' : '', c.hide ? 'hide-sm' : '']" :aria-sort="sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="gx-sort" :title="c.tip" @click="sortBy(c.key)">{{ c.label }}<span v-if="sortKey === c.key" aria-hidden="true">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span></button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in shown" :key="r.id">
              <td>
                <RouterLink class="gx-item" :to="{ name: 'item', params: { slug: r.slug } }" @click="track('items_item_click', { source: 'browse' })">
                  <img :src="itemImage(r.icon, r.name)" alt="" width="24" height="24" loading="lazy" @error="hideImage" />
                  <span>{{ r.name }}<small v-if="r.members" class="gx-badge" title="Members only">M</small></span>
                </RouterLink>
              </td>
              <td class="num"><b>{{ gpText(r.price) }}</b></td>
              <td class="num hide-sm" :class="changeClass(r.change1)">{{ pctText(r.change1) }}</td>
              <td class="num" :class="changeClass(r.change7)">{{ pctText(r.change7) }}</td>
              <td class="num hide-sm" :class="changeClass(r.change30)">{{ pctText(r.change30) }}</td>
              <td class="num hide-sm">{{ r.volume ? gpText(r.volume) : '-' }}</td>
              <td class="num hide-sm">{{ r.limit ? gpText(r.limit) : '-' }}</td>
              <td class="num" :class="changeClass(r.margin)">{{ signedGp(r.margin) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button v-if="shown.length < sorted.length" type="button" class="lb-more" @click="limit += 50; track('items_show_more')">Show more ({{ (sorted.length - shown.length).toLocaleString('en-US') }} left)</button>
      <p class="st-note gx-note">Price is the middle of the latest buy and sell prices. 1d, 7d and 30d compare it with the average price that many days ago. Margin is what buying at the sell price and selling at the buy price makes, after the 2% Grand Exchange tax. Traded is how many were bought and sold in a day.</p>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { track } from '@/utils/analytics'
import { ago } from '@/components/admin/stats/statsFormat'
import { changeClass, gpText, itemImage, pctText, signedGp } from '@/utils/geFormat'

const props = defineProps({
  rows: { type: Array, required: true },
  updatedAt: { type: String, default: '' },
  stale: { type: Boolean, default: false },
})

const route = useRoute()
const router = useRouter()

const memberChoices = [
  { key: 'all', label: 'All' },
  { key: 'f2p', label: 'Free-to-play' },
  { key: 'members', label: 'Members' },
]
const columns = [
  { key: 'name', label: 'Item' },
  { key: 'price', label: 'Price', num: true },
  { key: 'change1', label: '1d', num: true, hide: true, tip: 'Against the average price yesterday' },
  { key: 'change7', label: '7d', num: true, tip: 'Against the average price 7 days ago' },
  { key: 'change30', label: '30d', num: true, hide: true, tip: 'Against the average price 30 days ago' },
  { key: 'volume', label: 'Traded', num: true, hide: true, tip: 'How many were traded in a day' },
  { key: 'limit', label: 'Limit', num: true, hide: true, tip: 'Buy limit per 4 hours' },
  { key: 'margin', label: 'Margin', num: true, tip: 'Flip profit after tax' },
]

// State lives in the address so a view can be shared as a link.
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)
const members = ref(pick(route.query.show, ['all', 'f2p', 'members'], 'all'))
const query = ref(typeof route.query.q === 'string' ? route.query.q.slice(0, 60) : '')
const sortKey = ref(pick(route.query.sort, columns.map((c) => c.key), 'volume'))
const sortDir = ref(pick(route.query.dir, ['asc', 'desc'], 'desc'))
const limit = ref(50)

function sortBy(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDir.value = key === 'name' ? 'asc' : 'desc'
  }
}

const filtered = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean)
  return props.rows.filter((r) => {
    if (members.value === 'f2p' && r.members) return false
    if (members.value === 'members' && !r.members) return false
    const name = r.name.toLowerCase()
    return words.every((w) => name.includes(w))
  })
})
// Items with nothing to compare (no price, no change) go last whichever way it is sorted.
const sorted = computed(() => {
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir
  })
})
const shown = computed(() => sorted.value.slice(0, limit.value))

watch([query, members, sortKey, sortDir], () => {
  limit.value = 50
})
let urlTimer = null
watch([members, query, sortKey, sortDir], () => {
  clearTimeout(urlTimer)
  urlTimer = setTimeout(() => {
    const next = { browse: '1' }
    if (members.value !== 'all') next.show = members.value
    if (query.value) next.q = query.value
    if (sortKey.value !== 'volume' || sortDir.value !== 'desc') {
      next.sort = sortKey.value
      next.dir = sortDir.value
    }
    router.replace({ query: next })
  }, 300)
})
let searchTimer = null
watch(query, (q) => {
  clearTimeout(searchTimer)
  if (q) searchTimer = setTimeout(() => track('items_search', { query_length: q.length }), 800)
})
onBeforeUnmount(() => {
  clearTimeout(urlTimer)
  clearTimeout(searchTimer)
})

const hideImage = (e) => {
  e.target.style.visibility = 'hidden'
}
</script>
