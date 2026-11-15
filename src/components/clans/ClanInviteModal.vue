<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card rec-share-modal" role="dialog" aria-modal="true" :aria-label="`Invite people to ${clan.name}`">
      <div class="share-modal-header">
        <h2>Invite people</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <SharePreview :src="imageUrl" :alt="`Invite to ${clan.name}`" :filename="`${clan.slug}-invite.png`" loading-text="Drawing the invite…" @download="sent('download')" />

      <p class="rec-share-text">{{ text }}</p>

      <div class="share-actions">
        <button class="btn btn-primary share-wide" type="button" @click="copyLink"><ShareIcon name="link" />Copy invite link</button>
        <a class="btn share-x" :href="xUrl" target="_blank" rel="noopener" @click="sent('x')"><ShareIcon name="x" />Post on X</a>
        <a class="btn btn-ghost" :href="redditUrl" target="_blank" rel="noopener" @click="sent('reddit')"><ShareIcon name="reddit" />Reddit</a>
        <button v-if="canCopyImage" class="btn btn-ghost" type="button" :disabled="copyingImage" @click="copyImage"><ShareIcon name="image" />{{ copyingImage ? 'Copying…' : 'Copy image' }}</button>
        <button v-if="canNativeShare" class="btn btn-ghost" type="button" @click="nativeShare"><ShareIcon name="share" />More…</button>
      </div>
      <p class="empty-hint share-modal-hint">Anyone with the link can join with their RuneScape name, no account needed. Pasted into Discord, X or Reddit, the link shows this card with who is in the clan and the competition that is on. If you make a new link, the old one stops working.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SharePreview from '@/components/SharePreview.vue'
import ShareIcon from '@/components/ShareIcon.vue'
import { clansApi } from '@/api/clans'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

const props = defineProps({
  clan: { type: Object, required: true },
  token: { type: String, required: true },
})
const emit = defineEmits(['close'])
const { showToast } = useToast()

const copyingImage = ref(false)
const imageUrl = computed(() => clansApi.inviteImageUrl(props.token))
const link = computed(() => clansApi.inviteUrl(props.token))
const text = computed(() => `Join ${props.clan.name} on TickGains and take part in our XP competitions.`)
const xUrl = computed(() => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.value)}&url=${encodeURIComponent(link.value)}&hashtags=OSRS,OldSchoolRuneScape`)
const redditUrl = computed(() => `https://www.reddit.com/submit?url=${encodeURIComponent(link.value)}&title=${encodeURIComponent(text.value)}`)
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canCopyImage = typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof window !== 'undefined' && typeof window.ClipboardItem !== 'undefined'

const sent = (method) => track('clan_share', { method })

async function copyLink() {
  sent('copy_link')
  try {
    await navigator.clipboard.writeText(link.value)
    showToast('Invite link copied!')
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
