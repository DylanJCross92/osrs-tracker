<template>
  <Teleport to="body">
    <div class="modal-overlay spr-overlay" @click.self="$emit('close')">
      <div class="modal-card spr" role="dialog" aria-modal="true" aria-labelledby="spr-h">
        <header class="spr-head">
          <h2 id="spr-h">What looks wrong?</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        </header>
        <template v-if="!sent">
          <p class="spr-sub">The Smart Planner is still in Beta. Tell us what is off about this plan and we will look at it. Your answers and the plan come with the message (not your name).</p>
          <form @submit.prevent="submit">
            <label class="spr-field">
              <span>What looks wrong</span>
              <textarea ref="box" v-model="message" rows="5" maxlength="2000" placeholder="For example: it sends me to Monkey Madness I but I am combat level 40." required />
            </label>
            <label class="spr-field">
              <span>Your email, if you want a reply (optional)</span>
              <input v-model="email" type="email" autocomplete="email" maxlength="200" />
            </label>
            <input v-model="website" class="spr-trap" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" name="website" />
            <p v-if="error" class="spr-error" role="alert">{{ error }}</p>
            <footer class="spr-foot">
              <button class="btn btn-ghost" type="button" @click="$emit('close')">Cancel</button>
              <button class="btn btn-primary" type="submit" :disabled="sending || message.trim().length < 5">{{ sending ? 'Sending…' : 'Send report' }}</button>
            </footer>
          </form>
        </template>
        <div v-else class="spr-done" role="status">
          <b>Thank you.</b>
          <p>That is with us now. It helps make the Smart Planner better.</p>
          <button class="btn btn-primary" type="button" @click="$emit('close')">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '@/api/client'
import { feedbackApi } from '@/api/feedback'
import { useAuth } from '@/composables/useAuth'
import { reportContext } from '@/utils/smartReport'
import { track } from '@/utils/analytics'

// A short form: what looks wrong, an optional reply address. Goes through the site's feedback route as a "plan report".
const props = defineProps({ plan: { type: Object, required: true } })
const emit = defineEmits(['close'])
const route = useRoute()
const { user } = useAuth()

const message = ref('')
const email = ref('')
const website = ref('') // a field real people never see; bots fill it in
const sending = ref(false)
const sent = ref(false)
const error = ref('')
const box = ref(null)

watch(
  () => user.value?.email,
  (value) => {
    if (value && !email.value) email.value = value
  },
  { immediate: true },
)

async function submit() {
  if (sending.value || message.value.trim().length < 5) return
  sending.value = true
  error.value = ''
  try {
    await feedbackApi.send({
      kind: 'plan_report',
      message: message.value,
      email: email.value,
      page: route.path,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      website: website.value,
      context: reportContext(props.plan),
    })
    track('smart_planner_report', { goal: props.plan.profile?.goal || '' })
    sent.value = true
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not send that right now. Please try again.'
  } finally {
    sending.value = false
  }
}

const onKey = (e) => {
  if (e.key !== 'Escape') return
  e.stopImmediatePropagation()
  emit('close')
}
onMounted(() => {
  document.addEventListener('keydown', onKey, true)
  nextTick(() => box.value?.focus())
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey, true))
</script>
