<template>
  <div class="acc">
    <section class="card acc-head">
      <div>
        <h1>Your account</h1>
        <p class="acc-sub">{{ user?.email }}<span v-if="since"> · Member since {{ since }}</span></p>
      </div>
      <button class="btn btn-ghost" type="button" @click="doLogout">Log out</button>
    </section>

    <section class="card">
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
        <div><b>Your rivals</b><small>Players you compare against, up to {{ MAX_RIVALS }}.</small></div>
        <p v-if="!rivals.length" class="acc-empty">None yet. Save one from the Compare page.</p>
        <ul v-else class="acc-rivals">
          <li v-for="r in rivals" :key="r">
            <RouterLink :to="{ name: 'playerDetail', params: { username: r } }">{{ r }}</RouterLink>
            <button type="button" :aria-label="`Remove ${r} from your rivals`" @click="removeRival(r)">×</button>
          </li>
        </ul>
      </div>
    </section>

    <section class="card acc-pw-row">
      <div>
        <h2>Password</h2>
        <p class="acc-note">Choose a new password for this account.</p>
      </div>
      <button class="btn btn-ghost" type="button" @click="pwOpen = true">Change password</button>
    </section>

    <ChangePasswordModal v-if="pwOpen" @close="pwOpen = false" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'
import { logOut, useAuth } from '@/composables/useAuth'
import { useGainPeriod } from '@/composables/useGainPeriod'
import { MAX_RIVALS, useRivals } from '@/composables/useRivals'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'

setPageMeta({ title: 'Your account', description: 'Your TickGains account and settings.', path: '/account', noindex: true })

const router = useRouter()
const { user, syncState } = useAuth()
const { period } = useGainPeriod()
const { rivals, removeRival } = useRivals()

const since = computed(() => (user.value?.createdAt ? new Date(user.value.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''))
const statusText = computed(() => ({ idle: '', saving: 'Saving…', saved: 'Saved to your account', error: 'Could not save, check your connection' })[syncState.value])

// --- password -------------------------------------------------------------------------------------------------------
const pwOpen = ref(false)

// --- leaving --------------------------------------------------------------------------------------------------------
async function doLogout() {
  await logOut()
  track('logout')
  router.replace({ name: 'players' })
}
</script>
