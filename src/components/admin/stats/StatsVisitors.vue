<template>
  <div class="vz">
    <p v-if="listError" class="cl-banner is-error" role="alert">{{ listError }}</p>
    <p v-else-if="!list" class="st-empty">Loading…</p>
    <template v-else>
      <div class="vz-grid">
        <section class="st-card vz-list" aria-labelledby="vz-people">
          <div class="st-card-head">
            <h2 id="vz-people">Visitors</h2>
            <input v-model.trim="filter" class="st-search" type="search" placeholder="Find a visitor" aria-label="Find a visitor" />
          </div>
          <p v-if="!list.visitors.length" class="st-empty">Nobody has been followed in this time yet. Visitors appear here from the first visit after this page shipped.</p>
          <p v-else-if="!shown.length" class="st-empty">No visitor matches "{{ filter }}".</p>
          <ul v-else class="vz-people">
            <li v-for="v in shown" :key="v.key">
              <button type="button" class="vz-person" :class="{ on: v.key === selected }" :aria-pressed="v.key === selected" @click="pick(v.key)">
                <span class="vz-av" :class="v.kind" aria-hidden="true">{{ v.kind === 'account' ? v.label.charAt(0).toUpperCase() : v.kind === 'anon' ? '≈' : '?' }}</span>
                <span class="vz-who">
                  <b>{{ v.label }}</b>
                  <small v-if="v.players">{{ v.players }}</small>
                  <small v-else-if="v.note">{{ v.note }}</small>
                  <small>{{ count(v.events, 'step') }} · {{ ago(v.last) }}</small>
                </span>
              </button>
            </li>
          </ul>
        </section>

        <div ref="detail" class="vz-detail">
          <p v-if="!selected" class="st-card st-empty">No visitor to show yet.</p>
          <p v-else-if="journeyError" class="cl-banner is-error" role="alert">{{ journeyError }}</p>
          <p v-else-if="!journey" class="st-card st-empty">Loading…</p>
          <template v-else>
            <section class="st-card" aria-labelledby="vz-head">
              <div class="st-card-head">
                <div>
                  <h2 id="vz-head">{{ journey.label }}</h2>
                  <p v-if="journey.players" class="vz-sub">{{ journey.players }}</p>
                </div>
                <span class="vz-kind">{{ journey.kind === 'account' ? 'Signed-in account' : journey.kind === 'anon' ? 'Several people, not told apart' : 'Not signed in' }}</span>
              </div>
              <div class="vz-tiles">
                <div><span>Steps</span><b>{{ fmt(journey.count) }}</b></div>
                <div><span>Pages viewed</span><b>{{ fmt(journey.pages) }}</b></div>
                <div><span>Visits</span><b>{{ fmt(journey.sessions.length) }}</b></div>
                <div><span>First seen</span><b class="is-small">{{ when(journey.first) }}</b></div>
                <div><span>Last seen</span><b class="is-small">{{ when(journey.last) }}</b></div>
              </div>
            </section>

            <section class="st-card" aria-labelledby="vz-chart">
              <div class="st-card-head"><h2 id="vz-chart">Activity per day</h2></div>
              <StatChart :labels="journey.daily.map((d) => d.day)" :series="series" empty-text="Nothing recorded for this visitor in this time." />
              <p class="st-note">Every step is one thing they did: a page opened, a button used, a share. Visits are split where they went quiet for 30 minutes.</p>
            </section>

            <section class="st-card" aria-labelledby="vz-steps">
              <div class="st-card-head"><h2 id="vz-steps">What they did, in order</h2></div>
              <p v-if="journey.kind === 'anon'" class="st-note">These steps come from browsers that asked not to be tracked, blocked the visitor id or cannot keep one, so they cannot be told apart. Neighbouring steps may be different people.</p>
              <p v-if="journey.count >= 1500" class="st-note">Showing the most recent part of a long history.</p>
              <ol class="vz-sessions">
                <li v-for="(s, i) in journey.sessions" :key="s.start" class="vz-session">
                  <button type="button" class="vz-session-head" :aria-expanded="isOpen(i)" @click="toggle(i)">
                    <b>{{ dayWhen(s.start) }}</b>
                    <span>{{ time(s.start) }}<template v-if="time(s.end) !== time(s.start)"> to {{ time(s.end) }}</template> · {{ count(s.events.length, 'step') }}</span>
                    <i class="vz-chev" :class="{ open: isOpen(i) }" aria-hidden="true" />
                  </button>
                  <ol v-if="isOpen(i)" class="vz-steps">
                    <li v-for="(e, n) in s.events" :key="n" :class="describe(e).kind">
                      <time :datetime="e.at">{{ timeSec(e.at) }}</time>
                      <span class="vz-dot" aria-hidden="true" />
                      <span class="vz-what"><b>{{ describe(e).text }}</b><code v-if="describe(e).kind === 'page'">{{ describe(e).detail }}</code><small v-else-if="describe(e).detail">{{ describe(e).detail }}</small></span>
                    </li>
                  </ol>
                </li>
              </ol>
            </section>
          </template>
        </div>
      </div>
    </template>
    <p class="st-foot">Visitors are followed from the day this tab shipped. A visitor is a browser: someone using two browsers is two visitors until they sign in, and then everything from those browsers joins their account. Browsers that send Do Not Track or Global Privacy Control are counted elsewhere but never followed here. Steps are deleted after about 13 months.</p>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { statsApi } from '@/api/stats'
import StatChart from './StatChart.vue'
import { ago, count, fmt } from './statsFormat'
import { useStatsLoad } from './useStatsLoad'
import { describeEvent } from '@/utils/describeEvent'

// `select` opens one person (a key from the list), for a link from the Overview tab.
const props = defineProps({ days: { type: Number, required: true }, select: { type: String, default: '' } })
const route = useRoute()
// A link from another page (the Player plans page) can open one visitor: /admin/stats?tab=visitors&v=v:<id>.
const asked = props.select || (typeof route?.query?.v === 'string' ? route.query.v : '')
const people = useStatsLoad((d) => statsApi.visitors(d), 'Could not load the visitors.')
const list = people.data
const listError = people.error
const one = useStatsLoad((key, d) => statsApi.journey(key, d), 'Could not load this visitor.')
const journey = one.data
const journeyError = one.error

const filter = ref('')
const selected = ref('')
const detail = ref(null)
const openSessions = reactive(new Set([0]))

const shown = computed(() => {
  const q = filter.value.toLowerCase()
  const all = list.value?.visitors || []
  return q ? all.filter((v) => v.label.toLowerCase().includes(q) || v.players.toLowerCase().includes(q)) : all
})

watch(() => props.days, (d) => people.load(d), { immediate: true })

// The most recently active visitor is open by default; a visitor already open stays open when the range changes.
watch(list, (l) => {
  if (!l?.visitors.length) {
    // Not in the recent list (quiet for the whole range), but a link can still ask for them.
    if (asked && selected.value !== asked) pick(asked, false)
    else if (!asked) selected.value = ''
    return
  }
  if (l.visitors.some((v) => v.key === selected.value)) one.load(selected.value, props.days)
  else pick(l.visitors.some((v) => v.key === asked) ? asked : l.visitors[0].key, false)
})

async function pick(key, scroll = true) {
  selected.value = key
  openSessions.clear()
  openSessions.add(0)
  await one.load(key, props.days)
  await nextTick()
  // On a narrow screen the detail sits below the list.
  if (scroll && window.matchMedia?.('(max-width: 900px)')?.matches) detail.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}

const isOpen = (i) => openSessions.has(i)
const toggle = (i) => (openSessions.has(i) ? openSessions.delete(i) : openSessions.add(i))
const describe = (e) => describeEvent(e.name, e.props)

const series = computed(() => [{ key: 'steps', label: 'Steps', color: 'var(--st-a)', values: journey.value.daily.map((d) => d.n) }])

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-')
const dayWhen = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const timeSec = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
</script>
