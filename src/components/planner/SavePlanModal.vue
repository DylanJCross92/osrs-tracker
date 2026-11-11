<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <form class="modal-card save-plan" role="dialog" aria-modal="true" aria-labelledby="save-plan-title" @submit.prevent="submit(false)">
      <div class="share-modal-header">
        <h2 id="save-plan-title">{{ forShare ? 'Name your plan to share it' : asNew ? 'Save as a new plan' : 'Save this plan' }}</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <label class="save-plan-field">
        <span>Plan name</span>
        <input ref="input" v-model="name" type="text" maxlength="60" placeholder="e.g. Road to Max" autocomplete="off" data-1p-ignore data-lpignore="true" />
      </label>

      <p v-if="noSave" class="save-plan-note">This plan is for a profile that is not yours, so it is not saved to your account. It is only shared: the public link keeps a copy of this version.</p>
      <p v-else class="save-plan-note">
        <template v-if="loggedIn">Saved to your account, so it is on every device you log in on.</template>
        <template v-else>Saved in this browser. <RouterLink :to="{ name: 'login', query: { next: '/planner' } }" @click="$emit('close')">Log in</RouterLink> to keep your plans on every device.</template>
      </p>

      <div class="save-plan-actions">
        <button class="btn btn-primary" type="submit" :disabled="!name.trim()">{{ forShare ? (noSave ? 'Continue' : 'Save and continue') : exists ? 'Update plan' : 'Save plan' }}</button>
        <button v-if="exists && !forShare" class="btn btn-ghost" type="button" :disabled="!name.trim()" @click="submit(true)">Save as a new plan</button>
        <button class="btn-text" type="button" @click="$emit('close')">Cancel</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const props = defineProps({
  initialName: { type: String, default: '' },
  // True when this plan has been saved before (so it can be updated instead of saved as a new one).
  exists: { type: Boolean, default: false },
  // Opened by Share on a plan that was never saved: it has to be named first.
  forShare: { type: Boolean, default: false },
  // Saving a copy of the plan on screen as a separate plan.
  asNew: { type: Boolean, default: false },
  // The plan cannot be saved (it is for someone else's profile), only shared.
  noSave: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'confirm'])

const { loggedIn } = useAuth()
const name = ref(props.initialName)
const input = ref(null)

function submit(asNew) {
  const n = name.value.trim()
  if (!n) return
  emit('confirm', { name: n, asNew })
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  input.value?.focus()
  input.value?.select()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
