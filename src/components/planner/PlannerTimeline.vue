<template>
  <div v-if="timeline.entries.length" class="ptl-summary">
    <p v-if="timeline.finishDate" class="ptl-finish">
      <span class="ptl-finish-label">Finish line</span>
      <b>{{ fmtDate(timeline.finishDate) }}</b>
      <small>about {{ formatDays(timeline.totalDays) }} at {{ hoursPerDay }} h/day · skills are trained in the order shown</small>
    </p>
    <p v-else-if="timeline.totalHours === 0" class="planner-hint">Every goal is already reached, so there is nothing left to train.</p>

    <slot />
    <div v-if="usedCategories.length > 1" class="ptl-legend" aria-label="Skill categories">
      <span v-for="c in usedCategories" :key="c.key" class="ptl-legend-item"><i :class="`cat-${c.key}`" />{{ c.label }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { SKILL_CATEGORIES } from '@/utils/plannerTools'

const props = defineProps({
  timeline: { type: Object, required: true },
  hoursPerDay: { type: Number, required: true },
})

const usedCategories = computed(() => {
  const seen = new Set(props.timeline.entries.filter((e) => !e.done).map((e) => e.category))
  return Object.keys(SKILL_CATEGORIES).filter((k) => seen.has(k)).map((k) => ({ key: k, label: SKILL_CATEGORIES[k].label }))
})

const fmtDate = (d) => (d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-')
function formatDays(days) {
  if (days == null) return ''
  if (days < 1) return 'less than a day'
  const d = Math.ceil(days)
  return `${d.toLocaleString('en-US')} day${d === 1 ? '' : 's'}`
}
</script>
