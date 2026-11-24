<template>
  <DashboardView v-if="showDashboard" />
  <HomeView v-else />
</template>

<script setup>
import { computed, defineAsyncComponent, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRivals } from '@/composables/useRivals'

// The home page is the dashboard once you are signed in or have picked your player, and the welcome page for everyone else.
const HomeView = defineAsyncComponent(() => import('@/views/HomeView.vue'))
const DashboardView = defineAsyncComponent(() => import('@/views/DashboardView.vue'))

const { ready, loggedIn } = useAuth()
// Someone not signed in who has said which player is theirs ("This is me", saved in this browser) gets the dashboard too.
const { me } = useRivals()

// Who is signed in is only known a moment after the page opens. A returning member would see the welcome page flash by,
// so this browser remembers (just a yes or no, nothing about who) that someone was signed in last time.
const HINT = 'tickgains-signed-in'
const readHint = () => {
  try {
    return localStorage.getItem(HINT) === '1'
  } catch {
    return false
  }
}
const hinted = readHint()
watch(
  [ready, loggedIn],
  ([isReady, isIn]) => {
    if (!isReady) return
    try {
      if (isIn) localStorage.setItem(HINT, '1')
      else localStorage.removeItem(HINT)
    } catch {
      /* storage unavailable */
    }
  },
  { immediate: true },
)

const showDashboard = computed(() => !!me.value || (ready.value ? loggedIn.value : hinted))
</script>
