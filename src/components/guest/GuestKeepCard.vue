<template>
  <aside v-if="show" class="gk" role="status" aria-label="Where your data is saved">
    <span class="gk-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
    </span>
    <div class="gk-main">
      <b>{{ summary ? `${summary} saved in this browser` : 'You are using TickGains as a guest' }}</b>
      <span>Clear your browser data, use private mode or switch device and they are gone. A free account keeps them safe on every device.</span>
      <div class="gk-tools">
        <button v-if="canPersist && !persisted" class="gk-link" type="button" @click="keep">Ask this browser to keep it</button>
        <span v-else-if="persisted" class="gk-ok"><span aria-hidden="true">✓</span> This browser has agreed to keep it</span>
        <button class="gk-link" type="button" @click="backupOpen = true">Back up with a save code</button>
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
    <GuestBackupModal v-if="backupOpen" @close="backupOpen = false" />
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useKeepData } from '@/composables/useKeepData'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'
import GuestBackupModal from '@/components/guest/GuestBackupModal.vue'

// For someone who is not signed in: what is kept in this browser, and the ways to make it last (an account, a save code, the browser's own keep-it
// switch, the home screen on iPhone). `always`: show it even before anything is saved.
const props = defineProps({ place: { type: String, default: 'dashboard' }, always: { type: Boolean, default: true } })
const route = useRoute()
const { loggedIn, ready } = useAuth()
const { total, summary, canPersist, persisted, keepOnDevice, suggestInstall } = useKeepData()
const { showToast } = useToast()

const show = computed(() => ready.value && !loggedIn.value && (props.always || total.value > 0))
const backupOpen = ref(false)

async function keep() {
  const ok = await keepOnDevice()
  showToast(ok ? 'This browser will keep your TickGains data.' : 'This browser did not agree. A save code or an account keeps it safe.')
  track('guest_keep_persist', { ok })
}
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
