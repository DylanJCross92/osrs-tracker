<template>
  <aside v-if="show" class="gk" role="status" aria-label="Where your data is saved">
    <span class="gk-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
    </span>
    <div class="gk-main">
      <b>{{ summary ? `${summary} saved in this browser` : 'You are using TickGains as a guest' }}</b>
      <span>Clear your browser data, use private mode or switch device and they are gone. A free account keeps them safe on every device, or copy a link that brings them back.</span>
      <div class="gk-tools">
        <button class="gk-link" type="button" title="Copies a link that brings back your plans, quests, diaries and followed players on any device" @click="copySessionLink('keep-card')">Copy link to save session</button>
      </div>
      <p v-if="suggestInstall && !hideInstall" class="gk-tip">
        On an iPhone or iPad: tap Share, then <b>Add to Home Screen</b>. Safari clears what websites save after about a week away; an app on your home screen is kept.
        <button class="gk-link" type="button" @click="dismissInstall">Got it</button>
      </p>
    </div>
    <div class="gk-cta">
      <RouterLink class="btn btn-primary" :to="{ name: 'signup', query: { next: route.fullPath } }" @click="track('guest_keep_signup', { place })">Create a free account</RouterLink>
      <RouterLink class="btn-text" :to="{ name: 'login', query: { next: route.fullPath } }" @click="track('guest_keep_login', { place })">Log in</RouterLink>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useKeepData } from '@/composables/useKeepData'
import { track } from '@/utils/analytics'
import { useSessionLink } from '@/composables/useSessionLink'

// For someone who is not signed in: what is kept in this browser, and the ways to make it last (an account, a save code, the browser's own keep-it
// switch, the home screen on iPhone). `always`: show it even before anything is saved.
const props = defineProps({ place: { type: String, default: 'dashboard' }, always: { type: Boolean, default: true } })
const route = useRoute()
const { loggedIn, ready } = useAuth()
const { total, summary, suggestInstall } = useKeepData()
const { copySessionLink } = useSessionLink()

const show = computed(() => ready.value && !loggedIn.value && (props.always || total.value > 0))
const INSTALL_KEY = 'tickgains-install-tip-hidden'
const hideInstall = ref(
  (() => {
    try {
      return localStorage.getItem(INSTALL_KEY) === '1'
    } catch {
      return false
    }
  })(),
)
function dismissInstall() {
  hideInstall.value = true
  try {
    localStorage.setItem(INSTALL_KEY, '1')
  } catch {
    /* storage unavailable */
  }
}
</script>
