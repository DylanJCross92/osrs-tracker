<template>
  <div class="card">
    <h2>Tracked Players</h2>
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
        <button class="btn-text remove-btn" title="Stop tracking" @click.stop="removePlayer(p)">✕</button>
      </div>
      <div v-if="p.latest" class="player-stats">
        <div><b>{{ p.latest.overallLevel.toLocaleString() }}</b><span>total level</span></div>
        <div><b>{{ formatXp(p.latest.overallXp) }}</b><span>total xp</span></div>
      </div>
      <p v-else class="empty-hint">No data yet.</p>
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
import { useConfirm } from '@/composables/useConfirm'
import { formatXp } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { ApiError } from '@/api/client'

const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()
const { askConfirm } = useConfirm()

const newUsername = ref('')
const adding = ref(false)

onMounted(() => {
  if (!store.loaded) store.loadPlayers()
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

async function removePlayer(player) {
  const ok = await askConfirm(
    `Stop tracking "${player.displayName}"? This deletes their whole XP history.`,
    'Stop Tracking',
  )
  if (!ok) return
  try {
    await store.removePlayer(player.id)
    showToast(`Stopped tracking ${player.displayName}.`)
  } catch {
    showToast('Could not remove that player.')
  }
}

function goToPlayer(player) {
  router.push({ name: 'playerDetail', params: { id: player.id } })
}
</script>
