<template>
  <div class="so">
    <!-- Things that need you, only when there are any -->
    <section v-if="attention.length" class="so-attn" aria-label="Needs your attention">
      <template v-for="a in attention" :key="a.key">
        <RouterLink v-if="a.to" class="so-chip is-warn" :to="a.to">{{ a.text }} <span aria-hidden="true">→</span></RouterLink>
        <span v-else class="so-chip">{{ a.text }}</span>
      </template>
    </section>

    <!-- The headline numbers, each with how the latest stretch compares with the one before -->
    <section class="st-tiles is-six" aria-label="Summary">
      <div v-for="t in tiles" :key="t.key" class="st-tile">
        <span class="st-tile-label">{{ t.label }}</span>
        <span class="so-numrow">
          <b class="st-tile-num" :class="t.cls">{{ t.num }}</b>
          <span v-if="t.chip" class="st-delta" :class="`is-${t.trend.dir}`" :title="t.chipTip">{{ t.chip }}</span>
        </span>
        <small>{{ t.sub }}</small>
      </div>
    </section>

    <!-- People per day, with who the signed-in ones were -->
    <section class="st-card" aria-labelledby="st-people">
      <div class="st-card-head"><h2 id="st-people">People per day</h2><span class="st-hint">Last {{ days }} days</span></div>
      <p v-if="shares.error.value" class="st-empty">{{ shares.error.value }}</p>
      <p v-else-if="!shares.data.value" class="st-empty">Loading…</p>
      <StatChart v-else :labels="chartDays" :series="peopleSeries" legend empty-text="No visitors recorded in this time yet." @hover="onHover">
        <template #tooltip="{ index }">
          <p class="st-pop-head is-stacked">
            <b>{{ dayLong(chartDays[index]) }}</b>
            <span>{{ count(visitorsOn(index), 'visitor') }}<template v-if="activeOn(index)"> · {{ count(activeOn(index).active, 'account') }} active<template v-if="activeOn(index).logins || activeOn(index).resumed"> ({{ count(activeOn(index).logins, 'sign-in') }}, {{ fmt(activeOn(index).resumed) }} came back)</template></template></span>
          </p>
          <template v-if="activeOn(index)?.active">
            <p v-if="whoError" class="st-pop-note">{{ whoError }}</p>
            <p v-else-if="!who || who.day !== chartDays[index]" class="st-pop-note">Loading…</p>
            <ul v-else-if="who.accounts.length" class="st-pop-list">
              <li v-for="a in who.accounts.slice(0, POP_ROWS)" :key="a.email" class="st-pop-acct">
                <span class="st-pop-who"><b>{{ a.email }}</b><em v-if="a.players">{{ a.players }}</em></span>
                <small class="st-pop-meta">{{ a.logins ? 'Signed in' : 'Came back' }}<template v-if="a.lastSeen"> · <span :title="new Date(a.lastSeen).toLocaleString()">last seen {{ seenAgo(a.lastSeen) }}</span></template></small>
              </li>
              <li v-if="who.accounts.length > POP_ROWS" class="st-pop-more">and {{ who.accounts.length - POP_ROWS }} more</li>
            </ul>
          </template>
        </template>
      </StatChart>
      <p class="st-note">A visitor is a browser, counted once a day; the line is different accounts that signed in or came back. Hover or tap a day to see which. Visits by you, other admins and link previews are not counted, and anyone with Do Not Track on is not counted as an account.</p>
    </section>

    <!-- One card for each of the other tabs -->
    <div class="so-trio">
      <section class="st-card so-card" aria-labelledby="so-visitors">
        <div class="st-card-head">
          <h2 id="so-visitors">Visitors</h2>
          <button class="so-more" type="button" @click="$emit('go', 'visitors')">Follow visitors <span aria-hidden="true">→</span></button>
        </div>
        <p v-if="people.error.value" class="st-empty">{{ people.error.value }}</p>
        <p v-else-if="!pplSummary" class="st-empty">Loading…</p>
        <p v-else-if="!pplSummary.total" class="st-empty">Nobody has been followed in this time yet.</p>
        <template v-else>
          <ul class="so-facts">
            <li><b>{{ fmt(pplSummary.total) }}<template v-if="pplSummary.capped">+</template></b><small>people followed</small></li>
            <li><b>{{ fmt(pplSummary.accounts) }}</b><small>signed in</small></li>
            <li><b>{{ fmt(pplSummary.anonymous) }}</b><small>not signed in</small></li>
            <li><b>{{ fmt(pplSummary.returning) }}</b><small>came back another day</small></li>
          </ul>
          <h3 class="so-sub">Most active</h3>
          <ul class="so-people">
            <li v-for="v in pplSummary.busiest" :key="v.key">
              <button type="button" @click="$emit('go', 'visitors', v.key)">
                <span class="so-who"><b>{{ v.label }}</b><em v-if="v.players">{{ v.players }}</em></span>
                <small>{{ count(v.events, 'step') }}</small>
              </button>
            </li>
          </ul>
          <h3 class="so-sub">Latest</h3>
          <ul class="so-people">
            <li v-for="v in pplSummary.latest" :key="v.key">
              <button type="button" @click="$emit('go', 'visitors', v.key)">
                <span class="so-who"><b>{{ v.label }}</b><em v-if="v.players">{{ v.players }}</em></span>
                <small>{{ ago(v.last) }}</small>
              </button>
            </li>
          </ul>
          <p class="st-note">Averaging {{ fmt(pplSummary.avgSteps) }} steps each. Open anyone to see what they did, in order.</p>
        </template>
      </section>

      <section class="st-card so-card" aria-labelledby="so-features">
        <div class="st-card-head">
          <h2 id="so-features">What people do</h2>
          <button class="so-more" type="button" @click="$emit('go', 'features')">All events <span aria-hidden="true">→</span></button>
        </div>
        <p v-if="eventsData.error.value" class="st-empty">{{ eventsData.error.value }}</p>
        <p v-else-if="!events" class="st-empty">Loading…</p>
        <template v-else>
          <ul class="so-facts">
            <li><b>{{ fmt(actions.total) }}</b><small>things people did</small></li>
            <li><b>{{ fmt(pages.total) }}</b><small>page views</small></li>
          </ul>
          <h3 class="so-sub">Where people spend time</h3>
          <StatBars :items="areas.slice(0, 5)" />
          <h3 class="so-sub">From search to a tracked player</h3>
          <StatBars :items="funnel" color="var(--st-a)" />
          <h3 class="so-sub">Most used</h3>
          <StatBars :items="topActions" color="var(--st-c)" />
        </template>
      </section>

      <section class="st-card so-card" aria-labelledby="so-sharing">
        <div class="st-card-head">
          <h2 id="so-sharing">Sharing</h2>
          <button class="so-more" type="button" @click="$emit('go', 'sharing')">Details <span aria-hidden="true">→</span></button>
        </div>
        <p v-if="shares.error.value" class="st-empty">{{ shares.error.value }}</p>
        <p v-else-if="!share" class="st-empty">Loading…</p>
        <template v-else>
          <ul class="so-facts">
            <li><b>{{ fmt(share.shares) }}</b><small>shares</small></li>
            <li><b class="is-visits">{{ fmt(share.visits) }}</b><small>visits through links</small></li>
            <li><b>{{ share.pct }}</b><small>of all visits</small></li>
            <li><b>{{ share.perShare ?? '-' }}</b><small>visits per share</small></li>
          </ul>
          <p class="so-line">{{ count(share.link, 'link') }} · {{ count(share.image, 'image') }} · {{ count(share.social, 'post') }}</p>
          <h3 class="so-sub">Shared most</h3>
          <StatBars :items="sharedItems" color="var(--st-b)" empty-text="Nothing recorded yet." />
          <h3 class="so-sub">Where visitors came from</h3>
          <StatBars :items="sourceItems" color="var(--st-c)" empty-text="No visits through shared links yet." />
        </template>
      </section>
    </div>

    <!-- The rest of the site: how it is growing, and what just happened -->
    <div class="st-pair">
      <section class="st-card" aria-labelledby="st-growth">
        <div class="st-card-head"><h2 id="st-growth">Growth</h2><span class="st-hint">New in the last {{ days }} days</span></div>
        <p v-if="overviewData.error.value" class="st-empty">{{ overviewData.error.value }}</p>
        <p v-else-if="!overview" class="st-empty">Loading…</p>
        <ul v-else class="st-growth">
          <li v-for="g in growth" :key="g.key">
            <span class="st-growth-label">{{ g.label }}</span>
            <b>{{ g.big }}</b>
            <small :class="{ 'is-up': g.up }">{{ g.small }}</small>
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
          <li v-for="(f, i) in overview.feed.slice(0, 8)" :key="i">
            <i class="st-feed-dot" :class="`is-${f.kind}`" aria-hidden="true" />
            <span class="st-feed-text"><b>{{ feedTitle(f) }}</b> <span>{{ f.text }}</span><em v-if="f.detail && f.kind !== 'claim' && f.kind !== 'feedback'"> · {{ f.detail }}</em></span>
            <small>{{ ago(f.at) }}</small>
          </li>
        </ul>
        <p class="st-note">Newest first, across new accounts, players, claims, follows, clans, competitions and feedback.</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'
import { eventGroup, groupTotals } from '@/utils/eventGroups'
import StatBars from './StatBars.vue'
import StatChart from './StatChart.vue'
import StatSpark from './StatSpark.vue'
import { conversion, funnelRows, peopleSummary, sharingSummary, trend, trendLabel } from './overviewData'
import { ago, compact, count, dayLong, fmt, lastDays } from './statsFormat'
import { useStatsLoad } from './useStatsLoad'

const props = defineProps({ days: { type: Number, required: true } })
// 'go' asks the page to open one of the other tabs, optionally on one visitor.
defineEmits(['go'])

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

// The same data the other tabs load, so every number here matches the tab it comes from.
const shares = useStatsLoad((d) => statsApi.shares(d), 'Could not load the visitors and shares.')
const overviewData = useStatsLoad((d) => statsApi.overview(d), 'Could not load the overview.')
const activeData = useStatsLoad((d) => statsApi.dailyActive(d), 'Could not load the active accounts.')
const xpData = useStatsLoad((d) => statsApi.dailyXp(d), 'Could not load the XP.')
const eventsData = useStatsLoad((d) => statsApi.events(d), 'Could not load the events.')
const people = useStatsLoad((d) => statsApi.visitors(d), 'Could not load the visitors.')
const overview = overviewData.data
const active = computed(() => activeData.data.value?.days || null)
const xp = computed(() => xpData.data.value?.days || null)
const events = computed(() => eventsData.data.value?.events || null)

function loadAll() {
  shares.load(props.days)
  overviewData.load(props.days)
  activeData.load(props.days)
  xpData.load(props.days)
  eventsData.load(props.days)
  people.load(props.days)
  who.value = null
  whoCache.clear()
}
watch(() => props.days, loadAll, { immediate: true })

// --- needs attention ---------------------------------------------------------------------------------------------------
const attention = computed(() => {
  const o = overview.value
  if (!o) return []
  const list = []
  if (o.pendingClaims) list.push({ key: 'claims', text: `${count(o.pendingClaims, 'profile claim')} waiting`, to: { name: 'adminClaims' } })
  if (o.unverified) list.push({ key: 'unverified', text: `${count(o.unverified, 'account')} not verified` })
  return list
})

// --- headline tiles ----------------------------------------------------------------------------------------------------
const daily = computed(() => shares.data.value?.daily || null)
const grow = (key) => overview.value?.growth.find((g) => g.key === key) || null
const sumDaily = (list) => lastDays(props.days).map((_, i) => list.reduce((s, e) => s + (e.daily[i] || 0), 0))
const isPage = (e) => eventGroup(e.name).key === 'pages'
const actionEvents = computed(() => (events.value || []).filter((e) => !isPage(e)))
const pageEvents = computed(() => (events.value || []).filter(isPage))
const actions = computed(() => ({ total: actionEvents.value.reduce((s, e) => s + e.total, 0) }))
const pages = computed(() => ({ total: pageEvents.value.reduce((s, e) => s + e.total, 0) }))
const share = computed(() => sharingSummary(shares.data.value))

const tiles = computed(() => {
  const d = daily.value
  const visits = d ? d.reduce((s, x) => s + x.site, 0) : null
  const accounts = grow('accounts')
  const players = grow('players')
  const act = active.value
  const last = act ? act[act.length - 1] : null
  const make = (key, label, num, sub, t, extra = {}) => ({ key, label, num, sub, trend: t, chip: trendLabel(t), chipTip: `Compared with the ${Math.floor(props.days / 2)} days before`, ...extra })
  const none = trend([])
  return [
    make('visitors', 'Visitors', visits == null ? '-' : fmt(visits), d ? `${fmt(d[d.length - 1].site)} today · about ${fmt(Math.round(visits / d.length))} a day` : '', d ? trend(d.map((x) => x.site)) : none, { cls: 'is-visits' }),
    make('signups', 'New accounts', accounts ? fmt(accounts.added) : '-', accounts ? `${conversion(accounts.added, visits)} of visitors · ${fmt(accounts.total)} in all` : '', accounts ? trend(accounts.daily) : none),
    make('active', 'Active accounts today', last ? fmt(last.active) : '-', overview.value ? `${fmt(overview.value.activeWeek)} in the last 7 days` : '', act ? trend(act.map((x) => x.active)) : none),
    make('actions', 'Things people did', events.value ? fmt(actions.value.total) : '-', events.value ? `${fmt(pages.value.total)} page views` : '', events.value ? trend(sumDaily(actionEvents.value)) : none),
    make('shares', 'Shares', share.value ? fmt(share.value.shares) : '-', share.value ? `${fmt(share.value.visits)} visits came through shared links` : '', d ? trend(d.map((x) => x.shares)) : none),
    make('players', 'Tracked players', players ? fmt(players.total) : '-', players ? `+${fmt(players.added)} in ${props.days} days` : '', players ? trend(players.daily) : none),
  ]
})

// --- the chart -----------------------------------------------------------------------------------------------------------
const chartDays = computed(() => daily.value?.map((d) => d.day) || [])
const activeByDay = computed(() => new Map((active.value || []).map((d) => [d.day, d])))
const visitorsOn = (i) => daily.value?.[i]?.site ?? 0
const activeOn = (i) => activeByDay.value.get(chartDays.value[i]) || null
const peopleSeries = computed(() => {
  const list = [{ key: 'site', label: 'Visitors', color: 'var(--st-b)', values: daily.value.map((x) => x.site) }]
  if (active.value) list.push({ key: 'active', label: 'Active accounts', color: 'var(--st-a)', type: 'line', values: chartDays.value.map((day) => activeByDay.value.get(day)?.active ?? 0) })
  return list
})

// Fetched shortly after the pointer settles on a day.
let timer = 0
function onHover(i) {
  clearTimeout(timer)
  whoError.value = ''
  if (i >= 0) timer = setTimeout(() => loadWho(i), 150)
}
async function loadWho(i) {
  const d = activeOn(i)
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

// --- the three summaries ---------------------------------------------------------------------------------------------------
const pplSummary = computed(() => (people.data.value ? peopleSummary(people.data.value) : null))
const areas = computed(() => groupTotals(events.value || []))
const funnel = computed(() => funnelRows(events.value))
const topActions = computed(() => actionEvents.value.slice(0, 5).map((e) => ({ key: e.name, label: e.name, value: e.total, sub: e.accounts ? count(e.accounts, 'user') : '' })))
const sharedItems = computed(() => (share.value?.topItems || []).map((i) => ({ key: i.kind + i.item, label: i.item, value: i.shares, sub: `${i.label}${i.visits ? ` · ${count(i.visits, 'visit')}` : ''}` })))
const sourceItems = computed(() => (share.value?.topSources || []).map((s) => ({ key: s.source, label: s.label, value: s.visits })))

// --- growth ---------------------------------------------------------------------------------------------------------------
const growth = computed(() => {
  const list = (overview.value?.growth || []).map((g) => ({ key: g.key, label: g.label, big: fmt(g.total), small: g.added > 0 ? `+${fmt(g.added)}` : 'none new', up: g.added > 0, daily: g.daily }))
  if (xp.value) {
    const days = xp.value.slice(-props.days)
    const total = days.reduce((s, d) => s + d.xp, 0)
    const today = xp.value[xp.value.length - 1]
    list.push({ key: 'xp', label: 'XP gained', big: compact(total), small: `${compact(today.xp)} today`, up: today.xp > 0, daily: days.map((d) => d.xp) })
  }
  return list
})

const TITLES = { player: 'Tracked', account: 'New account', claim: 'Claim', feedback: 'Feedback', follow: 'Followed', clan: 'New clan', competition: 'New competition' }
const feedTitle = (f) => (f.kind === 'claim' ? (f.detail === 'verified' ? 'Profile claimed' : 'Claim started') : f.kind === 'feedback' ? `Feedback (${f.detail})` : TITLES[f.kind] || f.kind)
</script>
