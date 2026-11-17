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

      <section class="st-card" aria-labelledby="st-active">
        <div class="st-card-head">
          <h2 id="st-active">Active accounts</h2>
          <ul class="st-legend" aria-hidden="true">
            <li><i class="st-sw is-visits" />Different accounts per day</li>
          </ul>
        </div>
        <p v-if="activeError" class="st-empty">{{ activeError }}</p>
        <p v-else-if="!active" class="st-empty">Loading…</p>
        <template v-else>
          <div v-if="activeMax" class="st-chart" role="img" :aria-label="`Active accounts per day for the last ${days} days`">
            <span class="st-ymax">{{ fmt(activeMax) }}</span>
            <div class="st-cols">
              <div v-for="d in active" :key="d.day" class="st-col" :title="`${dayLabel(d.day)}: ${count(d.active, 'account')} active, ${count(d.logins, 'sign-in')}, ${fmt(d.resumed)} came back`">
                <i class="st-bar is-visits" :style="{ height: d.active ? `${Math.max(4, (d.active / activeMax) * 100)}%` : '0' }" />
              </div>
            </div>
            <div class="st-xaxis"><span>{{ dayLabel(active[0].day) }}</span><span>{{ dayLabel(active[active.length - 1].day) }}</span></div>
          </div>
          <p v-else class="st-empty">No signed-in activity recorded in this time yet.</p>
          <p class="st-note">Accounts that signed in or came back that day, counted once each. Counting began when this shipped, so earlier days are empty. Your own visits and anyone with Do Not Track on are not counted.</p>
        </template>
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

      <section class="st-card" aria-labelledby="st-events">
        <div class="st-card-head">
          <h2 id="st-events">What people do</h2>
          <input v-model.trim="eventFilter" class="st-search" type="search" placeholder="Filter events" aria-label="Filter events" />
        </div>
        <p v-if="eventsError" class="st-empty">{{ eventsError }}</p>
        <p v-else-if="!events" class="st-empty">Loading…</p>
        <p v-else-if="!events.length" class="st-empty">No events recorded in this time yet.</p>
        <div v-else class="st-table-wrap">
          <table class="st-table st-events">
            <thead><tr><th>Event</th><th>Total</th><th>Today</th><th>Signed in</th><th><span class="sr-only">Per day</span></th></tr></thead>
            <tbody>
              <template v-for="e in shownEvents" :key="e.name">
                <tr class="st-ev-row" :class="{ 'is-open': open === e.name }" tabindex="0" role="button" :aria-expanded="open === e.name" @click="toggle(e.name)" @keydown.enter.prevent="toggle(e.name)" @keydown.space.prevent="toggle(e.name)">
                  <th scope="row">{{ e.name }}</th>
                  <td>{{ fmt(e.total) }}</td>
                  <td>{{ fmt(e.today) }}</td>
                  <td>{{ e.accounts ? fmt(e.accounts) : '-' }}</td>
                  <td class="st-spark" aria-hidden="true"><i v-for="(n, i) in e.daily" :key="i" :style="{ height: sparkHeight(n, e) }" /></td>
                </tr>
                <tr v-if="open === e.name" class="st-ev-detail">
                  <td colspan="5">
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
        <p class="st-note">One row per event, sent from the same places that report to Google Analytics. Signed in is the number of different accounts. Tap an event to see its details.</p>
      </section>

      <p class="st-foot">Counting began when this page shipped, so earlier shares are not included. Visits by you and other admins, and link previews fetched by Discord or X, are not counted. The share numbers keep only a daily tally. Events keep no IP address and no cookie; a signed-in account is stored with an event only to count different accounts, and events are deleted after about 13 months.</p>
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
  loadEvents()
  loadActive()
  try {
    data.value = await statsApi.shares(days.value)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not load the statistics.'
  } finally {
    loading.value = false
  }
}

// Accounts active per day.
const active = ref(null)
const activeError = ref('')
const activeMax = computed(() => Math.max(0, ...(active.value || []).map((d) => d.active)))
async function loadActive() {
  activeError.value = ''
  try {
    active.value = (await statsApi.dailyActive(days.value)).days
  } catch (err) {
    active.value = null
    activeError.value = err instanceof ApiError ? err.message : 'Could not load the active accounts.'
  }
}

// Product events, and the detail of the one that is open.
const events = ref(null)
const eventsError = ref('')
const eventFilter = ref('')
const open = ref('')
const detail = ref(null)
async function loadEvents() {
  eventsError.value = ''
  open.value = ''
  try {
    events.value = (await statsApi.events(days.value)).events
  } catch (err) {
    events.value = null
    eventsError.value = err instanceof ApiError ? err.message : 'Could not load the events.'
  }
}
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
    const res = await statsApi.eventDetail(name, days.value)
    if (open.value === name) detail.value = res
  } catch {
    if (open.value === name) detail.value = { breakdown: {} }
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
