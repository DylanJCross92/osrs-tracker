import { defineStore } from 'pinia'
import { ref } from 'vue'
import { playersApi } from '@/api/players'

const POLL_INTERVAL_MS = 5000

export const usePlayersStore = defineStore('players', () => {
  const players = ref([])
  const loaded = ref(false)
  let pollTimer = null

  function hasPendingWomImport() {
    return players.value.some((p) => p.womImportStatus === 'pending' || p.womImportStatus === 'running')
  }

  // A Wise Old Man import runs in the background on the server and can take
  // well over a minute, so while any player is still importing, poll for
  // status changes instead of making the user manually refresh to see it
  // finish. Stops itself once nothing is pending.
  function ensurePolling() {
    if (pollTimer || !hasPendingWomImport()) return
    pollTimer = setInterval(async () => {
      await loadPlayers()
      if (!hasPendingWomImport()) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }, POLL_INTERVAL_MS)
  }

  async function loadPlayers() {
    players.value = await playersApi.list()
    loaded.value = true
    ensurePolling()
  }

  async function addPlayer(username) {
    players.value = await playersApi.add(username)
    ensurePolling()
  }

  async function refreshPlayer(id) {
    players.value = await playersApi.refresh(id)
  }

  async function checkWomHistory(id) {
    players.value = await playersApi.checkWomHistory(id)
    ensurePolling()
  }

  async function syncAll() {
    players.value = await playersApi.syncAll()
    ensurePolling()
  }

  function fetchSnapshots(id) {
    return playersApi.snapshots(id)
  }

  return { players, loaded, loadPlayers, addPlayer, refreshPlayer, checkWomHistory, syncAll, fetchSnapshots, ensurePolling }
})
