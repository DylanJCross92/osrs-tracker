<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card plan-share" role="dialog" aria-modal="true" :aria-label="`Share ${plan.name}`">
      <div class="share-modal-header">
        <h2>Share this plan</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <!-- A link that carries the whole plan: no account, nothing stored, and it never says whose it is unless you choose to -->
      <p class="ps-lead">
        <template v-if="current">Public: anyone with the link can view <b>{{ plan.name }}</b>.</template>
        <template v-else>Anyone with this link can see <b>{{ plan.name }}</b>. No account needed, and nothing about your account is in it.</template>
      </p>
      <div class="ps-link">
        <input type="text" readonly :value="shareUrl" aria-label="Plan link" @focus="$event.target.select()" />
        <button class="btn btn-primary" type="button" @click="copyLink">Copy link</button>
      </div>
      <div class="share-actions ps-socials">
        <a class="btn share-x" :href="xUrl" target="_blank" rel="noopener" @click="track('plan_share', { method: 'x' })"><ShareIcon name="x" />Post on X</a>
        <a class="btn btn-ghost" :href="redditUrl" target="_blank" rel="noopener" @click="track('plan_share', { method: 'reddit' })"><ShareIcon name="reddit" />Reddit</a>
        <button v-if="canNativeShare" class="btn btn-ghost" type="button" @click="nativeShare"><ShareIcon name="share" />More</button>
      </div>
      <label v-if="canName && !current" class="ps-toggle">
        <input v-model="withName" type="checkbox" />
        <span>Include my player name<small>Opens with {{ plan.player.rsn }}'s stats and live progress. Leave off to share just the plan.</small></span>
      </label>

      <!-- Optional: a short link with a preview picture, view counts and live progress. This one lives on your account. -->
      <details class="ps-more" :open="!!current || autoPublish">
        <summary>{{ current ? 'Short public link' : 'Want a short link with a preview image?' }}</summary>
        <template v-if="!loggedIn">
          <p class="ps-lead">A short public link needs a free account, so you can switch it off again whenever you like. You also get view counts.</p>
          <div class="share-actions">
            <RouterLink class="btn btn-primary" :to="{ name: 'login', query: { next: '/planner' } }">Log in</RouterLink>
            <RouterLink class="btn btn-ghost" :to="{ name: 'signup', query: { next: '/planner' } }">Create an account</RouterLink>
          </div>
        </template>
        <template v-else>
          <p v-if="!current && autoPublish && busy" class="ps-lead">Creating the public link…</p>
          <p v-else-if="current && autoPublish" class="ps-lead">It is not saved to your account.</p>

          <label v-if="canLive" class="ps-toggle">
            <input v-model="live" type="checkbox" :disabled="busy" @change="current && publish()" />
            <span>Show live progress<small>Also shows how far {{ plan.player.rsn }} has got, from their tracked XP.</small></span>
          </label>

          <p v-if="error" class="planner-error" role="alert">{{ error }}</p>

          <div v-if="!current" class="share-actions">
            <button class="btn btn-ghost share-wide" type="button" :disabled="busy" @click="publish">{{ busy ? 'Saving…' : 'Make a short public link' }}</button>
          </div>

          <template v-if="current">
            <details class="ps-preview">
              <summary>Preview</summary>
              <SharePreview :src="cardSrc" :alt="`Preview of ${plan.name}`" :filename="`${slugify(plan.name)}-plan.png`" loading-text="Drawing the preview…" @download="track('plan_share', { method: 'download' })" />
            </details>

            <div class="ps-stop">
              <template v-if="!confirmStop">
                <button class="btn-text" type="button" :disabled="busy" title="The public copy is a snapshot: press this after you change the plan" @click="publish">{{ busy ? 'Updating…' : 'Update public copy' }}</button>
                <button class="btn-text ps-off" type="button" @click="confirmStop = true">Stop sharing</button>
              </template>
              <template v-else>
                <span>The short link will stop working for everyone.</span>
                <button class="btn btn-ghost" type="button" :disabled="busy" @click="stopSharing">Yes, stop sharing</button>
                <button class="btn-text" type="button" @click="confirmStop = false">Keep it public</button>
              </template>
            </div>
          </template>
        </template>
      </details>
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
import { encodePlan } from '@/utils/planner'

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
const live = ref(current.value?.mode === 'live' && canLive.value)
const mode = computed(() => (live.value && canLive.value ? 'live' : 'static'))
const busy = ref(false)
const error = ref('')
const confirmStop = ref(false)

// The plan carried in the link itself. Only names the player when asked to.
const withName = ref(false)
const canName = computed(() => !!props.plan.player?.rsn)
const longUrl = computed(() => {
  const named = withName.value && canName.value
  const params = encodePlan({
    username: named ? props.plan.player.rsn : '',
    hoursPerDay: props.plan.hoursPerDay,
    goals: props.plan.goals,
    strategy: props.plan.globalStrategy,
    gpValue: props.plan.gpValue,
    budget: null,
    statsAt: named ? props.plan.statsAt : null,
  })
  if (!named) params.set('from', 'share')
  return `${window.location.origin}/planner?${params.toString()}`
})
const publicUrl = computed(() => (current.value ? sharedPlansApi.pageUrl(current.value.slug) : ''))
// Once there is a short public link, that is the one to hand out.
const shareUrl = computed(() => publicUrl.value || longUrl.value)
const url = shareUrl
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
  if (props.autoPublish && loggedIn.value && !current.value) publish()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
