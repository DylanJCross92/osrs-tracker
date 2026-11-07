<template>
  <div class="card detail-header">
    <div>
      <a href="#" class="btn-text back-link" @click.prevent="router.push({ name: 'players' })">← All players</a>
      <h1 class="detail-name">{{ player?.displayName || usernameParam }}</h1>
      <p v-if="latest" class="last-synced">
        Last updated {{ formatRelative(latest.capturedAt) }}
        <button class="btn-text refresh-link" :disabled="refreshing || !player" @click="refresh">
          {{ refreshing ? 'Syncing…' : 'Refresh Now' }}
        </button>
        <span v-if="checkingForUpdates" class="checking-indicator">
          <span class="spinner" /> Checking for updates…
        </span>
      </p>
    </div>
    <div class="detail-actions">
      <label class="period-select">
        <span class="period-select-label">Show gains for</span>
        <select v-model="period">
          <option value="day">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
      </label>
      <button
        v-if="player?.womImportStatus === 'none'"
        class="btn btn-ghost"
        :disabled="checkingWomHistory"
        @click="checkWomHistory"
      >
        {{ checkingWomHistory ? 'Checking…' : 'Check for Historical' }}
      </button>
      <button class="btn btn-ghost" :disabled="!player" @click="shareModalOpen = true">Share</button>
    </div>
  </div>

  <ShareCardModal v-if="shareModalOpen && player" :username="player.username" @close="shareModalOpen = false" />

  <div v-if="isImportingWomHistory" class="card wom-import-banner">
    <span class="spinner" />
    <p>Still importing historical data from Wise Old Man — the chart and table below will fill in as it finds more.</p>
  </div>

  <div v-if="loading" class="card"><p class="empty-hint">Loading hiscores history…</p></div>

  <template v-else-if="snapshots.length">
    <div class="card hiscores-panel">
      <table class="hiscores-table">
        <thead>
          <tr>
            <th class="hs-skill-col">Skill</th>
            <th>Rank</th>
            <th>Level</th>
            <th>Experience</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="skill in HISCORES_SKILL_ORDER"
            :key="skill"
            class="hiscores-row"
            :class="{ active: selectedSkill === skill }"
            tabindex="0"
            role="button"
            :aria-pressed="selectedSkill === skill"
            @click="selectedSkill = skill"
            @keydown.enter="selectedSkill = skill"
            @keydown.space.prevent="selectedSkill = skill"
          >
            <td class="hs-skill-col">
              <span class="skill-cell">
                <img class="skill-icon" :src="skillIconSrc(skill)" :alt="skill" width="16" height="16" />
                <span class="skill-name">{{ skill }}</span>
              </span>
            </td>
            <td>
              <span
                v-if="periodRankGains[skill] > 0"
                class="xp-delta"
                :title="`Climbed ${periodRankGains[skill].toLocaleString()} ranks ${periodPhrase}`"
              >
                +{{ formatXp(periodRankGains[skill]) }}
              </span>
              {{ rankLabel(rankForSkill(latest, skill)) }}
            </td>
            <td>
              <span v-if="periodLevelGains[skill] > 0" class="xp-delta" :title="`+${periodLevelGains[skill]} levels ${periodPhrase}`">
                +{{ periodLevelGains[skill] }}
              </span>
              {{ levelForSkill(latest, skill).toLocaleString() }}
            </td>
            <td class="hs-xp-col">
              <span v-if="periodXpGains[skill] > 0" class="xp-delta" :title="`+${periodXpGains[skill].toLocaleString()} xp ${periodPhrase}`">
                +{{ formatXp(periodXpGains[skill]) }}
              </span>
              {{ xpForSkill(latest, skill).toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selectedSkill !== 'Overall'" class="card skill-progress-card">
      <div class="skill-progress-head">
        <img class="skill-progress-icon" :src="skillIconSrc(selectedSkill)" :alt="selectedSkill" width="28" height="28" />
        <h2 class="skill-progress-name">{{ selectedSkill }}</h2>
        <span class="skill-progress-level">Level {{ targetSkillLevel }}</span>
      </div>
      <template v-if="selectedSkillLevel < 99">
        <div class="level-progress-track">
          <div class="level-progress-fill" :style="{ width: levelProgressPercent + '%' }"></div>
        </div>
        <p class="level-progress-caption">
          {{ levelProgressPercent.toFixed(1) }}% — {{ xpToNextLevel.toLocaleString() }} xp to go
        </p>
      </template>
      <p v-else class="level-progress-caption">Max level reached — nice work.</p>

      <template v-if="trainingAdvice">
        <h3 class="training-advice-heading">Training tips</h3>
        <div class="advice-row">
          <span class="advice-label">⚡ Fastest</span>
          <span class="advice-text">
            {{ trainingAdvice.fastest }}
            <span v-if="trainingAdvice.actionsToNext" class="advice-eta">
              ~{{ trainingAdvice.actionsToNext.toLocaleString() }} {{ trainingAdvice.actionLabel }} (~{{ trainingAdvice.timeToNext }}) to reach level
              {{ trainingAdvice.nextLevel }} ({{ trainingAdvice.xpToNext.toLocaleString() }} xp to go).
            </span>
            <span v-else class="advice-eta">You're already at the max level (99)!</span>
          </span>
        </div>
        <div v-if="trainingAdvice.alt" class="advice-row">
          <span class="advice-label">🌱 Skiller-friendly</span>
          <span class="advice-text">
            {{ trainingAdvice.alt.fastest }}
            <span class="advice-eta">
              ~{{ trainingAdvice.alt.actionsToNext.toLocaleString() }} {{ trainingAdvice.alt.actionLabel }} (~{{ trainingAdvice.alt.timeToNext }}) to reach level
              {{ trainingAdvice.nextLevel }}.
            </span>
          </span>
        </div>
        <div class="advice-row">
          <span class="advice-label">💰 Best money maker</span>
          <span class="advice-text">
            <template v-if="trainingAdvice.money">{{ trainingAdvice.money }}</template>
            <template v-else-if="trainingAdvice.moneyUnlocksAt">
              No reliable money-making method yet — that opens up at level {{ trainingAdvice.moneyUnlocksAt }}.
            </template>
            <template v-else>No reliable money-making method for this skill — it's a pure xp (and gp) investment.</template>
          </span>
        </div>
      </template>
    </div>

    <div class="gain-tiles">
      <div class="card gain-tile">
        <span class="stat-label">{{ selectedSkill }} gained today</span>
        <span class="stat-value stat-gain">{{ formatSignedXp(gain('day')) }}</span>
      </div>
      <div class="card gain-tile">
        <span class="stat-label">{{ selectedSkill }} gained this week</span>
        <span class="stat-value stat-gain">{{ formatSignedXp(gain('week')) }}</span>
      </div>
      <div class="card gain-tile">
        <span class="stat-label">{{ selectedSkill }} gained this month</span>
        <span class="stat-value stat-gain">{{ formatSignedXp(gain('month')) }}</span>
      </div>
    </div>

    <div class="card">
      <div class="chart-header">
        <h2>{{ selectedSkill }} XP over time</h2>
      </div>
      <XpLineChart :points="chartPoints" :aria-label="`${selectedSkill} experience over time`" />
      <button class="btn-text table-toggle" @click="showTable = !showTable">
        {{ showTable ? 'Hide' : 'Show' }} data table
      </button>
      <div v-if="showTable" class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th class="day-toggle-col"></th>
              <th>Updated</th>
              <th>Rank</th>
              <th>Rank Gained</th>
              <th>Level</th>
              <th>Lvl Gained</th>
              <th>XP</th>
              <th>XP Gained</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="month in monthGroups" :key="month.key">
              <tr
                v-if="showMonthGrouping"
                class="month-row"
                tabindex="0"
                role="button"
                :aria-expanded="expandedMonths.has(month.key)"
                @click="toggleMonth(month.key)"
                @keydown.enter="toggleMonth(month.key)"
                @keydown.space.prevent="toggleMonth(month.key)"
              >
                <td class="day-toggle-col">
                  <span class="chevron" :class="{ open: expandedMonths.has(month.key) }">▸</span>
                </td>
                <td>{{ month.label }} <span class="day-row-count">({{ month.days.length }} day{{ month.days.length === 1 ? '' : 's' }})</span></td>
                <td>{{ rankLabel(month.rank) }}</td>
                <td :class="{ 'stat-gain': month.rankGain > 0 }">{{ month.rankGain != null ? formatSignedXp(month.rankGain) : '--' }}</td>
                <td>{{ month.level }}</td>
                <td :class="{ 'stat-gain': month.levelGain > 0 }">{{ month.levelGain != null ? formatSignedXp(month.levelGain) : '--' }}</td>
                <td>{{ month.xp.toLocaleString() }}</td>
                <td :class="{ 'stat-gain': month.xpGain > 0 }">{{ month.xpGain != null ? formatSignedXp(month.xpGain) : '--' }}</td>
              </tr>
              <template v-if="!showMonthGrouping || expandedMonths.has(month.key)">
                <template v-for="group in month.days" :key="group.key">
                  <tr
                    class="day-row"
                    :class="{ 'day-row-nested': showMonthGrouping }"
                    tabindex="0"
                    role="button"
                    :aria-expanded="expandedDays.has(group.key)"
                    @click="toggleDay(group.key)"
                    @keydown.enter="toggleDay(group.key)"
                    @keydown.space.prevent="toggleDay(group.key)"
                  >
                    <td class="day-toggle-col">
                      <span class="chevron" :class="{ open: expandedDays.has(group.key) }">▸</span>
                    </td>
                    <td>{{ group.label }} <span class="day-row-count">({{ group.rows.length }})</span></td>
                    <td>{{ rankLabel(group.rank) }}</td>
                    <td :class="{ 'stat-gain': group.rankGain > 0 }">{{ group.rankGain != null ? formatSignedXp(group.rankGain) : '--' }}</td>
                    <td>{{ group.level }}</td>
                    <td :class="{ 'stat-gain': group.levelGain > 0 }">{{ group.levelGain != null ? formatSignedXp(group.levelGain) : '--' }}</td>
                    <td>{{ group.xp.toLocaleString() }}</td>
                    <td :class="{ 'stat-gain': group.xpGain > 0 }">{{ group.xpGain != null ? formatSignedXp(group.xpGain) : '--' }}</td>
                  </tr>
                  <template v-if="expandedDays.has(group.key)">
                    <tr v-for="row in group.rows" :key="row.capturedAt" class="hour-row">
                      <td class="day-toggle-col"></td>
                      <td>{{ new Date(row.capturedAt).toLocaleString(undefined, { timeStyle: 'short' }) }}</td>
                      <td>{{ rankLabel(row.rank) }}</td>
                      <td :class="{ 'stat-gain': row.rankGain > 0 }">{{ row.rankGain != null ? formatSignedXp(row.rankGain) : '--' }}</td>
                      <td>{{ row.level }}</td>
                      <td :class="{ 'stat-gain': row.levelGain > 0 }">{{ row.levelGain != null ? formatSignedXp(row.levelGain) : '--' }}</td>
                      <td>{{ row.xp.toLocaleString() }}</td>
                      <td :class="{ 'stat-gain': row.xpGain > 0 }">{{ row.xpGain != null ? formatSignedXp(row.xpGain) : '--' }}</td>
                    </tr>
                  </template>
                </template>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>

  </template>

  <div v-else class="card">
    <p class="empty-hint">
      {{ player ? 'No snapshots yet for this player.' : `"${usernameParam}" isn't being tracked.` }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { useGainPeriod } from '@/composables/useGainPeriod'
import { formatRelative, withYearIfNotCurrent } from '@/utils/time'
import XpLineChart from '@/components/XpLineChart.vue'
import ShareCardModal from '@/components/ShareCardModal.vue'
import {
  SKILL_NAMES,
  skillIconSrc,
  formatXp,
  formatSignedXp,
  xpForSkill,
  xpForLevel,
  levelForSkill,
  rankForSkill,
  xpGain,
  levelGain,
  rankGain,
} from '@/utils/osrsSkills'
import { getTrainingAdvice } from '@/utils/trainingGuide'
import { setPageMeta } from '@/utils/pageMeta'

// Same order (and the same "Overall" row first) as the official OSRS
// hiscores table, not the in-game skills panel's 3-column layout.
const HISCORES_SKILL_ORDER = ['Overall', ...SKILL_NAMES]

const route = useRoute()
const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()

// The URL carries the RSN rather than the numeric id, so it reads naturally
// (/player/Dylanz297) — we still resolve it to the player's id client-side
// since the API itself is id-based.
const usernameParam = computed(() => route.params.username ?? '')
const player = computed(
  () => store.players.find((p) => p.username.toLowerCase() === usernameParam.value.toLowerCase()) ?? null,
)
const playerId = computed(() => player.value?.id ?? null)

watch(
  [player, usernameParam],
  ([p, username]) => {
    const name = p?.displayName || username
    setPageMeta({
      title: `${name} — OSRS Hiscores`,
      description: `Track ${name}'s OSRS XP, levels, and hiscores over time, with training advice for every skill.`,
      path: `/player/${encodeURIComponent(username)}`,
    })
  },
  { immediate: true },
)

const isImportingWomHistory = computed(
  () => player.value?.womImportStatus === 'pending' || player.value?.womImportStatus === 'running',
)

// The store polls for Wise Old Man import status in the background (see
// stores/players.js) — once it flips away from pending/running for this
// specific player, re-fetch their snapshots so the chart/table pick up
// whatever history just landed, without the user having to reload.
watch(
  () => player.value?.womImportStatus,
  (status, previousStatus) => {
    const wasImporting = previousStatus === 'pending' || previousStatus === 'running'
    if (!wasImporting || status !== 'done' || !playerId.value) return
    store
      .fetchSnapshots(playerId.value)
      .then((rows) => {
        snapshots.value = rows
      })
      .catch(() => {})
  },
)

const snapshots = ref([])
const loading = ref(true)
const refreshing = ref(false)
const checkingWomHistory = ref(false)
const shareModalOpen = ref(false)
const checkingForUpdates = ref(false)
const showTable = ref(false)
const selectedSkill = ref('Overall')

async function load() {
  loading.value = true
  if (!store.loaded) await store.loadPlayers()

  if (!playerId.value) {
    // Unknown RSN in the URL — nothing to fetch.
    snapshots.value = []
    loading.value = false
    return
  }

  try {
    snapshots.value = await store.fetchSnapshots(playerId.value)
  } catch {
    showToast("Could not load this player's history.")
    snapshots.value = []
  } finally {
    loading.value = false
  }

  // Check for updates whenever this page loads, rather than only on the
  // 6-hourly scheduler or a manual refresh. Runs after the saved data is
  // already showing, so a slow hiscores fetch never blocks the page —
  // snapshots.value is swapped in once the refresh completes.
  checkingForUpdates.value = true
  try {
    await store.refreshPlayer(playerId.value)
    snapshots.value = await store.fetchSnapshots(playerId.value)
  } catch {
    // Non-fatal — the page already has the last saved data.
  } finally {
    checkingForUpdates.value = false
  }
}
onMounted(load)
watch(() => route.params.username, load)

const latest = computed(() => snapshots.value[snapshots.value.length - 1] ?? null)

const selectedSkillLevel = computed(() => (latest.value ? levelForSkill(latest.value, selectedSkill.value) : 1))
const selectedSkillXp = computed(() => (latest.value ? xpForSkill(latest.value, selectedSkill.value) : 0))
const trainingAdvice = computed(() =>
  getTrainingAdvice(selectedSkill.value, selectedSkillLevel.value, selectedSkillXp.value),
)

// How far into the current level the player is, for the progress bar — xp
// is not evenly distributed between levels, so this is relative to the
// actual xp window for this specific level, not a flat percentage.
const levelProgressPercent = computed(() => {
  if (selectedSkillLevel.value >= 99) return 100
  const lo = xpForLevel(selectedSkillLevel.value)
  const hi = xpForLevel(selectedSkillLevel.value + 1)
  const pct = ((selectedSkillXp.value - lo) / (hi - lo)) * 100
  return Math.min(Math.max(pct, 0), 100)
})
const xpToNextLevel = computed(() => {
  if (selectedSkillLevel.value >= 99) return 0
  return xpForLevel(selectedSkillLevel.value + 1) - selectedSkillXp.value
})
// The badge shows the level you're progressing toward, not the current one
// — already at 99 (or total-level "Overall"), there's no next level to show.
const targetSkillLevel = computed(() =>
  selectedSkillLevel.value < 99 ? selectedSkillLevel.value + 1 : selectedSkillLevel.value,
)

// Dropdown above the hiscores table — which window its per-skill deltas
// show. "day" means the calendar day (resets at local midnight), "week"/
// "month" are rolling 7/30-day windows. Shared across pages for the session.
const { period } = useGainPeriod()
const periodPhrase = computed(
  () => ({ day: 'today', week: 'in the last 7 days', month: 'in the last 30 days' })[period.value],
)

// Per-skill xp/level/rank gained over the selected period — computed once
// per snapshot load/period change rather than re-walking history on every
// row's render.
const periodXpGains = computed(() => buildGainMap(xpGain))
const periodLevelGains = computed(() => buildGainMap(levelGain))
const periodRankGains = computed(() => buildGainMap(rankGain))

function buildGainMap(gainFn) {
  const map = {}
  for (const skill of HISCORES_SKILL_ORDER) {
    map[skill] = gainFn(snapshots.value, skill, period.value)
  }
  return map
}

function rankLabel(rank) {
  return rank ? rank.toLocaleString() : '--'
}

function gain(gainPeriod) {
  return xpGain(snapshots.value, selectedSkill.value, gainPeriod)
}

// Same "no-gain snapshots dropped" rule as snapshotRows below, so the chart
// doesn't draw flat segments for refreshes that gained nothing in this skill.
const chartPoints = computed(() => {
  const list = snapshots.value
  return list
    .filter((s, i) => i === 0 || xpForSkill(s, selectedSkill.value) > xpForSkill(list[i - 1], selectedSkill.value))
    .map((s) => ({ x: new Date(s.capturedAt).getTime(), y: xpForSkill(s, selectedSkill.value) }))
})

// Per-refresh xp/level/rank gained (the breakdown behind the daily totals
// shown inline above) — each row's delta from the snapshot before it,
// newest first. Refreshes that gained no xp for this skill are left out —
// they're not meaningful "updates" to show in the breakdown.
const snapshotRows = computed(() => {
  const list = snapshots.value
  return [...list]
    .map((s, i) => {
      const prev = i > 0 ? list[i - 1] : null
      const rank = rankForSkill(s, selectedSkill.value)
      const prevRank = prev ? rankForSkill(prev, selectedSkill.value) : null
      return {
        capturedAt: s.capturedAt,
        rank,
        rankGain: prev && rank != null && prevRank != null ? prevRank - rank : null,
        level: levelForSkill(s, selectedSkill.value),
        levelGain: prev ? levelForSkill(s, selectedSkill.value) - levelForSkill(prev, selectedSkill.value) : null,
        xp: xpForSkill(s, selectedSkill.value),
        xpGain: prev ? xpForSkill(s, selectedSkill.value) - xpForSkill(prev, selectedSkill.value) : null,
      }
    })
    .filter((row) => row.xpGain == null || row.xpGain > 0)
    .reverse()
})

// Same rows, bucketed by calendar day (newest day first, same as
// snapshotRows) with per-day totals summed from each row's own gain —
// rows stay newest-first within a day too, so a group's first row is
// always its end-of-day snapshot.
const groupedSnapshotRows = computed(() => {
  const groups = []
  const byDay = new Map()
  for (const row of snapshotRows.value) {
    const date = new Date(row.capturedAt)
    const key = date.toLocaleDateString('en-CA')
    let group = byDay.get(key)
    if (!group) {
      group = {
        key,
        label: date.toLocaleDateString(undefined, withYearIfNotCurrent(date, { weekday: 'short', month: 'short', day: 'numeric' })),
        rows: [],
        rank: row.rank,
        level: row.level,
        xp: row.xp,
        rankGain: null,
        levelGain: null,
        xpGain: null,
      }
      byDay.set(key, group)
      groups.push(group)
    }
    group.rows.push(row)
    if (row.rankGain != null) group.rankGain = (group.rankGain ?? 0) + row.rankGain
    if (row.levelGain != null) group.levelGain = (group.levelGain ?? 0) + row.levelGain
    if (row.xpGain != null) group.xpGain = (group.xpGain ?? 0) + row.xpGain
  }
  return groups
})

const expandedDays = ref(new Set())
function toggleDay(key) {
  const next = new Set(expandedDays.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedDays.value = next
}

// Day groups bucketed by calendar month (newest month first, same ordering
// as groupedSnapshotRows) — only actually used as a collapsing level when
// there's data outside the current month, so a freshly-added player's
// table stays a flat day list instead of a single redundant month wrapper.
const monthGroups = computed(() => {
  const groups = []
  const byMonth = new Map()
  for (const day of groupedSnapshotRows.value) {
    const date = new Date(day.rows[0].capturedAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    let group = byMonth.get(key)
    if (!group) {
      group = {
        key,
        label: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        days: [],
        rank: day.rank,
        level: day.level,
        xp: day.xp,
        rankGain: null,
        levelGain: null,
        xpGain: null,
      }
      byMonth.set(key, group)
      groups.push(group)
    }
    group.days.push(day)
    if (day.rankGain != null) group.rankGain = (group.rankGain ?? 0) + day.rankGain
    if (day.levelGain != null) group.levelGain = (group.levelGain ?? 0) + day.levelGain
    if (day.xpGain != null) group.xpGain = (group.xpGain ?? 0) + day.xpGain
  }
  return groups
})

const showMonthGrouping = computed(() => {
  if (monthGroups.value.length > 1) return true
  const onlyMonth = monthGroups.value[0]
  if (!onlyMonth) return false
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return onlyMonth.key !== currentMonthKey
})

const expandedMonths = ref(new Set())
function toggleMonth(key) {
  const next = new Set(expandedMonths.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedMonths.value = next
}

async function refresh() {
  refreshing.value = true
  try {
    await store.refreshPlayer(playerId.value)
    snapshots.value = await store.fetchSnapshots(playerId.value)
    showToast('Synced the latest hiscores.')
  } catch {
    showToast('Could not refresh right now.')
  } finally {
    refreshing.value = false
  }
}

async function checkWomHistory() {
  checkingWomHistory.value = true
  try {
    await store.checkWomHistory(playerId.value)
    showToast('Checking Wise Old Man for historical data in the background.')
  } catch {
    showToast('Could not start the Wise Old Man check right now.')
  } finally {
    checkingWomHistory.value = false
  }
}
</script>
