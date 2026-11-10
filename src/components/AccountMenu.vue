<template>
  <div v-if="ready" class="acct" :class="{ 'is-in': loggedIn }">
    <template v-if="!loggedIn">
      <RouterLink class="btn btn-ghost acct-login" :to="{ name: 'login', query: nextQuery }">Log in</RouterLink>
    </template>
    <div v-else ref="rootEl" class="acct-wrap">
      <button type="button" class="acct-avatar" :aria-expanded="open" aria-haspopup="menu" :aria-label="`Account menu for ${user.email}`" @click="open = !open" @keydown.esc="open = false">{{ initial }}</button>
      <div v-if="open" class="acct-menu" role="menu">
        <p class="acct-email" :title="user.email">{{ user.email }}</p>
        <RouterLink class="acct-item" role="menuitem" :to="{ name: 'account' }" @click="open = false">Account and settings</RouterLink>
        <button class="acct-item" type="button" role="menuitem" @click="doLogout">Log out</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logOut, useAuth } from '@/composables/useAuth'
import { track } from '@/utils/analytics'

const { user, ready, loggedIn } = useAuth()
const route = useRoute()
const router = useRouter()
const open = ref(false)
const rootEl = ref(null)

const initial = computed(() => (user.value?.email || '?').charAt(0).toUpperCase())
// Log in from a profile and come back to that profile.
const nextQuery = computed(() => (['login', 'signup', 'forgotPassword', 'resetPassword', 'verifyEmail'].includes(route.name) ? undefined : { next: route.fullPath }))

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
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
</script>
