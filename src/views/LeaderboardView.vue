<template>
  <div class="lb">
    <section class="card lb-head">
      <div>
        <h1>Leaderboard</h1>
        <p class="lb-sub">Every tracked OSRS player, ranked. Pick a time window and a skill, or rank by all-time totals.</p>
      </div>
      <span v-if="data.generatedAt" class="lb-updated">{{ players.length.toLocaleString('en-US') }} players · updated {{ ago(data.generatedAt) }}</span>
    </section>

    <section class="card lb-board">
      <div class="lb-controls">
        <div class="range-tabs">
          <button v-for="m in modes" :key="m.key" :class="{ active: mode === m.key }" @click="setMode(m.key)">{{ m.label }}</button>
        </div>
        <div class="lb-controls-row">
          <label v-if="mode === 'gains'" class="period-select">
            <span class="period-select-label">Window</span>
            <select v-model="period">
              <option v-for="p in periods" :key="p.key" :value="p.key">{{ p.long }}</option>
            </select>
          </label>
          <label v-if="mode !== 'level'" class="period-select">
            <span class="period-select-label">Skill</span>
            <select v-model="skill">
              <option value="Overall">Overall</option>
              <option v-for="s in SKILL_NAMES" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <input v-model.trim="query" class="lb-search" type="search" placeholder="Find a player" aria-label="Find a player" autocomplete="off" data-1p-ignore />
        </div>
      </div>

      <p v-if="loading" class="empty-hint">Loading leaderboard...</p>
      <p v-else-if="error" class="empty-hint">{{ error }}</p>
      <template v-else>
        <ol class="disc-board-list lb-list">
          <li v-for="r in shown" :key="r.p.id" :class="{ 'lb-me': r.p.username === highlight }">
            <RouterLink :to="{ name: 'playerDetail', params: { username: r.p.username } }" @click="track('leaderboard_player_click', { rank: r.rank, mode })">
              <span class="disc-rank" :class="`r${r.rank}`">{{ r.rank.toLocaleString('en-US') }}</span>
              <span class="disc-board-main">
                <span class="disc-board-name">{{ r.p.displayName }}<PlayerBadge :label="r.p.badge" :claimed="r.p.claimed" /></span>
                <span class="disc-bar"><span :style="{ width: `${(r.value / max) * 100}%` }" /></span>
              </span>
              <span class="lb-meta">{{ r.meta }}</span>
              <span class="disc-board-xp" :class="{ dim: !r.value, 'lb-plain': mode !== 'gains' }">{{ valueText(r) }}</span>
            </RouterLink>
          </li>
        </ol>
        <p v-if="!shown.length" class="empty-hint">No players match "{{ query }}".</p>
        <p v-else-if="mode === 'gains' && !ranked[0]?.value" class="empty-hint">Nobody has gained {{ skill === 'Overall' ? '' : skill + ' ' }}XP in this window yet.</p>
        <div class="lb-foot">
          <button v-if="shown.length < rows.length" class="lb-more" @click="limit += 25; track('leaderboard_show_more')">Show more ({{ rows.length - shown.length }} left)</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlayerBadge from '@/components/PlayerBadge.vue'
import { playersApi } from '@/api/players'
import { setPageMeta } from '@/utils/pageMeta'
import { SKILL_NAMES, formatXp } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { track } from '@/utils/analytics'

setPageMeta({
  title: 'OSRS Leaderboard',
  description: 'OSRS XP leaderboard: top XP gains today, this week and this month, plus all-time total XP and total level for every tracked player.',
  path: '/leaderboard',
})

const route = useRoute()
const router = useRouter()

const modes = [
  { key: 'gains', label: 'XP gained' },
  { key: 'xp', label: 'Total XP' },
  { key: 'level', label: 'Total level' },
]
const periods = [
  { key: 'day', label: 'Today', long: 'Today' },
  { key: 'week', label: '7 days', long: 'Last 7 days' },
  { key: 'month', label: '30 days', long: 'Last 30 days' },
]

// State lives in the URL so any view can be shared as a link.
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)
const mode = ref(pick(route.query.mode, modes.map((m) => m.key), 'gains'))
const period = ref(pick(route.query.period, periods.map((p) => p.key), 'day'))
const skill = ref(pick(route.query.skill, ['Overall', ...SKILL_NAMES], 'Overall'))
const query = ref('')
const limit = ref(25)
const highlight = typeof route.query.u === 'string' ? route.query.u : ''
let periodTouched = !!route.query.period

watch(period, () => (periodTouched = true))
watch([mode, period, skill, query], () => (limit.value = 25))
let searchTimer = null
watch(query, (q) => {
  clearTimeout(searchTimer)
  if (q) searchTimer = setTimeout(() => track('leaderboard_search', { username_length: q.length }), 800)
})
watch([mode, period, skill], () => {
  const q = { mode: mode.value, skill: skill.value }
  if (mode.value === 'gains') q.period = period.value
  router.replace({ query: q })
  track('leaderboard_view', { mode: mode.value, period: period.value, skill: skill.value })
})
function setMode(m) {
  mode.value = m
  if (m === 'level') skill.value = 'Overall'
}

const data = ref({ players: [] })
const loading = ref(true)
const error = ref('')
const players = computed(() => data.value.players || [])
const now = ref(Date.now())
let timer = null
let tick = null
async function load(initial = false) {
  try {
    data.value = await playersApi.discover()
    error.value = ''
  } catch {
    if (initial) error.value = 'Could not load the leaderboard right now.'
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  load(true)
  timer = setInterval(load, 60_000)
  tick = setInterval(() => (now.value = Date.now()), 30_000)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearInterval(tick)
})
const ago = (iso) => {
  void now.value
  return iso ? formatRelative(iso) : ''
}

// If nobody has gained anything today, open on the 7-day window instead of an empty board.
watch(players, (list) => {
  if (!periodTouched && list.length && !list.some((p) => p.gains?.day?.xp > 0)) period.value = 'week'
  periodTouched = true
})

const valueOf = (p) => {
  if (mode.value === 'gains') return skill.value === 'Overall' ? p.gains?.[period.value]?.xp || 0 : p.skillGains?.[period.value]?.[skill.value] || 0
  if (mode.value === 'xp') return skill.value === 'Overall' ? p.overallXp || 0 : p.skillLevels?.[skill.value]?.xp || 0
  return p.overallLevel || 0
}
const metaOf = (p) => {
  if (mode.value === 'level') return `${Math.round(p.overallXp || 0).toLocaleString('en-US')} XP`
  if (skill.value === 'Overall') return p.overallLevel ? `Total ${p.overallLevel.toLocaleString('en-US')}` : ''
  const lv = p.skillLevels?.[skill.value]?.level
  return lv ? `Level ${lv}` : ''
}

// Rank everyone first so ranks stay true when the list is filtered by name.
const ranked = computed(() =>
  players.value
    .map((p) => ({ p, value: valueOf(p), meta: metaOf(p) }))
    .sort((a, b) => b.value - a.value || (b.p.overallXp || 0) - (a.p.overallXp || 0))
    .map((r, i) => ({ ...r, rank: i + 1 })),
)
const rows = computed(() => {
  const q = query.value.toLowerCase()
  return q ? ranked.value.filter((r) => r.p.displayName.toLowerCase().includes(q)) : ranked.value
})
const shown = computed(() => rows.value.slice(0, limit.value))
const max = computed(() => Math.max(ranked.value[0]?.value || 0, 1))
const valueText = (r) => {
  if (!r.value) return '-'
  if (mode.value === 'gains') return `+${formatXp(r.value)}`
  return `${Math.round(r.value).toLocaleString('en-US')}${mode.value === 'level' ? '' : ' XP'}`
}

</script>
