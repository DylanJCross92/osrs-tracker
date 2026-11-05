<template>
  <div class="card detail-header">
    <div>
      <a href="#" class="btn-text back-link" @click.prevent="router.push({ name: 'players' })">← All players</a>
      <h2 class="detail-name">{{ player?.displayName || playerId }}</h2>
    </div>
    <div class="detail-actions">
      <button class="btn btn-ghost" :disabled="refreshing" @click="refresh">
        {{ refreshing ? 'Syncing…' : 'Refresh Now' }}
      </button>
      <button class="btn btn-danger" @click="removePlayer">Stop Tracking</button>
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
              <span class="skill-icon">{{ SKILL_ICONS[skill] }}</span>
              <span class="skill-name">{{ skill }}</span>
            </td>
            <td>{{ rankLabel(rankForSkill(latest, skill)) }}</td>
            <td>{{ levelForSkill(latest, skill).toLocaleString() }}</td>
            <td class="hs-xp-col">
              {{ xpForSkill(latest, skill).toLocaleString() }}
              <span
                v-if="lastGains[skill]"
                class="xp-delta"
                :title="`+${lastGains[skill].amount.toLocaleString()} xp on ${new Date(lastGains[skill].capturedAt).toLocaleString()}`"
              >
                +{{ formatXp(lastGains[skill].amount) }}
              </span>
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
              <th>Level</th>
              <th>XP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in [...snapshots].reverse()" :key="i">
              <td>{{ new Date(s.capturedAt).toLocaleString() }}</td>
              <td>{{ levelForSkill(s, selectedSkill) }}</td>
              <td>{{ xpForSkill(s, selectedSkill).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
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
import { useConfirm } from '@/composables/useConfirm'
import XpLineChart from '@/components/XpLineChart.vue'
import {
  SKILL_NAMES,
  SKILL_ICONS,
  formatXp,
  formatSignedXp,
  xpForSkill,
  levelForSkill,
  rankForSkill,
  xpGain,
  lastXpGain,
} from '@/utils/osrsSkills'

// Same order (and the same "Overall" row first) as the official OSRS
// hiscores table, not the in-game skills panel's 3-column layout.
const HISCORES_SKILL_ORDER = ['Overall', ...SKILL_NAMES]

const route = useRoute()
const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()
const { askConfirm } = useConfirm()

const playerId = computed(() => Number(route.params.id))
const player = computed(() => store.players.find((p) => p.id === playerId.value) ?? null)

const snapshots = ref([])
const loading = ref(true)
const refreshing = ref(false)
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
}
onMounted(load)
watch(playerId, load)

const latest = computed(() => snapshots.value[snapshots.value.length - 1] ?? null)

// Per-skill "last time it gained xp" — computed once per snapshot load
// rather than re-walking history on every row's render.
const lastGains = computed(() => {
  const map = {}
  for (const skill of HISCORES_SKILL_ORDER) {
    map[skill] = lastXpGain(snapshots.value, skill)
  }
  return map
})

function rankLabel(rank) {
  return rank ? rank.toLocaleString() : '--'
}

function gain(period) {
  return xpGain(snapshots.value, selectedSkill.value, period)
}

const chartPoints = computed(() =>
  snapshots.value.map((s) => ({ x: new Date(s.capturedAt).getTime(), y: xpForSkill(s, selectedSkill.value) })),
)

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

async function removePlayer() {
  if (!player.value) return
  const ok = await askConfirm(
    `Stop tracking "${player.value.displayName}"? This deletes their whole XP history.`,
    'Stop Tracking',
  )
  if (!ok) return
  await store.removePlayer(playerId.value)
  router.push({ name: 'players' })
}
</script>
