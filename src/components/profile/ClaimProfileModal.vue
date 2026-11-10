<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card claim-modal" role="dialog" aria-modal="true" :aria-label="`Claim ${displayName}`">
      <div class="share-modal-header">
        <h2>{{ title }}</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <!-- Not signed in -->
      <template v-if="!loggedIn">
        <p class="claim-lead">Claiming proves that <b>{{ displayName }}</b> is your RuneScape account and makes you its owner on TickGains. You need a TickGains account first.</p>
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
        <p class="empty-hint share-modal-hint">The message has to come from {{ displayName }}, since that is how we know it is you. The code works until {{ expires }}. You can close this and come back any time, your code stays on your profile page and your account page.</p>
        <button class="btn-text claim-cancel" type="button" :disabled="busy" @click="cancel">Cancel this claim</button>
      </template>

      <!-- Not started yet -->
      <template v-else>
        <p class="claim-lead">Claim <b>{{ displayName }}</b> to become its owner on TickGains and unlock owner features as we add them.</p>
        <ol class="claim-steps">
          <li>Start the claim to get a short code.</li>
          <li>Send that code in game to <b class="claim-contact">{{ state.contact }}</b> from {{ displayName }}.</li>
          <li>Once the code is checked you will get an email, and the profile becomes yours.</li>
        </ol>
        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
        <button class="btn btn-primary claim-start" type="button" :disabled="busy" @click="start">{{ busy ? 'Starting…' : 'Start claim' }}</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

const next = computed(() => `/player/${encodeURIComponent(props.username)}`)
const expires = computed(() => (props.state.expiresAt ? new Date(props.state.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''))
const title = computed(() => {
  if (props.state.mine === 'owner') return 'Your profile'
  if (props.state.claimed) return 'Already claimed'
  return props.state.mine === 'pending' ? 'Send your code' : 'Claim this profile'
})

async function start() {
  busy.value = true
  error.value = ''
  try {
    emit('update', await claimsApi.start(props.username))
    refreshNotifications()
    track('claim_started')
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
