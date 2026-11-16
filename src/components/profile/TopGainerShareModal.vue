<template>
  <div class="modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="modal-card share-modal-card rec-share-modal" role="dialog" aria-modal="true" aria-label="Share top gainer days">
      <div class="share-modal-header">
        <h2>Share this</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <SharePreview :src="imageUrl" :alt="text" :filename="`${username}-top-gainer.png`" loading-text="Drawing your card…" @download="sent('download')" />

      <p class="rec-share-text">{{ text }}</p>

      <div class="share-actions">
        <button class="btn btn-primary share-wide" type="button" @click="copyLink"><ShareIcon name="link" />Copy link</button>
        <a class="btn share-x" :href="xUrl" target="_blank" rel="noopener" @click="sent('x')"><ShareIcon name="x" />Post on X</a>
        <a class="btn btn-ghost" :href="redditUrl" target="_blank" rel="noopener" @click="sent('reddit')"><ShareIcon name="reddit" />Reddit</a>
        <button v-if="canCopyImage" class="btn btn-ghost" type="button" :disabled="copyingImage" @click="copyImage"><ShareIcon name="image" />{{ copyingImage ? 'Copying…' : 'Copy image' }}</button>
        <button v-if="canNativeShare" class="btn btn-ghost" type="button" @click="nativeShare"><ShareIcon name="share" />More…</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SharePreview from '@/components/SharePreview.vue'
import ShareIcon from '@/components/ShareIcon.vue'
import { topGainerApi } from '@/api/topGainer'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

const props = defineProps({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  stats: { type: Object, required: true },
})
const emit = defineEmits(['close'])
const { showToast } = useToast()

const copyingImage = ref(false)
// The number in the picture comes from the live count, so the link and the picture always agree.
const imageUrl = computed(() => `${topGainerApi.imageUrl(props.username)}?d=${props.stats.days}`)
const link = computed(() => topGainerApi.shareUrl(props.username))
const text = computed(() => `${props.displayName} has been the top gainer on TickGains for ${props.stats.days} ${props.stats.days === 1 ? 'day' : 'days'}. Think you can top it?`)
const xUrl = computed(() => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.value)}&url=${encodeURIComponent(link.value)}&hashtags=OSRS,OldSchoolRuneScape`)
const redditUrl = computed(() => `https://www.reddit.com/submit?url=${encodeURIComponent(link.value)}&title=${encodeURIComponent(text.value)}`)
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canCopyImage = typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof window !== 'undefined' && typeof window.ClipboardItem !== 'undefined'

const sent = (method) => track('top_gainer_share', { method, days: props.stats.days })

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
    // Dismissed by the user, nothing to do.
  }
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
