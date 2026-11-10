<template>
  <div class="cl">
    <header class="cl-head">
      <h1>Profile claims</h1>
      <p>{{ data.pending.length ? `${data.pending.length} waiting for a code check` : 'Nothing waiting right now' }}</p>
    </header>

    <p v-if="done" class="cl-banner is-ok" role="status"><span aria-hidden="true">✓</span> {{ done }}</p>
    <p v-if="error && !openId" class="cl-banner is-error" role="alert">{{ error }}</p>

    <section class="cl-list" aria-label="Claims waiting">
      <p v-if="loading" class="cl-empty">Loading…</p>
      <p v-else-if="!data.pending.length" class="cl-empty">No requests waiting. New claims show up here, and as a red number on your avatar.</p>

      <article v-for="c in data.pending" :key="c.id" class="cl-card" :class="{ 'is-open': openId === c.id, 'is-expired': c.expired }">
        <div class="cl-row">
          <div class="cl-who">
            <RouterLink class="cl-name" :to="{ name: 'playerDetail', params: { username: c.player.username } }" target="_blank">{{ c.player.displayName }}</RouterLink>
            <span class="cl-meta">{{ c.email }} · {{ c.expired ? 'expired' : `started ${ago(c.createdAt)}` }}</span>
          </div>
          <div v-if="openId !== c.id" class="cl-actions">
            <button class="btn btn-primary" type="button" :disabled="c.expired" @click="startVerify(c)">Verify</button>
            <button class="btn-text cl-reject" type="button" @click="reject(c)">Reject</button>
          </div>
        </div>

        <form v-if="openId === c.id" class="cl-verify" novalidate @submit.prevent="approve(c)">
          <p class="cl-check">Check that the in-game message came from <b>{{ c.player.displayName }}</b>, then enter the code it contained.</p>
          <div class="cl-verify-row">
            <input v-model="code" class="cl-code-input" type="text" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code" aria-label="Code from the in-game message" data-1p-ignore />
            <button class="btn btn-primary" type="submit" :disabled="busy || !code.trim()">{{ busy ? 'Checking…' : 'Approve' }}</button>
            <button class="btn btn-ghost" type="button" :disabled="busy" @click="close">Cancel</button>
          </div>
          <p v-if="error" class="cl-error" role="alert">{{ error }}</p>
        </form>
      </article>
    </section>

    <details class="cl-verified">
      <summary>Verified owners <span class="cl-count">{{ data.verified.length }}</span></summary>
      <p v-if="!data.verified.length" class="cl-empty">No claimed profiles yet.</p>
      <ul v-else>
        <li v-for="c in data.verified" :key="c.id">
          <RouterLink class="cl-name" :to="{ name: 'playerDetail', params: { username: c.player.username } }">{{ c.player.displayName }}</RouterLink>
          <span class="cl-meta">{{ c.email }}</span>
          <button class="btn-text cl-reject" type="button" @click="revoke(c)">Revoke</button>
        </li>
      </ul>
    </details>
  </div>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue'
import { ApiError } from '@/api/client'
import { claimsApi } from '@/api/claims'
import { refreshNotifications } from '@/composables/useAuth'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'

setPageMeta({ title: 'Profile claims', description: 'Verify profile claims.', path: '/admin/claims', noindex: true })

const data = reactive({ pending: [], verified: [] })
const loading = ref(true)
const openId = ref(null)
const code = ref('')
const error = ref('')
const done = ref('')
const busy = ref(false)

const message = (err) => (err instanceof ApiError ? err.message : 'Something went wrong, please try again.')
function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}

async function load() {
  try {
    Object.assign(data, await claimsApi.admin.overview())
    refreshNotifications()
  } finally {
    loading.value = false
  }
}
onMounted(load)

function startVerify(c) {
  openId.value = c.id
  code.value = ''
  error.value = ''
  done.value = ''
  nextTick(() => document.querySelector('.cl-code-input')?.focus())
}
function close() {
  openId.value = null
  code.value = ''
  error.value = ''
}

// The code has to belong to this very request, so typing another person's code on the wrong row never approves it.
async function approve(c) {
  if (busy.value || !code.value.trim()) return
  busy.value = true
  error.value = ''
  try {
    const { claim: found } = await claimsApi.admin.lookup(code.value)
    if (found.id !== c.id) {
      error.value = `That code belongs to a different request (${found.player.displayName}). Check the name on the in-game message.`
      return
    }
    const { claim, emailed } = await claimsApi.admin.approve(code.value)
    done.value = `${claim.player.displayName} now belongs to ${claim.email}. ${emailed ? 'They have been emailed.' : 'The email to them could not be sent, so let them know yourself.'}`
    track('claim_approved')
    close()
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
    if (openId.value === c.id) close()
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
