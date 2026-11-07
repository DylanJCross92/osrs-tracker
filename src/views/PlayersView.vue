<template>
  <div class="card">
    <h1>Find Player</h1>
    <ul class="find-player-features">
      <li><span class="check-icon">✓</span> A snapshot is taken as soon as you add them, then every 6 hours after</li>
      <li><span class="check-icon">✓</span> We'll search Wise Old Man for historical data and import it if we find any</li>
    </ul>
    <form class="add-player-form" @submit.prevent="submitAdd">
      <!-- Decoy fields so Firefox/Chrome's login-manager autofill (which
           ignores autocomplete="off" on a field it suspects is a login
           username) latches onto these instead of the real RSN input. -->
      <input type="text" name="username" autocomplete="username" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
      <input type="password" name="password" autocomplete="current-password" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
      <input
        v-model="newUsername"
        type="text"
        placeholder="OSRS username / RSN..."
        :disabled="adding"
        autocomplete="off"
        name="rsn"
      />
      <button class="btn btn-primary" type="submit" :disabled="adding || !newUsername.trim()">
        {{ adding ? 'Adding…' : 'Track Player' }}
      </button>
    </form>
    <ul v-if="suggestions.length" class="search-suggest">
      <li v-for="sg in suggestions" :key="sg.username">
        <RouterLink :to="{ name: 'playerDetail', params: { username: sg.username }, query: { tab: 'stats' } }">
          <span>{{ sg.displayName }}</span>
          <small>Tracked · Overall {{ sg.overallLevel?.toLocaleString() ?? '—' }}</small>
        </RouterLink>
      </li>
    </ul>
  </div>

  <div v-if="pageLoading" class="card">
    <p class="empty-hint">Loading your tracked players…</p>
  </div>
  <template v-else>
    <div v-if="store.players.length" class="period-toolbar">
      <h2 class="period-toolbar-title">Top Player Gains</h2>
      <label class="period-select">
        <span class="period-select-label">Show gains for</span>
        <select v-model="period">
          <option value="day">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
      </label>
    </div>

    <div v-if="store.players.length" class="player-grid">
      <div v-for="p in sortedPlayers" :key="p.id" class="card player-card" @click="goToPlayer(p)">
        <div class="player-card-top">
          <span class="player-name">{{ p.displayName }}</span>
          <PlayerBadge :label="p.badge" />
        </div>
        <div v-if="p.latest" class="player-stats">
          <div><b>{{ p.latest.overallLevel.toLocaleString() }}</b><span>overall</span></div>
          <div><b>{{ formatXp(p.latest.overallXp) }}</b><span>total xp</span></div>
        </div>
        <p v-else class="empty-hint">No data yet.</p>
        <div v-if="gainFor(p) && gainFor(p).xp > 0" class="player-gain-row">
          <span class="gain-today">
            <img class="top-skill-icon" :src="skillIconSrc('Overall')" alt="Overall" width="16" height="16" />
            +{{ formatXp(gainFor(p).xp) }}
          </span>
          <span v-if="gainFor(p).topSkill" class="top-skill">
            <img class="top-skill-icon" :src="skillIconSrc(gainFor(p).topSkill)" :alt="gainFor(p).topSkill" width="16" height="16" />
            +{{ formatXp(gainFor(p).topSkillXp) }}
          </span>
        </div>
        <p v-if="isImporting(p)" class="wom-status">
          <span class="spinner" /> Importing history from Wise Old Man…
        </p>
        <p v-if="p.latest" class="last-synced">Last synced {{ formatRelative(p.latest.capturedAt) }}</p>
      </div>
    </div>
    <div v-else class="card">
      <p class="empty-hint">No one is being tracked yet — add an RSN above to start the timeline.</p>
    </div>
  </template>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { useGainPeriod } from '@/composables/useGainPeriod'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { ApiError } from '@/api/client'
import { setPageMeta } from '@/utils/pageMeta'
import PlayerBadge from '@/components/PlayerBadge.vue'
import { playersApi } from '@/api/players'

const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()

const newUsername = ref('')
const adding = ref(false)
const pageLoading = ref(true)
const { period } = useGainPeriod()

function isImporting(player) {
  return player.womImportStatus === 'pending' || player.womImportStatus === 'running'
}

function gainFor(player) {
  return player.gains?.[period.value] ?? null
}

// Most xp gained in the selected period first; players with no gain (or no
// data to compare yet) sink to the bottom, alphabetically among themselves.
const sortedPlayers = computed(() =>
  [...store.players].sort((a, b) => {
    const gainA = gainFor(a)?.xp ?? -Infinity
    const gainB = gainFor(b)?.xp ?? -Infinity
    if (gainB !== gainA) return gainB - gainA
    return a.displayName.localeCompare(b.displayName)
  }),
)

// The Wise Old Man import runs in the background and is picked up by the
// store's polling — this just announces it here once, when it finishes
// while this page happens to be open.
watch(
  () => store.players.map((p) => ({ id: p.id, status: p.womImportStatus, count: p.womImportedCount, name: p.displayName })),
  (current, previous) => {
    if (!previous) return
    for (const player of current) {
      const before = previous.find((p) => p.id === player.id)
      const wasImporting = before && (before.status === 'pending' || before.status === 'running')
      if (!wasImporting || player.status !== 'done') continue
      showToast(
        player.count > 0
          ? `Finished importing ${player.count.toLocaleString()} historical snapshots for ${player.name}.`
          : `${player.name} is all set — no extra history found on Wise Old Man.`,
      )
    }
  },
)

// Typeahead: partial, case-insensitive matches among already-tracked players.
const suggestions = ref([])
let suggestTimer = null
watch(newUsername, (q) => {
  clearTimeout(suggestTimer)
  const term = (q || '').trim()
  if (term.length < 2) {
    suggestions.value = []
    return
  }
  suggestTimer = setTimeout(async () => {
    try {
      const rows = await playersApi.search(term)
      if ((newUsername.value || '').trim() === term) suggestions.value = rows
    } catch {
      suggestions.value = []
    }
  }, 250)
})

setPageMeta({
  description: "Track any OSRS player's hiscores and XP gains over time, with training advice for every skill.",
  path: '/',
})

onMounted(async () => {
  try {
    if (!store.loaded) await store.loadPlayers()
  } finally {
    pageLoading.value = false
  }
  // Check every tracked player for updates whenever this page loads,
  // rather than only on the 6-hourly scheduler or a manual refresh.
  store.syncAll().catch(() => {})
})

async function submitAdd() {
  const username = newUsername.value.trim()
  if (!username) return
  adding.value = true
  try {
    await store.addPlayer(username)
    showToast(`Now tracking ${username} — checking Wise Old Man for history in the background.`)
    newUsername.value = ''
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Could not add that player.')
  } finally {
    adding.value = false
  }
}

function goToPlayer(player) {
  router.push({ name: 'playerDetail', params: { username: player.username }, query: { tab: 'stats' } })
}
</script>
