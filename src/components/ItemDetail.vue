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
          <ul class="gxc" aria-label="About this item">
            <li v-if="item.change1 != null" :class="tone(item.change1)">{{ pctText(item.change1) }} today</li>
            <li v-if="item.limit" title="How many you can buy every 4 hours">{{ item.limit.toLocaleString('en-US') }} / 4h limit</li>
            <li v-if="item.volume" :title="`${item.volume.toLocaleString('en-US')} bought and sold yesterday`">{{ item.volume >= 1e6 ? gpAxis(item.volume) : gpText(item.volume) }} traded yesterday</li>
            <li v-if="item.updatedAt">Updated {{ ago(item.updatedAt) }}</li>
          </ul>
        </div>
        <WatchButton :slug="slug" :name="item.name" :source="variant" />
      </header>

      <p v-if="item.stale" class="gx-stale" role="status">Prices are a little behind right now. They update every few minutes.</p>

      <dl class="gxv" aria-label="Price now">
        <div title="The middle of the latest buy and sell price"><dt>GE price</dt><dd class="is-main">{{ gpText(item.price) }}<small> gp</small></dd></div>
        <div title="What you pay to buy right away"><dt>Instant buy</dt><dd>{{ gpText(item.high) }}<small> gp</small></dd></div>
        <div title="What you get selling right away"><dt>Instant sell</dt><dd>{{ gpText(item.low) }}<small> gp</small></dd></div>
        <div v-if="item.flip" :title="`Buy and sell again, after the 2% tax (${pctText(item.flip.roi)})`"><dt>Flip</dt><dd :class="changeClass(item.flip.margin)">{{ signedGp(item.flip.margin) }}<small> gp</small></dd></div>
      </dl>

      <section class="gxi-sec gxi-chart">
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

      <section v-if="insights.length" class="gxi-sec gxn">
        <h2>Market insights</h2>
        <dl class="gxn-grid">
          <div v-for="i in insights" :key="i.label" :title="i.tip"><dt>{{ i.label }}</dt><dd :class="i.tone">{{ i.value }}</dd></div>
        </dl>
        <p v-if="verdict" class="gxn-verdict" :class="verdict.tone">{{ verdict.text }}</p>
      </section>

      <section v-if="showAlch || methods.length" class="gxi-sec gxu">
        <h2>Ways to use it</h2>
        <div v-if="showAlch" class="gxu-row">
          <h3>High alchemy</h3>
          <p v-if="item.alchProfit != null" class="gxu-big" :class="changeClass(item.alchProfit)">{{ signedGp(item.alchProfit) }} gp <small>each</small></p>
          <p class="gxu-note">Casting it gives {{ gpText(item.highAlch) }} gp. Buying one costs {{ gpText(item.high) }} gp, plus a nature rune.</p>
        </div>
        <div v-if="methods.length" class="gxu-row">
          <h3>Used in training</h3>
          <p class="gxu-note">These methods use {{ item.name }} up, so its price is part of what they cost.</p>
          <ul class="gx-method-list">
            <li v-for="m in methods" :key="m.id"><RouterLink :to="m.path" class="gxh-chip">{{ m.name }} <small>{{ m.skill }}</small></RouterLink></li>
          </ul>
        </div>
      </section>

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
import { changeClass, gpAxis, gpText, itemImage, pctText, signedGp } from '@/utils/geFormat'
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
// A move from 1 gp to 2 gp reads as "up 100%", so the note about where the price sits against its average only shows for items that cost something.
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
// The numbers under "Market insights": the range's low, high, average and change, then (for items that cost something) the flip and the changes against earlier days.
const insights = computed(() => {
  const out = []
  const sm = summary.value
  const short = ranges.find((r) => r.key === range.value)?.label || ''
  if (sm) {
    out.push({ label: `${short} low`, value: `${gpText(sm.low)} gp`, tip: `The lowest price in the last ${rangeLabel.value}` })
    out.push({ label: `${short} high`, value: `${gpText(sm.high)} gp`, tip: `The highest price in the last ${rangeLabel.value}` })
    out.push({ label: `${short} average`, value: `${gpText(sm.avg)} gp`, tip: `The average price over the last ${rangeLabel.value}` })
    if (sm.change != null) out.push({ label: `${short} change`, value: pctText(sm.change), tone: tone(sm.change), tip: `From the first price to the last over the ${rangeLabel.value}` })
  }
  const i = item.value
  if (i) {
    for (const c of trend.value) out.push({ label: c.label === 'Yesterday' ? 'Change since yesterday' : `${c.label} change`, value: pctText(c.value), tone: c.tone, tip: c.tip })
  }
  return out
})
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
