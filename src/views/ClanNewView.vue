<template>
  <div class="clan clan-narrow">
    <section class="card clan-join">
      <p class="clan-kicker">New clan</p>
      <h1>Start a clan</h1>
      <p class="clan-desc">A clan is your crew: a real clan, or a few friends. Invite people with a link, then run XP competitions between them.</p>

      <form class="clan-form" novalidate @submit.prevent="create">
        <label class="clan-field">
          <span>Clan name <small>{{ name.length }}/40</small></span>
          <input v-model="name" type="text" maxlength="40" autocomplete="off" placeholder="e.g. The Iron Clan" data-1p-ignore :disabled="busy" />
        </label>
        <label class="clan-field">
          <span>Description <small>optional, {{ description.length }}/200</small></span>
          <textarea v-model="description" maxlength="200" rows="3" placeholder="A line about who this clan is for" :disabled="busy"></textarea>
        </label>
        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
        <div class="clan-btns">
          <button class="btn btn-primary" type="submit" :disabled="busy || name.trim().length < 3">{{ busy ? 'Creating…' : 'Create clan' }}</button>
          <RouterLink class="btn btn-ghost" :to="{ name: 'clans' }">Cancel</RouterLink>
        </div>
      </form>
      <p class="clan-note">Names and descriptions are plain text, and links are not allowed. You can own up to 3 clans.</p>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { clansApi } from '@/api/clans'
import { track } from '@/utils/analytics'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({ title: 'New clan', description: 'Start a clan on TickGains.', path: '/clans/new', noindex: true })

const router = useRouter()
const name = ref('')
const description = ref('')
const error = ref('')
const busy = ref(false)

async function create() {
  if (busy.value || name.value.trim().length < 3) return
  busy.value = true
  error.value = ''
  try {
    const clan = await clansApi.create(name.value.trim(), description.value.trim())
    track('clan_create')
    router.push({ name: 'clan', params: { slug: clan.slug } })
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}
</script>
