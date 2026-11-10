<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card cpw-modal" role="dialog" aria-modal="true" aria-label="Change password">
      <div class="share-modal-header">
        <h2>Change password</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <form class="auth-form" novalidate @submit.prevent="submit">
        <label class="auth-field"><span>Current password</span><input ref="firstEl" v-model="current" type="password" autocomplete="current-password" maxlength="128" :disabled="busy" /></label>
        <label class="auth-field"><span>New password</span><input v-model="next" type="password" autocomplete="new-password" maxlength="128" placeholder="At least 8 characters" :disabled="busy" /></label>
        <label class="auth-field"><span>Confirm new password</span><input v-model="confirm" type="password" autocomplete="new-password" maxlength="128" placeholder="Type it again" :disabled="busy" /></label>
        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
        <p class="auth-fine">Changing your password logs you out on your other devices.</p>
        <div class="cpw-actions">
          <button class="btn btn-ghost" type="button" @click="$emit('close')">Cancel</button>
          <button class="btn btn-primary" type="submit" :disabled="busy || !current || !next || !confirm">{{ busy ? 'Saving…' : 'Change password' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ApiError } from '@/api/client'
import { authApi } from '@/api/auth'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

const emit = defineEmits(['close'])
const { showToast } = useToast()

const firstEl = ref(null)
const current = ref('')
const next = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  if (busy.value) return
  error.value = ''
  if (next.value !== confirm.value) {
    error.value = 'The two new passwords do not match.'
    return
  }
  busy.value = true
  try {
    await authApi.changePassword(current.value, next.value)
    track('account_setting', { setting: 'password' })
    showToast('Password changed. Your other devices were logged out.')
    emit('close')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  nextTick(() => firstEl.value?.focus())
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
