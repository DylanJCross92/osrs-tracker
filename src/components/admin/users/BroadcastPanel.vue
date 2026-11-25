<template>
  <section v-if="isOwner" class="ann" aria-labelledby="bc-h">
    <div class="ann-head">
      <div>
        <h2 id="bc-h">In-app notice to everyone</h2>
        <p v-if="data" class="ann-sub">Shows in each account's notification bell. No email is sent.</p>
      </div>
    </div>

    <p v-if="error" class="st-empty">{{ error }}</p>
    <p v-else-if="!data" class="st-empty">Loading…</p>
    <template v-else>
      <blockquote class="bc-quote">{{ data.text }}</blockquote>
      <p class="ann-facts">
        Opens <b>{{ data.link }}</b>. Goes to <b>{{ data.accounts.toLocaleString('en-US') }}</b> {{ data.accounts === 1 ? 'account' : 'accounts' }}, once each.
        <template v-if="data.alreadySent">Already sent to <b>{{ data.alreadySent.toLocaleString('en-US') }}</b>.</template>
      </p>
      <p v-if="message" class="ann-ok" role="status">{{ message }}</p>

      <div v-if="!asking" class="ann-actions">
        <button type="button" class="btn btn-primary" :disabled="busy || !data.remaining" @click="asking = true">
          {{ data.remaining ? `Notify ${data.remaining.toLocaleString('en-US')} ${data.remaining === 1 ? 'account' : 'accounts'}` : 'Everyone has it' }}
        </button>
      </div>
      <div v-else class="ann-confirm" role="alertdialog" aria-labelledby="bc-confirm-h">
        <p id="bc-confirm-h"><b>Notify {{ data.remaining.toLocaleString('en-US') }} {{ data.remaining === 1 ? 'account' : 'accounts' }} now?</b> It appears in their bell straight away and cannot be taken back.</p>
        <div class="ann-actions">
          <button type="button" class="btn btn-ghost" @click="asking = false">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="!!busy" @click="send">{{ busy ? 'Sending…' : 'Yes, notify them' }}</button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'
import { useAuth } from '@/composables/useAuth'

// The owner's one-off in-app notice to every account (what it says is in server/src/utils/broadcasts.js). Only the owner sees it; the
// server refuses anyone else.
const KEY = 'weekly-race-2026-11'
const { user } = useAuth()
const isOwner = computed(() => !!user.value?.roles?.includes('owner'))

const data = ref(null)
const error = ref('')
const message = ref('')
const asking = ref(false)
const busy = ref(false)

async function load() {
  try {
    data.value = await statsApi.broadcast(KEY)
    error.value = ''
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not load the notice.'
  }
}
onMounted(() => isOwner.value && load())

async function send() {
  busy.value = true
  message.value = ''
  try {
    const res = await statsApi.broadcastSend(KEY)
    asking.value = false
    message.value = `Sent to ${res.sent.toLocaleString('en-US')} ${res.sent === 1 ? 'account' : 'accounts'}.`
    await load()
  } catch (err) {
    asking.value = false
    message.value = err instanceof ApiError ? err.message : 'The notice could not be sent.'
  } finally {
    busy.value = false
  }
}
</script>
