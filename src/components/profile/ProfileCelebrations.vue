<template>
  <div v-if="visible.length" class="congrats" role="status">
    <div v-for="c in visible" :key="c.key" class="congrats-row">
      <img v-if="c.skill" :src="skillIconSrc(c.skill)" :alt="c.skill" width="22" height="22" />
      <span class="congrats-text">
        <b>{{ name }}</b> reached <b class="congrats-gold">{{ c.title }}</b> <span class="congrats-time">{{ formatRelative(c.occurredAt) }} ago</span>
      </span>
      <span class="congrats-actions">
        <button class="congrats-btn" type="button" :class="{ done: c.cheered }" :disabled="c.cheered || c.busy" @click="cheer(c)">
          {{ c.cheered ? 'Congratulated' : 'Congratulate' }}<span v-if="c.cheers" class="congrats-count">{{ c.cheers.toLocaleString('en-US') }}</span>
        </button>
        <button v-if="c.skill" class="btn-text congrats-share" type="button" @click="$emit('share', c.skill)">Share</button>
        <button class="btn-text congrats-dismiss" type="button" aria-label="Hide this" @click="dismiss(c)">✕</button>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { playersApi } from '@/api/players'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { track } from '@/utils/analytics'

const props = defineProps({
  playerId: { type: Number, required: true },
  name: { type: String, required: true },
  celebrations: { type: Array, default: () => [] },
})
defineEmits(['share'])

// A fresh 99 shows for 72 hours (the stats-table badge lasts the full week). Hiding one is remembered in this browser.
const SHOW_MS = 72 * 3_600_000
const DISMISS_KEY = 'tickgains-congrats-dismissed'
const CHEERED_KEY = 'tickgains-congrats-cheered'
const readSet = (key) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return new Set()
  }
}
const writeSet = (key, set) => {
  try {
    localStorage.setItem(key, JSON.stringify([...set].slice(-200)))
  } catch {
    /* storage unavailable */
  }
}

const dismissed = ref(readSet(DISMISS_KEY))
const cheeredLocal = ref(readSet(CHEERED_KEY))
const rows = ref([])
const keyOf = (c) => `${props.playerId}:${c.type}:${c.skill}:${c.value}`

watch(
  () => props.celebrations,
  (list) => {
    rows.value = list.map((c) => ({ ...c, key: keyOf(c), cheered: c.cheered || cheeredLocal.value.has(keyOf(c)), busy: false }))
  },
  { immediate: true },
)

const visible = computed(() =>
  rows.value
    .filter((c) => !dismissed.value.has(c.key) && Date.now() - new Date(c.occurredAt).getTime() < SHOW_MS)
    .slice(0, 3),
)

async function cheer(c) {
  c.busy = true
  try {
    const res = await playersApi.cheer(props.playerId, { type: c.type, skill: c.skill, value: c.value })
    c.cheers = res.cheers
    c.cheered = true
    cheeredLocal.value = new Set([...cheeredLocal.value, c.key])
    writeSet(CHEERED_KEY, cheeredLocal.value)
    track('congratulate', { skill: c.skill || 'xp' })
  } catch {
    /* rate limited or expired: leave the button as it was */
  } finally {
    c.busy = false
  }
}

function dismiss(c) {
  dismissed.value = new Set([...dismissed.value, c.key])
  writeSet(DISMISS_KEY, dismissed.value)
}
</script>
