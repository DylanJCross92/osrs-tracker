<template>
  <section class="card ov-skills" aria-label="Skills">
    <header class="ov-head">
      <div>
        <h2>Skill board</h2>
        <p class="ov-sub">Every skill at a glance. Tap one to plan its next level.</p>
      </div>
      <span class="ov-skills-key" aria-hidden="true"><i class="k-99" />99<i class="k-gain" />Gained this week</span>
    </header>
    <div class="ov-skill-grid">
      <button v-for="t in tiles" :key="t.skill" type="button" class="ov-skill" :class="{ 'is-99': t.level >= 99, 'is-200m': t.maxed, 'is-gain': t.gain > 0 }" :aria-label="`${t.skill}, level ${t.level}${t.gain > 0 ? `, +${t.gain.toLocaleString('en-US')} XP this week` : ''}. Open quick planner`" @click="$emit('skill', t.skill)">
        <img :src="skillIconSrc(t.skill)" alt="" width="26" height="26" />
        <b class="ov-skill-level">{{ t.level }}</b>
        <span class="ov-skill-name">{{ t.skill }}</span>
        <span class="ov-meter ov-skill-meter" aria-hidden="true"><i :style="{ width: `${t.pct}%` }" /></span>
        <small v-if="t.gain > 0" class="ov-skill-gain">+{{ formatXp(t.gain) }}</small>
        <small v-else class="ov-skill-xp">{{ t.maxed ? '200M' : formatXp(t.xp) }}</small>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { skillIconSrc, formatXp, SKILL_NAMES } from '@/utils/osrsSkills'
import { xpAtLevel, MAX_XP } from '@/utils/planner'

defineEmits(['skill'])
const props = defineProps({
  snapshot: { type: Object, required: true },
  // The chart's 7 days (with each day's skills), to show what each skill gained this week.
  days: { type: Array, default: () => [] },
})

const weekGain = computed(() => {
  const sums = {}
  for (const d of props.days) for (const s of d.skills || []) sums[s.skill] = (sums[s.skill] || 0) + s.xp
  return sums
})

const tiles = computed(() =>
  SKILL_NAMES.filter((n) => n !== 'Overall' && props.snapshot.skills?.[n]).map((skill) => {
    const { xp, level } = props.snapshot.skills[skill]
    const from = xpAtLevel(level)
    const to = xpAtLevel(level + 1)
    // Past 99 the bar is full (the board shows the real level, 99 is the cap).
    const pct = level >= 99 ? 100 : Math.min(Math.max(((xp - from) / (to - from)) * 100, 0), 100)
    return { skill, xp, level, pct, maxed: xp >= MAX_XP, gain: weekGain.value[skill] || 0 }
  }),
)
</script>
