<template>
  <div class="fb" :class="{ 'is-open': open }">
    <Transition name="fb-pop">
      <section v-if="open" id="fb-panel" ref="panel" class="fb-panel" role="dialog" aria-labelledby="fb-title" @keydown.esc.stop="close">
        <header class="fb-head">
          <h2 id="fb-title">Send feedback</h2>
          <button class="fb-x" type="button" aria-label="Close" @click="close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div v-if="sent" class="fb-done" role="status">
          <span class="fb-done-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg></span>
          <b>Thank you!</b>
          <p>We read every message.</p>
          <button class="btn btn-ghost" type="button" @click="again">Send another</button>
        </div>

        <form v-else class="fb-form" novalidate @submit.prevent="submit">
          <div class="fb-kinds" role="radiogroup" aria-label="What kind of feedback">
            <button v-for="k in KINDS" :key="k.key" type="button" role="radio" :aria-checked="kind === k.key" :class="{ on: kind === k.key }" @click="kind = k.key">
              <span aria-hidden="true">{{ k.icon }}</span>{{ k.label }}
            </button>
          </div>

          <label class="fb-field">
            <span class="sr-only">Your message</span>
            <textarea ref="box" v-model="message" rows="5" :maxlength="MAX" :placeholder="PLACEHOLDERS[kind]" required />
          </label>

          <label class="fb-field">
            <span class="sr-only">Your email, optional</span>
            <input v-model.trim="email" type="email" autocomplete="email" inputmode="email" placeholder="Email, if you'd like a reply (optional)" />
          </label>

          <!-- A field real visitors never see; bots that fill every field are ignored. -->
          <input v-model="website" class="fb-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />

          <p v-if="error" class="fb-error" role="alert">{{ error }}</p>

          <div class="fb-foot">
            <small :class="{ 'is-near': message.length > MAX - 200 }">{{ message.length > 0 ? `${message.length} / ${MAX}` : '' }}</small>
            <button class="btn btn-primary" type="submit" :disabled="sending || message.trim().length < MIN">{{ sending ? 'Sending…' : 'Send' }}</button>
          </div>
        </form>
      </section>
    </Transition>

    <button class="fb-fab" type="button" :aria-expanded="open" aria-controls="fb-panel" :aria-label="open ? 'Close feedback' : 'Send feedback'" title="Feedback" @click="toggle">
      <svg v-if="!open" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1.1-4.7A8 8 0 1121 12z" /><path d="M8.5 11h7M8.5 14h4" /></svg>
      <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '@/api/client'
import { feedbackApi } from '@/api/feedback'
import { useAuth } from '@/composables/useAuth'
import { track } from '@/utils/analytics'

// A small button in the corner that opens a feedback form. The message is saved and emailed to the site owner.
const MAX = 2000
const MIN = 5
const KINDS = [
  { key: 'bug', label: 'Bug', icon: '🐞' },
  { key: 'idea', label: 'Idea', icon: '💡' },
  { key: 'other', label: 'Other', icon: '💬' },
]
const PLACEHOLDERS = {
  bug: 'What went wrong? What did you expect to happen?',
  idea: 'What would make TickGains better for you?',
  other: 'Tell us anything.',
}

const route = useRoute()
const { user } = useAuth()

const open = ref(false)
const kind = ref('idea')
const message = ref('')
const email = ref('')
const website = ref('')
const sending = ref(false)
const sent = ref(false)
const error = ref('')
const box = ref(null)

// Signed-in people get their account email filled in as the reply address (they can clear it).
watch(
  () => user.value?.email,
  (value) => {
    if (value && !email.value) email.value = value
  },
  { immediate: true },
)

function toggle() {
  open.value ? close() : show()
}
function show() {
  open.value = true
  track('feedback_open', { page: String(route.name || '') })
  nextTick(() => box.value?.focus())
}
function close() {
  open.value = false
  // A sent message is done with; an unsent draft is kept for when the form is opened again.
  if (sent.value) again()
}
function again() {
  sent.value = false
  message.value = ''
  error.value = ''
  nextTick(() => box.value?.focus())
}

async function submit() {
  if (sending.value || message.value.trim().length < MIN) return
  sending.value = true
  error.value = ''
  try {
    await feedbackApi.send({
      kind: kind.value,
      message: message.value,
      email: email.value,
      // Where they were, so a bug report can be found. Only the path, never the address bar's query.
      page: route.path,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      website: website.value,
    })
    track('feedback_sent', { kind: kind.value })
    sent.value = true
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not send that right now. Please try again.'
  } finally {
    sending.value = false
  }
}
</script>
