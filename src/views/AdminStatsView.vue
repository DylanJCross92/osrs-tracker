<template>
  <div class="st">
    <header class="st-head">
      <div>
        <h1>Statistics</h1>
        <p>What is going on across TickGains: who visits, who signs up, what people use and what gets shared.</p>
      </div>
      <div class="st-range" role="group" aria-label="Time range">
        <button v-for="d in RANGES" :key="d" type="button" class="st-range-btn" :class="{ on: days === d }" :aria-pressed="days === d" @click="days = d">{{ d }} days</button>
      </div>
    </header>

    <nav class="st-tabs" role="tablist" aria-label="Statistics">
      <button v-for="t in TABS" :id="`st-tab-${t.key}`" :key="t.key" type="button" role="tab" class="st-tab" :class="{ on: tab === t.key }" :aria-selected="tab === t.key" :aria-controls="`st-panel`" @click="setTab(t.key)">{{ t.label }}</button>
    </nav>

    <div id="st-panel" role="tabpanel" :aria-labelledby="`st-tab-${tab}`">
      <StatsOverview v-if="tab === 'overview'" :days="days" />
      <StatsFeatures v-else-if="tab === 'features'" :days="days" />
      <StatsVisitors v-else-if="tab === 'visitors'" :days="days" />
      <StatsSharing v-else :days="days" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatsFeatures from '@/components/admin/stats/StatsFeatures.vue'
import StatsOverview from '@/components/admin/stats/StatsOverview.vue'
import StatsSharing from '@/components/admin/stats/StatsSharing.vue'
import StatsVisitors from '@/components/admin/stats/StatsVisitors.vue'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({ title: 'Statistics', description: 'Site statistics.', path: '/admin/stats', noindex: true })

const RANGES = [7, 30, 90]
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'features', label: 'What people do' },
  { key: 'visitors', label: 'Visitors' },
  { key: 'sharing', label: 'Sharing' },
]
const route = useRoute()
const router = useRouter()
const days = ref(30)
const tab = ref(TABS.some((t) => t.key === route.query.tab) ? route.query.tab : 'overview')
// The tab is kept in the address, so a refresh or a shared link opens the same one.
function setTab(key) {
  tab.value = key
  router.replace({ query: key === 'overview' ? {} : { tab: key } })
}
</script>
