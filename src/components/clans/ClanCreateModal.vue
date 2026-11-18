<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <form class="modal-card save-plan clan-create" role="dialog" aria-modal="true" aria-labelledby="cc-h" novalidate @submit.prevent="create">
        <div class="share-modal-header">
          <h2 id="cc-h">Start a clan</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="close">✕</button>
        </div>
        <p class="clan-desc cc-lead">A clan is your crew: a real clan, or a few friends. Invite people with a link, then run XP competitions between them.</p>

        <div class="clan-form cc-form">
          <label class="clan-field">
            <span>Clan name <small>{{ name.length }}/40</small></span>
            <input ref="nameInput" v-model="name" type="text" maxlength="40" autocomplete="off" placeholder="e.g. The Iron Clan" data-1p-ignore :disabled="busy" />
          </label>
          <label class="clan-field">
            <span>Description <small>optional, {{ description.length }}/200</small></span>
            <textarea v-model="description" maxlength="200" rows="3" placeholder="A line about who this clan is for" :disabled="busy"></textarea>
          </label>
          <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
        </div>
        <p class="clan-note cc-note">Names and descriptions are plain text, and links are not allowed. You can own up to 3 clans.</p>

        <div class="save-plan-actions">
          <button class="btn btn-ghost" type="button" :disabled="busy" @click="close">Cancel</button>
          <button class="btn btn-primary" type="submit" :disabled="busy || name.trim().length < 3">{{ busy ? 'Creating…' : 'Create clan' }}</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { clansApi } from '@/api/clans'
import { track } from '@/utils/analytics'

// Starting a clan, in a window on the Clans page. The new clan's own page opens when it is made.
const emit = defineEmits(['close'])
const router = useRouter()
const name = ref('')
const description = ref('')
const error = ref('')
const busy = ref(false)
const nameInput = ref(null)

const close = () => !busy.value && emit('close')
async function create() {
  if (busy.value || name.value.trim().length < 3) return
  busy.value = true
  error.value = ''
  try {
    const clan = await clansApi.create(name.value.trim(), description.value.trim())
    track('clan_create')
    emit('close')
    router.push({ name: 'clan', params: { slug: clan.slug } })
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}
const onKey = (e) => e.key === 'Escape' && close()
onMounted(() => {
  document.addEventListener('keydown', onKey)
  nameInput.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
