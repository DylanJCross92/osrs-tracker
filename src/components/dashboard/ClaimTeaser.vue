<template>
  <section v-if="show" class="ct" :class="`is-${variant}`" :aria-labelledby="`ct-${variant}-h`">
    <template v-if="variant === 'card'">
      <header class="ct-head">
        <span class="ct-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z" /><path d="M9 12l2 2 4-4" /></svg>
        </span>
        <div>
          <h2 :id="`ct-${variant}-h`">Make {{ displayName }} yours</h2>
          <p>Claim this profile to unlock:</p>
        </div>
      </header>
      <ul class="ct-list">
        <li v-for="b in CLAIM_BENEFITS" :key="b.key">
          <span class="ct-tick" aria-hidden="true">✓</span>
          <span><b>{{ b.title }}</b>{{ b.text }}</span>
        </li>
      </ul>
      <div class="ct-foot">
        <button class="btn btn-primary" type="button" :disabled="busy" @click="open">{{ pending ? 'Finish claiming' : `Claim ${displayName}` }}</button>
        <small>Free, and it takes a minute: {{ loggedIn ? 'send a short code from your account in game' : 'create an account, then send a short code from your account in game' }}.</small>
      </div>
    </template>

    <!-- The same card as Goals, locked: it shows what is missing and what unlocks it -->
    <template v-else>
      <header class="ct-lockhead">
        <h2 :id="`ct-${variant}-h`">Goals</h2>
        <span class="ct-lock"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>Claim to unlock</span>
      </header>
      <p class="ct-lockp">Your plan's goals and how far along you are show up here and on your profile once {{ displayName }} is yours.</p>
      <button class="btn" type="button" :disabled="busy" @click="open">{{ pending ? 'Finish claiming' : 'Claim this profile' }}</button>
    </template>

    <ClaimProfileModal v-if="state" :username="username" :display-name="displayName" :state="state" :logged-in="loggedIn" @update="(s) => (state = s)" @close="close" />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ClaimProfileModal from '@/components/profile/ClaimProfileModal.vue'
import { ApiError } from '@/api/client'
import { claimsApi } from '@/api/claims'
import { refreshProfiles, useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { CLAIM_BENEFITS } from '@/data/claimBenefits'
import { track } from '@/utils/analytics'

// On the dashboard of someone whose player is not claimed yet: what claiming gives, and the way to do it. `card` is the invitation, `goals` is the Goals
// card shown locked. Hidden when the profile already belongs to someone (there is nothing to offer) or to this account.
const props = defineProps({ username: { type: String, required: true }, displayName: { type: String, required: true }, variant: { type: String, default: 'card' } })
const { loggedIn } = useAuth()
const { showToast } = useToast()

const claim = ref(null) // the claim state for this player, or null until read
const state = ref(null) // set while the claim window is open
const busy = ref(false)

async function read() {
  claim.value = null
  try {
    claim.value = await claimsApi.get(props.username)
  } catch {
    claim.value = null
  }
}
onMounted(read)
watch(() => props.username, read)

const pending = computed(() => claim.value?.mine === 'pending')
// Nothing to offer once someone owns it. While the state is not known yet the invitation shows (claiming checks again when it opens).
const show = computed(() => !(claim.value && (claim.value.mine === 'owner' || claim.value.claimed)))

async function open() {
  if (busy.value) return
  busy.value = true
  track('claim_teaser_click', { variant: props.variant, signed_in: loggedIn.value })
  try {
    const fresh = await claimsApi.get(props.username)
    if (fresh.claimed && fresh.mine !== 'owner') {
      claim.value = fresh
      showToast(`${props.displayName} has already been claimed by another account.`)
      return
    }
    state.value = fresh
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Could not start the claim. Please try again.')
  } finally {
    busy.value = false
  }
}
function close() {
  state.value = null
  refreshProfiles()
  read()
}
</script>
