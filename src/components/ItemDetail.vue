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
        <WatchButton :slug="slug" :name="item.name" :source="variant" />
      </header>

      <p v-if="item.stale" class="gx-stale" role="status">Prices are a little behind right now. They update every few minutes.</p>

      <div class="gxi-grid">
      <section class="gxp" aria-label="Price now">
        <b class="gxp-price">{{ gpText(item.price) }}<small> gp</small></b>
        <span v-if="pricey && item.change1 != null" class="gxp-today" :class="tone(item.change1)">{{ pctText(item.change1) }} today</span>
        <span v-if="item.updatedAt" class="gxp-upd">Updated {{ ago(item.updatedAt) }}</span>
      </section>

      <aside class="gxd" aria-label="Trade details">
        <dl class="gxd-list">
          <div title="What you pay to buy right away"><dt>Buy now</dt><dd>{{ gpText(item.high) }}<small> gp</small></dd></div>
          <div title="What you get selling right away"><dt>Sell now</dt><dd>{{ gpText(item.low) }}<small> gp</small></dd></div>
          <div v-if="pricey && item.flip" :title="`Buy and sell again, after the 2% tax (${pctText(item.flip.roi)})`"><dt>Flip profit</dt><dd :class="changeClass(item.flip.margin)">{{ signedGp(item.flip.margin) }}<small> gp</small></dd></div>
          <div v-if="item.limit" title="How many you can buy every 4 hours"><dt>Buy limit</dt><dd>{{ item.limit.toLocaleString('en-US') }}<small> / 4h</small></dd></div>
          <div v-if="item.volume" title="Bought and sold yesterday"><dt>Traded yesterday</dt><dd>{{ item.volume.toLocaleString('en-US') }}</dd></div>
        </dl>
        <template v-if="pricey && trend.length">
          <h2 class="gxd-h">Price change</h2>
          <dl class="gxd-list">
            <div v-for="c in trend" :key="c.label" :title="c.tip"><dt>{{ c.label }}</dt><dd :class="c.tone">{{ pctText(c.value) }}</dd></div>
          </dl>
        </template>
      </aside>

      <section class="gxi-card gxi-chart">
        <div class="gx-chart-head">
          <h2>Price history</h2>
          <div class="gx-seg" role="group" aria-label="Range">
            <button v-for="r in ranges" :key="r.key" type="button" :class="{ on: range === r.key }" :aria-pressed="range === r.key" @click="range = r.key">{{ r.label }}</button>
          </div>
        </div>
        <template v-if="summary">
          <ul class="gxr" :aria-label="`Over the ${rangeLabel}`">
            <li><span>Lowest</span><b>{{ gpText(summary.low) }}</b></li>
            <li><span>Highest</span><b>{{ gpText(summary.high) }}</b></li>
            <li><span>Average</span><b>{{ gpText(summary.avg) }}</b></li>
            <li v-if="summary.change != null"><span>Change</span><b :class="tone(summary.change)">{{ pctText(summary.change) }}</b></li>
          </ul>
          <p v-if="verdict" class="gxr-verdict" :class="verdict.tone"><i aria-hidden="true" />{{ verdict.text }}</p>
        </template>
        <p v-if="historyError" class="empty-hint">{{ historyError }}</p>
        <div v-else-if="!history" class="gx-chart-sk sk" aria-busy="true" aria-label="Loading the chart" />
        <PriceLineChart v-else :points="history.points" :show-time="range === '1d' || range === '1w'" :aria-label="`${item.name} price over the ${rangeLabel}`" />
      </section>

      <div v-if="showAlch || methods.length" class="gxi-uses">
        <section v-if="showAlch" class="gxi-card gx-alch">
          <h2>High alchemy</h2>
          <p v-if="item.alchProfit != null" class="gx-alch-big" :class="changeClass(item.alchProfit)">{{ signedGp(item.alchProfit) }} gp <small>each</small></p>
          <p class="gx-alch-note">Casting it gives {{ gpText(item.highAlch) }} gp. Buying one costs {{ gpText(item.high) }} gp, plus a nature rune.</p>
        </section>

        <section v-if="methods.length" class="gxi-card gx-methods">
          <h2>Used in training</h2>
          <p class="gx-alch-note">These methods use {{ item.name }} up, so its price is part of what they cost.</p>
          <ul class="gx-method-list">
            <li v-for="m in methods" :key="m.id"><RouterLink :to="m.path" class="gxh-chip">{{ m.name }} <small>{{ m.skill }}</small></RouterLink></li>
          </ul>
        </section>
      </div>

      </div>

      <p class="st-note gx-note">Prices from the <a href="https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices" target="_blank" rel="noopener">OSRS Wiki real-time prices</a>. A fan project, not affiliated with Jagex.</p>
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
import { changeClass, gpText, itemImage, pctText, signedGp } from '@/utils/geFormat'
import { MIN_PRICE } from '@/utils/geTrending'
import { summarizeHistory } from '@/utils/geSummary'
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
// Percentages on a 2 gp item (1 gp to 2 gp is "up 100%") and flip profits of a coin or two mean nothing, so they only show for items that cost something.
const pricey = computed(() => (item.value?.price ?? 0) >= MIN_PRICE)
const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')
// Alchemy is only worth a card when it makes money or is close to it.
const showAlch = computed(() => {
  const i = item.value
  if (!i || i.highAlch == null || i.price == null) return false
  return i.alchProfit != null ? i.alchProfit > -25 : i.highAlch >= i.price * 0.7
})
const trend = computed(() => {
  const i = item.value
  if (!i) return []
  return [
    { label: 'Yesterday', value: i.change1, tip: 'Against the average price yesterday' },
    { label: '7 days', value: i.change7, tip: 'Against the average price 7 days ago' },
    { label: '30 days', value: i.change30, tip: 'Against the average price 30 days ago' },
  ]
    .filter((c) => c.value != null)
    .map((c) => ({ ...c, tone: tone(c.value) }))
})
// The range's lowest, highest and average price, and where the price is now against that average.
const summary = computed(() => (history.value?.points ? summarizeHistory(history.value.points, item.value?.price) : null))
const verdict = computed(() => {
  const v = summary.value?.vsAvg
  if (v == null || !pricey.value || Math.abs(v) < 3) return null
  return { tone: v < 0 ? 'good' : 'bad', text: `${Math.abs(v)}% ${v < 0 ? 'below' : 'above'} its ${rangeLabel.value} average right now` }
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
