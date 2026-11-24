<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card share-modal-card route-share pace-share" role="dialog" aria-modal="true" aria-label="Share plan progress">
        <div class="share-modal-header">
          <h2>Share progress</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        </div>

        <!-- The picture is drawn here in the browser, so nothing is uploaded -->
        <button type="button" class="share-preview" :disabled="!blob" :title="blob ? 'Download image' : ''" :aria-label="blob ? 'Download image' : 'Drawing the picture'" @click="download">
          <span class="share-modal-preview">
            <span v-if="!blob && !failed" class="empty-hint">Drawing the picture…</span>
            <span v-else-if="failed" class="empty-hint">Could not draw the picture. Close this and try again.</span>
            <img v-if="previewUrl" :src="previewUrl" :alt="`${info.title}: ${info.pctText} complete`" />
          </span>
          <span v-if="blob" class="share-dl" aria-hidden="true">
            <ShareIcon name="download" :size="22" />
            <b>Download image</b>
          </span>
        </button>

        <div class="share-actions">
          <button class="btn btn-primary" type="button" :disabled="!blob" @click="download"><ShareIcon name="download" />Download image</button>
          <button v-if="canCopyImage" class="btn btn-ghost" type="button" :disabled="!blob" @click="copyImage"><ShareIcon name="image" />Copy image</button>
          <button class="btn btn-ghost" type="button" @click="copyLink"><ShareIcon name="link" />Copy link</button>
          <a class="btn share-x" :href="xUrl" target="_blank" rel="noopener" @click="track('pace_share', { method: 'x' })"><ShareIcon name="x" />Post on X</a>
          <a class="btn btn-ghost" :href="redditUrl" target="_blank" rel="noopener" @click="track('pace_share', { method: 'reddit' })"><ShareIcon name="reddit" />Reddit</a>
          <button v-if="canNativeShare" class="btn btn-ghost" type="button" :disabled="!blob" @click="nativeShare"><ShareIcon name="share" />More</button>
        </div>
        <p class="empty-hint share-modal-hint">Posts cannot carry the picture for you: download or copy it, then attach it. The link opens this plan, without your name.</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ShareIcon from '@/components/ShareIcon.vue'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'
import { drawPaceImage, paceFileName } from '@/utils/paceImage'
import { saveRouteImage } from '@/utils/routeImage'

// The sharing window for the plan's pace chart: the picture, and the ways to send it on. `info` is the heading and numbers of the picture
// (see PlannerProgress), `link` the address that opens this plan (no name in it).
const props = defineProps({ series: { type: Object, required: true }, info: { type: Object, required: true }, link: { type: String, default: '' } })
const emit = defineEmits(['close'])
const { showToast } = useToast()

const blob = ref(null)
const previewUrl = ref('')
const failed = ref(false)

const text = computed(() => `${props.info.title}: ${props.info.pctText} complete${props.info.finishText ? `, finishing ${props.info.finishText}` : ''}. My OSRS plan on TickGains`)
const shareLink = computed(() => props.link || `${window.location.origin}/planner`)
const xUrl = computed(() => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.value)}&url=${encodeURIComponent(shareLink.value)}&hashtags=OSRS,OldSchoolRuneScape`)
const redditUrl = computed(() => `https://www.reddit.com/submit?url=${encodeURIComponent(shareLink.value)}&title=${encodeURIComponent(text.value)}`)
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canCopyImage = typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined'
const fileName = computed(() => paceFileName(props.info.title))

async function download() {
  if (!blob.value) return
  track('pace_share', { method: 'download' })
  const result = await saveRouteImage(blob.value, fileName.value, { share: false })
  if (result === 'saved') showToast('Picture saved')
}
// Older route: select the picture on the page and run the browser's own copy command (needs no clipboard permission).
function copyBySelection() {
  const img = document.querySelector('.pace-share .share-modal-preview img')
  if (!img) return false
  const sel = window.getSelection()
  const before = sel.rangeCount ? sel.getRangeAt(0) : null
  try {
    const range = document.createRange()
    range.selectNode(img)
    sel.removeAllRanges()
    sel.addRange(range)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    sel.removeAllRanges()
    if (before) sel.addRange(before)
  }
}
async function copyImage() {
  track('pace_share', { method: 'copy_image' })
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(blob.value) })])
    showToast('Image copied')
  } catch {
    if (copyBySelection()) showToast('Copied. If pasting shows nothing, use Download image.', 4200)
    else showToast('Your browser blocked copying here. Use Download image instead.')
  }
}
async function copyLink() {
  track('pace_share', { method: 'copy_link' })
  try {
    await navigator.clipboard.writeText(shareLink.value)
    showToast('Link copied!')
  } catch {
    showToast('Could not copy the link.')
  }
}
async function nativeShare() {
  track('pace_share', { method: 'native' })
  const file = new File([blob.value], fileName.value, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: text.value, text: text.value, url: shareLink.value })
    else await navigator.share({ title: text.value, text: text.value, url: shareLink.value })
  } catch {
    /* dismissed */
  }
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  try {
    const b = await drawPaceImage({ series: props.series, ...props.info })
    blob.value = b
    previewUrl.value = URL.createObjectURL(b)
  } catch {
    failed.value = true
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>
