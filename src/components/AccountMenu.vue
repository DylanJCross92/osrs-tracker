<template>
  <div v-if="ready" class="acct" :class="{ 'is-in': loggedIn }">
    <template v-if="!loggedIn">
      <RouterLink class="btn btn-ghost acct-login" :to="{ name: 'login', query: nextQuery }">Log in</RouterLink>
    </template>
    <template v-else>
    <NotificationBell />
    <div ref="rootEl" class="acct-wrap">
      <button type="button" class="acct-avatar" :aria-expanded="open" aria-haspopup="menu" :aria-label="`Account menu for ${user.email}`" @click="toggle" @keydown.esc="open = false"><img v-if="photo" class="acct-avatar-img" :src="photo" alt="" draggable="false" /><template v-else>{{ initial }}</template></button>
      <div v-if="open" class="acct-menu" role="menu">
        <div v-if="profiles.length" class="acct-profiles">
          <RouterLink v-for="p in profiles" :key="p.username" class="acct-profile" :title="`Signed in as ${user.email}`" :to="{ name: 'playerDetail', params: { username: p.username } }" @click="open = false">{{ p.displayName }}</RouterLink>
        </div>
        <p v-else class="acct-email" :title="user.email">{{ user.email }}</p>
        <RouterLink class="acct-item" role="menuitem" :to="{ name: 'account' }" @click="open = false">My account<span v-if="countOf('claim_code')" class="acct-count" :aria-label="`${countOf('claim_code')} to finish`">{{ countOf('claim_code') }}</span></RouterLink>
        <RouterLink class="acct-item" role="menuitem" :to="{ name: 'myClans' }" @click="open = false">My clans<span v-if="clanRequests" class="acct-count" :aria-label="`${clanRequests} requests to answer`">{{ clanRequests }}</span></RouterLink>
        <RouterLink v-if="isAdmin" class="acct-item" role="menuitem" :to="{ name: 'adminClaims' }" @click="open = false">Profile claims<span v-if="countOf('claims_waiting')" class="acct-count" :aria-label="`${countOf('claims_waiting')} waiting`">{{ countOf('claims_waiting') }}</span></RouterLink>
        <template v-if="isAdmin">
          <button class="acct-item acct-sub-toggle" type="button" role="menuitem" aria-haspopup="true" :aria-expanded="adminOpen" @click="adminOpen = !adminOpen">
            Admin
            <svg class="acct-sub-chev" :class="{ 'is-open': adminOpen }" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div v-if="adminOpen" class="acct-sub" role="group" aria-label="Admin">
            <RouterLink class="acct-item" role="menuitem" :to="{ name: 'adminStats' }" @click="open = false">Statistics</RouterLink>
            <RouterLink class="acct-item" role="menuitem" :to="{ name: 'adminUsers' }" @click="open = false">User Management</RouterLink>
            <RouterLink class="acct-item" role="menuitem" :to="{ name: 'adminPlans' }" @click="open = false">Player plans</RouterLink>
          </div>
        </template>
        <button class="acct-item" type="button" role="menuitem" @click="doLogout">Log out</button>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NotificationBell from '@/components/NotificationBell.vue'
import { profilePageApi } from '@/api/profilePage'
import { logOut, refreshNotifications, refreshProfiles, useAuth } from '@/composables/useAuth'
import { track } from '@/utils/analytics'

const { user, ready, loggedIn, isAdmin, profiles, notifications } = useAuth()
const route = useRoute()
const router = useRouter()
const open = ref(false)
// The Admin group inside the menu; it opens by itself when you are on one of its pages.
const ADMIN_PAGES = ['adminStats', 'adminUsers', 'adminPlans']
const adminOpen = ref(false)
const rootEl = ref(null)

// An owner who uploaded a picture for their profile sees it here instead of their initial.
const photo = computed(() => {
  const p = profiles.value.find((x) => x.avatarV)
  return p ? profilePageApi.avatarUrl(p.username, p.avatarV) : ''
})
const initial = computed(() => (user.value?.email || '?').charAt(0).toUpperCase())
// Log in from a profile and come back to that profile.
const nextQuery = computed(() => (['login', 'signup', 'forgotPassword', 'resetPassword', 'verifyEmail'].includes(route.name) ? undefined : { next: route.fullPath }))

// How many notifications of one kind there are, for the little red number on the matching menu item.
const clanRequests = computed(() => countOf('clan_request') + countOf('clan_requests'))
const countOf = (type) => notifications.value.items.filter((n) => n.type === type).reduce((sum, n) => sum + n.count, 0)

// Opening the menu also checks for a newly approved claim, so the profile name shows up without a reload.
function toggle() {
  open.value = !open.value
  if (open.value) {
    adminOpen.value = ADMIN_PAGES.includes(route.name)
    refreshProfiles()
    refreshNotifications()
  }
}

async function doLogout() {
  open.value = false
  try {
    await logOut()
    track('logout')
  } finally {
    // Leave pages that need an account.
    if (route.meta?.requiresAuth) router.replace({ name: 'players' })
  }
}

const onDoc = (e) => {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}
// The badge stays fresh: check again every minute while the tab is visible, and whenever it comes back into view.
let timer = null
const poll = () => {
  if (loggedIn.value && document.visibilityState === 'visible') refreshNotifications()
}
onMounted(() => {
  document.addEventListener('click', onDoc)
  document.addEventListener('visibilitychange', poll)
  timer = setInterval(poll, 60_000)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDoc)
  document.removeEventListener('visibilitychange', poll)
  clearInterval(timer)
})
</script>
