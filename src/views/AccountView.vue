<template>
  <div class="hub">
    <header class="hub-top">
      <div>
        <p class="hub-eyebrow">Account</p>
        <h1>My account</h1>
        <p class="acc-sub">{{ user?.email }}<span v-if="since"> · Member since {{ since }}</span></p>
        <RoleBadges class="acc-roles" :roles="user?.roles || []" />
      </div>
      <button class="btn btn-ghost" type="button" @click="doLogout">Log out</button>
    </header>

    <div class="hub-body">
      <nav class="hub-nav" aria-label="Account sections">
        <button v-for="t in TABS" :key="t.key" type="button" class="hub-tab" :class="{ active: tab === t.key }" :aria-current="tab === t.key ? 'page' : undefined" @click="setTab(t.key)">
          <span>{{ t.label }}</span>
          <i v-if="badge(t.key)" class="hub-count">{{ badge(t.key) }}</i>
        </button>
      </nav>

      <main class="hub-main">
        <AccountProfiles v-if="tab === 'profiles'" />
        <AccountNotifications v-else-if="tab === 'notifications'" @unread="onUnread" />

        <div v-else class="hub-stack">
          <section class="card hub-card">
            <div class="acc-title">
              <h2>Preferences</h2>
              <span class="acc-status" :class="`is-${syncState}`" role="status">{{ statusText }}</span>
            </div>
            <p class="acc-note">These are saved to your account, so they follow you to any device you log in on.</p>

            <div class="acc-row">
              <label for="acc-period"><b>Gains shown by default</b><small>The time range used on profiles and Compare.</small></label>
              <select id="acc-period" v-model="period">
                <option value="day">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
            </div>

            <div class="acc-row">
              <div><b>Players you follow</b><small>They show on your homepage, and you hear when they hit a big milestone.</small></div>
              <p v-if="!rivals.length" class="acc-empty">None yet. Press Follow on a profile.</p>
              <ul v-else class="acc-rivals">
                <li v-for="r in rivals" :key="r">
                  <RouterLink :to="{ name: 'playerDetail', params: { username: r } }">{{ r }}</RouterLink>
                  <button type="button" :aria-label="`Unfollow ${r}`" @click="unfollow(r)">×</button>
                </li>
              </ul>
            </div>
          </section>

          <section class="card acc-pw-row hub-card">
            <div>
              <h2>Password</h2>
              <p class="acc-note">Choose a new password for this account.</p>
            </div>
            <button class="btn btn-ghost" type="button" @click="pwOpen = true">Change password</button>
          </section>
        </div>
      </main>
    </div>

    <ChangePasswordModal v-if="pwOpen" @close="pwOpen = false" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'
import RoleBadges from '@/components/RoleBadges.vue'
import AccountProfiles from '@/components/account/AccountProfiles.vue'
import AccountNotifications from '@/components/account/AccountNotifications.vue'
import { logOut, useAuth, waitForAuth } from '@/composables/useAuth'
import { useGainPeriod } from '@/composables/useGainPeriod'
import { useRivals } from '@/composables/useRivals'
import { useFollowing } from '@/composables/useFollowing'
import { meForProfiles } from '@/utils/identity'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'

setPageMeta({ title: 'Your account', description: 'Your TickGains account and settings.', path: '/account', noindex: true })

// The account page is for the account: who you are, the profiles you own and how each is played, notifications and preferences.
// Plans, goals, records and quests live on their own pages (the planner, the profile page, the quest tracker).
const router = useRouter()
const route = useRoute()
const { user, syncState, profiles, notifications } = useAuth()
const { period } = useGainPeriod()
const { me, rivals } = useRivals()
const { unfollow } = useFollowing()

const since = computed(() => (user.value?.createdAt ? new Date(user.value.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''))
const statusText = computed(() => ({ idle: '', saving: 'Saving…', saved: 'Saved to your account', error: 'Could not save, check your connection' })[syncState.value])

// --- sections -------------------------------------------------------------------------------------------------------
const TABS = [
  { key: 'profiles', label: 'Profiles' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'settings', label: 'Settings' },
]
const KEYS = TABS.map((t) => t.key)
const fromRoute = () => (KEYS.includes(route.query.tab) ? route.query.tab : 'profiles')
const tab = ref(fromRoute())
watch(() => [route.query.tab, route.hash], () => {
  tab.value = fromRoute()
  sendLegacy()
})
function setTab(key) {
  tab.value = key
  router.replace({ name: 'account', query: key === 'profiles' ? {} : { tab: key } })
  window.scrollTo({ top: 0 })
}

// Old links into sections that moved: each goes to the page where that thing now lives.
async function sendLegacy() {
  const old = route.hash === '#quests' ? 'quests' : route.query.tab
  if (old === 'plans') return router.replace({ name: 'planner' })
  if (old === 'quests') return router.replace({ name: 'quests' })
  if (old === 'goals' || old === 'records') {
    await waitForAuth()
    const mine = meForProfiles(profiles.value, me.value)
    const own = profiles.value.find((p) => p.displayName === mine) || profiles.value[0]
    return router.replace(own ? { name: 'playerDetail', params: { username: own.username }, query: { tab: old } } : { name: 'players' })
  }
}
sendLegacy()

const unread = ref(notifications.value?.unread || 0)
watch(() => notifications.value?.unread, (n) => (unread.value = n || 0))
const onUnread = (n) => (unread.value = n)
const badge = (key) => (key === 'notifications' ? unread.value || '' : '')

// --- password -------------------------------------------------------------------------------------------------------
const pwOpen = ref(false)

// --- leaving --------------------------------------------------------------------------------------------------------
async function doLogout() {
  await logOut()
  track('logout')
  router.replace({ name: 'players' })
}
</script>
