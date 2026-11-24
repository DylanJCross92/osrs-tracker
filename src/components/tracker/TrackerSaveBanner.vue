<template>
  <aside v-if="!loggedIn" class="trk-banner is-guest" role="status" aria-label="Where your progress is saved">
    <span class="trk-banner-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
    </span>
    <div class="trk-banner-text">
      <b>Saved in this browser only</b>
      <span>Clear your browser data, use private mode or switch device and this progress is gone. A free account keeps it safe, syncs it to every device and lets the Account Planner use it in every plan.</span>
    </div>
    <div class="trk-banner-cta">
      <RouterLink class="btn btn-primary" :to="{ name: 'signup', query: { next: '/quests' } }" @click="track('tracker_signup_click', { place: place })">Create a free account</RouterLink>
      <RouterLink class="btn-text" :to="{ name: 'login', query: { next: '/quests' } }" @click="track('tracker_login_click', { place: place })">Log in</RouterLink>
    </div>
  </aside>
  <!-- Signed in: nothing to say unless saving to the account is failing. -->
  <aside v-else-if="syncState === 'error'" class="trk-banner is-saved" role="status" aria-label="Where your progress is saved">
    <span class="trk-banner-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
    </span>
    <div class="trk-banner-text">
      <b>Could not reach your account just now</b>
      <span>Your changes are kept in this browser and will sync when the connection is back.</span>
    </div>
  </aside>
</template>

<script setup>
import { useAuth } from '@/composables/useAuth'
import { track } from '@/utils/analytics'

// Says plainly where the quests and diaries are kept. Signed out they live in this browser only, and the way to keep them is one click away.
defineProps({ place: { type: String, default: 'tracker' } })
const { loggedIn, syncState } = useAuth()
</script>
