<template>
  <div class="card">
    <h1>Tracked Players</h1>
    <p class="empty-hint intro">
      Track any OSRS player's hiscores. A snapshot is taken as soon as you add them, then automatically
      every 6 hours after that.
    </p>
    <form class="add-player-form" @submit.prevent="submitAdd">
      <input v-model="newUsername" type="text" placeholder="OSRS username / RSN..." :disabled="adding" />
      <button class="btn btn-primary" type="submit" :disabled="adding || !newUsername.trim()">
        {{ adding ? 'Adding…' : 'Track Player' }}
      </button>
    </form>
  </div>

  <div v-if="store.players.length" class="player-grid">
    <div v-for="p in store.players" :key="p.id" class="card player-card" @click="goToPlayer(p)">
      <div class="player-card-top">
        <span class="player-name">{{ p.displayName }}</span>
      </div>
      <div v-if="p.latest" class="player-stats">
        <div><b>{{ p.latest.overallLevel.toLocaleString() }}</b><span>total level</span></div>
        <div><b>{{ formatXp(p.latest.overallXp) }}</b><span>total xp</span></div>
      </div>
      <p v-else class="empty-hint">No data yet.</p>
      <div v-if="p.todayGain && p.todayGain.xp > 0" class="player-gain-row">
        <span class="gain-today">
          <img class="top-skill-icon" :src="skillIconSrc('Overall')" alt="Overall" width="16" height="16" />
          +{{ formatXp(p.todayGain.xp) }}
        </span>
        <span v-if="p.todayGain.topSkill" class="top-skill">
          <img class="top-skill-icon" :src="skillIconSrc(p.todayGain.topSkill)" :alt="p.todayGain.topSkill" width="16" height="16" />
          +{{ formatXp(p.todayGain.topSkillXp) }}
        </span>
      </div>
      <p v-if="p.latest" class="last-synced">Last synced {{ formatRelative(p.latest.capturedAt) }}</p>
    </div>
  </div>
  <div v-else class="card">
    <p class="empty-hint">No one is being tracked yet — add an RSN above to start the timeline.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { ApiError } from '@/api/client'
import { setPageMeta } from '@/utils/pageMeta'

const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()

const newUsername = ref('')
const adding = ref(false)

setPageMeta({
  description: "Track any OSRS player's hiscores and XP gains over time, with training advice for every skill.",
  path: '/',
})

onMounted(async () => {
  if (!store.loaded) await store.loadPlayers()
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
    showToast(`Now tracking ${username}.`)
    newUsername.value = ''
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Could not add that player.')
  } finally {
    adding.value = false
  }
}

function goToPlayer(player) {
  router.push({ name: 'playerDetail', params: { username: player.username } })
}
</script>
