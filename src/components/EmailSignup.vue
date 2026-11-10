<template>
  <form class="signup" :class="[`signup-${variant}`, { 'is-done': done }]" novalidate @submit.prevent="submit">
    <template v-if="!done">
      <div v-if="variant === 'card'" class="signup-copy">
        <h3>{{ heading }}</h3>
        <p>{{ blurb }}</p>
      </div>
      <p v-else class="signup-label">{{ heading }}</p>

      <div class="signup-row">
        <label class="sr-only" :for="inputId">Email address</label>
        <input :id="inputId" v-model="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" maxlength="254" :disabled="busy" data-1p-ignore />
        <!-- Honeypot: invisible to people, tempting to bots. -->
        <input v-model="website" class="signup-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <button class="btn btn-primary" type="submit" :disabled="busy">{{ busy ? 'Joining…' : 'Keep me posted' }}</button>
      </div>
      <p v-if="error" class="signup-error" role="alert">{{ error }}</p>
      <p v-else class="signup-fine">Occasional news and new features, like claiming your profile. No spam, unsubscribe anytime. See the <RouterLink to="/privacy">privacy page</RouterLink>.</p>
    </template>
    <p v-else class="signup-done" role="status"><span aria-hidden="true">✓</span> You're on the list. We'll email you when there's news.</p>
  </form>
</template>

<script>
import { ref } from 'vue'

// One flag for every signup form on the page, so signing up in one spot turns the others into the thank-you too.
const KEY = 'tickgains:newsletter'
function readDone() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const signedUp = ref(readDone())
</script>

<script setup>
import { useId } from 'vue'
import { newsletterApi } from '@/api/newsletter'
import { ApiError } from '@/api/client'
import { track } from '@/utils/analytics'

const props = defineProps({
  // Where the form sits, kept with the address so we can tell which spot works. Letters, digits, - and _ only.
  source: { type: String, default: 'site' },
  variant: { type: String, default: 'inline' },
  heading: { type: String, default: 'Get news and new features by email' },
  blurb: { type: String, default: '' },
})

const inputId = `signup-${useId()}`
const email = ref('')
const website = ref('')
const busy = ref(false)
const error = ref('')
// Someone who already signed up here sees the thank-you instead of the form again.
const done = signedUp

async function submit() {
  if (busy.value) return
  error.value = ''
  const value = email.value.trim()
  if (!/^[^\s@]+@[^\s@.][^\s@]*\.[^\s@.]{2,}$/.test(value)) {
    error.value = 'Please enter a valid email address.'
    return
  }
  busy.value = true
  try {
    await newsletterApi.subscribe(value, props.source, website.value)
    done.value = true
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // Private browsing: the thank-you still shows for this visit.
    }
    track('newsletter_signup', { source: props.source })
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not sign you up right now. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>
