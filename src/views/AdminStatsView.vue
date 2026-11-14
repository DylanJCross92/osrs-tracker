<template>
  <div class="st">
    <header class="st-head">
      <div>
        <h1>Statistics</h1>
        <p>People sharing links and images from TickGains, and the people who arrive through them.</p>
      </div>
      <div class="st-range" role="group" aria-label="Time range">
        <button v-for="d in RANGES" :key="d" type="button" class="st-range-btn" :class="{ on: days === d }" :aria-pressed="days === d" @click="setDays(d)">{{ d }} days</button>
      </div>
    </header>

    <p v-if="error" class="cl-banner is-error" role="alert">{{ error }}</p>
    <p v-else-if="loading && !data" class="cl-empty">Loading…</p>

    <template v-if="data">
      <section class="st-tiles" aria-label="Summary">
        <div class="st-tile">
          <span class="st-tile-label">Shares</span>
          <b class="st-tile-num">{{ fmt(data.totals.shares) }}</b>
          <small>{{ count(data.totals.link, 'link') }} · {{ count(data.totals.image, 'image') }} · {{ count(data.totals.social, 'post') }}</small>
        </div>
        <div class="st-tile">
          <span class="st-tile-label">Visits through shared links</span>
          <b class="st-tile-num is-visits">{{ fmt(data.totals.visits) }}</b>
          <small>{{ perShare }}</small>
        </div>
        <div class="st-tile">
          <span class="st-tile-label">Share of all visits</span>
          <b class="st-tile-num">{{ sharePct }}</b>
          <small>{{ fmt(data.totals.siteVisits) }} visits in total, counted once a day per browser</small>
        </div>
      </section>

      <section class="st-card" aria-labelledby="st-daily">
        <div class="st-card-head">
          <h2 id="st-daily">Day by day</h2>
          <ul class="st-legend" aria-hidden="true">
            <li><i class="st-sw is-shares" />Shares</li>
            <li><i class="st-sw is-visits" />Visits through shared links</li>
          </ul>
        </div>
        <div v-if="hasDaily" class="st-chart" role="img" :aria-label="`Shares and visits per day for the last ${days} days`">
          <span class="st-ymax">{{ fmt(dailyMax) }}</span>
          <div class="st-cols">
            <div v-for="d in data.daily" :key="d.day" class="st-col" :title="`${dayLabel(d.day)}: ${d.shares} shares, ${d.visits} visits`">
              <i class="st-bar is-shares" :style="{ height: barHeight(d.shares) }" />
              <i class="st-bar is-visits" :style="{ height: barHeight(d.visits) }" />
            </div>
          </div>
          <div class="st-xaxis"><span>{{ dayLabel(data.daily[0].day) }}</span><span>{{ dayLabel(data.daily[data.daily.length - 1].day) }}</span></div>
        </div>
        <p v-else class="st-empty">Nothing shared or visited through a shared link in this time yet.</p>
      </section>

      <section class="st-card" aria-labelledby="st-kinds">
        <h2 id="st-kinds">What is being shared</h2>
        <div class="st-table-wrap">
          <table class="st-table">
            <thead><tr><th>Kind</th><th>Shares</th><th>Links</th><th>Images</th><th>Posts</th><th>Visits</th><th>Visits per share</th></tr></thead>
            <tbody>
              <tr v-for="k in data.byKind" :key="k.kind" :class="{ 'is-zero': !k.shares && !k.visits }">
                <th scope="row">{{ k.label }}</th>
                <td>{{ fmt(k.shares) }}</td><td>{{ fmt(k.link) }}</td><td>{{ fmt(k.image) }}</td><td>{{ fmt(k.social) }}</td>
                <td>{{ fmt(k.visits) }}</td>
                <td>{{ k.shares ? (k.visits / k.shares).toFixed(1) : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="st-note">Links are copied links and links sent with Copy message. Images are saved or copied pictures. Posts are X, Reddit and the phone share sheet.</p>
      </section>

      <section class="st-card" aria-labelledby="st-sources">
        <h2 id="st-sources">Where visitors came from</h2>
        <ul v-if="data.sources.length" class="st-sources">
          <li v-for="s in data.sources" :key="s.source">
            <span class="st-src-name">{{ s.label }}</span>
            <span class="st-src-bar"><i :style="{ width: (s.visits / data.sources[0].visits) * 100 + '%' }" /></span>
            <b>{{ fmt(s.visits) }}</b>
          </li>
        </ul>
        <p v-else class="st-empty">No visits through shared links yet.</p>
        <p class="st-note">Discord and most phone apps do not tell the site where a click came from, so those show as "Direct or app".</p>
      </section>

      <p class="st-foot">Counting began when this page shipped, so earlier shares are not included. Visits by you and other admins, and link previews fetched by Discord or X, are not counted. Nothing identifies a person: only a daily tally is kept.</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({ title: 'Statistics', description: 'Share statistics.', path: '/admin/stats', noindex: true })

const RANGES = [7, 30, 90]
const days = ref(30)
const data = ref(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await statsApi.shares(days.value)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not load the statistics.'
  } finally {
    loading.value = false
  }
}
function setDays(d) {
  if (d === days.value) return
  days.value = d
  load()
}
onMounted(load)

const fmt = (n) => Number(n || 0).toLocaleString('en-US')
const count = (n, word) => `${fmt(n)} ${word}${Number(n) === 1 ? '' : 's'}`
const dayLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

const dailyMax = computed(() => Math.max(1, ...(data.value?.daily || []).map((d) => Math.max(d.shares, d.visits))))
const hasDaily = computed(() => (data.value?.daily || []).some((d) => d.shares || d.visits))
const barHeight = (n) => (n ? `${Math.max(4, (n / dailyMax.value) * 100)}%` : '0')

const perShare = computed(() => {
  const t = data.value.totals
  return t.shares ? `About ${(t.visits / t.shares).toFixed(1)} per share` : 'No shares yet'
})
const sharePct = computed(() => {
  const t = data.value.totals
  if (!t.siteVisits) return '-'
  const p = (t.visits / t.siteVisits) * 100
  return `${p > 0 && p < 10 ? p.toFixed(1) : Math.round(p)}%`
})
</script>
