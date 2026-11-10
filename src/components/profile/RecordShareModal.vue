<template>
  <div class="modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="modal-card share-modal-card rec-share-modal" role="dialog" aria-modal="true" :aria-label="`Share ${record.title}`">
      <div class="share-modal-header">
        <h2>Share this record</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <div class="share-modal-preview">
        <p v-if="imageLoading" class="empty-hint">Drawing your record card…</p>
        <img v-show="!imageLoading" :src="imageUrl" :alt="`${displayName}'s record: ${record.headline}`" @load="imageLoading = false" @error="imageLoading = false" />
      </div>

      <p class="rec-share-text">{{ text }}</p>

      <div class="rec-share-actions">
        <a class="btn rec-share-x" :href="xUrl" target="_blank" rel="noopener" @click="sent('x')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.2 4.7H5.4l11.3 14.5z" /></svg>
          Post on X
        </a>
        <a class="btn btn-ghost" :href="redditUrl" target="_blank" rel="noopener" @click="sent('reddit')">Reddit</a>
        <button v-if="canNativeShare" class="btn btn-ghost" type="button" @click="nativeShare">Share…</button>
        <button class="btn btn-ghost" type="button" @click="copyLink">Copy link</button>
        <button v-if="canCopyImage" class="btn btn-ghost" type="button" :disabled="copyingImage" @click="copyImage">{{ copyingImage ? 'Copying…' : 'Copy image' }}</button>
        <a class="btn btn-ghost" :href="imageUrl" :download="`${username}-${record.key}.png`" @click="sent('download')">Download image</a>
      </div>
      <p class="empty-hint share-modal-hint">The link shows this card when you paste it into Discord, X or Reddit. If someone beats the record, the card updates.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { recordsApi } from '@/api/records'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

const props = defineProps({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  record: { type: Object, required: true },
})
const emit = defineEmits(['close'])
const { showToast } = useToast()

const imageLoading = ref(true)
const copyingImage = ref(false)

const imageUrl = computed(() => recordsApi.imageUrl(props.username, props.record.key))
const link = computed(() => recordsApi.shareUrl(props.username, props.record.key))
const text = computed(() => `${props.displayName}'s record: ${props.record.headline}. Think you can beat it?`)
const xUrl = computed(() => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.value)}&url=${encodeURIComponent(link.value)}&hashtags=OSRS,OldSchoolRuneScape`)
const redditUrl = computed(() => `https://www.reddit.com/submit?url=${encodeURIComponent(link.value)}&title=${encodeURIComponent(text.value)}`)
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canCopyImage = typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof window !== 'undefined' && typeof window.ClipboardItem !== 'undefined'

const sent = (method) => track('record_share', { method, record: props.record.key })

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
    showToast('Could not copy the image. Try Download image instead.')
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
