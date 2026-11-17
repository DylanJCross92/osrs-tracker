<template>
  <div>
    <p v-if="error" class="cl-banner is-error" role="alert">{{ error }}</p>
    <p v-else-if="!data" class="st-empty">Loading…</p>
    <template v-else>
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
        <div class="st-card-head"><h2 id="st-daily">Day by day</h2></div>
        <StatChart :labels="data.daily.map((d) => d.day)" :series="dailySeries" empty-text="Nothing shared or visited through a shared link in this time yet." />
      </section>

      <div class="st-pair">
        <section class="st-card" aria-labelledby="st-kinds">
          <div class="st-card-head"><h2 id="st-kinds">What is being shared</h2></div>
          <div class="st-table-wrap">
            <table class="st-table">
              <thead><tr><th>Kind</th><th>Shares</th><th>Links</th><th>Images</th><th>Posts</th><th>Visits</th><th>Per share</th></tr></thead>
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
          <div class="st-card-head"><h2 id="st-sources">Where visitors came from</h2></div>
          <StatBars :items="sources" empty-text="No visits through shared links yet." />
          <p class="st-note">Discord and most phone apps do not tell the site where a click came from, so those show as "Direct or app".</p>
        </section>
      </div>
    </template>
    <p class="st-foot">Counting began when this page shipped, so earlier shares are not included. Visits by you and other admins, and link previews fetched by Discord or X, are not counted. The share numbers keep only a daily tally. Events keep no IP address and no cookie; a signed-in account is stored with an event only to count different accounts, and events are deleted after about 13 months.</p>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { statsApi } from '@/api/stats'
import StatBars from './StatBars.vue'
import StatChart from './StatChart.vue'
import { count, fmt } from './statsFormat'
import { useStatsLoad } from './useStatsLoad'

const props = defineProps({ days: { type: Number, required: true } })
const shares = useStatsLoad((d) => statsApi.shares(d), 'Could not load the statistics.')
const data = shares.data
const error = shares.error
watch(() => props.days, (d) => shares.load(d), { immediate: true })

const dailySeries = computed(() => [
  { key: 'shares', label: 'Shares', color: 'var(--st-a)', values: data.value.daily.map((d) => d.shares) },
  { key: 'visits', label: 'Visits through shared links', color: 'var(--st-b)', type: 'line', values: data.value.daily.map((d) => d.visits) },
])
const sources = computed(() => data.value.sources.map((s) => ({ key: s.source, label: s.label, value: s.visits })))
const perShare = computed(() => (data.value.totals.shares ? `About ${(data.value.totals.visits / data.value.totals.shares).toFixed(1)} per share` : 'No shares yet'))
const sharePct = computed(() => {
  const t = data.value.totals
  if (!t.siteVisits) return '-'
  const p = (t.visits / t.siteVisits) * 100
  return `${p > 0 && p < 10 ? p.toFixed(1) : Math.round(p)}%`
})
</script>
