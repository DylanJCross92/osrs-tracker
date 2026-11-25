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
          <div class="sa-chart" @pointerleave="hover = -1">
            <div class="sa-bars" role="group" :aria-label="`People active in each of the last 24 hours. Use the arrow keys to move between hours.`" tabindex="0" @keydown="onKey" @focus="hover < 0 && (hover = data.hourly.length - 1)" @blur="hover = -1">
              <span v-for="(h, i) in data.hourly" :key="h.at" class="sa-bar" :class="{ on: hover === i }" @pointerenter="hover = i" @pointerdown="hover = i">
                <i :style="{ height: barHeight(h.people) }" :class="{ now: i === data.hourly.length - 1 }" />
              </span>
            </div>
            <div v-if="tip" class="sc-tip sa-tip" :style="tipStyle" role="status" aria-live="polite">
              <b>{{ hourRange(tip.at) }}<small v-if="hover === data.hourly.length - 1"> · so far</small></b>
              <p>People<em>{{ tip.people.toLocaleString('en-US') }}</em></p>
              <p><i class="sa-sw is-in" aria-hidden="true" />Signed in<em>{{ tip.signedIn.toLocaleString('en-US') }}</em></p>
              <p><i class="sa-sw is-out" aria-hidden="true" />Visitors<em>{{ (tip.people - tip.signedIn).toLocaleString('en-US') }}</em></p>
              <p>Actions<em>{{ tip.actions.toLocaleString('en-US') }}</em></p>
            </div>
          </div>
          <div class="sa-axis"><span>{{ hourText(data.hourly[0].at) }}</span><span>{{ hourText(data.hourly[12].at) }}</span><span>now</span></div>
        </div>

        <div class="sa-areas">
          <div class="sa-sub"><h3>Busiest parts of the site</h3><span>Last 24 hours</span></div>
          <p v-if="!data.areas.length" class="st-empty">No page views yet.</p>
          <ol v-else>
            <li v-for="a in data.areas" :key="a.area">
              <span class="sa-area-name">{{ areaLabel(a.area) }}</span>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { statsApi } from '@/api/stats'
import { ago, areaLabel, busiestHour } from './statsFormat'
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

// The bar being pointed at (or reached with the arrow keys); -1 when none.
const hover = ref(-1)
const tip = computed(() => (hover.value >= 0 ? data.value?.hourly[hover.value] : null))
const tipStyle = computed(() => {
  const count = data.value?.hourly.length || 24
  const middle = ((hover.value + 0.5) / count) * 100
  // Centred on the bar, but kept inside the chart at either end.
  return hover.value < 4 ? { left: '0' } : hover.value > count - 5 ? { right: '0' } : { left: `${middle}%`, transform: 'translateX(-50%)' }
})
function onKey(e) {
  const last = (data.value?.hourly.length || 1) - 1
  const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
  if (step) hover.value = Math.min(last, Math.max(0, (hover.value < 0 ? last : hover.value) + step))
  else if (e.key === 'Home') hover.value = 0
  else if (e.key === 'End') hover.value = last
  else if (e.key === 'Escape') hover.value = -1
  else return
  e.preventDefault()
}

const share = (part, whole) => `${whole ? Math.round((part / whole) * 100) : 0}%`
const barHeight = (n) => `${n ? Math.max(6, Math.round((n / peak.value) * 100)) : 2}%`
const hourText = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric' })
const dayName = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short' })
const hourRange = (iso) => `${dayName(iso)} ${hourText(iso)} – ${hourText(new Date(new Date(iso).getTime() + 3_600_000))}`
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
const details = (w) => [`${plural(w.newAccounts, 'new account')}`, plural(w.logins, 'sign-in'), plural(w.events, 'action')].join(' · ')
</script>
