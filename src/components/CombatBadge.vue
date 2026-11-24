<template>
  <span v-if="level" class="cb" :class="[`is-${size}`, tier]" :title="title" role="img" :aria-label="title">
    <svg class="cb-ico" viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
      <path d="M12 2l8 3v6.5c0 4.8-3.2 8.7-8 10.5-4.8-1.8-8-5.7-8-10.5V5l8-3z" />
    </svg>
    <b>{{ level }}</b>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { combatLevel, MAX_COMBAT_LEVEL } from '@/utils/combat'

// A player's combat level as a small badge that hangs off the bottom of their picture. Put it inside a positioned wrapper next to the avatar frame (the
// frame itself clips, so the badge cannot live inside it). `skills` is the hiscores snapshot: { Attack: { level }, ... }.
const props = defineProps({ skills: { type: Object, default: null }, size: { type: String, default: 'md' } })

const level = computed(() => {
  const s = props.skills
  if (!s || typeof s !== 'object') return 0
  const levels = {}
  for (const name of ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Prayer', 'Magic']) {
    const n = Number(s[name]?.level)
    if (Number.isFinite(n) && n > 0) levels[name] = n
  }
  // Nothing known about the seven combat skills: no badge rather than a guess.
  return Object.keys(levels).length ? combatLevel(levels) : 0
})
// Maxed out (126) shines gold; the 100s are a step below that, the rest plain.
const tier = computed(() => (level.value >= MAX_COMBAT_LEVEL ? 'is-max' : level.value >= 100 ? 'is-high' : ''))
const title = computed(() => `Combat level ${level.value}${level.value >= MAX_COMBAT_LEVEL ? ' (maximum)' : ''}`)
</script>
