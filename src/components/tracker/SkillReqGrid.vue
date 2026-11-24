<template>
  <ul class="trk-reqs">
    <li v-for="r in rows" :key="r.key" :class="r.state" :title="r.title">
      <img v-if="r.icon" :src="r.icon" :alt="r.skill" width="24" height="24" />
      <span v-else class="trk-reqs-ico" aria-hidden="true">{{ r.glyph }}</span>
      <span class="trk-reqs-main">
        <b>{{ r.value }}</b>
        <small>{{ r.label }}</small>
      </span>
      <i v-if="r.state === 'short'" class="trk-reqs-gap">{{ r.gap }}</i>
      <i v-else-if="r.state === 'met'" class="trk-reqs-ok" aria-label="You meet this">✓</i>
    </li>
  </ul>
</template>

<script setup>
import { computed } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'

// Skill levels (and a combat level, quest points or a plain note) a quest or diary tier needs, each with the skill's own icon. With a player's levels it
// shows what is met and how many levels are missing.
const props = defineProps({
  skills: { type: Object, default: () => ({}) },
  levels: { type: Object, default: null },
  combat: { type: Number, default: null },
  qp: { type: Number, default: 0 },
  notes: { type: Array, default: () => [] },
})

const rows = computed(() => {
  const out = []
  for (const [skill, need] of Object.entries(props.skills)) {
    const have = props.levels ? props.levels[skill] ?? 1 : null
    const short = have != null && have < need
    out.push({ key: skill, skill, icon: skillIconSrc(skill), value: need, label: skill, state: have == null ? '' : short ? 'short' : 'met', gap: short ? `${need - have} to go` : '', title: have == null ? `${need} ${skill}` : `${need} ${skill}. You are level ${have}.` })
  }
  if (props.combat) out.push({ key: 'combat', icon: skillIconSrc('Attack'), skill: 'Combat', value: props.combat, label: 'Combat level', state: '', title: `Combat level ${props.combat} recommended` })
  if (props.qp) out.push({ key: 'qp', glyph: 'QP', value: props.qp, label: 'Quest points', state: '', title: `${props.qp} quest points` })
  for (const n of props.notes) out.push({ key: n, glyph: '•', value: n, label: '', state: '', title: n })
  return out
})
</script>
