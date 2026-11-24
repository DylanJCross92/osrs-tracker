<template>
  <!-- Signed out: a slim bar fixed to the bottom of the screen, always in view, so it never takes room from the page -->
  <aside v-if="!loggedIn" class="trk-bar" role="status" aria-label="Where your progress is saved">
    <span class="trk-bar-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
    </span>
    <p class="trk-bar-text"><b><span class="trk-bar-long">Saved in this browser only.</span><span class="trk-bar-short">Saved here only</span></b> <span>Clearing it or switching device loses your progress.</span></p>
    <div class="trk-bar-cta">
      <button class="trk-bar-link" type="button" title="Copies a link that brings back your quests, diaries and plans on any device" @click="copySessionLink('tracker')">Copy link<span class="trk-bar-more"> to save</span></button>
      <RouterLink class="trk-bar-link" :to="{ name: 'login', query: { next: '/quests' } }" @click="track('tracker_login_click', { place: place })">Log in</RouterLink>
      <RouterLink class="btn btn-primary" :to="{ name: 'signup', query: { next: '/quests' } }" @click="track('tracker_signup_click', { place: place })">Create <span class="trk-bar-more">free </span>account</RouterLink>
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
import { useSessionLink } from '@/composables/useSessionLink'
import { track } from '@/utils/analytics'

// Says plainly where the quests and diaries are kept. Signed out they live in this browser only, and the way to keep them is one click away.
defineProps({ place: { type: String, default: 'tracker' } })
const { loggedIn, syncState } = useAuth()
const { copySessionLink } = useSessionLink()
</script>
