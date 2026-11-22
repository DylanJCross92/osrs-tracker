<template>
  <div v-if="visible.length" class="congrats" role="status">
    <div v-for="c in visible" :key="c.key" class="congrats-row">
      <button v-if="is99(c)" class="congrats-medal" :data-medal-skill="c.skill" type="button" :title="`Watch the ${c.skill} 99 celebration`" :aria-label="`Watch the ${c.skill} 99 celebration`" @click="playing = [c]">
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
    <Level99Modal v-if="playing" :key="playing.map((c) => c.key).join()" :skills="playing.map((c) => c.skill)" :show-ms="playing.length > 1 ? 4600 : 4000" @close="playing = null" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { playersApi } from '@/api/players'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { track } from '@/utils/analytics'
import { authReady, useAuth } from '@/composables/useAuth'
import Level99Modal from '@/components/profile/Level99Modal.vue'

const props = defineProps({
  playerId: { type: Number, required: true },
  name: { type: String, required: true },
  celebrations: { type: Array, default: () => [] },
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
// Anyone who opens the profile of a player with a recent 99 sees it play once. A signed-in account is remembered on the server (so it
// never plays for them again, on any device); a signed-out visitor is remembered only for this tab's session.
const SESSION_KEY = 'tickgains-congrats-played'
const sessionSeen = (() => {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]'))
  } catch {
    return new Set()
  }
})()
const rememberInSession = (key) => {
  sessionSeen.add(key)
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...sessionSeen].slice(-100)))
  } catch {
    /* storage unavailable */
  }
}
const { loggedIn } = useAuth()
const authKnown = ref(false)
authReady().finally(() => (authKnown.value = true))
// Development: ?fake99 plays every time the page opens, so it can be watched again.
const forced = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('fake99')
let forcedDone = false
// Every new 99 plays together, side by side (the newest first, three at most), and each badge flies into its own row's medal.
const unseen = (c) => is99(c) && (forced ? !forcedDone : loggedIn.value ? !c.seen : !sessionSeen.has(c.key))
watch(
  [visible, authKnown],
  ([list, known]) => {
    // Wait until it is known whether someone is signed in, so the right kind of "seen" is used.
    if (!known || playing.value) return
    const fresh = list.filter(unseen).slice(0, 3)
    if (!fresh.length) return
    forcedDone = true
    if (!forced) {
      for (const c of fresh) {
        if (loggedIn.value) {
          c.seen = true
          playersApi.celebrationSeen(props.playerId, { type: c.type, skill: c.skill, value: c.value }).catch(() => {})
        } else rememberInSession(c.key)
      }
    }
    playing.value = fresh
    track('level_99_celebration', { skill: fresh[0].skill, count: fresh.length })
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
