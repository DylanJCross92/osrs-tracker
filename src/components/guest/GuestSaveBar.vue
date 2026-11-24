<template>
  <aside v-if="show" class="gsb" role="status" aria-label="Your data is only saved in this browser">
    <span class="gsb-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
    </span>
    <p class="gsb-text">
      <b><span class="gsb-long">{{ summary }} saved in this browser only.</span><span class="gsb-short">Saved here only</span></b>
      <span>Clearing it or switching device loses it.</span>
    </p>
    <div class="gsb-cta">
      <button class="gsb-link" type="button" title="Copies a link that brings back everything you saved, on any device" @click="copySessionLink('bar')">Copy link<span class="gsb-more"> to save</span></button>
      <RouterLink class="gsb-link gsb-login" :to="{ name: 'login', query: { next: route.fullPath } }" @click="track('guest_bar_login')">Log in</RouterLink>
      <RouterLink class="btn btn-primary" :to="{ name: 'signup', query: { next: route.fullPath } }" @click="track('guest_bar_signup')">Create <span class="gsb-more">free </span>account</RouterLink>
    </div>
  </aside>
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useKeepData } from '@/composables/useKeepData'
import { useSessionLink } from '@/composables/useSessionLink'
import { track } from '@/utils/analytics'

// A slim bar fixed to the bottom of every page, for someone who is not signed in and has put something in that would be lost (a plan, finished quests or
// diary tiers, followed players, watched items). Nothing is shown until there is something to lose, and never to a signed-in visitor.
const emit = defineEmits(['visible'])
const route = useRoute()
const { loggedIn, ready } = useAuth()
const { total, summary } = useKeepData()
const { copySessionLink } = useSessionLink()

// Not on the pages for signing in or restoring, where it would only be in the way.
const QUIET = ['login', 'signup', 'restore', 'verify', 'forgotPassword', 'resetPassword']
const show = computed(() => ready.value && !loggedIn.value && total.value > 0 && !QUIET.includes(route.name) && !String(route.name || '').startsWith('admin'))
watchEffect(() => emit('visible', show.value))
</script>
