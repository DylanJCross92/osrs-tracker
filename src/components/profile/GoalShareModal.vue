<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card rec-share-modal" role="dialog" aria-modal="true" :aria-label="`Share ${goal.title}`">
      <div class="share-modal-header">
        <h2>Share this goal</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <SharePreview :src="imageUrl" :alt="`${displayName}'s goal: ${goal.title}`" :filename="`${username}-goal-${goal.id}.png`" loading-text="Drawing your goal card…" @download="sent('download')" />

      <p class="rec-share-text">{{ text }}</p>

      <div class="share-actions">
        <button class="btn btn-primary share-wide" type="button" @click="copyLink"><ShareIcon name="link" />Copy link</button>
        <a class="btn share-x" :href="xUrl" target="_blank" rel="noopener" @click="sent('x')"><ShareIcon name="x" />Post on X</a>
        <a class="btn btn-ghost" :href="redditUrl" target="_blank" rel="noopener" @click="sent('reddit')"><ShareIcon name="reddit" />Reddit</a>
        <button v-if="canCopyImage" class="btn btn-ghost" type="button" :disabled="copyingImage" @click="copyImage"><ShareIcon name="image" />{{ copyingImage ? 'Copying…' : 'Copy image' }}</button>
        <button v-if="canNativeShare" class="btn btn-ghost" type="button" @click="nativeShare"><ShareIcon name="share" />More…</button>
      </div>
      <p class="empty-hint share-modal-hint">The link shows this card in Discord, X and Reddit, and the bar moves as you train.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SharePreview from '@/components/SharePreview.vue'
import ShareIcon from '@/components/ShareIcon.vue'
import { goalsApi } from '@/api/goals'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

const props = defineProps({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  goal: { type: Object, required: true },
})
const emit = defineEmits(['close'])
const { showToast } = useToast()
const copyingImage = ref(false)

const imageUrl = computed(() => goalsApi.imageUrl(props.username, props.goal.id))
const link = computed(() => goalsApi.shareUrl(props.username, props.goal.id))
const text = computed(() => (props.goal.reached ? `I reached my OSRS goal: ${props.goal.title}!` : `I'm ${props.goal.percent}% of the way to ${props.goal.title} in OSRS. Follow my progress.`))
const xUrl = computed(() => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.value)}&url=${encodeURIComponent(link.value)}&hashtags=OSRS,OldSchoolRuneScape`)
const redditUrl = computed(() => `https://www.reddit.com/submit?url=${encodeURIComponent(link.value)}&title=${encodeURIComponent(text.value)}`)
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canCopyImage = typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof window !== 'undefined' && typeof window.ClipboardItem !== 'undefined'
const sent = (method) => track('goal_share', { method })

async function copyLink() {
  sent('copy_link')
  try {
    await navigator.clipboard.writeText(link.value)
    showToast('Link copied!')
  } catch {
    showToast('Could not copy the link.')
  }
}
async function copyImage() {
  sent('copy_image')
  copyingImage.value = true
  try {
    const blob = await fetch(imageUrl.value).then((r) => r.blob())
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
    showToast('Image copied! Paste it anywhere.')
  } catch {
    showToast('Could not copy the image. Use the download button on the card instead.')
  } finally {
    copyingImage.value = false
  }
}
async function nativeShare() {
  sent('native')
  try {
    await navigator.share({ title: text.value, text: text.value, url: link.value })
  } catch {
    // Dismissed.
  }
}
const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
