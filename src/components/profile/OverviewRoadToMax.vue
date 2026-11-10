<template>
  <section class="card ov-road" aria-label="Road to max">
    <header class="ov-head">
      <div>
        <h2>Road to max</h2>
        <p class="ov-sub">{{ allMaxed ? 'Every skill at 99. The only thing left is 200M.' : 'How close this account is to the finish line.' }}</p>
      </div>
    </header>
    <div class="ov-road-grid">
      <div v-for="m in meters" :key="m.label" class="ov-road-item" :class="{ 'is-done': m.pct >= 100 }">
        <div class="ov-road-top"><span>{{ m.label }}</span><b>{{ m.value }}</b></div>
        <div class="ov-meter ov-road-meter"><i :style="{ width: `${m.pct}%` }" /></div>
        <small>{{ m.note }}</small>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { formatXp, SKILL_NAMES } from '@/utils/osrsSkills'
import { count99s, MAX_TOTAL_LEVEL } from '@/utils/profile'
import { MAX_XP } from '@/utils/planner'

const props = defineProps({ snapshot: { type: Object, required: true } })

const skillCount = SKILL_NAMES.filter((n) => n !== 'Overall').length
const n99 = computed(() => count99s(props.snapshot))
const allMaxed = computed(() => n99.value >= skillCount)
const pctOf = (v, of) => Math.min((v / of) * 100, 100)

const meters = computed(() => {
  const level = props.snapshot.overallLevel
  const xp = props.snapshot.overallXp
  const maxTotalXp = skillCount * MAX_XP
  const left99 = skillCount - n99.value
  const leftLevels = Math.max(MAX_TOTAL_LEVEL - level, 0)
  return [
    { label: 'Skills at 99', value: `${n99.value} / ${skillCount}`, pct: pctOf(n99.value, skillCount), note: left99 ? `${left99} to go` : 'All done' },
    { label: 'Total level', value: `${level.toLocaleString('en-US')} / ${MAX_TOTAL_LEVEL.toLocaleString('en-US')}`, pct: pctOf(level, MAX_TOTAL_LEVEL), note: leftLevels ? `${leftLevels.toLocaleString('en-US')} levels to go` : 'Maxed' },
    { label: 'All skills 200M', value: `${((xp / maxTotalXp) * 100).toFixed(xp / maxTotalXp < 0.1 ? 1 : 0)}%`, pct: pctOf(xp, maxTotalXp), note: `${formatXp(xp)} of ${formatXp(maxTotalXp)} XP` },
  ]
})
</script>
