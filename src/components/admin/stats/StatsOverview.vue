<template>
  <div>
    <section class="st-tiles is-six" aria-label="Summary">
      <div class="st-tile">
        <span class="st-tile-label">Visitors</span>
        <b class="st-tile-num is-visits">{{ visitors ? fmt(visitors.total) : '-' }}</b>
        <small v-if="visitors">{{ fmt(visitors.today) }} today · about {{ fmt(visitors.perDay) }} a day</small>
      </div>
      <div class="st-tile">
        <span class="st-tile-label">Active accounts today</span>
        <b class="st-tile-num">{{ active ? fmt(activeToday.active) : '-' }}</b>
        <small v-if="overview">{{ fmt(overview.activeWeek) }} in the last 7 days</small>
      </div>
      <div class="st-tile">
        <span class="st-tile-label">Accounts</span>
        <b class="st-tile-num">{{ accounts ? fmt(accounts.total) : '-' }}</b>
        <small v-if="accounts">+{{ fmt(accounts.added) }} in {{ days }} days<template v-if="overview.unverified"> · {{ fmt(overview.unverified) }} not verified</template></small>
      </div>
      <div class="st-tile">
        <span class="st-tile-label">Tracked players</span>
        <b class="st-tile-num">{{ players ? fmt(players.total) : '-' }}</b>
        <small v-if="players">+{{ fmt(players.added) }} in {{ days }} days</small>
      </div>
      <div class="st-tile">
        <span class="st-tile-label">Claimed profiles</span>
        <b class="st-tile-num">{{ claims ? fmt(claims.total) : '-' }}</b>
        <small v-if="overview">{{ fmt(overview.pendingClaims) }} waiting for approval</small>
      </div>
      <div class="st-tile">
        <span class="st-tile-label">XP gained today</span>
        <b class="st-tile-num is-visits">{{ xp ? compact(xpToday.xp) : '-' }}</b>
        <small v-if="xp">by {{ fmt(xpToday.players) }} players so far</small>
      </div>
    </section>

    <section class="st-card" aria-labelledby="st-visitors">
      <div class="st-card-head"><h2 id="st-visitors">Visitors per day</h2></div>
      <p v-if="shares.error.value" class="st-empty">{{ shares.error.value }}</p>
      <p v-else-if="!shares.data.value" class="st-empty">Loading…</p>
      <StatChart v-else :labels="shares.data.value.daily.map((d) => d.day)" :series="visitorSeries" />
      <p class="st-note">A visitor is a browser, counted once a day. Visits by you, other admins and link previews are not counted.</p>
    </section>

    <section class="st-card" aria-labelledby="st-active">
      <div class="st-card-head"><h2 id="st-active">Active accounts per day</h2></div>
      <p v-if="activeData.error.value" class="st-empty">{{ activeData.error.value }}</p>
      <p v-else-if="!active" class="st-empty">Loading…</p>
      <StatChart v-else :labels="active.map((d) => d.day)" :series="activeSeries" empty-text="No signed-in activity recorded in this time yet." @hover="onActiveHover">
        <template #tooltip="{ index }">
          <p class="st-pop-head is-stacked">
            <b>{{ dayLong(active[index].day) }}</b>
            <span>{{ count(active[index].active, 'account') }} active<template v-if="active[index].logins || active[index].resumed"> · {{ count(active[index].logins, 'sign-in') }}, {{ fmt(active[index].resumed) }} came back</template></span>
          </p>
          <p v-if="!active[index].active" class="st-pop-note">Nobody signed in or came back.</p>
          <p v-else-if="whoError" class="st-pop-note">{{ whoError }}</p>
          <p v-else-if="!who || who.day !== active[index].day" class="st-pop-note">Loading…</p>
          <ul v-else-if="who.accounts.length" class="st-pop-list">
            <li v-for="a in who.accounts.slice(0, POP_ROWS)" :key="a.email" class="st-pop-acct">
              <span class="st-pop-who"><b>{{ a.email }}</b><em v-if="a.players">{{ a.players }}</em></span>
              <small class="st-pop-meta">{{ a.logins ? 'Signed in' : 'Came back' }}<template v-if="a.lastSeen"> · <span :title="new Date(a.lastSeen).toLocaleString()">last seen {{ seenAgo(a.lastSeen) }}</span></template></small>
            </li>
            <li v-if="who.accounts.length > POP_ROWS" class="st-pop-more">and {{ who.accounts.length - POP_ROWS }} more</li>
          </ul>
        </template>
      </StatChart>
      <p class="st-note">Different accounts that signed in or came back that day. Hover or tap a day to see which. Anyone with Do Not Track on is not counted.</p>
    </section>

    <div class="st-pair">
      <section class="st-card" aria-labelledby="st-new">
        <div class="st-card-head"><h2 id="st-new">New each day</h2></div>
        <p v-if="overviewData.error.value" class="st-empty">{{ overviewData.error.value }}</p>
        <p v-else-if="!overview" class="st-empty">Loading…</p>
        <StatChart v-else :labels="overview.labels" :series="newSeries" :height="170" />
      </section>
      <section class="st-card" aria-labelledby="st-xp">
        <div class="st-card-head"><h2 id="st-xp">XP gained per day</h2></div>
        <p v-if="xpData.error.value" class="st-empty">{{ xpData.error.value }}</p>
        <p v-else-if="!xp" class="st-empty">Loading…</p>
        <StatChart v-else :labels="xp.map((d) => d.day)" :series="xpSeries" :height="170" :tip-format="(v) => `${fmt(v)} XP`" />
        <p class="st-note">Across every tracked player, game days (6 AM to 6 AM Eastern). Shows up to 60 days.</p>
      </section>
    </div>

    <section class="st-card" aria-labelledby="st-growth">
      <div class="st-card-head"><h2 id="st-growth">Growth</h2><span class="st-hint">New in the last {{ days }} days</span></div>
      <p v-if="overviewData.error.value" class="st-empty">{{ overviewData.error.value }}</p>
      <p v-else-if="!overview" class="st-empty">Loading…</p>
      <ul v-else class="st-growth">
        <li v-for="g in overview.growth" :key="g.key">
          <span class="st-growth-label">{{ g.label }}</span>
          <b>{{ fmt(g.total) }}</b>
          <small :class="{ 'is-up': g.added > 0 }">{{ g.added > 0 ? `+${fmt(g.added)}` : 'none new' }}</small>
          <StatSpark :values="g.daily" />
        </li>
      </ul>
    </section>

    <section class="st-card" aria-labelledby="st-feed">
      <div class="st-card-head"><h2 id="st-feed">Latest activity</h2></div>
      <p v-if="overviewData.error.value" class="st-empty">{{ overviewData.error.value }}</p>
      <p v-else-if="!overview" class="st-empty">Loading…</p>
      <p v-else-if="!overview.feed.length" class="st-empty">Nothing yet.</p>
      <ul v-else class="st-feed">
        <li v-for="(f, i) in overview.feed" :key="i">
          <i class="st-feed-dot" :class="`is-${f.kind}`" aria-hidden="true" />
          <span class="st-feed-text"><b>{{ feedTitle(f) }}</b> <span>{{ f.text }}</span><em v-if="f.detail && f.kind !== 'claim' && f.kind !== 'feedback'"> · {{ f.detail }}</em></span>
          <small>{{ ago(f.at) }}</small>
        </li>
      </ul>
      <p class="st-note">Newest first, across new accounts, players, claims, follows, clans, competitions and feedback.</p>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'
import StatChart from './StatChart.vue'
import StatSpark from './StatSpark.vue'
import { ago, compact, count, dayLong, fmt } from './statsFormat'
import { useStatsLoad } from './useStatsLoad'

const props = defineProps({ days: { type: Number, required: true } })

// Which accounts were active on the day being looked at (see onActiveHover).
const POP_ROWS = 6
// "5 min ago", "3 h ago", "2 days ago", or the date once it is older than a month.
function seenAgo(iso) {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`
  if (sec < 86_400) return `${Math.round(sec / 3600)} h ago`
  if (sec < 30 * 86_400) return `${Math.round(sec / 86_400)} day${Math.round(sec / 86_400) === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
const who = ref(null)
const whoError = ref('')
const whoCache = new Map()

const shares = useStatsLoad((d) => statsApi.shares(d), 'Could not load the visitors.')
const overviewData = useStatsLoad((d) => statsApi.overview(d), 'Could not load the overview.')
const activeData = useStatsLoad((d) => statsApi.dailyActive(d), 'Could not load the active accounts.')
const xpData = useStatsLoad((d) => statsApi.dailyXp(d), 'Could not load the XP.')
const overview = overviewData.data
const active = computed(() => activeData.data.value?.days || null)
const xp = computed(() => xpData.data.value?.days || null)

function loadAll() {
  shares.load(props.days)
  overviewData.load(props.days)
  activeData.load(props.days)
  xpData.load(props.days)
  who.value = null
  whoCache.clear()
}
watch(() => props.days, loadAll, { immediate: true })

const last = (list) => list?.[list.length - 1] || { active: 0, xp: 0, players: 0 }
const activeToday = computed(() => last(active.value))
const xpToday = computed(() => last(xp.value))
const grow = (key) => overview.value?.growth.find((g) => g.key === key) || null
const accounts = computed(() => grow('accounts'))
const players = computed(() => grow('players'))
const claims = computed(() => grow('claims'))
const visitors = computed(() => {
  const d = shares.data.value?.daily
  if (!d) return null
  const total = d.reduce((s, x) => s + x.site, 0)
  return { total, today: d[d.length - 1].site, perDay: Math.round(total / d.length) }
})

const visitorSeries = computed(() => {
  const d = shares.data.value.daily
  return [
    { key: 'site', label: 'Visitors', color: 'var(--st-b)', values: d.map((x) => x.site) },
    { key: 'shared', label: 'Arrived through a shared link', color: 'var(--st-a)', type: 'line', values: d.map((x) => x.visits) },
  ]
})
const activeSeries = computed(() => [{ key: 'active', label: 'Active accounts', color: 'var(--st-a)', values: active.value.map((d) => d.active) }])
const newSeries = computed(() => [
  { key: 'accounts', label: 'Accounts', color: 'var(--st-a)', type: 'line', values: grow('accounts').daily },
  { key: 'players', label: 'Players', color: 'var(--st-b)', type: 'line', values: grow('players').daily },
  { key: 'claims', label: 'Claims', color: 'var(--st-c)', type: 'line', values: grow('claims').daily },
])
const xpSeries = computed(() => [{ key: 'xp', label: 'XP gained', color: 'var(--st-b)', values: xp.value.map((d) => d.xp) }])

// Fetched shortly after the pointer settles on a day.
let timer = 0
function onActiveHover(i) {
  clearTimeout(timer)
  whoError.value = ''
  if (i >= 0) timer = setTimeout(() => loadWho(i), 150)
}
async function loadWho(i) {
  const d = active.value?.[i]
  if (!d || !d.active) return
  if (whoCache.has(d.day)) {
    who.value = whoCache.get(d.day)
    return
  }
  try {
    const res = await statsApi.activeAccounts(d.day)
    whoCache.set(d.day, res)
    who.value = res
  } catch (err) {
    whoError.value = err instanceof ApiError ? err.message : 'Could not load the accounts.'
  }
}
onBeforeUnmount(() => clearTimeout(timer))

const TITLES = { player: 'Tracked', account: 'New account', claim: 'Claim', feedback: 'Feedback', follow: 'Followed', clan: 'New clan', competition: 'New competition' }
const feedTitle = (f) => (f.kind === 'claim' ? (f.detail === 'verified' ? 'Profile claimed' : 'Claim started') : f.kind === 'feedback' ? `Feedback (${f.detail})` : TITLES[f.kind] || f.kind)
</script>
