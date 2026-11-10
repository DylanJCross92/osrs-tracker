<template>
  <button type="button" class="share-preview" :disabled="loading || busy" :title="loading ? '' : 'Download image'" :aria-label="loading ? loadingText : 'Download image'" @click="download">
    <span class="share-modal-preview">
      <span v-if="loading" class="empty-hint">{{ loadingText }}</span>
      <img v-show="!loading" :src="src" :alt="alt" @load="loading = false" @error="loading = false" />
    </span>
    <span v-if="!loading" class="share-dl" aria-hidden="true">
      <ShareIcon name="download" :size="22" />
      <b>{{ busy ? 'Saving…' : 'Download image' }}</b>
    </span>
  </button>
</template>

<script setup>
import { ref, watch } from 'vue'
import ShareIcon from '@/components/ShareIcon.vue'

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
  filename: { type: String, default: 'tickgains-card.png' },
  loadingText: { type: String, default: 'Drawing your card…' },
})
const emit = defineEmits(['download'])

const loading = ref(true)
const busy = ref(false)
watch(() => props.src, () => (loading.value = true))

// The image comes from the API, possibly another origin in development, so the download attribute alone would be
// ignored. Fetch the bytes and save them; if that fails, open the image so it can be saved by hand.
async function download() {
  emit('download')
  busy.value = true
  try {
    const blob = await fetch(props.src).then((r) => {
      if (!r.ok) throw new Error('bad response')
      return r.blob()
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = props.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    window.open(props.src, '_blank', 'noopener')
  } finally {
    busy.value = false
  }
}
</script>
