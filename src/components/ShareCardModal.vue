<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card">
      <div class="share-modal-header">
        <h2>Share weekly card</h2>
        <button class="btn-text" @click="$emit('close')">✕</button>
      </div>

      <label class="period-select share-modal-skill">
        <span class="period-select-label">Skill</span>
        <select v-model="skill">
          <option value="Overall">Overall</option>
          <option v-for="name in SKILL_NAMES" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>

      <div class="share-modal-preview">
        <p v-if="imageLoading" class="empty-hint">Loading preview…</p>
        <img
          v-show="!imageLoading"
          :src="previewUrl"
          :alt="`${username}'s weekly card`"
          @load="imageLoading = false"
          @error="imageLoading = false"
        />
      </div>

      <div class="share-modal-actions">
        <button class="btn btn-primary" :disabled="copyingLive" @click="copyLiveLink">
          {{ copyingLive ? 'Copying…' : 'Live' }}
        </button>
        <button class="btn btn-ghost" :disabled="freezing" @click="copySnapshotLink">
          {{ freezing ? 'Creating…' : 'Current snapshot' }}
        </button>
        <a class="btn btn-ghost" :href="previewUrl" target="_blank" rel="noopener">
          Download Image
        </a>
      </div>
      <p class="empty-hint share-modal-hint">
        <strong>Live</strong> always reflects the last 7 days. <strong>Current snapshot</strong> freezes today's numbers
        permanently, so the link never changes.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { cardsApi } from '@/api/cards'
import { useToast } from '@/composables/useToast'
import { SKILL_NAMES } from '@/utils/osrsSkills'

const props = defineProps({
  username: { type: String, required: true },
})
defineEmits(['close'])

const { showToast } = useToast()

const skill = ref('Overall')
const imageLoading = ref(true)
const copyingLive = ref(false)
const freezing = ref(false)

const previewUrl = computed(() => cardsApi.weeklyImageUrl(props.username, skill.value))

watch(skill, () => {
  imageLoading.value = true
})

async function copyToClipboard(url) {
  try {
    await navigator.clipboard.writeText(url)
    showToast('Link copied!')
  } catch {
    showToast('Could not copy the link.')
  }
}

function copyLiveLink() {
  copyingLive.value = true
  const path = `/player/${encodeURIComponent(props.username)}/card/weekly${skill.value !== 'Overall' ? `?skill=${encodeURIComponent(skill.value)}` : ''}`
  copyToClipboard(`${window.location.origin}${path}`).finally(() => (copyingLive.value = false))
}

async function copySnapshotLink() {
  freezing.value = true
  try {
    const frozen = await cardsApi.freezeWeekly(props.username, skill.value)
    await copyToClipboard(`${window.location.origin}/player/${encodeURIComponent(props.username)}/card/weekly/${frozen.slug}`)
  } catch {
    showToast('Could not create a share link right now.')
  } finally {
    freezing.value = false
  }
}
</script>
