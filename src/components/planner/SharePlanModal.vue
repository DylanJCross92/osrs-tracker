<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card plan-share" role="dialog" aria-modal="true" :aria-label="`Share ${plan.name}`">
      <div class="share-modal-header">
        <h2>Share this plan</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <template v-if="!loggedIn">
        <p class="ps-lead">Plans are private. To make one public you need a free account, so you can switch the link off again whenever you like.</p>
        <div class="share-actions">
          <RouterLink class="btn btn-primary share-wide" :to="{ name: 'login', query: { next: '/planner' } }">Log in</RouterLink>
          <RouterLink class="btn btn-ghost" :to="{ name: 'signup', query: { next: '/planner' } }">Create an account</RouterLink>
        </div>
      </template>

      <template v-else>
        <p v-if="!current && autoPublish && busy" class="ps-lead">Creating the public link for <b>{{ plan.name }}</b>…</p>
        <p v-else-if="!current" class="ps-lead">
          <b>{{ plan.name }}</b> is private. Make it public to get a link anyone can open, no account needed. They can look at it and copy it, but never change yours. Your account is never shown.
        </p>
        <p v-else class="ps-lead ps-live"><span class="ps-dot" aria-hidden="true" /> <b>{{ plan.name }}</b> is public. Anyone with the link can view it.<template v-if="autoPublish"> It is not saved to your account.</template></p>

        <fieldset class="ps-modes">
          <legend>What people see</legend>
          <label class="ps-mode" :class="{ on: mode === 'static' }">
            <input v-model="mode" type="radio" value="static" />
            <span><b>Static plan</b><small>The goals, methods, hours, gp and finish time as they are now. It does not change as you play.</small></span>
          </label>
          <label class="ps-mode" :class="{ on: mode === 'live', off: !canLive }">
            <input v-model="mode" type="radio" value="live" :disabled="!canLive" />
            <span>
              <b>Live progress</b>
              <small v-if="canLive">Also shows how far {{ plan.player.rsn }} has got, updating from their tracked XP.</small>
              <small v-else>Needs a player on the plan. Load your RSN in the planner and save again.</small>
            </span>
          </label>
        </fieldset>

        <p v-if="error" class="planner-error" role="alert">{{ error }}</p>

        <div class="share-actions">
          <button class="btn btn-primary share-wide" type="button" :disabled="busy" @click="publish">
            {{ busy ? 'Saving…' : current ? 'Update the public copy' : 'Make public' }}
          </button>
        </div>
        <p v-if="current" class="empty-hint share-modal-hint">The public copy is a snapshot. When you change this plan, press Update to publish the changes.</p>

        <template v-if="current">
          <div class="ps-link">
            <input type="text" readonly :value="url" aria-label="Public link" @focus="$event.target.select()" />
            <button class="btn btn-ghost" type="button" @click="copyLink">Copy link</button>
          </div>

          <SharePreview :src="cardSrc" :alt="`Preview of ${plan.name}`" :filename="`${slugify(plan.name)}-plan.png`" loading-text="Drawing the preview…" @download="track('plan_share', { method: 'download' })" />

          <div class="share-actions">
            <a class="btn share-x" :href="xUrl" target="_blank" rel="noopener" @click="track('plan_share', { method: 'x' })"><ShareIcon name="x" />Post on X</a>
            <a class="btn btn-ghost" :href="redditUrl" target="_blank" rel="noopener" @click="track('plan_share', { method: 'reddit' })"><ShareIcon name="reddit" />Reddit</a>
            <button v-if="canNativeShare" class="btn btn-ghost" type="button" @click="nativeShare"><ShareIcon name="share" />More…</button>
          </div>
          <p class="empty-hint share-modal-hint">Pasting the link into Discord, X or Reddit shows the preview above.</p>

          <div class="ps-stop">
            <template v-if="!confirmStop">
              <button class="btn-text" type="button" @click="confirmStop = true">Stop sharing</button>
            </template>
            <template v-else>
              <span>The link will stop working for everyone.</span>
              <button class="btn btn-ghost" type="button" :disabled="busy" @click="stopSharing">Yes, stop sharing</button>
              <button class="btn-text" type="button" @click="confirmStop = false">Keep it public</button>
            </template>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SharePreview from '@/components/SharePreview.vue'
import ShareIcon from '@/components/ShareIcon.vue'
import { sharedPlansApi } from '@/api/sharedPlans'
import { useAuth } from '@/composables/useAuth'
import { useSharedPlans } from '@/composables/useSharedPlans'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

const props = defineProps({
  plan: { type: Object, required: true },
  // A plan for a profile that is not yours is never kept private: it is published the moment this window opens.
  autoPublish: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const { loggedIn } = useAuth()
const { shareFor, share, stop } = useSharedPlans()
const { showToast } = useToast()

const current = computed(() => shareFor(props.plan.id))
const canLive = computed(() => !!props.plan.player?.rsn)
const mode = ref(current.value?.mode === 'live' && canLive.value ? 'live' : 'static')
const busy = ref(false)
const error = ref('')
const confirmStop = ref(false)

const url = computed(() => (current.value ? sharedPlansApi.pageUrl(current.value.slug) : ''))
const cardSrc = computed(() => (current.value ? sharedPlansApi.cardUrl(current.value.slug, new Date(current.value.updatedAt).getTime()) : ''))
const text = computed(() => `${props.plan.name}: my OSRS training plan on TickGains`)
const xUrl = computed(() => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.value)}&url=${encodeURIComponent(url.value)}&hashtags=OSRS,OldSchoolRuneScape`)
const redditUrl = computed(() => `https://www.reddit.com/submit?url=${encodeURIComponent(url.value)}&title=${encodeURIComponent(text.value)}`)
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan'

async function publish() {
  busy.value = true
  error.value = ''
  try {
    const wasShared = !!current.value
    await share(props.plan, mode.value)
    track(wasShared ? 'plan_share_updated' : 'plan_shared', { mode: mode.value, goals: props.plan.goals.length })
    showToast(wasShared ? 'Public copy updated.' : 'Your plan is public. Copy the link to share it.')
  } catch (err) {
    error.value = err?.message || 'Could not share the plan.'
  } finally {
    busy.value = false
  }
}
async function stopSharing() {
  busy.value = true
  try {
    await stop(current.value.slug)
    track('plan_share_stopped')
    showToast('Sharing is off. The link no longer works.')
    confirmStop.value = false
  } catch (err) {
    error.value = err?.message || 'Could not stop sharing.'
  } finally {
    busy.value = false
  }
}
async function copyLink() {
  track('plan_share', { method: 'copy_link' })
  try {
    await navigator.clipboard.writeText(url.value)
    showToast('Link copied!')
  } catch {
    showToast('Could not copy the link.')
  }
}
async function nativeShare() {
  track('plan_share', { method: 'native' })
  try {
    await navigator.share({ title: text.value, text: text.value, url: url.value })
  } catch {
    /* dismissed */
  }
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  // Sharing a plan for someone else's profile publishes it straight away, there is no private version to start from.
  if (props.autoPublish && loggedIn.value && !current.value) publish()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
