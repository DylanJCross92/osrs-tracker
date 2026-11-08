<template>
  <div class="disc">
    <!-- Hero: pitch + stats + search + top gainer -->
    <section class="card disc-hero">
      <div class="disc-hero-main">
        <span class="disc-eyebrow"><span class="disc-live-dot" /> Live · updated {{ ago(data.generatedAt) }}</span>
        <h1>Discover <span class="home-accent">players</span></h1>
        <p class="disc-sub">Level-ups, 99s, big XP days and rising stars across every tracked OSRS player — right now.</p>

        <div v-if="players.length" class="disc-stat-tiles">
          <div class="disc-stat-tile">
            <span class="disc-stat-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c2.2.7 3.5 2.6 3.5 5.5" /></svg></span>
            <span><b>{{ players.length }}</b><small>players</small></span>
          </div>
          <div class="disc-stat-tile">
            <span class="disc-stat-icon green"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg></span>
            <span><b class="stat-gain">+{{ formatXp(totalToday || totalWeek) }}</b><small>XP {{ totalToday ? 'today' : '· 7 days' }}</small></span>
          </div>
          <div class="disc-stat-tile">
            <span class="disc-stat-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z" /></svg></span>
            <span><b>{{ levelUps }}</b><small>level-ups · 7 days</small></span>
          </div>
        </div>

        <label class="disc-search">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input v-model="query" type="text" placeholder="Search for a player" autocomplete="off" maxlength="12" @keydown.enter="goFirst" />
        </label>
        <ul v-if="suggestions.length" class="search-suggest">
          <li v-for="sg in suggestions" :key="sg.username">
            <RouterLink :to="profileTo(sg.username)"><span>{{ sg.displayName }}</span><small>Overall {{ sg.overallLevel?.toLocaleString() ?? '—' }}</small></RouterLink>
          </li>
        </ul>
        <p v-else-if="query.trim().length >= 2 && searched" class="disc-nomatch">No tracked player matches. <RouterLink to="/">Track them →</RouterLink></p>
      </div>

      <RouterLink v-if="spotlight" :to="profileTo(spotlight.p.username)" class="disc-spot">
        <span class="disc-spot-label"><span class="disc-live-dot" /> Top gainer {{ spotlight.period === 'day' ? 'today' : spotlight.period === 'week' ? 'this week' : 'this month' }}</span>
        <span class="disc-spot-top">
          <span v-if="spotlight.topSkill" class="disc-spot-avatar"><img :src="skillIconSrc(spotlight.topSkill)" :alt="spotlight.topSkill" width="34" height="34" /></span>
          <span class="disc-spot-name">{{ spotlight.p.displayName }}<PlayerBadge :label="spotlight.p.badge" /></span>
        </span>
        <span class="disc-spot-xp">+{{ spotlight.xp.toLocaleString() }} <small>XP</small></span>
        <span v-if="spotlight.topSkill" class="disc-spot-chip">mostly {{ spotlight.topSkill }} <b>+{{ formatXp(spotlight.topSkillXp) }}</b></span>
        <span class="disc-spot-cta">View profile →</span>
      </RouterLink>
    </section>

    <p v-if="loading" class="card empty-hint">Loading the latest activity…</p>
    <p v-else-if="error" class="card empty-hint">{{ error }}</p>

    <template v-else>
    <div class="disc-grid">
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
                <span class="disc-bar"><span :style="{ width: `${(r.xp / boardMax) * 100}%` }" /></span>
              </span>
              <span class="disc-board-xp" :class="{ dim: !r.xp }">{{ r.xp ? `+${formatXp(r.xp)}` : '—' }}</span>
            </RouterLink>
          </li>
        </ol>
        <p v-if="board.length && !board[0].xp" class="empty-hint">Nobody has gained {{ skill === 'Overall' ? '' : skill + ' ' }}XP {{ periodWord }} yet.</p>
      </section>
    </div>


    <!-- Trending + Most improved -->
    <div class="disc-two">
      <section class="card">
        <div class="disc-head"><h2>Trending players</h2><span class="disc-updated">updated {{ ago(insights.computedAt) }}</span></div>
        <ol v-if="trendingList.length" class="disc-rank-list">
          <li v-for="(t, i) in trendingList" :key="t.id"><RouterLink :to="profileTo(t.username)">
            <span class="disc-rank" :class="`r${i + 1}`">{{ i + 1 }}</span>
            <span class="disc-board-main"><span class="disc-board-name">{{ t.displayName }}<PlayerBadge :label="t.badge" /></span><small>{{ t.reason }}</small></span>
          </RouterLink></li>
        </ol>
        <p v-else class="empty-hint">Nothing is trending yet — players show up here with fresh gains or milestones.</p>
      </section>

      <section class="card">
        <div class="disc-head"><h2>Most improved</h2><span class="disc-updated">vs. previous 4-week average</span></div>
        <ol v-if="improvedList.length" class="disc-rank-list">
          <li v-for="(t, i) in improvedList" :key="t.id"><RouterLink :to="profileTo(t.username)">
            <span class="disc-rank" :class="`r${i + 1}`">{{ i + 1 }}</span>
            <span class="disc-board-main"><span class="disc-board-name">{{ t.displayName }}<PlayerBadge :label="t.badge" /></span><small>+{{ formatXp(t.currentWeek) }} this week vs. {{ formatXp(t.previousAvg) }} usual</small></span>
            <span class="disc-board-xp">+{{ t.pct }}%</span>
          </RouterLink></li>
        </ol>
        <div v-if="improvedList.length < 3" class="disc-info">
          <b>How "Most improved" works</b>
          <p>
            It compares the last 7 days with each player's previous four-week weekly average, so a player needs about five weeks of tracking history.
            Right now <b>{{ insights.improvedMeta?.withHistory ?? 0 }} of {{ insights.improvedMeta?.total ?? players.length }}</b> tracked players have that much.
          </p>
          <p>To qualify: at least {{ formatXp(insights.improvedMeta?.minWeek || 250000) }} XP this week, a usual week of {{ formatXp(insights.improvedMeta?.minUsual || 25000) }}+, and {{ insights.improvedMeta?.minPct || 25 }}% or more above it.</p>
        </div>
      </section>
    </div>

    <!-- Featured: weekly spotlight + players near milestones -->
    <div class="disc-featured">
      <section class="card disc-spotlight-card">
        <div class="disc-head">
          <h2>Player spotlight</h2>
          <span v-if="insights.spotlight" class="disc-updated">week of {{ shortDate(insights.spotlight.periodStart) }}</span>
        </div>
        <RouterLink v-if="insights.spotlight" :to="profileTo(insights.spotlight.username)" class="disc-spotlight">
          <span class="disc-spotlight-reason">{{ insights.spotlight.reason }}</span>
          <span class="disc-spotlight-name">{{ insights.spotlight.displayName }}<PlayerBadge :label="insights.spotlight.badge" /></span>
          <span class="disc-spotlight-headline">
            <img v-if="insights.spotlight.skill" :src="skillIconSrc(insights.spotlight.skill)" :alt="insights.spotlight.skill" width="28" height="28" />
            {{ insights.spotlight.headline }}
          </span>
          <span class="disc-spotlight-stats">
            <span v-for="st in insights.spotlight.stats" :key="st.label"><small>{{ st.label }}</small><b>{{ st.value }}</b></span>
          </span>
          <span class="disc-spot-cta">View profile →</span>
        </RouterLink>
        <p v-else class="empty-hint">The spotlight appears once someone has a week of activity to feature.</p>
      </section>

      <section class="card disc-near">
        <div class="disc-head">
          <h2>Closing in on a milestone</h2>
          <button v-if="nearAll.length > 5" class="btn-text" @click="nearOpen = !nearOpen">{{ nearOpen ? 'Show less' : `View all (${nearAll.length})` }}</button>
        </div>
        <ul v-if="nearList.length" class="disc-near-list">
          <li v-for="n in nearList" :key="n.id + n.milestone + n.skill">
            <RouterLink :to="profileTo(n.username)">
              <img :src="skillIconSrc(n.skill || 'Overall')" :alt="n.skill || 'Overall'" width="26" height="26" />
              <span class="disc-near-main">
                <span class="disc-near-top"><b>{{ n.displayName }}</b><span>{{ n.milestone }}<template v-if="n.skill"> · {{ n.skill }}</template></span></span>
                <span class="disc-bar gold"><span :style="{ width: `${n.progress}%` }" /></span>
                <small>{{ n.progress }}% · {{ n.remainingXp != null ? `${formatXp(n.remainingXp)} XP to go` : `${n.remainingLevels} levels to go` }}</small>
              </span>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="empty-hint">Nobody is within reach of a milestone yet — as players level up, the closest ones show here.</p>
      </section>
    </div>

    <!-- Explore by skill -->
    <section class="card disc-explore">
      <div class="disc-head"><h2>Explore by skill</h2></div>
      <div class="disc-explore-controls">
        <label class="period-select"><span class="period-select-label">Skill</span>
          <select v-model="exSkill"><option v-for="s in SKILL_NAMES" :key="s" :value="s">{{ s }}</option></select>
        </label>
        <div class="range-tabs">
          <button v-for="p in periods" :key="p.key" :class="{ active: exPeriod === p.key }" @click="exPeriod = p.key">{{ p.label }}</button>
        </div>
        <label class="period-select"><span class="period-select-label">Sort</span>
          <select v-model="exSort">
            <option value="gained">XP gained</option>
            <option value="total">Total XP</option>
            <option value="milestone">Closest milestone</option>
            <option value="n99">Closest to 99</option>
          </select>
        </label>
      </div>
      <ol v-if="exRows.length" class="disc-board-list">
        <li v-for="(r, i) in exRows" :key="r.p.id + exSkill" :style="{ '--i': i }">
          <RouterLink :to="profileTo(r.p.username)">
            <span class="disc-rank" :class="`r${i + 1}`">{{ i + 1 }}</span>
            <span class="disc-board-main">
              <span class="disc-board-name"><img :src="skillIconSrc(exSkill)" :alt="exSkill" width="18" height="18" />{{ r.p.displayName }}<PlayerBadge :label="r.p.badge" /></span>
              <span class="disc-bar gold"><span :style="{ width: `${r.progress}%` }" /></span>
              <small class="disc-explore-meta">Level {{ r.level }} · {{ formatXp(r.xp) }} XP · next: {{ r.nextLabel }} ({{ r.progress }}%)</small>
            </span>
            <span class="disc-board-xp" :class="{ dim: !r.gained }">{{ r.gained ? `+${formatXp(r.gained)}` : '—' }}</span>
          </RouterLink>
        </li>
      </ol>
      <p v-else class="empty-hint">No tracked players have {{ exSkill }} data yet.</p>
      <div v-if="skillAchievements.length" class="disc-skill-ach">
        <h3>Recent {{ exSkill }} achievements</h3>
        <ul class="disc-ach-list compact">
          <li v-for="a in skillAchievements" :key="a.key"><RouterLink :to="profileTo(a.username)"><b>{{ a.displayName }}</b> {{ a.title }} <small>{{ achievedWhen(a) }}</small></RouterLink></li>
        </ul>
      </div>
    </section>

    <!-- Recent achievements -->
    <section class="card disc-achievements">
      <div class="disc-head">
        <h2>Recent achievements</h2>
        <span class="disc-updated">as detected by TickGains</span>
      </div>
      <ul v-if="achievements.length" class="disc-ach-list">
        <li v-for="a in achievements.slice(0, achShown)" :key="a.key">
          <RouterLink :to="profileTo(a.username)">
            <span class="disc-event-icon"><img v-if="a.skill" :src="skillIconSrc(a.skill)" :alt="a.skill" width="24" height="24" /><span v-else class="disc-glyph">★</span></span>
            <span class="disc-event-text"><b>{{ a.displayName }}</b> <em class="gold">{{ a.title }}</em><small>{{ a.description }}</small></span>
            <span class="disc-event-time">{{ achievedWhen(a) }}</span>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="empty-hint">No major achievements detected yet — 99s, 100M+ XP and big total-level milestones land here.</p>
      <button v-if="achievements.length > achShown" class="btn btn-ghost" @click="achShown += 5">View more ({{ achievements.length - achShown }})</button>
      <p class="profile-note">"Detected" is when TickGains first saw the achievement in a saved snapshot. Where data had a gap, the date is shown as a range.</p>
    </section>

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
    </template>
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
const visibleEvents = computed(() => events.value)

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
// Gainers first, then everyone else dimmed — the board always fills out instead of leaving a gap.
const board = computed(() =>
  players.value
    .map((p) => ({ p, xp: skill.value === 'Overall' ? p.gains?.[period.value]?.xp || 0 : p.skillGains?.[period.value]?.[skill.value] || 0 }))
    .sort((a, b) => b.xp - a.xp || (b.p.overallXp || 0) - (a.p.overallXp || 0))
    .slice(0, 10),
)
const boardMax = computed(() => Math.max(board.value[0]?.xp || 0, 1))
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

// --- search ---
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


// --- insights (cached server-side; see discoverInsights.service.js) ---
const insights = computed(() => data.value.insights || {})
const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const fullDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const achievedWhen = (a) => (a.after ? `between ${fullDate(a.after)} and ${fullDate(a.detectedAt)}` : `detected ${fullDate(a.detectedAt)}`)
const achievements = computed(() => insights.value.achievements || [])
const achShown = ref(5)

// Don't repeat the weekly spotlight player in neighbouring sections when there are alternatives.
const spotId = computed(() => insights.value.spotlight?.id)
const without = (list, min) => {
  const filtered = list.filter((x) => x.id !== spotId.value)
  return filtered.length >= min ? filtered : list
}
const nearAll = computed(() => without(insights.value.nearMilestones || [], 5))
const nearOpen = ref(false)
const nearList = computed(() => (nearOpen.value ? nearAll.value : nearAll.value.slice(0, 5)))
const trendingList = computed(() => without(insights.value.trending || [], 3))
const improvedList = computed(() => insights.value.improved || [])

// --- explore by skill ---
const exSkill = ref('Agility')
const exPeriod = ref('week')
const exSort = ref('gained')
let exAutoPicked = false
watch(players, (list) => {
  if (exAutoPicked || !list.length) return
  exAutoPicked = true
  // Start on whichever skill saw the most XP this week.
  const totals = {}
  for (const p of list) for (const [k, v] of Object.entries(p.skillGains?.week || {})) totals[k] = (totals[k] || 0) + v
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]
  if (top) exSkill.value = top[0]
})
const SKILL_XP_STEPS = [10_000_000, 50_000_000, 100_000_000, 200_000_000]
const xpForLvl = (level) => {
  let points = 0
  let xp = 0
  for (let l = 1; l < level; l++) {
    points += Math.floor(l + 300 * 2 ** (l / 7))
    xp = Math.floor(points / 4)
  }
  return xp
}
const XP99 = xpForLvl(99)
const XP90 = xpForLvl(90)
function nextMilestone(level, xp) {
  const steps = [
    { label: 'Level 90', xp: XP90 },
    { label: 'Level 99', xp: XP99 },
    ...SKILL_XP_STEPS.map((x) => ({ label: `${formatXp(x)} XP`, xp: x })),
  ].filter((s) => xp < s.xp)
  const next = steps[0]
  return next ? { label: next.label, progress: Math.min(Math.round((xp / next.xp) * 1000) / 10, 99.9) } : { label: 'Maxed', progress: 100 }
}
const exRows = computed(() => {
  const rows = players.value
    .map((p) => {
      const sk = p.skillLevels?.[exSkill.value]
      if (!sk) return null
      const next = nextMilestone(sk.level, sk.xp)
      const to99 = sk.level >= 99 ? 100 : Math.round((sk.xp / XP99) * 1000) / 10
      return { p, level: sk.level, xp: sk.xp, gained: p.skillGains?.[exPeriod.value]?.[exSkill.value] || 0, nextLabel: next.label, progress: exSort.value === 'n99' ? to99 : next.progress, to99 }
    })
    .filter(Boolean)
  if (exSort.value === 'gained') rows.sort((a, b) => b.gained - a.gained || b.xp - a.xp)
  else if (exSort.value === 'total') rows.sort((a, b) => b.xp - a.xp)
  else if (exSort.value === 'n99') return rows.filter((r) => r.level < 99).sort((a, b) => b.to99 - a.to99).slice(0, 10).map((r) => ({ ...r, nextLabel: 'Level 99' }))
  else rows.sort((a, b) => b.progress - a.progress)
  return rows.slice(0, 10)
})
const skillAchievements = computed(() => achievements.value.filter((a) => a.skill === exSkill.value).slice(0, 3))
watch([exSkill, exPeriod, exSort], () => track('discover_explore', { skill: exSkill.value, period: exPeriod.value, sort: exSort.value }))

const rails = [{ key: 'recentlyTracked', title: 'Recently tracked' }]
</script>
