<template>
  <div>
    <p v-if="error" class="cl-banner is-error" role="alert">{{ error }}</p>
    <p v-else-if="!events" class="st-empty">Loading…</p>
    <template v-else>
      <section class="st-tiles" aria-label="Summary">
        <div class="st-tile">
          <span class="st-tile-label">Things people did</span>
          <b class="st-tile-num">{{ fmt(actions.total) }}</b>
          <small>{{ fmt(actions.today) }} today · page views not included</small>
        </div>
        <div class="st-tile">
          <span class="st-tile-label">Page views</span>
          <b class="st-tile-num is-visits">{{ fmt(pages.total) }}</b>
          <small>{{ fmt(pages.today) }} today</small>
        </div>
        <div class="st-tile">
          <span class="st-tile-label">Most used</span>
          <b class="st-tile-num is-text">{{ areas[0]?.label || '-' }}</b>
          <small v-if="areas[0]">{{ fmt(areas[0].value) }} actions in {{ days }} days</small>
        </div>
      </section>

      <section class="st-card" aria-labelledby="st-ev-day">
        <div class="st-card-head"><h2 id="st-ev-day">Activity per day</h2></div>
        <StatChart :labels="labels" :series="daySeries" />
        <p class="st-note">Actions are clicks and features used. Page views are every page opened inside the site.</p>
      </section>

      <div class="st-pair">
        <section class="st-card" aria-labelledby="st-areas">
          <div class="st-card-head"><h2 id="st-areas">Where people spend time</h2></div>
          <StatBars :items="areas" />
          <p class="st-note">Actions grouped by the part of the site they happen in.</p>
        </section>
        <section class="st-card" aria-labelledby="st-funnel">
          <div class="st-card-head"><h2 id="st-funnel">From search to a tracked player</h2></div>
          <StatBars :items="funnel" color="var(--st-a)" />
          <p class="st-note">How far searches get. Each step shows how many of the step before it carried on.</p>
        </section>
      </div>

      <section class="st-card" aria-labelledby="st-top">
        <div class="st-card-head"><h2 id="st-top">Most used actions</h2></div>
        <StatBars :items="topActions" color="var(--st-c)" />
        <p class="st-note">These counts only include signed-in accounts. To follow one visitor, signed in or not, open the Visitors tab.</p>
      </section>

      <section class="st-card" aria-labelledby="st-events">
        <div class="st-card-head">
          <h2 id="st-events">All events</h2>
          <input v-model.trim="eventFilter" class="st-search" type="search" placeholder="Filter events" aria-label="Filter events" />
        </div>
        <p v-if="!events.length" class="st-empty">No events recorded in this time yet.</p>
        <div v-else class="st-table-wrap">
          <table class="st-table st-events">
            <thead><tr><th>Event</th><th>Total</th><th>Today</th><th>Users</th><th>Users today</th><th><span class="sr-only">Per day</span></th></tr></thead>
            <tbody>
              <template v-for="e in shownEvents" :key="e.name">
                <tr class="st-ev-row" :class="{ 'is-open': open === e.name }" tabindex="0" role="button" :aria-expanded="open === e.name" @click="toggle(e.name)" @keydown.enter.prevent="toggle(e.name)" @keydown.space.prevent="toggle(e.name)">
                  <th scope="row">{{ e.name }}</th>
                  <td>{{ fmt(e.total) }}</td>
                  <td>{{ fmt(e.today) }}</td>
                  <td>{{ e.accounts ? fmt(e.accounts) : '-' }}</td>
                  <td>{{ e.accountsToday ? fmt(e.accountsToday) : '-' }}</td>
                  <td class="st-spark" aria-hidden="true"><i v-for="(n, i) in e.daily" :key="i" :style="{ height: sparkHeight(n, e) }" /></td>
                </tr>
                <tr v-if="open === e.name" class="st-ev-detail">
                  <td colspan="6">
                    <p v-if="!detail" class="st-empty">Loading…</p>
                    <template v-else>
                      <div v-if="Object.keys(detail.breakdown).length" class="st-break">
                        <div v-for="(list, key) in detail.breakdown" :key="key">
                          <b>{{ key }}</b>
                          <ul><li v-for="v in list" :key="v.value"><span>{{ v.value }}</span><em>{{ fmt(v.n) }}</em></li></ul>
                        </div>
                      </div>
                      <p v-else class="st-empty">This event carries no details.</p>
                    </template>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="st-note">One row per event, sent from the same places that report to Google Analytics. Users is the number of different signed-in accounts behind the event, in total and today. Signed-out visitors are not tracked, so they are not counted there. Tap an event to see its details.</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { statsApi } from '@/api/stats'
import { SEARCH_FUNNEL, eventGroup, groupTotals } from '@/utils/eventGroups'
import StatBars from './StatBars.vue'
import StatChart from './StatChart.vue'
import { fmt, lastDays } from './statsFormat'
import { useStatsLoad } from './useStatsLoad'

const props = defineProps({ days: { type: Number, required: true } })

const eventsData = useStatsLoad((d) => statsApi.events(d), 'Could not load the events.')
const error = eventsData.error
const events = computed(() => eventsData.data.value?.events || null)
const open = ref('')
const detail = ref(null)
const eventFilter = ref('')
watch(() => props.days, (d) => { open.value = ''; eventsData.load(d) }, { immediate: true })

const labels = computed(() => lastDays(props.days))
const isPage = (e) => eventGroup(e.name).key === 'pages'
const sumDaily = (list) => labels.value.map((_, i) => list.reduce((s, e) => s + (e.daily[i] || 0), 0))
const actionEvents = computed(() => (events.value || []).filter((e) => !isPage(e)))
const pageEvents = computed(() => (events.value || []).filter(isPage))
const actions = computed(() => ({ total: actionEvents.value.reduce((s, e) => s + e.total, 0), today: actionEvents.value.reduce((s, e) => s + e.today, 0) }))
const pages = computed(() => ({ total: pageEvents.value.reduce((s, e) => s + e.total, 0), today: pageEvents.value.reduce((s, e) => s + e.today, 0) }))
const daySeries = computed(() => [
  { key: 'actions', label: 'Actions', color: 'var(--st-a)', values: sumDaily(actionEvents.value) },
  { key: 'pages', label: 'Page views', color: 'var(--st-b)', type: 'line', values: sumDaily(pageEvents.value) },
])
const areas = computed(() => groupTotals(events.value || []))
const funnel = computed(() => {
  const by = new Map((events.value || []).map((e) => [e.name, e.total]))
  return SEARCH_FUNNEL.map((s, i) => {
    const value = by.get(s.name) || 0
    const prev = i ? by.get(SEARCH_FUNNEL[i - 1].name) || 0 : 0
    return { key: s.name, label: s.label, value, sub: i && prev ? `${Math.min(100, Math.round((value / prev) * 100))}% of the step before` : '' }
  })
})
const topActions = computed(() =>
  actionEvents.value.slice(0, 12).map((e) => ({ key: e.name, label: e.name, value: e.total, sub: e.accounts ? `${fmt(e.accounts)} ${e.accounts === 1 ? 'user' : 'users'}` : '' })),
)

const shownEvents = computed(() => (events.value || []).filter((e) => !eventFilter.value || e.name.includes(eventFilter.value.toLowerCase())))
const sparkHeight = (n, e) => (n ? `${Math.max(12, (n / Math.max(...e.daily, 1)) * 100)}%` : '2px')
async function toggle(name) {
  if (open.value === name) {
    open.value = ''
    return
  }
  open.value = name
  detail.value = null
  try {
    const res = await statsApi.eventDetail(name, props.days)
    if (open.value === name) detail.value = res
  } catch {
    if (open.value === name) detail.value = { breakdown: {} }
  }
}
</script>
