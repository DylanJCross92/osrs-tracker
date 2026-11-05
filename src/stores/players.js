import { defineStore } from 'pinia'
import { ref } from 'vue'
import { playersApi } from '@/api/players'

export const usePlayersStore = defineStore('players', () => {
  const players = ref([])
  const loaded = ref(false)

  async function loadPlayers() {
    players.value = await playersApi.list()
    loaded.value = true
  }

  async function addPlayer(username) {
    players.value = await playersApi.add(username)
  }

  async function refreshPlayer(id) {
    players.value = await playersApi.refresh(id)
  }

  async function syncAll() {
    players.value = await playersApi.syncAll()
  }

  function fetchSnapshots(id) {
    return playersApi.snapshots(id)
  }

  return { players, loaded, loadPlayers, addPlayer, refreshPlayer, syncAll, fetchSnapshots }
})
