<template>
  <div class="disc">
    <!-- Hero: pitch + search + spotlight -->
    <section class="card disc-hero">
      <div class="disc-hero-main">
        <h1>Discover</h1>
        <p class="disc-sub">See what's happening across tracked OSRS players — right now.</p>
        <div class="disc-stats" v-if="players.length">
          <span><b>{{ players.length }}</b> players</span>
          <span><b class="stat-gain">+{{ formatXp(totalToday || totalWeek) }}</b> XP {{ totalToday ? 'today' : 'this week' }}</span>
          <span><b>{{ levelUps }}</b> level-ups this week</span>
        </div>
        <div class="disc-search">
          <input v-model="query" type="text" placeholder="Search a tracked player…" autocomplete="off" @keydown.enter="goFirst" />
          <button class="btn btn-ghost" type="button" :disabled="!players.length" @click="surprise">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4" /><circle cx="12" cy="12" r="3" /></svg>
            Surprise me
          </button>
        </div>
        <ul v-if="suggestions.length" class="search-suggest">
          <li v-for="sg in suggestions" :key="sg.username">
            <RouterLink :to="profileTo(sg.username)"><span>{{ sg.displayName }}</span><small>Overall {{ sg.overallLevel?.toLocaleString() ?? '—' }}</small></RouterLink>
          </li>
        </ul>
        <p v-else-if="query.trim().length >= 2 && searched" class="disc-nomatch">No tracked player matches. <RouterLink to="/">Track them →</RouterLink></p>
      </div>

      <RouterLink v-if="spotlight" :to="profileTo(spotlight.p.username)" class="disc-spot">
        <span class="disc-spot-label"><span class="disc-live-dot" /> Top gainer {{ spotlight.period === 'day' ? 'today' : spotlight.period === 'week' ? 'this week' : 'this month' }}</span>
        <span class="disc-spot-name">{{ spotlight.p.displayName }}<PlayerBadge :label="spotlight.p.badge" /></span>
        <span class="disc-spot-xp">+{{ spotlight.xp.toLocaleString() }} <small>XP</small></span>
        <span v-if="spotlight.topSkill" class="disc-spot-skill">
          <img :src="skillIconSrc(spotlight.topSkill)" :alt="spotlight.topSkill" width="22" height="22" />
          mostly {{ spotlight.topSkill }} (+{{ formatXp(spotlight.topSkillXp) }})
        </span>
        <span class="disc-spot-cta">View profile →</span>
      </RouterLink>
    </section>

    <p v-if="loading" class="card empty-hint">Loading the latest activity…</p>
    <p v-else-if="error" class="card empty-hint">{{ error }}</p>

    <div v-else class="disc-grid">
      <!-- Live activity -->
      <section class="card disc-feed">
        <div class="disc-head">
          <h2><span class="disc-live-dot" /> Live activity</h2>
          <span class="disc-updated">updated {{ ago(data.generatedAt) }}</span>
        </div>
        <div class="range-tabs disc-chips">
          <button v-for="f in feedFilters" :key="f.key" :class="{ active: feedFilter === f.key }" @click="feedFilter = f.key">{{ f.label }}</button>
        </div>
        <ul class="disc-events">
          <li v-for="(e, i) in visibleEvents" :key="e.id" :class="['disc-event', `kind-${e.kind}`, { 'is-new': newIds.has(e.id) }]" :style="{ '--i': i }">
            <RouterLink :to="profileTo(e.username)">
              <span class="disc-event-icon">
                <img v-if="e.skill" :src="skillIconSrc(e.skill)" :alt="e.skill" width="24" height="24" />
                <span v-else-if="e.kind === 'gain'" class="disc-glyph">▲</span>
                <span v-else class="disc-glyph">★</span>
              </span>
              <span class="disc-event-text">
                <b>{{ e.displayName }}</b>
                <template v-if="e.kind === 'max'"> hit <em class="gold">level 99 {{ e.skill }}</em></template>
                <template v-else-if="e.kind === 'levelup'"> reached <em>{{ e.skill }} level {{ e.to }}</em><small v-if="e.to - e.from > 1"> (+{{ e.to - e.from }} levels)</small></template>
                <template v-else-if="e.kind === 'gain'"> gained <em class="stat-gain">+{{ formatXp(e.xp) }} XP</em></template>
                <template v-else> unlocked <em class="gold">{{ e.title }}</em></template>
              </span>
              <span class="disc-event-time">{{ ago(e.at) }}</span>
            </RouterLink>
          </li>
        </ul>
        <p v-if="!events.length" class="empty-hint">Nothing in the last 7 days for this filter — check back soon.</p>
        <button v-if="events.length > shownEvents" class="btn btn-ghost" @click="shownEvents += 12">Show more ({{ events.length - shownEvents }})</button>
      </section>

      <!-- Leaderboard -->
      <section class="card disc-board">
        <div class="disc-head"><h2>Leaderboard</h2></div>
        <div class="range-tabs disc-chips">
          <button v-for="p in periods" :key="p.key" :class="{ active: period === p.key }" @click="period = p.key">{{ p.label }}</button>
        </div>
        <label class="period-select disc-skill-select">
          <span class="period-select-label">XP gained in</span>
          <select v-model="skill">
            <option value="Overall">Overall</option>
            <option v-for="s in SKILL_NAMES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <ol class="disc-board-list">
          <li v-for="(r, i) in board" :key="r.p.id + skill + period" :style="{ '--i': i }">
            <RouterLink :to="profileTo(r.p.username)">
              <span class="disc-rank" :class="`r${i + 1}`">{{ i + 1 }}</span>
              <span class="disc-board-main">
                <span class="disc-board-name">{{ r.p.displayName }}<PlayerBadge :label="r.p.badge" /></span>
                <span class="disc-bar"><span :style="{ width: `${(r.xp / board[0].xp) * 100}%` }" /></span>
              </span>
              <span class="disc-board-xp">+{{ formatXp(r.xp) }}</span>
            </RouterLink>
          </li>
        </ol>
        <p v-if="!board.length" class="empty-hint">Nobody has gained {{ skill === 'Overall' ? '' : skill + ' ' }}XP {{ periodWord }} yet.</p>
      </section>
    </div>

    <!-- Curated rails -->
    <section v-for="rail in rails" v-show="data[rail.key]?.length" :key="rail.key" class="disc-rail-section">
      <h2>{{ rail.title }}</h2>
      <div class="disc-rail">
        <RouterLink v-for="p in data[rail.key]" :key="p.id" :to="profileTo(p.username)" class="card discover-card">
          <span class="discover-card-name">{{ p.displayName }}<PlayerBadge :label="p.badge" /></span>
          <span class="discover-card-stats">
            <span>Overall {{ p.overallLevel?.toLocaleString() }}</span>
            <span>{{ formatXp(p.overallXp) }} XP</span>
            <span v-if="p.overallRank > 0">Rank {{ p.overallRank.toLocaleString() }}</span>
          </span>
          <span v-if="p.featured" :class="['discover-card-featured', p.featured.kind === 'gain' ? '' : 'neutral']">
            <img v-if="p.featured.skill" :src="skillIconSrc(p.featured.skill)" :alt="p.featured.skill" width="16" height="16" />
            {{ p.featured.text }}
          </span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PlayerBadge from '@/components/PlayerBadge.vue'
import { playersApi } from '@/api/players'
import { setPageMeta } from '@/utils/pageMeta'
import { skillIconSrc, formatXp, SKILL_NAMES } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { track } from '@/utils/analytics'

setPageMeta({
  title: 'Discover OSRS Players',
  description: 'Live OSRS activity: recent level-ups and 99s, top XP gainers today, this week and this month, and players closing in on max.',
  path: '/discover',
})

const router = useRouter()
const data = ref({ players: [], activity: [] })
const loading = ref(true)
const error = ref('')

const players = computed(() => data.value.players || [])
const events = computed(() => {
  const list = data.value.activity || []
  const f = feedFilter.value
  if (f === 'levels') return list.filter((e) => e.kind === 'levelup' || e.kind === 'max')
  if (f === '99') return list.filter((e) => e.kind === 'max')
  if (f === 'xp') return list.filter((e) => e.kind === 'gain')
  if (f === 'milestones') return list.filter((e) => e.kind === 'milestone')
  return list
})
const profileTo = (username) => ({ name: 'playerDetail', params: { username } })

// --- live refresh: refetch every minute and keep relative times ticking ---
const now = ref(Date.now())
const newIds = ref(new Set())
let seenIds = null
let refreshTimer = null
let tickTimer = null
async function load(initial = false) {
  try {
    const fresh = await playersApi.discover()
    const ids = new Set((fresh.activity || []).map((e) => e.id))
    if (seenIds) newIds.value = new Set([...ids].filter((id) => !seenIds.has(id)))
    seenIds = ids
    data.value = fresh
    error.value = ''
  } catch {
    if (initial) error.value = 'Could not load discovery right now.'
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  load(true)
  refreshTimer = setInterval(load, 60_000)
  tickTimer = setInterval(() => (now.value = Date.now()), 30_000)
})
onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  clearInterval(tickTimer)
})
const ago = (iso) => {
  void now.value // re-evaluate as time passes
  return iso ? formatRelative(iso) : ''
}

// --- activity feed ---
const feedFilters = [
  { key: 'all', label: 'All' },
  { key: 'levels', label: 'Level-ups' },
  { key: '99', label: '99s' },
  { key: 'xp', label: 'Big gains' },
  { key: 'milestones', label: 'Milestones' },
]
const feedFilter = ref('all')
const shownEvents = ref(12)
watch(feedFilter, () => (shownEvents.value = 12))
const visibleEvents = computed(() => events.value.slice(0, shownEvents.value))

// --- leaderboard (period + skill) ---
const periods = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
]
const period = ref('day')
const skill = ref('Overall')
let periodAutoPicked = false
// If nobody has gained anything yet today, start on the 7-day view instead of an empty board.
watch(players, (list) => {
  if (!periodAutoPicked && list.length) {
    periodAutoPicked = true
    if (!list.some((p) => p.gains?.day?.xp > 0)) period.value = 'week'
  }
})
const periodWord = computed(() => ({ day: 'today', week: 'this week', month: 'this month' })[period.value])
const board = computed(() =>
  players.value
    .map((p) => ({ p, xp: skill.value === 'Overall' ? p.gains?.[period.value]?.xp || 0 : p.skillGains?.[period.value]?.[skill.value] || 0 }))
    .filter((r) => r.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10),
)
watch([period, skill], () => track('discover_leaderboard', { period: period.value, skill: skill.value }))

// --- hero ---
const totalToday = computed(() => players.value.reduce((s, p) => s + Math.max(p.gains?.day?.xp || 0, 0), 0))
const totalWeek = computed(() => players.value.reduce((s, p) => s + Math.max(p.gains?.week?.xp || 0, 0), 0))
const levelUps = computed(() => (data.value.activity || []).filter((e) => e.kind === 'levelup' || e.kind === 'max').reduce((n, e) => n + (e.to - e.from), 0))
const spotlight = computed(() => {
  for (const key of ['day', 'week', 'month']) {
    const top = [...players.value].filter((p) => p.gains?.[key]?.xp > 0).sort((a, b) => b.gains[key].xp - a.gains[key].xp)[0]
    if (top) return { p: top, period: key, xp: top.gains[key].xp, topSkill: top.gains[key].topSkill, topSkillXp: top.gains[key].topSkillXp }
  }
  return null
})

// --- search + surprise ---
const query = ref('')
const suggestions = ref([])
const searched = ref(false)
let searchTimer = null
watch(query, (q) => {
  clearTimeout(searchTimer)
  searched.value = false
  const term = q.trim()
  if (term.length < 2) {
    suggestions.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    try {
      const rows = await playersApi.search(term)
      if (query.value.trim() === term) suggestions.value = rows
    } catch {
      suggestions.value = []
    } finally {
      searched.value = true
    }
  }, 250)
})
function goFirst() {
  if (suggestions.value[0]) router.push(profileTo(suggestions.value[0].username))
}
function surprise() {
  const pool = players.value
  if (!pool.length) return
  const pick = pool[Math.floor(Math.random() * pool.length)]
  track('discover_surprise')
  router.push(profileTo(pick.username))
}

const rails = [
  { key: 'recent99', title: 'Recent level 99s' },
  { key: 'approachingMax', title: 'Closing in on max' },
  { key: 'recentlyTracked', title: 'Recently tracked' },
]
</script>
