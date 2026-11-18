<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card share-modal-card route-share" role="dialog" aria-modal="true" :aria-label="`Share ${skill} route`">
        <div class="share-modal-header">
          <h2>Share route</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        </div>

        <!-- The picture is drawn here in the browser, so nothing is uploaded -->
        <button type="button" class="share-preview" :disabled="!blob" :title="blob ? 'Download image' : ''" :aria-label="blob ? 'Download image' : 'Drawing the picture'" @click="download">
          <span class="share-modal-preview">
            <span v-if="!blob && !failed" class="empty-hint">Drawing the picture…</span>
            <span v-else-if="failed" class="empty-hint">Could not draw the picture. Close this and try again.</span>
            <img v-if="previewUrl" :src="previewUrl" :alt="`${skill} route from level ${levels.from} to ${levels.to}`" />
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
          <a class="btn share-x" :href="xUrl" target="_blank" rel="noopener" @click="track('route_share', { method: 'x', skill })"><ShareIcon name="x" />Post on X</a>
          <a class="btn btn-ghost" :href="redditUrl" target="_blank" rel="noopener" @click="track('route_share', { method: 'reddit', skill })"><ShareIcon name="reddit" />Reddit</a>
          <button v-if="canNativeShare" class="btn btn-ghost" type="button" :disabled="!blob" @click="nativeShare"><ShareIcon name="share" />More</button>
        </div>
        <p class="empty-hint share-modal-hint">Posts cannot carry the picture for you: download or copy it, then attach it. The link opens the {{ skill }} calculator.</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ShareIcon from '@/components/ShareIcon.vue'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'
import { drawRouteImage, imageFileName, routeLevels, routeSubtitle, saveRouteImage } from '@/utils/routeImage'

const props = defineProps({
  skill: { type: String, required: true },
  startLevel: { type: Number, required: true },
  endLevel: { type: Number, required: true },
  segments: { type: Array, required: true },
  hours: { type: Number, default: null },
  netGp: { type: Number, default: null },
  // The line under the picture's title, e.g. "Fastest route" or "Using Lava runes".
  label: { type: String, default: 'Fastest route' },
  // The address to share with the picture. Defaults to this skill's calculator.
  url: { type: String, default: '' },
})
const emit = defineEmits(['close'])
const { showToast } = useToast()

// What the route really covers and is made of, so the picture always matches the steps in it.
const levels = computed(() => routeLevels(props.segments, props.startLevel, props.endLevel))
const subtitle = computed(() => routeSubtitle(props.segments, props.label))

const blob = ref(null)
const previewUrl = ref('')
const failed = ref(false)

const link = computed(() => {
  const base = props.url || `${window.location.origin}/calculators/${props.skill.toLowerCase()}`
  try {
    const u = new URL(base, window.location.origin)
    u.searchParams.set('from', 'share')
    return u.toString()
  } catch {
    return base
  }
})
const text = computed(() => `My ${props.skill} route from ${levels.value.from} to ${levels.value.to} on TickGains`)
const xUrl = computed(() => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.value)}&url=${encodeURIComponent(link.value)}&hashtags=OSRS,OldSchoolRuneScape`)
const redditUrl = computed(() => `https://www.reddit.com/submit?url=${encodeURIComponent(link.value)}&title=${encodeURIComponent(text.value)}`)
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canCopyImage = typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined'
const fileName = computed(() => imageFileName(props.skill, levels.value.from, levels.value.to))

async function download() {
  if (!blob.value) return
  track('route_share', { method: 'download', skill: props.skill })
  const result = await saveRouteImage(blob.value, fileName.value, { share: false })
  if (result === 'saved') showToast('Picture saved')
}
// Older route: select the picture on the page and run the browser's own copy command. It needs no clipboard permission,
// so it can still work where navigator.clipboard.write is refused.
function copyBySelection() {
  const img = document.querySelector('.route-share .share-modal-preview img')
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
  track('route_share', { method: 'copy_image', skill: props.skill })
  try {
    // The picture goes in as a promise, which is what Safari needs to allow the copy.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(blob.value) })])
    showToast('Image copied')
  } catch {
    // This route cannot confirm what landed on the clipboard, so say so and point at the sure thing.
    if (copyBySelection()) showToast('Copied. If pasting shows nothing, use Download image.', 4200)
    else showToast('Your browser blocked copying here. Use Download image instead.')
  }
}
async function copyLink() {
  track('route_share', { method: 'copy_link', skill: props.skill })
  try {
    await navigator.clipboard.writeText(link.value)
    showToast('Link copied!')
  } catch {
    showToast('Could not copy the link.')
  }
}
async function nativeShare() {
  track('route_share', { method: 'native', skill: props.skill })
  const file = new File([blob.value], fileName.value, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: text.value, text: text.value, url: link.value })
    else await navigator.share({ title: text.value, text: text.value, url: link.value })
  } catch {
    /* dismissed */
  }
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  try {
    const b = await drawRouteImage({
      skill: props.skill,
      startLevel: levels.value.from,
      endLevel: levels.value.to,
      segments: props.segments,
      totalHours: props.hours,
      totalGp: props.netGp,
      strategy: subtitle.value,
    })
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
