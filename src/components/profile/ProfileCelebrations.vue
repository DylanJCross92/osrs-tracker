<template>
  <div v-if="visible.length" class="congrats" role="status">
    <div v-for="c in visible" :key="c.key" class="congrats-row">
      <button v-if="is99(c)" class="congrats-medal" :data-medal-skill="c.skill" type="button" :title="`Watch the ${c.skill} 99 celebration`" :aria-label="`Watch the ${c.skill} 99 celebration`" @click="playing = c">
        <img :src="skillIconSrc(c.skill)" alt="" width="16" height="16" />
        <span aria-hidden="true" />
      </button>
      <img v-else-if="c.skill" :src="skillIconSrc(c.skill)" :alt="c.skill" width="22" height="22" />
      <span class="congrats-text">
        <b>{{ name }}</b> reached <b class="congrats-gold">{{ c.title }}</b> <span class="congrats-time">{{ formatRelative(c.occurredAt) }} ago</span>
      </span>
      <span class="congrats-actions">
        <button class="congrats-btn" type="button" :class="{ done: c.cheered }" :disabled="c.cheered || c.busy" @click="cheer(c)">
          {{ c.cheered ? 'Congratulated' : 'Congratulate' }}<span v-if="c.cheers" class="congrats-count">{{ c.cheers.toLocaleString('en-US') }}</span>
        </button>
        <button v-if="c.skill" class="btn-text congrats-share" type="button" @click="is99(c) ? $emit('share99', c.skill) : $emit('share', c.skill)">Share</button>
        <button class="btn-text congrats-dismiss" type="button" aria-label="Hide this" @click="dismiss(c)">✕</button>
      </span>
    </div>
    <Level99Modal v-if="playing" :skill="playing.skill" @close="playing = null" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { playersApi } from '@/api/players'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { track } from '@/utils/analytics'
import Level99Modal from '@/components/profile/Level99Modal.vue'

const props = defineProps({
  playerId: { type: Number, required: true },
  name: { type: String, required: true },
  celebrations: { type: Array, default: () => [] },
  // The owner of this profile sees a fresh 99 play once by itself; everyone else can click the medal to watch it.
  autoPlay: { type: Boolean, default: false },
})
defineEmits(['share', 'share99'])

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

const is99 = (c) => c.type === 'skill_level' && c.value === 99 && !!c.skill
const playing = ref(null)
const PLAYED_KEY = 'tickgains-congrats-played'
const played = readSet(PLAYED_KEY)
// Development: ?fake99 plays every time the page opens, so it can be watched again.
const forced = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('fake99')
let forcedDone = false
watch(
  [visible, () => props.autoPlay],
  ([list, auto]) => {
    if (!auto || playing.value) return
    const fresh = list.find((c) => is99(c) && (forced ? !forcedDone : !played.has(c.key)))
    if (!fresh) return
    forcedDone = true
    played.add(fresh.key)
    writeSet(PLAYED_KEY, played)
    playing.value = fresh
    track('level_99_celebration', { skill: fresh.skill })
  },
  { immediate: true },
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
