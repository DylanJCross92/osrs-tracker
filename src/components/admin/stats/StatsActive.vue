<template>
  <section class="st-card sa" aria-labelledby="sa-h">
    <div class="st-card-head">
      <h2 id="sa-h">Active people</h2>
      <span v-if="data" class="st-hint sa-live"><i class="sa-dot" :class="{ on: data.online > 0 }" aria-hidden="true" /><b>{{ data.online }}</b> online now<template v-if="updated"> · updated {{ updated }}</template></span>
    </div>

    <p v-if="error" class="st-empty">{{ error }}</p>
    <p v-else-if="!data" class="st-empty">Loading…</p>
    <template v-else>
      <div class="sa-tiles">
        <div v-for="w in data.windows" :key="w.key" class="sa-tile">
          <span class="st-tile-label">{{ w.label }}</span>
          <b class="sa-num">{{ w.people.toLocaleString('en-US') }}</b>
          <span class="sa-split" role="img" :aria-label="`${w.signedIn} signed in, ${w.visitors} not signed in`">
            <i class="is-in" :style="{ width: share(w.signedIn, w.people) }" />
            <i class="is-out" :style="{ width: share(w.visitors, w.people) }" />
          </span>
          <span class="sa-legend"><span><i class="is-in" aria-hidden="true" />{{ w.signedIn }} signed in</span><span><i class="is-out" aria-hidden="true" />{{ w.visitors }} visitors</span></span>
          <small>{{ details(w) }}</small>
        </div>
      </div>

      <div class="sa-lower">
        <div class="sa-hours">
          <div class="sa-sub"><h3>Hour by hour</h3><span v-if="busiest">Busiest: {{ hourText(busiest.at) }}, {{ busiest.people }} {{ busiest.people === 1 ? 'person' : 'people' }}</span></div>
          <div class="sa-bars" role="img" :aria-label="`People active in each of the last 24 hours`">
            <span v-for="h in data.hourly" :key="h.at" class="sa-bar" :title="`${hourText(h.at)}: ${h.people} ${h.people === 1 ? 'person' : 'people'}`">
              <i :style="{ height: barHeight(h.people) }" :class="{ now: h === data.hourly[data.hourly.length - 1] }" />
            </span>
          </div>
          <div class="sa-axis"><span>{{ hourText(data.hourly[0].at) }}</span><span>{{ hourText(data.hourly[12].at) }}</span><span>now</span></div>
        </div>

        <div class="sa-areas">
          <div class="sa-sub"><h3>Busiest parts of the site</h3><span>Last 24 hours</span></div>
          <p v-if="!data.areas.length" class="st-empty">No page views yet.</p>
          <ol v-else>
            <li v-for="a in data.areas" :key="a.route">
              <span class="sa-area-name">{{ routeLabel(a.route) }}</span>
              <span class="sa-area-bar" aria-hidden="true"><i :style="{ width: share(a.people, data.areas[0].people) }" /></span>
              <b>{{ a.people }}</b>
            </li>
          </ol>
        </div>
      </div>

      <p class="st-note">
        A person is an account, or a browser that is not signed in; a browser that signed in counts once, as the account. Visits by you and other admins, and link previews, are left out.
        <template v-if="untracked">{{ untracked.toLocaleString('en-US') }} action{{ untracked === 1 ? '' : 's' }} in the last 7 days came from browsers that asked not to be tracked, so they cannot be counted as people.</template>
        Updates every minute.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { statsApi } from '@/api/stats'
import { ago, busiestHour, routeLabel } from './statsFormat'
import { useStatsLoad } from './useStatsLoad'

// How many different people were active in the last hour, 24 hours and 7 days, who they were, and when and where. Refreshes by itself
// while the page is open.
const { data, error, load } = useStatsLoad(() => statsApi.active(), 'Could not load who is active.')

let timer = null
onMounted(() => {
  load()
  timer = setInterval(() => !document.hidden && load(), 60_000)
})
onBeforeUnmount(() => clearInterval(timer))

const updated = computed(() => (data.value?.generatedAt ? ago(data.value.generatedAt) : ''))
const busiest = computed(() => busiestHour(data.value?.hourly))
const untracked = computed(() => data.value?.windows.find((w) => w.key === 'week')?.untracked || 0)
const peak = computed(() => Math.max(1, ...(data.value?.hourly || []).map((h) => h.people)))

const share = (part, whole) => `${whole ? Math.round((part / whole) * 100) : 0}%`
const barHeight = (n) => `${n ? Math.max(6, Math.round((n / peak.value) * 100)) : 2}%`
const hourText = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric' })
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
const details = (w) => [`${plural(w.newAccounts, 'new account')}`, plural(w.logins, 'sign-in'), plural(w.events, 'action')].join(' · ')
</script>
