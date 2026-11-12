<template>
  <div class="hub">
    <section class="card hub-top">
      <div>
        <h1>My account</h1>
        <p class="acc-sub">{{ user?.email }}<span v-if="since"> · Member since {{ since }}</span></p>
        <RoleBadges class="acc-roles" :roles="user?.roles || []" />
      </div>
      <button class="btn btn-ghost" type="button" @click="doLogout">Log out</button>
    </section>

    <div class="hub-body">
      <nav class="hub-nav" aria-label="Account sections">
        <button v-for="t in TABS" :key="t.key" type="button" class="hub-tab" :class="{ active: tab === t.key }" :aria-current="tab === t.key ? 'page' : undefined" @click="setTab(t.key)">
          <span>{{ t.label }}</span>
          <i v-if="badge(t.key)" class="hub-count">{{ badge(t.key) }}</i>
        </button>
      </nav>

      <main class="hub-main">
        <div v-if="needsProfile && !profiles.length" class="card hub-card">
          <h2>{{ tab === 'goals' ? 'Goals' : 'Records' }}</h2>
          <p class="acc-note">{{ tab === 'goals' ? 'Public goals' : 'Personal records' }} belong to a RuneScape profile you own. Open your profile page and press Claim, then they show up here.</p>
          <RouterLink class="btn btn-primary" :to="{ name: 'players' }">Find your profile</RouterLink>
        </div>
        <template v-else>
          <div v-if="needsProfile && profiles.length > 1" class="hub-pick" role="group" aria-label="Profile">
            <button v-for="p in profiles" :key="p.username" type="button" :class="{ active: activeProfile?.username === p.username }" @click="pickProfile(p.username)">{{ p.displayName }}</button>
          </div>

          <AccountOverview v-if="tab === 'overview'" :profiles="profiles" :unread="unread" @go="goTo" />
          <AccountPlans v-else-if="tab === 'plans'" />
          <AccountGoals v-else-if="tab === 'goals'" :key="activeProfile.username" :profile="activeProfile" />
          <QuestTracker v-else-if="tab === 'quests'" />
          <ProfileRecords v-else-if="tab === 'records'" :key="activeProfile.username" :player="activeProfile" />
          <AccountNotifications v-else-if="tab === 'notifications'" @unread="onUnread" />

          <div v-else class="hub-stack">
            <section class="card hub-card">
              <div class="acc-title">
                <h2>Settings</h2>
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

            <section class="card hub-card">
              <h2>Your profiles</h2>
              <p class="acc-note">RuneScape profiles you own or are claiming. To claim one, open its profile page and press Claim.</p>
              <p v-if="claimsLoading" class="acc-empty">Loading…</p>
              <p v-else-if="!claims.length" class="acc-empty">No claims yet.</p>
              <ul v-else class="acc-claims">
                <li v-for="c in claims" :key="c.id">
                  <div class="acc-claim-main">
                    <RouterLink :to="{ name: 'playerDetail', params: { username: c.player.username } }">{{ c.player.displayName }}</RouterLink>
                    <span class="claim-chip" :class="c.status === 'verified' ? 'is-ok' : c.expired ? 'is-expired' : ''">{{ c.status === 'verified' ? 'Verified owner' : c.expired ? 'Expired' : 'Waiting for your code' }}</span>
                  </div>
                  <p v-if="c.status === 'pending' && !c.expired && c.code" class="acc-claim-code">
                    Send <b class="claim-code-inline">{{ c.code }}</b> in game to <b>{{ claimContact }}</b> from {{ c.player.displayName }}.
                  </p>
                </li>
              </ul>
            </section>

            <section class="card acc-pw-row hub-card">
              <div>
                <h2>Password</h2>
                <p class="acc-note">Choose a new password for this account.</p>
              </div>
              <button class="btn btn-ghost" type="button" @click="pwOpen = true">Change password</button>
            </section>
          </div>
        </template>
      </main>
    </div>

    <ChangePasswordModal v-if="pwOpen" @close="pwOpen = false" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'
import RoleBadges from '@/components/RoleBadges.vue'
import QuestTracker from '@/components/QuestTracker.vue'
import AccountOverview from '@/components/account/AccountOverview.vue'
import AccountPlans from '@/components/account/AccountPlans.vue'
import AccountGoals from '@/components/account/AccountGoals.vue'
import AccountNotifications from '@/components/account/AccountNotifications.vue'
import ProfileRecords from '@/components/profile/ProfileRecords.vue'
import { useRequirements } from '@/composables/useRequirements'
import { listSavedPlans } from '@/utils/plannerTools'
import { logOut, useAuth } from '@/composables/useAuth'
import { useGainPeriod } from '@/composables/useGainPeriod'
import { useRivals } from '@/composables/useRivals'
import { useFollowing } from '@/composables/useFollowing'
import { claimsApi } from '@/api/claims'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'

setPageMeta({ title: 'Your account', description: 'Your TickGains account and settings.', path: '/account', noindex: true })

const router = useRouter()
const route = useRoute()
const { user, syncState, profiles, notifications } = useAuth()
const { period } = useGainPeriod()
const { rivals } = useRivals()
const { unfollow } = useFollowing()

const since = computed(() => (user.value?.createdAt ? new Date(user.value.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''))
const statusText = computed(() => ({ idle: '', saving: 'Saving…', saved: 'Saved to your account', error: 'Could not save, check your connection' })[syncState.value])

// --- sections -------------------------------------------------------------------------------------------------------
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'plans', label: 'Plans' },
  { key: 'goals', label: 'Goals' },
  { key: 'quests', label: 'Quests' },
  { key: 'records', label: 'Records' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'settings', label: 'Settings' },
]
const KEYS = TABS.map((t) => t.key)
// The section lives in the address (?tab=quests), and an old #quests link still lands on the quest tracker.
const fromRoute = () => (KEYS.includes(route.query.tab) ? route.query.tab : route.hash === '#quests' ? 'quests' : 'overview')
const tab = ref(fromRoute())
watch(() => [route.query.tab, route.hash], () => (tab.value = fromRoute()))
function setTab(key) {
  tab.value = key
  router.replace({ name: 'account', query: key === 'overview' ? {} : { tab: key } })
  window.scrollTo({ top: 0 })
}
const needsProfile = computed(() => tab.value === 'goals' || tab.value === 'records')
const picked = ref('')
const activeProfile = computed(() => profiles.value.find((p) => p.username === picked.value) || profiles.value[0] || null)
const pickProfile = (username) => (picked.value = username)
function goTo(key, username) {
  if (username) picked.value = username
  setTab(key)
}

const { questStats } = useRequirements()
const planCount = listSavedPlans().length
const unread = ref(notifications.value?.unread || 0)
watch(() => notifications.value?.unread, (n) => (unread.value = n || 0))
const onUnread = (n) => (unread.value = n)
const badge = (key) => (key === 'plans' ? planCount || '' : key === 'quests' ? questStats.value.done || '' : key === 'notifications' ? unread.value || '' : '')

// --- profiles -------------------------------------------------------------------------------------------------------
const claims = ref([])
const claimContact = ref('')
const claimsLoading = ref(true)
onMounted(async () => {
  try {
    const res = await claimsApi.mine()
    claims.value = res.claims
    claimContact.value = res.contact
  } catch {
    claims.value = []
  } finally {
    claimsLoading.value = false
  }
})

// --- password -------------------------------------------------------------------------------------------------------
const pwOpen = ref(false)

// --- leaving --------------------------------------------------------------------------------------------------------
async function doLogout() {
  await logOut()
  track('logout')
  router.replace({ name: 'players' })
}
</script>
