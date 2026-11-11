<template>
  <div class="rail" :class="[`cat-${entry.category}`, { done: entry.done }]">
    <template v-if="!entry.done">
      <!-- Where this skill sits in the whole plan, to scale -->
      <span class="rail-scale" aria-hidden="true"><i :style="scaleStyle" /></span>
      <span v-if="first || roomy" class="rail-label rail-start">{{ fmtShort(entry.startDate) }}</span>
      <span class="rail-line" aria-hidden="true" />
      <span class="rail-node rail-node-start" aria-hidden="true" />
      <span v-for="m in pips" :key="m.level" class="rail-pip" :style="{ '--f': m.f }" :title="`Level ${m.level}: ${fmtFull(m.date)}`">{{ m.level }}</span>
      <span v-for="m in pips" :key="`l${m.level}`" class="rail-label rail-pip-label" :style="{ '--f': m.f }">{{ fmtShort(m.date) }}</span>
      <span class="rail-node rail-node-end" aria-hidden="true" />
      <span class="rail-label rail-end"><b>{{ fmtShort(entry.endDate) }}</b><small>{{ endYear }}</small></span>
    </template>
    <template v-else>
      <span class="rail-line rail-line-done" aria-hidden="true" />
      <span class="rail-node rail-node-done" aria-hidden="true">✓</span>
      <span class="rail-label rail-done-text">Done</span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  entry: { type: Object, required: true },
  totalHours: { type: Number, required: true },
  // The first goal always shows its start date; the rest start the moment the one above ends, so their start date is only
  // repeated when the card is open and there is room (which is also when the level pips get drawn).
  first: { type: Boolean, default: false },
  roomy: { type: Boolean, default: false },
})

const fmtShort = (d) => (d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')
const fmtFull = (d) => (d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '')
const endYear = computed(() => (props.entry.endDate ? String(props.entry.endDate.getFullYear()) : ''))

const scaleStyle = computed(() => {
  const t = props.totalHours || 1
  const left = (props.entry.startHours / t) * 100
  return { left: left + '%', width: Math.max((props.entry.hours / t) * 100, 4) + '%' }
})

// Level pips sit on the line where, within this skill's own training, the level is reached. Thinned out so they never collide.
const pips = computed(() => {
  const e = props.entry
  if (!e.hours || !props.roomy) return []
  const out = []
  let last = -1
  for (const m of e.milestones.slice(0, -1)) {
    const f = (m.hours - e.startHours) / e.hours
    if (f < 0.02 || f > 0.98 || f - last < 0.1) continue
    out.push({ ...m, f: Number(f.toFixed(4)) })
    last = f
  }
  return out
})
</script>
