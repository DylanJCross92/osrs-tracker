<template>
  <div class="card detail-header">
    <div>
      <a href="#" class="btn-text back-link" @click.prevent="router.push({ name: 'players' })">← All players</a>
      <h2 class="detail-name">{{ player?.displayName || playerId }}</h2>
      <p v-if="latest" class="last-synced">
        Last updated {{ formatRelative(latest.capturedAt) }}
        <span v-if="checkingForUpdates" class="checking-indicator">
          <span class="spinner" /> Checking for updates…
        </span>
      </p>
    </div>
    <div class="detail-actions">
      <button class="btn btn-ghost" :disabled="refreshing" @click="refresh">
        {{ refreshing ? 'Syncing…' : 'Refresh Now' }}
      </button>
    </div>
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
              <img class="skill-icon" :src="skillIconSrc(skill)" :alt="skill" width="16" height="16" />
              <span class="skill-name">{{ skill }}</span>
            </td>
            <td>
              <span
                v-if="todayRankGains[skill] > 0"
                class="xp-delta"
                :title="`Climbed ${todayRankGains[skill].toLocaleString()} ranks in the last 24h`"
              >
                +{{ formatXp(todayRankGains[skill]) }}
              </span>
              {{ rankLabel(rankForSkill(latest, skill)) }}
            </td>
            <td>
              <span v-if="todayLevelGains[skill] > 0" class="xp-delta" :title="`+${todayLevelGains[skill]} levels in the last 24h`">
                +{{ todayLevelGains[skill] }}
              </span>
              {{ levelForSkill(latest, skill).toLocaleString() }}
            </td>
            <td class="hs-xp-col">
              <span v-if="todayXpGains[skill] > 0" class="xp-delta" :title="`+${todayXpGains[skill].toLocaleString()} xp in the last 24h`">
                +{{ formatXp(todayXpGains[skill]) }}
              </span>
              {{ xpForSkill(latest, skill).toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
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
        <h3>{{ selectedSkill }} XP over time</h3>
      </div>
      <XpLineChart :points="chartPoints" :aria-label="`${selectedSkill} experience over time`" />
      <button class="btn-text table-toggle" @click="showTable = !showTable">
        {{ showTable ? 'Hide' : 'Show' }} data table
      </button>
      <div v-if="showTable" class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Synced</th>
              <th>Rank</th>
              <th>Rank Gained</th>
              <th>Level</th>
              <th>Lvl Gained</th>
              <th>XP</th>
              <th>XP Gained</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in snapshotRows" :key="row.capturedAt">
              <td>{{ new Date(row.capturedAt).toLocaleString() }}</td>
              <td>{{ rankLabel(row.rank) }}</td>
              <td :class="{ 'stat-gain': row.rankGain > 0 }">{{ row.rankGain != null ? formatSignedXp(row.rankGain) : '--' }}</td>
              <td>{{ row.level }}</td>
              <td :class="{ 'stat-gain': row.levelGain > 0 }">{{ row.levelGain != null ? formatSignedXp(row.levelGain) : '--' }}</td>
              <td>{{ row.xp.toLocaleString() }}</td>
              <td :class="{ 'stat-gain': row.xpGain > 0 }">{{ row.xpGain != null ? formatSignedXp(row.xpGain) : '--' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="trainingAdvice" class="card training-advice">
      <h3>Training {{ selectedSkill }} at level {{ selectedSkillLevel }}</h3>
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
    </div>
  </template>

  <div v-else class="card">
    <p class="empty-hint">No snapshots yet for this player.</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { formatRelative } from '@/utils/time'
import XpLineChart from '@/components/XpLineChart.vue'
import {
  SKILL_NAMES,
  skillIconSrc,
  formatXp,
  formatSignedXp,
  xpForSkill,
  levelForSkill,
  rankForSkill,
  xpGain,
  levelGain,
  rankGain,
} from '@/utils/osrsSkills'
import { getTrainingAdvice } from '@/utils/trainingGuide'

// Same order (and the same "Overall" row first) as the official OSRS
// hiscores table, not the in-game skills panel's 3-column layout.
const HISCORES_SKILL_ORDER = ['Overall', ...SKILL_NAMES]

const route = useRoute()
const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()

const playerId = computed(() => Number(route.params.id))
const player = computed(() => store.players.find((p) => p.id === playerId.value) ?? null)

const snapshots = ref([])
const loading = ref(true)
const refreshing = ref(false)
const checkingForUpdates = ref(false)
const showTable = ref(false)
const selectedSkill = ref('Overall')

async function load() {
  loading.value = true
  if (!store.loaded) await store.loadPlayers()
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
watch(playerId, load)

const latest = computed(() => snapshots.value[snapshots.value.length - 1] ?? null)

const selectedSkillLevel = computed(() => (latest.value ? levelForSkill(latest.value, selectedSkill.value) : 1))
const selectedSkillXp = computed(() => (latest.value ? xpForSkill(latest.value, selectedSkill.value) : 0))
const trainingAdvice = computed(() =>
  getTrainingAdvice(selectedSkill.value, selectedSkillLevel.value, selectedSkillXp.value),
)

// Per-skill xp/level/rank gained in the trailing 24h — computed once per
// snapshot load rather than re-walking history on every row's render.
const todayXpGains = computed(() => buildGainMap(xpGain))
const todayLevelGains = computed(() => buildGainMap(levelGain))
const todayRankGains = computed(() => buildGainMap(rankGain))

function buildGainMap(gainFn) {
  const map = {}
  for (const skill of HISCORES_SKILL_ORDER) {
    map[skill] = gainFn(snapshots.value, skill, 'day')
  }
  return map
}

function rankLabel(rank) {
  return rank ? rank.toLocaleString() : '--'
}

function gain(period) {
  return xpGain(snapshots.value, selectedSkill.value, period)
}

const chartPoints = computed(() =>
  snapshots.value.map((s) => ({ x: new Date(s.capturedAt).getTime(), y: xpForSkill(s, selectedSkill.value) })),
)

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
</script>
