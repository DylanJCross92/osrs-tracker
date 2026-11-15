<template>
  <div class="clan clan-narrow">
    <p v-if="loading" class="dash-loading">Opening the invite…</p>

    <section v-else-if="!preview" class="card clan-empty">
      <h1>This invite does not work</h1>
      <p>The link may be wrong, or the clan's owner made a new one. Ask for a fresh invite link.</p>
      <RouterLink class="btn btn-primary" to="/">Back home</RouterLink>
    </section>

    <section v-else class="card clan-join">
      <p class="clan-kicker">You are invited to join</p>
      <h1>{{ preview.name }}</h1>
      <p v-if="preview.description" class="clan-desc">{{ preview.description }}</p>
      <p class="clan-meta">{{ preview.memberCount }} member{{ preview.memberCount === 1 ? '' : 's' }}</p>

      <form class="clan-form" novalidate @submit.prevent="join">
        <label class="clan-field">
          <span>Your RuneScape name</span>
          <input v-model="rsn" type="text" maxlength="12" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="e.g. Zezima" data-1p-ignore :disabled="busy" />
        </label>
        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
        <button class="btn btn-primary clan-submit" type="submit" :disabled="busy || !rsn.trim()">{{ busy ? 'Joining…' : `Join ${preview.name}` }}</button>
      </form>
      <p class="clan-note">Your stats are public on the OSRS hiscores already. Joining shows your name and level in this clan and puts you in its competitions.<template v-if="!loggedIn"> <RouterLink :to="{ name: 'login', query: { next: route.fullPath } }">Log in</RouterLink> first if your profile is claimed, and you get a verified tick.</template></p>
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
    track('clan_join', { verified: res.verified })
    showToast(res.alreadyMember ? `${res.player.displayName} is already in ${res.name}.` : `${res.player.displayName} joined ${res.name}.`)
    router.push({ name: 'clan', params: { slug: res.slug } })
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}
</script>
