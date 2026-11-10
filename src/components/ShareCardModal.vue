<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card">
      <div class="share-modal-header">
        <h2>Share progress card</h2>
        <button class="btn-text" @click="$emit('close')">✕</button>
      </div>

      <div class="share-modal-controls">
      <div class="share-modal-period" role="group" aria-label="Timeframe">
        <button v-for="p in PERIODS" :key="p.key" :class="{ active: period === p.key }" @click="period = p.key">{{ p.label }}</button>
      </div>

      <label class="period-select share-modal-skill">
        <span class="period-select-label">Skill</span>
        <select v-model="skill">
          <option value="Overall">Overall</option>
          <option v-for="name in SKILL_NAMES" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      </div>

      <SharePreview :src="previewUrl" :alt="`${username}'s ${period}ly card`" :filename="`${username}-${skill}-${period}.png`" loading-text="Loading preview…" @download="track('share_card', { method: 'download', period, skill })" />

      <div class="share-actions is-pair">
        <button class="btn btn-primary" type="button" :disabled="copyingLive" @click="copyLiveLink"><ShareIcon name="live" />{{ copyingLive ? 'Copying…' : 'Copy live link' }}</button>
        <button class="btn btn-ghost" type="button" :disabled="freezing" @click="copySnapshotLink"><ShareIcon name="snapshot" />{{ freezing ? 'Creating…' : 'Copy snapshot link' }}</button>
      </div>
      <p class="empty-hint share-modal-hint">
        <strong>Live link</strong> always reflects {{ periodPhrase }}. <strong>Snapshot link</strong> freezes today's numbers
        permanently, so the link never changes.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SharePreview from '@/components/SharePreview.vue'
import ShareIcon from '@/components/ShareIcon.vue'
import { cardsApi } from '@/api/cards'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'
import { SKILL_NAMES } from '@/utils/osrsSkills'

const props = defineProps({
  username: { type: String, required: true },
  initialSkill: { type: String, default: 'Overall' },
})
defineEmits(['close'])

const { showToast } = useToast()

const PERIODS = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
]
const period = ref('week')
const skill = ref(props.initialSkill || 'Overall')
const copyingLive = ref(false)
const freezing = ref(false)

const periodPhrase = computed(() => ({ day: 'today so far', week: 'the last 7 days', month: 'the last 30 days' })[period.value])
const previewUrl = computed(() => cardsApi.weeklyImageUrl(props.username, skill.value, period.value))

async function copyToClipboard(url) {
  try {
    await navigator.clipboard.writeText(url)
    showToast('Link copied!')
  } catch {
    showToast('Could not copy the link.')
  }
}

function copyLiveLink() {
  track('share_card', { method: 'live', period: period.value, skill: skill.value })
  copyingLive.value = true
  const path = `/player/${encodeURIComponent(props.username)}/card/weekly${cardsApi.cardQuery(skill.value, period.value)}`
  copyToClipboard(`${window.location.origin}${path}`).finally(() => (copyingLive.value = false))
}

async function copySnapshotLink() {
  track('share_card', { method: 'snapshot', period: period.value, skill: skill.value })
  freezing.value = true
  try {
    const frozen = await cardsApi.freezeWeekly(props.username, skill.value, period.value)
    await copyToClipboard(`${window.location.origin}/player/${encodeURIComponent(props.username)}/card/weekly/${frozen.slug}`)
  } catch {
    showToast('Could not create a share link right now.')
  } finally {
    freezing.value = false
  }
}
</script>
