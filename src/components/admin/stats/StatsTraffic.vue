<template>
  <section class="st-card stt" aria-labelledby="stt-h">
    <div class="st-card-head">
      <h2 id="stt-h">Where visitors come from</h2>
      <span class="st-hint">Last {{ days }} days · one visit per browser per day</span>
    </div>

    <p v-if="error" class="st-empty">{{ error }}</p>
    <p v-else-if="!data" class="st-empty">Loading…</p>
    <p v-else-if="!data.total" class="st-empty">No visits recorded in this time yet.</p>
    <template v-else>
      <div class="stt-top">
        <div class="stt-total">
          <span class="st-tile-label">Visits</span>
          <b class="stt-num">{{ fmt(data.total) }}</b>
          <span v-if="change" class="st-delta" :class="change.cls" :title="`${fmt(data.previous)} in the ${data.days} days before`">{{ change.text }}</span>
        </div>
        <div class="stt-split">
          <span class="sa-split" role="img" :aria-label="`${data.direct} direct, ${data.referred} from other sites`">
            <i class="is-in" :style="{ width: share(data.direct) }" />
            <i class="is-out" :style="{ width: share(data.referred) }" />
          </span>
          <span class="sa-legend">
            <span><i class="is-in" aria-hidden="true" /><b>{{ fmt(data.direct) }}</b> direct, {{ share(data.direct) }}</span>
            <span><i class="is-out" aria-hidden="true" /><b>{{ fmt(data.referred) }}</b> from other sites, {{ share(data.referred) }}</span>
          </span>
        </div>
      </div>

      <div class="stt-lower">
        <div>
          <h3 class="so-sub">By source</h3>
          <StatBars :items="items" color="var(--st-b)" />
        </div>
        <div v-if="data.sites.length">
          <h3 class="so-sub">Sites that sent people</h3>
          <ol class="stt-sites">
            <li v-for="s in data.sites.slice(0, 8)" :key="s.site"><span :title="s.site">{{ s.site }}</span><b>{{ fmt(s.visits) }}</b></li>
          </ol>
        </div>
      </div>

      <p class="st-note">
        Direct is a typed address, a bookmark, or an app that sends no referrer. Facebook is told apart by its link redirect, its in-app browser, or a
        <code>?utm_source=facebook</code> tag, so add that to a link you post there (for example <code>tickgains.com/?utm_source=facebook</code>) to count it exactly.
        Your own visits and other admins' are left out. Sources are only recorded from the day each was added, so older days show fewer kinds.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, watch } from 'vue'
import { statsApi } from '@/api/stats'
import StatBars from './StatBars.vue'
import { fmt } from './statsFormat'
import { useStatsLoad } from './useStatsLoad'

// How many people opened the site, and from where: directly, or from Facebook, Google, Reddit and the like. Follows the range chosen on the page.
const props = defineProps({ days: { type: Number, required: true } })
const { data, error, load } = useStatsLoad((days) => statsApi.traffic(days), 'Could not load where visitors come from.')
watch(() => props.days, (d) => load(d), { immediate: true })

const share = (n) => `${data.value?.total ? Math.round((n / data.value.total) * 100) : 0}%`
const items = computed(() => (data.value?.sources || []).map((s) => ({ key: s.source, label: s.label, value: s.visits, sub: `${s.pct}%` })))
const change = computed(() => {
  const d = data.value
  if (!d?.previous) return null
  const diff = Math.round(((d.total - d.previous) / d.previous) * 100)
  return { text: `${diff > 0 ? '+' : ''}${diff}% vs before`, cls: diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : '' }
})
</script>
