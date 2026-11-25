<template>
  <section v-if="isOwner" class="ann" aria-labelledby="ann-h">
    <div class="ann-head">
      <div>
        <h2 id="ann-h">Announcement email</h2>
        <p v-if="data" class="ann-sub">{{ data.subject }}</p>
      </div>
      <button v-if="data" type="button" class="btn btn-ghost" :aria-expanded="showPreview" @click="showPreview = !showPreview">{{ showPreview ? 'Hide preview' : 'Preview' }}</button>
    </div>

    <p v-if="error" class="st-empty">{{ error }}</p>
    <p v-else-if="!data" class="st-empty">Loading…</p>
    <template v-else>
      <iframe v-if="showPreview" class="ann-frame" title="Email preview" sandbox="" :srcdoc="data.html" />

      <p class="ann-facts">
        Goes to <b>{{ data.audience.total.toLocaleString('en-US') }}</b> {{ data.audience.total === 1 ? 'person' : 'people' }}:
        {{ data.audience.accounts.toLocaleString('en-US') }} confirmed {{ data.audience.accounts === 1 ? 'account' : 'accounts' }} and
        {{ data.audience.subscribers.toLocaleString('en-US') }} news {{ data.audience.subscribers === 1 ? 'subscriber' : 'subscribers' }}, counted once each.
        Anyone who unsubscribed, anyone unconfirmed and the team are left out, and nobody is emailed twice.
      </p>
      <p v-if="data.alreadySent" class="ann-facts">Already sent to <b>{{ data.alreadySent.toLocaleString('en-US') }}</b>. <b>{{ data.remaining.toLocaleString('en-US') }}</b> still to go.</p>

      <p v-if="!data.configured" class="ann-warn" role="alert">Email is not set up on this server (no RESEND_API_KEY), so nothing can be sent.</p>
      <p v-else-if="!data.ownSender" class="ann-warn" role="alert">The site's own sending address (NOTIFY_FROM) is not set. Until it is, only your own address can receive email, so the send is switched off. A test to yourself still works.</p>

      <div v-if="running" class="ann-progress" role="status" aria-live="polite">
        <span class="ann-bar" aria-hidden="true"><i :style="{ width: `${percent}%` }" /></span>
        <span>Sending… {{ run.sent.toLocaleString('en-US') }} of {{ run.total.toLocaleString('en-US') }}<template v-if="run.failed"> · {{ run.failed }} failed</template></span>
      </div>
      <p v-else-if="run" class="ann-facts" role="status">
        Last send: {{ run.sent.toLocaleString('en-US') }} sent<template v-if="run.failed">, {{ run.failed }} failed</template>.
        <template v-if="run.stoppedReason"> {{ run.stoppedReason }}</template>
      </p>

      <p v-if="message" class="ann-ok" role="status">{{ message }}</p>

      <div v-if="!asking" class="ann-actions">
        <button type="button" class="btn btn-ghost" :disabled="!!busy || !data.configured" @click="sendTest">{{ busy === 'test' ? 'Sending…' : 'Send me a test' }}</button>
        <button type="button" class="btn btn-primary" :disabled="!!busy || running || !data.configured || !data.ownSender || !data.remaining" @click="asking = true">
          {{ data.alreadySent && data.remaining ? `Send to the ${data.remaining.toLocaleString('en-US')} left` : `Send to ${data.remaining.toLocaleString('en-US')} ${data.remaining === 1 ? 'person' : 'people'}` }}
        </button>
      </div>
      <div v-else class="ann-confirm" role="alertdialog" aria-labelledby="ann-confirm-h">
        <p id="ann-confirm-h"><b>Email {{ data.remaining.toLocaleString('en-US') }} {{ data.remaining === 1 ? 'person' : 'people' }} now?</b> This cannot be undone. It is a real email to real people.</p>
        <div class="ann-actions">
          <button type="button" class="btn btn-ghost" @click="asking = false">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="!!busy" @click="send">{{ busy === 'send' ? 'Starting…' : 'Yes, send it' }}</button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'
import { useAuth } from '@/composables/useAuth'

// The owner's one-off announcement email (what it says is in server/src/utils/announcementEmail.js). Preview, a test to your own address, and
// the send to everyone who can be emailed. Only the site owner sees it; the server refuses anyone else.
const KEY = 'graveyard-2026-11-25'
const { user } = useAuth()
const isOwner = computed(() => !!user.value?.roles?.includes('owner'))

const data = ref(null)
const error = ref('')
const message = ref('')
const showPreview = ref(false)
const asking = ref(false)
const busy = ref('')
let timer = null

const run = computed(() => data.value?.run || null)
const running = computed(() => !!run.value?.running)
const percent = computed(() => (run.value?.total ? Math.min(100, Math.round(((run.value.sent + run.value.failed) / run.value.total) * 100)) : 0))

async function load() {
  try {
    data.value = await statsApi.announcement(KEY)
    error.value = ''
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not load the announcement.'
  }
  // While a send is running, look again every few seconds; otherwise leave it.
  clearTimeout(timer)
  if (running.value) timer = setTimeout(load, 3000)
}
onMounted(() => isOwner.value && load())
onBeforeUnmount(() => clearTimeout(timer))

async function sendTest() {
  busy.value = 'test'
  message.value = ''
  try {
    const res = await statsApi.announcementTest(KEY)
    message.value = `A test was sent to ${res.sentTo}.`
  } catch (err) {
    message.value = err instanceof ApiError ? err.message : 'The test could not be sent.'
  } finally {
    busy.value = ''
  }
}

async function send() {
  busy.value = 'send'
  message.value = ''
  try {
    const res = await statsApi.announcementSend(KEY)
    asking.value = false
    message.value = res.started ? `Sending to ${res.remaining.toLocaleString('en-US')}…` : 'Everyone has already been sent this email.'
    await load()
  } catch (err) {
    asking.value = false
    message.value = err instanceof ApiError ? err.message : 'The send could not be started.'
  } finally {
    busy.value = ''
  }
}
</script>
