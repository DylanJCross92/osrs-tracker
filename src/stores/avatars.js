import { defineStore } from 'pinia'
import { ref } from 'vue'
import { profilePageApi } from '@/api/profilePage'

// Which players have an uploaded picture (and its version), for everyone, signed in or not. It is one small request that
// any page showing an avatar can rely on, instead of each page loading the whole player list first.
export const useAvatarsStore = defineStore('avatars', () => {
  const versions = ref({})
  const loaded = ref(false)
  let pending = null

  async function refresh() {
    try {
      versions.value = (await profilePageApi.avatars(loaded.value)).avatars || {}
      loaded.value = true
    } catch {
      // Without it the generated avatars simply stay.
    }
  }

  /** Loads the list once, however many avatars ask at the same time. */
  function ensureLoaded() {
    if (loaded.value) return Promise.resolve()
    if (!pending) pending = refresh().finally(() => (pending = null))
    return pending
  }

  return { versions, loaded, refresh, ensureLoaded }
})
