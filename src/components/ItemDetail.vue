<template>
  <div class="gxi" :class="`is-${variant}`">
    <p v-if="notFound" class="card empty-hint">No item with that address. <RouterLink :to="{ name: 'items' }">Browse all items</RouterLink>.</p>
    <p v-else-if="error" class="card empty-hint">{{ error }}</p>
    <PageSkeleton v-else-if="!item" kind="items" />
    <template v-else>
      <header class="gxi-head">
        <span class="gxi-icon"><img :src="itemImage(item.icon, item.name)" alt="" width="40" height="40" @error="hideImage" /></span>
        <div class="gxi-title">
          <component :is="variant === 'page' ? 'h1' : 'h2'" class="gxi-h">{{ item.name }}<small v-if="item.members" class="gx-badge" title="Members only">Members</small></component>
          <p v-if="item.examine">{{ item.examine }}</p>
        </div>
        <div class="gxi-price">
          <b>{{ gpText(item.price) }}<small> gp</small></b>
          <span v-if="item.change1 != null" class="gxt-pill" :class="item.change1 > 0 ? 'up' : item.change1 < 0 ? 'down' : 'flat'">{{ pctText(item.change1) }} today</span>
          <span v-if="item.updatedAt" class="gx-updated">updated {{ ago(item.updatedAt) }}</span>
          <WatchButton :slug="slug" :name="item.name" :source="variant" />
        </div>
      </header>

      <p v-if="item.stale" class="gx-stale" role="status">Prices are a little behind right now. They update every few minutes.</p>

      <div class="gxf" aria-label="Price details">
        <dl class="gxf-group gxf-prices">
          <div title="The latest price paid by someone buying instantly"><dt>Buy</dt><dd>{{ gpText(item.high) }}</dd></div>
          <div title="The latest price received by someone selling instantly"><dt>Sell</dt><dd>{{ gpText(item.low) }}</dd></div>
          <div :title="item.flip ? `${item.flip.roi}% of the sell price, after the 2% Grand Exchange tax` : 'Needs both prices'"><dt>Flip</dt><dd :class="changeClass(item.flip?.margin)">{{ item.flip ? signedGp(item.flip.margin) : '-' }}</dd></div>
        </dl>
        <dl class="gxf-group gxf-meta">
          <div title="How many you can buy every 4 hours"><dt>Limit</dt><dd>{{ item.limit ? (item.limit >= 1e5 ? gpAxis(item.limit) : gpText(item.limit)) : '-' }}</dd></div>
          <div :title="item.volume ? `${item.volume.toLocaleString('en-US')} bought and sold yesterday` : 'How many were bought and sold yesterday'"><dt>Traded</dt><dd>{{ item.volume ? (item.volume >= 1e6 ? gpAxis(item.volume) : gpText(item.volume)) : '-' }}</dd></div>
        </dl>
        <ul class="gxf-changes" aria-label="Price change">
          <li v-for="c in changes" :key="c.label" :class="c.tone" :title="c.tip"><span>{{ c.label }}</span><b>{{ pctText(c.value) }}</b></li>
        </ul>
      </div>

      <section class="gxi-card gxi-chart">
        <div class="gx-chart-head">
          <h2>Price history</h2>
          <div class="gx-seg" role="group" aria-label="Range">
            <button v-for="r in ranges" :key="r.key" type="button" :class="{ on: range === r.key }" :aria-pressed="range === r.key" @click="range = r.key">{{ r.label }}</button>
          </div>
        </div>
        <p v-if="historyError" class="empty-hint">{{ historyError }}</p>
        <div v-else-if="!history" class="gx-chart-sk sk" aria-busy="true" aria-label="Loading the chart" />
        <PriceLineChart v-else :points="history.points" :show-time="range === '1d' || range === '1w'" :aria-label="`${item.name} price over the ${rangeLabel}`" />
      </section>

      <section v-if="showAlch" class="gxi-card gx-alch">
        <h2>High alchemy</h2>
        <p>
          Casting High Level Alchemy on {{ item.name }} gives <b>{{ gpText(item.highAlch) }}</b> gp.
          <template v-if="item.alchProfit != null">After buying one at {{ gpText(item.high) }} gp and a nature rune, that is <b :class="changeClass(item.alchProfit)">{{ signedGp(item.alchProfit) }} gp</b> each.</template>
        </p>
      </section>

      <section v-if="methods.length" class="gxi-card gx-methods">
        <h2>Used in training methods</h2>
        <p class="lb-sub">These methods use {{ item.name }} up as they train, so its price is part of what they cost.</p>
        <ul class="gx-method-list">
          <li v-for="m in methods" :key="m.id"><RouterLink :to="m.path" class="gxh-chip">{{ m.name }} <small>{{ m.skill }}</small></RouterLink></li>
        </ul>
      </section>

      <p class="st-note gx-note">Prices from the <a href="https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices" target="_blank" rel="noopener">OSRS Wiki real-time prices</a>. Buy is the latest price paid by someone buying instantly and sell the latest price received by someone selling instantly. This is a fan project and not affiliated with Jagex.</p>
    </template>
  </div>
</template>

<script setup>
import WatchButton from '@/components/WatchButton.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import PriceLineChart from '@/components/PriceLineChart.vue'
import { geApi } from '@/api/ge'
import { ApiError } from '@/api/client'
import { track } from '@/utils/analytics'
import { ago } from '@/components/admin/stats/statsFormat'
import { changeClass, gpAxis, gpText, itemImage, pctText, signedGp } from '@/utils/geFormat'
import { methodsUsingItem } from '@/utils/itemMethods'

// One item's details: its price, the numbers around it and its price history. The item page and the popup over the planner both show this.
const props = defineProps({
  slug: { type: String, required: true },
  // page: the item's own page; modal: the popup, where the item's name is not the page heading.
  variant: { type: String, default: 'page' },
})
const emit = defineEmits(['loaded'])
const ranges = [
  { key: '1d', label: '1D', long: 'day' },
  { key: '1w', label: '1W', long: 'week' },
  { key: '1m', label: '1M', long: 'month' },
  { key: '3m', label: '3M', long: '3 months' },
  { key: '1y', label: '1Y', long: 'year' },
]
const range = ref('1m')
const rangeLabel = computed(() => ranges.find((r) => r.key === range.value)?.long || '')

const item = ref(null)
const notFound = ref(false)
const error = ref('')
const history = ref(null)
const historyError = ref('')
// Only worth a section when the alchemy value is close to what the item sells for.
const showAlch = computed(() => item.value?.highAlch != null && item.value.price != null && item.value.highAlch >= item.value.price * 0.4)
// The three changes as pills: a rise is green, a fall red, nothing (or no history yet) plain.
const changes = computed(() => {
  const i = item.value
  if (!i) return []
  const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')
  return [
    { label: '1d', value: i.change1, tip: 'Against the average price yesterday' },
    { label: '7d', value: i.change7, tip: 'Against the average price 7 days ago' },
    { label: '30d', value: i.change30, tip: 'Against the average price 30 days ago' },
  ].map((c) => ({ ...c, tone: tone(c.value) }))
})
const methods = computed(() => (item.value ? methodsUsingItem(item.value.name) : []))
let itemTicket = 0
let historyTicket = 0

async function loadItem() {
  const mine = ++itemTicket
  const slug = props.slug
  item.value = null
  history.value = null
  notFound.value = false
  error.value = ''
  try {
    const res = await geApi.item(slug)
    if (mine !== itemTicket) return
    item.value = res
    emit('loaded', res)
    track('item_view', { has_methods: methodsUsingItem(res.name).length > 0, via: props.variant })
    loadHistory()
  } catch (err) {
    if (mine !== itemTicket) return
    if (err instanceof ApiError && err.status === 404) notFound.value = true
    else error.value = 'Could not load this item. Try again in a minute.'
  }
}

async function loadHistory() {
  if (!item.value) return
  const mine = ++historyTicket
  historyError.value = ''
  history.value = null
  try {
    const res = await geApi.history(item.value.slug, range.value)
    if (mine === historyTicket) history.value = res
  } catch (err) {
    if (mine === historyTicket) historyError.value = err instanceof ApiError && err.status === 503 ? 'The price history is not available right now.' : 'Could not load the price history.'
  }
}

const hideImage = (e) => {
  e.target.style.visibility = 'hidden'
}

watch(() => props.slug, loadItem)
watch(range, () => {
  track('item_range', { range: range.value })
  loadHistory()
})

let refreshTimer = null
onMounted(() => {
  loadItem()
  refreshTimer = setInterval(() => item.value && geApi.item(item.value.slug).then((res) => (item.value = res)).catch(() => {}), 5 * 60_000)
})
onBeforeUnmount(() => clearInterval(refreshTimer))
</script>
