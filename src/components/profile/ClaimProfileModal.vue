<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card claim-modal" role="dialog" aria-modal="true" :aria-label="`Claim ${displayName}`">
      <div class="share-modal-header">
        <h2>{{ title }}</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <!-- Not signed in -->
      <template v-if="!loggedIn">
        <p class="claim-lead">Claiming proves that <b>{{ displayName }}</b> is your RuneScape account and makes you its owner on TickGains. You need a TickGains account first, and it is free.</p>
        <ul class="claim-benefits"><li v-for="b in CLAIM_BENEFITS" :key="b.key"><span aria-hidden="true">✓</span><span><b>{{ b.title }}</b> {{ b.text }}</span></li></ul>
        <div class="claim-actions">
          <RouterLink class="btn btn-primary" :to="{ name: 'login', query: { next } }" @click="$emit('close')">Log in</RouterLink>
          <RouterLink class="btn btn-ghost" :to="{ name: 'signup', query: { next } }" @click="$emit('close')">Create an account</RouterLink>
        </div>
      </template>

      <!-- Already yours -->
      <p v-else-if="state.mine === 'owner'" class="claim-lead"><b>{{ displayName }}</b> is your profile. More owner features are on the way.</p>

      <!-- Someone else's -->
      <p v-else-if="state.claimed" class="claim-lead"><b>{{ displayName }}</b> has already been claimed by another account. If that is not right, reach out on the Discord or the contact page.</p>

      <!-- Waiting on the in-game message -->
      <template v-else-if="state.mine === 'pending'">
        <p class="claim-lead">Almost there. Prove <b>{{ displayName }}</b> is yours by sending this code in game.</p>
        <div class="claim-code-box">
          <span class="claim-code" aria-label="Your code">{{ state.code }}</span>
          <button class="btn btn-ghost" type="button" @click="copyCode">Copy code</button>
        </div>
        <ol class="claim-steps">
          <li>Log in to Old School RuneScape as <b>{{ displayName }}</b>.</li>
          <li>Send a private message to <b class="claim-contact">{{ state.contact }}</b> with just the code above.</li>
          <li>Once the code is checked you will get an email, and the profile becomes yours.</li>
        </ol>
        <ClaimHours :contact="state.contact" />
        <ClaimAvailability :contact="state.contact" :saved="state.onlineFrom ? state : null" saveable :busy="busy" @change="draft = $event" @save="saveWindow" />
        <div class="claim-ping">
          <button class="btn btn-primary" type="button" :disabled="busy || state.pingWaitMinutes > 0" @click="ping">
            {{ state.pingWaitMinutes > 0 ? `Pinged. You can ping again in ${state.pingWaitMinutes} min` : `I'm online now, ping ${state.contact}` }}
          </button>
          <p class="claim-ping-hint">Notifies {{ state.contact }} on Discord and in the TickGains app that you are in game and sending your code. Stay logged in.</p>
        </div>
        <p class="empty-hint share-modal-hint">The message has to come from {{ displayName }}, since that is how we know it is you. The code works until {{ expires }}. If the claim is not confirmed by then it closes, and you can open a new one. You can close this and come back any time, your code stays on your profile page and your account page.</p>
        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
        <button class="btn-text claim-cancel" type="button" :disabled="busy" @click="cancel">Cancel this claim</button>
      </template>

      <!-- Not started yet -->
      <template v-else>
        <p class="claim-lead">Claim <b>{{ displayName }}</b> to become its owner on TickGains.</p>
        <ul class="claim-benefits"><li v-for="b in CLAIM_BENEFITS" :key="b.key"><span aria-hidden="true">✓</span><span><b>{{ b.title }}</b> {{ b.text }}</span></li></ul>
        <ol class="claim-steps">
          <li>Start the claim to get a short code.</li>
          <li>Send that code in game to <b class="claim-contact">{{ state.contact }}</b> from {{ displayName }}.</li>
          <li>Once the code is checked you will get an email, and the profile becomes yours.</li>
        </ol>
        <ClaimHours :contact="state.contact" />
        <ClaimAvailability :contact="state.contact" @change="draft = $event" />
        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
        <button class="btn btn-primary claim-start" type="button" :disabled="busy" @click="start(false)">{{ busy ? 'Starting…' : 'Start claim' }}</button>
        <div class="claim-ping claim-ping-start">
          <button class="btn btn-ghost" type="button" :disabled="busy" @click="start(true)">I'm online now, start and ping {{ state.contact }}</button>
          <p class="claim-ping-hint">Starts the claim and notifies {{ state.contact }} on Discord and in the TickGains app, so they can log on and check your code.</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ClaimAvailability from '@/components/profile/ClaimAvailability.vue'
import ClaimHours from '@/components/profile/ClaimHours.vue'
import { CLAIM_BENEFITS } from '@/data/claimBenefits'
import { ApiError } from '@/api/client'
import { claimsApi } from '@/api/claims'
import { refreshNotifications } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

const props = defineProps({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  state: { type: Object, required: true },
  loggedIn: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'update'])
const { showToast } = useToast()

const busy = ref(false)
const error = ref('')
// The window being picked in the form ({ onlineFrom, onlineUntil } or null).
const draft = ref(null)

const next = computed(() => `/player/${encodeURIComponent(props.username)}`)
const expires = computed(() => (props.state.expiresAt ? new Date(props.state.expiresAt).toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''))
const title = computed(() => {
  if (props.state.mine === 'owner') return 'Your profile'
  if (props.state.claimed) return 'Already claimed'
  return props.state.mine === 'pending' ? 'Send your code' : 'Claim this profile'
})

async function start(pingNow = false) {
  busy.value = true
  error.value = ''
  try {
    emit('update', await claimsApi.start(props.username, draft.value, { ping: pingNow }))
    refreshNotifications()
    track('claim_started', { ping: pingNow })
    if (pingNow) showToast(`${props.state.contact} has been pinged. Stay logged in.`)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}

async function saveWindow(window) {
  busy.value = true
  error.value = ''
  try {
    emit('update', await claimsApi.online(props.username, window))
    showToast(window ? `Saved. ${props.state.contact} can see when you will be online.` : 'Window cleared.')
    if (window) track('claim_window_saved')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}

async function ping() {
  busy.value = true
  error.value = ''
  try {
    emit('update', await claimsApi.ping(props.username))
    showToast(`${props.state.contact} has been pinged. Stay logged in.`)
    track('claim_pinged')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}

async function cancel() {
  busy.value = true
  try {
    emit('update', await claimsApi.cancel(props.username))
    refreshNotifications()
    track('claim_cancelled')
  } catch {
    showToast('Could not cancel the claim, please try again.')
  } finally {
    busy.value = false
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.state.code)
    showToast('Code copied!')
  } catch {
    showToast('Could not copy. Select the code and copy it by hand.')
  }
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
