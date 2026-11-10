<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card rec-share-modal" role="dialog" aria-modal="true" :aria-label="`Challenge a friend as ${displayName}`">
      <div class="share-modal-header">
        <h2>Challenge a friend</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <SharePreview :src="imageUrl" :alt="`${displayName} challenges you to beat their week`" :filename="`${username}-challenge.png`" loading-text="Drawing your challenge card…" @download="sent('download')" />

      <p class="rec-share-text">{{ text }}</p>

      <div class="share-actions">
        <button class="btn btn-primary share-wide" type="button" @click="copyLink"><ShareIcon name="link" />Copy link</button>
        <a class="btn share-x" :href="xUrl" target="_blank" rel="noopener" @click="sent('x')"><ShareIcon name="x" />Post on X</a>
        <a class="btn btn-ghost" :href="redditUrl" target="_blank" rel="noopener" @click="sent('reddit')"><ShareIcon name="reddit" />Reddit</a>
        <button class="btn btn-ghost" type="button" @click="copyMessage"><ShareIcon name="message" />Copy message</button>
        <button v-if="canCopyImage" class="btn btn-ghost" type="button" :disabled="copyingImage" @click="copyImage"><ShareIcon name="image" />{{ copyingImage ? 'Copying…' : 'Copy image' }}</button>
        <button v-if="canNativeShare" class="btn btn-ghost" type="button" @click="nativeShare"><ShareIcon name="share" />More…</button>
      </div>
      <p class="empty-hint share-modal-hint">Paste the link into Discord, a clan chat or a text. It shows this card, and your friend sees the two of you side by side after typing their RSN. No sign-up. The numbers update as you play.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SharePreview from '@/components/SharePreview.vue'
import ShareIcon from '@/components/ShareIcon.vue'
import { useToast } from '@/composables/useToast'
import { challengeImageUrl, challengeText, challengeUrl } from '@/utils/challenge'
import { track } from '@/utils/analytics'

const props = defineProps({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  // XP gained in the last 7 days, for the message. 0 when unknown.
  weekXp: { type: Number, default: 0 },
  source: { type: String, default: 'profile' },
})
const emit = defineEmits(['close'])
const { showToast } = useToast()

const copyingImage = ref(false)

const imageUrl = computed(() => challengeImageUrl(props.username))
const link = computed(() => challengeUrl(props.username))
const text = computed(() => challengeText(props.displayName, props.weekXp))
const xUrl = computed(() => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.value)}&url=${encodeURIComponent(link.value)}&hashtags=OSRS,OldSchoolRuneScape`)
const redditUrl = computed(() => `https://www.reddit.com/submit?url=${encodeURIComponent(link.value)}&title=${encodeURIComponent(text.value)}`)
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canCopyImage = typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof window !== 'undefined' && typeof window.ClipboardItem !== 'undefined'

const sent = (method) => track('challenge_share', { method, source: props.source })

async function copy(value, done) {
  try {
    await navigator.clipboard.writeText(value)
    showToast(done)
  } catch {
    showToast('Could not copy, select the text and copy it by hand.')
  }
}
function copyLink() {
  sent('copy_link')
  return copy(link.value, 'Challenge link copied! Send it to a friend.')
}
function copyMessage() {
  sent('copy_message')
  return copy(`${text.value} ${link.value}`, 'Message copied!')
}

async function copyImage() {
  sent('copy_image')
  copyingImage.value = true
  try {
    const blob = await fetch(imageUrl.value).then((r) => r.blob())
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
    showToast('Image copied! Paste it anywhere.')
  } catch {
    showToast('Could not copy the image.')
  } finally {
    copyingImage.value = false
  }
}

async function nativeShare() {
  sent('native')
  try {
    await navigator.share({ title: `${props.displayName} challenges you`, text: text.value, url: link.value })
  } catch {
    // Dismissed by the user, nothing to do.
  }
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  track('challenge_open', { source: props.source })
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
