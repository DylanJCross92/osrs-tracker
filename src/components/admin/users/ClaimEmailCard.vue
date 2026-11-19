<template>
  <section class="st-card ce" aria-labelledby="ce-title">
    <div class="st-card-head">
      <h2 id="ce-title">Claim reminder email</h2>
      <button type="button" class="btn-text" @click="showExample = !showExample">{{ showExample ? 'Hide' : 'What does it say?' }}</button>
    </div>
    <p v-if="error" class="cl-banner is-error" role="alert">{{ error }}</p>
    <template v-else-if="data">
      <p class="ce-lead">Accounts with a confirmed email and no claimed player get one email about {{ data.afterHours }} hours after confirming. It lists what a claimed profile unlocks. Nobody is emailed twice, and anyone who claimed, started a claim or unsubscribed is skipped.</p>
      <p v-if="!data.mail.configured" class="cl-banner is-error" role="alert">Email is not set up on this server (no RESEND_API_KEY), so nothing can be sent.</p>
      <p v-else-if="data.mail.sharedSender" class="cl-banner" role="status">Emails come from Resend's shared address, which only delivers to your own email until a domain is verified. Until NOTIFY_FROM is set, the automatic emails are paused and only your own test can be delivered.</p>
      <ul class="ce-stats">
        <li><b>{{ fmt(data.sent) }}</b><span>emailed</span></li>
        <li><b>{{ fmt(data.waiting) }}</b><span>waiting for their day</span></li>
        <li><b>{{ fmt(data.legacy.length) }}</b><span>older accounts not emailed</span></li>
        <li><b>{{ fmt(data.optedOut) }}</b><span>unsubscribed</span></li>
      </ul>
      <div v-if="showExample" class="ce-example">
        <p><b>Subject:</b> Your TickGains account is ready for your player</p>
        <p>Heading "Claim your player on TickGains", then six things a claimed profile gives (dashboard, plans that follow real stats, a plan on the profile, a Claimed badge and customised profile, notifications, a verified tick in clans) with three example pictures, and a "Claim my profile" button.</p>
      </div>
      <div class="ce-actions">
        <button type="button" class="btn btn-ghost" :disabled="busy || !data.mail.configured" @click="test">{{ testing ? 'Sending…' : 'Send me a test' }}</button>
        <button type="button" class="btn btn-primary" :disabled="busy || !data.mail.configured || !data.legacy.length" @click="open = true">Email older accounts ({{ fmt(data.legacy.length) }})…</button>
      </div>
      <p v-if="message" class="ce-msg" role="status">{{ message }}</p>
    </template>
    <p v-else class="st-empty">Loading…</p>

    <Teleport to="body">
      <div v-if="open" class="modal-overlay" @click.self="close">
        <div class="modal-card ce-modal" role="alertdialog" aria-modal="true" aria-labelledby="ce-modal-title">
          <div class="share-modal-header">
            <h2 id="ce-modal-title">Email {{ fmt(batch.length) }} older {{ batch.length === 1 ? 'account' : 'accounts' }}?</h2>
            <button class="btn-text" type="button" aria-label="Close" :disabled="sending" @click="close">✕</button>
          </div>
          <p class="ce-modal-text">These accounts confirmed their email before this email existed and have not claimed a player. Each one gets the email once and cannot be emailed again. {{ data.legacy.length > 100 ? 'Up to 100 go out at a time.' : '' }}</p>
          <ul class="ce-list">
            <li v-for="a in batch" :key="a.id">{{ a.email }}<small>joined {{ shortDate(a.createdAt) }}</small></li>
          </ul>
          <div class="save-plan-actions">
            <button class="btn-text" type="button" :disabled="sending" @click="close">Cancel</button>
            <button class="btn btn-primary" type="button" :disabled="sending" @click="send">{{ sending ? 'Sending…' : `Send to ${fmt(batch.length)}` }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'
import { fmt } from '../stats/statsFormat'

const data = ref(null)
const error = ref('')
const message = ref('')
const showExample = ref(false)
const open = ref(false)
const testing = ref(false)
const sending = ref(false)
const busy = computed(() => testing.value || sending.value)
const batch = computed(() => (data.value?.legacy || []).slice(0, 100))
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')
const failure = (err, fallback) => (err instanceof ApiError ? err.message : fallback)

async function load() {
  try {
    data.value = await statsApi.claimNudge()
    error.value = ''
  } catch (err) {
    error.value = failure(err, 'Could not load the email details.')
  }
}
onMounted(load)

async function test() {
  testing.value = true
  message.value = ''
  try {
    const r = await statsApi.claimNudgeTest()
    message.value = r.ok ? `Sent a test to ${r.to}. Nobody is marked as emailed.` : 'The test could not be sent. Check the mail settings.'
  } catch (err) {
    message.value = failure(err, 'The test could not be sent.')
  } finally {
    testing.value = false
  }
}

const close = () => {
  if (!sending.value) open.value = false
}
async function send() {
  sending.value = true
  message.value = ''
  try {
    const r = await statsApi.claimNudgeSend(batch.value.map((a) => a.id))
    message.value = `Sent ${fmt(r.sent)}${r.failed ? `, ${fmt(r.failed)} failed (they stay in the list to try again)` : ''}.`
    open.value = false
    await load()
  } catch (err) {
    message.value = failure(err, 'Could not send.')
    open.value = false
  } finally {
    sending.value = false
  }
}
</script>
