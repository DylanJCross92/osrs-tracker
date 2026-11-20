<template>
  <div class="fn">
    <!-- What to look at: which funnel, how far back, and which people -->
    <div class="fn-controls">
      <div class="fn-tabs" role="tablist" aria-label="Funnel">
        <button v-for="f in FUNNEL_TABS" :id="`fn-tab-${f.key}`" :key="f.key" type="button" role="tab" class="fn-tab" :class="{ on: funnelKey === f.key }" :aria-selected="funnelKey === f.key" aria-controls="fn-panel" @click="funnelKey = f.key">{{ f.label }}</button>
      </div>
      <div class="fn-filters">
        <div class="st-range" role="group" aria-label="Date range">
          <button v-for="r in RANGES" :key="r.days" type="button" class="st-range-btn" :class="{ on: range === r.days }" :aria-pressed="range === r.days" @click="setRange(r.days)">{{ r.label }}</button>
        </div>
        <label class="fn-segment">
          <span>People</span>
          <select v-model="segment" aria-label="Group of people">
            <option v-for="s in segmentOptions" :key="s.key" :value="s.key">{{ s.label }}{{ s.people != null ? ` (${fmt(s.people)})` : '' }}</option>
          </select>
        </label>
      </div>
    </div>
    <p class="st-note fn-scope">{{ scopeText }}</p>

    <p v-if="error" class="st-empty">{{ error }}</p>
    <p v-else-if="!data" class="st-empty">Loading…</p>
    <template v-else>
      <div class="fn-main">
        <section id="fn-panel" class="st-card" role="tabpanel" :aria-labelledby="`fn-tab-${funnelKey}`">
          <div class="st-card-head"><h2>{{ funnel.label }} funnel</h2><span class="st-hint">{{ funnel.blurb }}</span></div>
          <FunnelBars :funnel="funnel" />
          <p v-if="data.capped" class="st-note">Only the first 400,000 events are read, so the oldest people may be missing.</p>
        </section>
        <FunnelInsights :insights="data.insights" :funnel-key="funnelKey" :cohort="data.cohort" />
      </div>

      <JourneyFlow :flow="data.flow" :total-people="data.cohort" @open="(key) => $emit('go', 'visitors', key)" />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { statsApi } from '@/api/stats'
import FunnelBars from './FunnelBars.vue'
import FunnelInsights from './FunnelInsights.vue'
import JourneyFlow from './JourneyFlow.vue'
import { fmt } from './statsFormat'
import { useStatsLoad } from './useStatsLoad'

defineEmits(['go'])

const FUNNEL_TABS = [
  { key: 'registration', label: 'Registration' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'planner', label: 'Planner' },
  { key: 'clans', label: 'Clans' },
]
const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' },
]
const DEFAULT_SEGMENTS = [
  { key: 'all', label: 'Everyone' },
  { key: 'signedup', label: 'Signed up' },
  { key: 'visitor', label: 'Not signed up' },
  { key: 'returning', label: 'Came back another day' },
  { key: 'shared', label: 'Opened a shared plan or invite' },
]

const funnelKey = ref('registration')
const range = ref(0)
const segment = ref('all')
const load = useStatsLoad((days, seg) => statsApi.funnels(days, seg), 'Could not load the funnels.')
const data = load.data
const error = load.error

function setRange(days) {
  range.value = days
}
// A change of range or group asks again; the old numbers stay up until the new ones arrive.
watch([range, segment], () => load.load(range.value, segment.value), { immediate: true })

const funnel = computed(() => data.value.funnels.find((f) => f.key === funnelKey.value) || data.value.funnels[0])
const segmentOptions = computed(() => data.value?.segments || DEFAULT_SEGMENTS)
const scopeText = computed(() => {
  const when = range.value ? `People first seen in the last ${range.value} days` : 'Everyone recorded, all time'
  const seg = segment.value === 'all' ? '' : ` · ${segmentOptions.value.find((s) => s.key === segment.value)?.label || ''}`
  return `${when}${seg}. Everything below uses these same people.`
})
</script>
