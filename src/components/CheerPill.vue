<template>
  <button class="cheer-pill" type="button" :class="{ done: cheered }" :disabled="cheered || busy || inert" :tabindex="inert ? -1 : 0" :title="cheered ? 'You congratulated them' : 'Congratulate'" @click.prevent.stop="cheer">
    {{ cheered ? 'Congratulated' : 'Congratulate' }}<span v-if="total" class="cheer-pill-count">{{ total.toLocaleString('en-US') }}</span>
  </button>
</template>

<script setup>
import { computed, ref } from 'vue'
import { playersApi } from '@/api/players'
import { track } from '@/utils/analytics'

// A small "Congratulate" pill for a 99 or 200M event in a feed. Same one-click-per-milestone rule as the profile page.
const props = defineProps({
  playerId: { type: Number, required: true },
  skill: { type: String, default: '' },
  type: { type: String, required: true },
  value: { type: Number, required: true },
  count: { type: Number, default: 0 },
  inert: { type: Boolean, default: false },
})

const CHEERED_KEY = 'tickgains-congrats-cheered'
const key = `${props.playerId}:${props.type}:${props.skill}:${props.value}`
const read = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHEERED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
const cheered = ref(read().has(key))
const extra = ref(0)
const busy = ref(false)
const total = computed(() => props.count + extra.value)

async function cheer() {
  if (props.inert) return
  busy.value = true
  try {
    const res = await playersApi.cheer(props.playerId, { type: props.type, skill: props.skill, value: props.value })
    extra.value = Math.max(res.cheers - props.count, 0)
    cheered.value = true
    const set = read()
    set.add(key)
    try {
      localStorage.setItem(CHEERED_KEY, JSON.stringify([...set].slice(-200)))
    } catch {
      /* storage unavailable */
    }
    track('congratulate', { skill: props.skill || 'xp', source: 'feed' })
  } catch {
    /* rate limited or expired: leave the pill as it was */
  } finally {
    busy.value = false
  }
}
</script>
