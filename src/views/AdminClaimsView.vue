<template>
  <div class="acc">
    <section class="card acc-head">
      <div>
        <h1>Profile claims</h1>
        <p class="acc-sub">When someone messages you a code in game, type it here to verify them.</p>
      </div>
    </section>

    <section class="card">
      <h2>Verify a code</h2>
      <form class="adm-lookup" novalidate @submit.prevent="lookup">
        <input v-model="code" class="adm-code-input" type="text" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code from the in-game message" aria-label="Code from the in-game message" data-1p-ignore />
        <button class="btn btn-primary" type="submit" :disabled="busy || !code.trim()">Look up</button>
      </form>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

      <div v-if="found" class="adm-found">
        <p class="adm-found-lead">Only approve this if the private message came <b>from {{ found.player.displayName }}</b> in game.</p>
        <dl class="adm-found-rows">
          <div><dt>Profile</dt><dd><RouterLink :to="{ name: 'playerDetail', params: { username: found.player.username } }" target="_blank">{{ found.player.displayName }}</RouterLink></dd></div>
          <div><dt>TickGains account</dt><dd>{{ found.email }}</dd></div>
          <div><dt>Started</dt><dd>{{ when(found.createdAt) }}</dd></div>
        </dl>
        <div class="acc-inline">
          <button class="btn btn-primary" type="button" :disabled="busy" @click="approve">{{ busy ? 'Approving…' : `Approve, ${found.player.displayName} is theirs` }}</button>
          <button class="btn btn-ghost" type="button" :disabled="busy" @click="found = null">Cancel</button>
        </div>
      </div>
      <p v-if="done" class="auth-done" role="status"><span aria-hidden="true">✓</span> {{ done }}</p>
    </section>

    <section class="card">
      <h2>Waiting <span class="adm-count">{{ data.pending.length }}</span></h2>
      <p v-if="loading" class="acc-empty">Loading…</p>
      <p v-else-if="!data.pending.length" class="acc-empty">Nothing waiting.</p>
      <ul v-else class="acc-claims">
        <li v-for="c in data.pending" :key="c.id">
          <div class="acc-claim-main">
            <RouterLink :to="{ name: 'playerDetail', params: { username: c.player.username } }">{{ c.player.displayName }}</RouterLink>
            <span class="adm-email">{{ c.email }}</span>
            <span class="claim-chip" :class="{ 'is-expired': c.expired }">{{ c.expired ? 'Expired' : `Started ${when(c.createdAt)}` }}</span>
            <button class="btn-text adm-reject" type="button" @click="reject(c)">Reject</button>
          </div>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>Verified owners <span class="adm-count">{{ data.verified.length }}</span></h2>
      <p v-if="!loading && !data.verified.length" class="acc-empty">No claimed profiles yet.</p>
      <ul v-else class="acc-claims">
        <li v-for="c in data.verified" :key="c.id">
          <div class="acc-claim-main">
            <RouterLink :to="{ name: 'playerDetail', params: { username: c.player.username } }">{{ c.player.displayName }}</RouterLink>
            <span class="adm-email">{{ c.email }}</span>
            <button class="btn-text adm-reject" type="button" @click="revoke(c)">Revoke</button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ApiError } from '@/api/client'
import { claimsApi } from '@/api/claims'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'

setPageMeta({ title: 'Profile claims', description: 'Verify profile claims.', path: '/admin/claims', noindex: true })

const data = reactive({ pending: [], verified: [] })
const loading = ref(true)
const code = ref('')
const found = ref(null)
const error = ref('')
const done = ref('')
const busy = ref(false)

const when = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const message = (err) => (err instanceof ApiError ? err.message : 'Something went wrong, please try again.')

async function load() {
  try {
    Object.assign(data, await claimsApi.admin.overview())
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function lookup() {
  error.value = ''
  done.value = ''
  found.value = null
  busy.value = true
  try {
    found.value = (await claimsApi.admin.lookup(code.value)).claim
  } catch (err) {
    error.value = message(err)
  } finally {
    busy.value = false
  }
}

async function approve() {
  busy.value = true
  error.value = ''
  try {
    const { claim, emailed } = await claimsApi.admin.approve(code.value)
    done.value = `${claim.player.displayName} now belongs to ${claim.email}. ${emailed ? 'They have been emailed.' : 'The email to them could not be sent, so let them know yourself.'}`
    found.value = null
    code.value = ''
    track('claim_approved')
    await load()
  } catch (err) {
    error.value = message(err)
  } finally {
    busy.value = false
  }
}

async function reject(c) {
  if (!window.confirm(`Reject ${c.email}'s claim on ${c.player.displayName}?`)) return
  try {
    await claimsApi.admin.reject(c.id)
    await load()
  } catch (err) {
    error.value = message(err)
  }
}

async function revoke(c) {
  if (!window.confirm(`Take ${c.player.displayName} away from ${c.email}? The profile becomes unclaimed.`)) return
  try {
    await claimsApi.admin.revoke(c.id)
    await load()
  } catch (err) {
    error.value = message(err)
  }
}
</script>
