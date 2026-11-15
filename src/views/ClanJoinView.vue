<template>
  <div class="clan clan-narrow">
    <p v-if="loading" class="dash-loading">Opening the invite…</p>

    <section v-else-if="!preview" class="card clan-empty">
      <h1>This invite does not work</h1>
      <p>The link may be wrong, or the clan's owner made a new one. Ask for a fresh invite link.</p>
      <RouterLink class="btn btn-primary" to="/">Back home</RouterLink>
    </section>

    <!-- The request is in: nothing more to do but wait for the answer -->
    <section v-else-if="sent" class="card clan-join clan-sent">
      <span class="clan-sent-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5" /><path d="M12 7v5l3 2" /></svg>
      </span>
      <p class="clan-kicker">{{ sent.alreadyRequested ? 'Already asked' : 'Request sent' }}</p>
      <h1>{{ sent.alreadyRequested ? 'Your request is waiting' : 'Now it is up to the clan' }}</h1>
      <p class="clan-desc"><b>{{ sent.player.displayName }}</b> will join <b>{{ sent.name }}</b> as soon as its owner or a moderator approves the request. Nothing else to do on your side.</p>
      <div class="clan-btns">
        <RouterLink class="btn btn-primary" :to="{ name: 'clan', params: { slug: sent.slug } }">See the clan</RouterLink>
        <RouterLink class="btn btn-ghost" :to="{ name: 'clans' }">Browse clans</RouterLink>
      </div>
    </section>

    <section v-else class="card clan-join">
      <p class="clan-kicker">You are invited to join</p>
      <h1>{{ preview.name }}</h1>
      <p v-if="preview.description" class="clan-desc">{{ preview.description }}</p>
      <p class="clan-meta">{{ preview.memberCount }} member{{ preview.memberCount === 1 ? '' : 's' }}</p>

      <p v-if="!preview.acceptingRequests" class="clan-closed" role="status">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M5.3 5.3l13.4 13.4" /></svg>
        <span><b>Not taking new requests right now.</b> The clan's owner has turned join requests off. Ask them to switch it back on, or to send a new link later.</span>
      </p>
      <form v-else class="clan-form" novalidate @submit.prevent="join">
        <label class="clan-field">
          <span>Your RuneScape name</span>
          <input v-model="rsn" type="text" maxlength="12" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="e.g. Zezima" data-1p-ignore :disabled="busy" />
        </label>
        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
        <button class="btn btn-primary clan-submit" type="submit" :disabled="busy || !rsn.trim()">{{ busy ? 'Sending…' : 'Request to join' }}</button>
      </form>
      <p v-if="preview.acceptingRequests" class="clan-note">The clan's owner or a moderator approves every request, so you join once they say yes. Your stats are public on the OSRS hiscores already; joining shows your name and level in the clan and puts you in its competitions.<template v-if="!loggedIn"> <RouterLink :to="{ name: 'login', query: { next: route.fullPath } }">Log in</RouterLink> first if your profile is claimed, and you get a verified tick.</template></p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { clansApi } from '@/api/clans'
import { useAuth } from '@/composables/useAuth'
import { useRivals } from '@/composables/useRivals'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({ title: 'Join a clan', description: 'Join a clan on TickGains.', path: '/join', noindex: true })

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { loggedIn, profiles } = useAuth()
const { me } = useRivals()

const preview = ref(null)
const loading = ref(true)
const rsn = ref('')
const error = ref('')
const busy = ref(false)
// Set once a request has gone in: { slug, name, player, alreadyRequested }.
const sent = ref(null)

onMounted(async () => {
  try {
    preview.value = await clansApi.preview(route.params.token)
    track('clan_invite_open')
  } catch {
    preview.value = null
  } finally {
    loading.value = false
  }
  // Fill in a name we already know: your claimed profile, or the name saved as yours.
  rsn.value = profiles.value[0]?.username || me.value || ''
})

async function join() {
  if (busy.value || !rsn.value.trim()) return
  busy.value = true
  error.value = ''
  try {
    const res = await clansApi.join(route.params.token, rsn.value.trim())
    track('clan_join_request', { status: res.status, verified: res.verified })
    if (res.status === 'pending') {
      sent.value = res
      return
    }
    // An owner or moderator is let straight in; so is someone who is already a member.
    showToast(res.alreadyMember ? `${res.player.displayName} is already in ${res.name}.` : `${res.player.displayName} joined ${res.name}.`)
    router.push({ name: 'clan', params: { slug: res.slug } })
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}
</script>
