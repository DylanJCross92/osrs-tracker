<template>
  <section v-if="claims.length" class="doc" aria-labelledby="doc-h">
    <h2 id="doc-h" class="doc-title">{{ claims.length === 1 ? 'A claim is still open' : `${claims.length} claims are still open` }}</h2>
    <ul class="doc-list">
      <li v-for="c in claims" :key="c.id" class="doc-row">
        <div class="doc-main">
          <span class="doc-top">
            <RouterLink class="doc-name" :to="{ name: 'playerDetail', params: { username: c.player.username } }">{{ c.player.displayName }}</RouterLink>
            <span class="doc-meta">closes {{ closesIn(c.expiresAt, now) }}</span>
          </span>
          <p class="doc-send">Send <code class="doc-code" aria-label="Claim code">{{ c.code }}</code> in game to <b>{{ contact || 'the owner' }}</b> from {{ c.player.displayName }}.</p>
        </div>
        <div class="doc-actions">
          <button class="btn btn-primary" type="button" :disabled="pinging === c.id || wait(c) > 0" @click="ping(c)">
            {{ wait(c) > 0 ? `Pinged, again in ${wait(c)} min` : pinging === c.id ? 'Pinging…' : `I'm online, ping ${contact || 'the owner'}` }}
          </button>
          <button class="btn-text doc-more" type="button" :disabled="opening === c.id" @click="open(c)">Details</button>
        </div>
      </li>
    </ul>
    <ClaimProfileModal v-if="state" :username="active.username" :display-name="active.displayName" :state="state" logged-in @update="state = $event" @close="close" />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ClaimProfileModal from '@/components/profile/ClaimProfileModal.vue'
import { ApiError } from '@/api/client'
import { claimsApi } from '@/api/claims'
import { refreshProfiles, useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'
import { closesIn, pingWaitLeft } from '@/utils/claimWindow'

// A reminder for every profile claim that is still waiting for its code: the code to copy, a ping to the owner, and the full claim window.
const { pendingClaims, claimContact } = useAuth()
const { showToast } = useToast()
const claims = computed(() => pendingClaims.value.filter((c) => c.code))
const contact = computed(() => claimContact.value)

// The clock ticks so the "ping again in" wait counts down.
const now = ref(new Date())
let timer
onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 30_000)
  refreshProfiles()
})
onBeforeUnmount(() => clearInterval(timer))
const wait = (c) => pingWaitLeft(c.lastPingAt, now.value)

const pinging = ref(null)
async function ping(c) {
  pinging.value = c.id
  try {
    await claimsApi.ping(c.player.username)
    await refreshProfiles()
    now.value = new Date()
    showToast(`${contact.value || 'The owner'} has been pinged. Stay logged in.`)
    track('claim_pinged', { place: 'dashboard' })
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Could not send the ping. Please try again.')
  } finally {
    pinging.value = null
  }
}

// The whole claim window (hours, when you will be online), read fresh first.
const active = ref({ username: '', displayName: '' })
const state = ref(null)
const opening = ref(null)
async function open(c) {
  opening.value = c.id
  try {
    const s = await claimsApi.get(c.player.username)
    active.value = c.player
    state.value = s
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Could not open the claim. Please try again.')
  } finally {
    opening.value = null
  }
}
function close() {
  state.value = null
  refreshProfiles()
}
</script>
