<template>
  <div class="dw">
    <header class="card dw-hero">
      <p class="dash-hi">Welcome to TickGains</p>
      <h1>Let's find your player</h1>
      <p class="dw-lead">Claim your RuneScape name and this page turns into your own dashboard: your week, streak, goals and plans.</p>
    </header>

    <div class="dash-grid">
      <div class="dash-main">
        <!-- A claim already started: the next step is the code, so say so first. -->
        <DashOpenClaims />

        <section class="card dw-steps" aria-labelledby="dw-steps-h">
          <h2 id="dw-steps-h">{{ pending ? 'Claiming a different player?' : 'Get set up in three steps' }}</h2>
          <ol class="dw-list">
            <li class="dw-step">
              <span class="dw-num" aria-hidden="true">1</span>
              <div class="dw-step-main">
                <b>Find your player</b>
                <p>Type your in-game name and press Claim. Profiles that already belong to someone are marked, and cannot be claimed.</p>
                <NavSearch hero :busy="busy" @claim="openClaim" />
              </div>
            </li>
            <li class="dw-step">
              <span class="dw-num" aria-hidden="true">2</span>
              <div class="dw-step-main">
                <b>Send the code in game</b>
                <p>You get a short code. Message it to us from that account to prove it is yours. It takes a minute.</p>
              </div>
            </li>
            <li class="dw-step">
              <span class="dw-num" aria-hidden="true">3</span>
              <div class="dw-step-main">
                <b>Your dashboard unlocks</b>
                <p>Your week, streak, milestones and goals show up on this page, and your plans track your real stats.</p>
              </div>
            </li>
          </ol>
        </section>

        <section class="dw-more" aria-labelledby="dw-more-h">
          <h2 id="dw-more-h">While you wait, you can already</h2>
          <ul class="dw-tiles">
            <li v-for="t in tiles" :key="t.title">
              <RouterLink class="card dw-tile" :to="t.to">
                <span class="dw-tile-ico" aria-hidden="true" v-html="t.icon" />
                <span class="dw-tile-text"><b>{{ t.title }}</b><small>{{ t.text }}</small></span>
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>

      <aside class="dash-side">
        <FollowingStrip v-if="following.length" />
        <DashWatchlist />
      </aside>
    </div>

    <ClaimProfileModal v-if="claimState" :username="claimFor.username" :display-name="claimFor.displayName" :state="claimState" logged-in @update="onUpdate" @close="closeClaim" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import FollowingStrip from '@/components/home/FollowingStrip.vue'
import DashOpenClaims from '@/components/dashboard/DashOpenClaims.vue'
import DashWatchlist from '@/components/dashboard/DashWatchlist.vue'
import NavSearch from '@/components/NavSearch.vue'
import ClaimProfileModal from '@/components/profile/ClaimProfileModal.vue'
import { ApiError } from '@/api/client'
import { claimsApi } from '@/api/claims'
import { refreshProfiles, useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useFollowing } from '@/composables/useFollowing'

const { pendingClaims } = useAuth()
const { following } = useFollowing()
// The newest claim that is still waiting for its code.
const pending = computed(() => pendingClaims.value[0] || null)

// The claim window, opened right here. The state is read fresh first, so a profile that was claimed a moment ago is refused.
const { showToast } = useToast()
const claimFor = ref({ username: '', displayName: '' })
const claimState = ref(null)
const busy = ref(false)
async function openClaim(player) {
  if (busy.value) return
  busy.value = true
  try {
    const state = await claimsApi.get(player.username)
    if (state.claimed && state.mine !== 'owner') {
      showToast(`${player.displayName} has already been claimed by another account.`)
      return
    }
    claimFor.value = { username: player.username, displayName: player.displayName }
    claimState.value = state
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Could not start the claim. Please try again.')
  } finally {
    busy.value = false
  }
}
const onUpdate = (state) => (claimState.value = state)
function closeClaim() {
  claimState.value = null
  refreshProfiles()
}

const svg = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const tiles = [
  { title: 'Follow players', text: 'See their gains and milestones.', to: { name: 'discover' }, icon: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>') },
  { title: 'Build a plan', text: 'Set goals and get a finish date.', to: { name: 'planner' }, icon: svg('<path d="M4 5h16M4 12h10M4 19h6"/>') },
  { title: 'Join a clan', text: 'Race friends on XP competitions.', to: { name: 'clans' }, icon: svg('<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.5 3.5-5.5 7-5.5s7 2 7 5.5M16 14.5c3 0 6 1.5 6 4.5"/>') },
  { title: 'Try a calculator', text: 'XP and time to any level.', to: { name: 'calculators' }, icon: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>') },
]
</script>
