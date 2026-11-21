<template>
  <svg v-if="points" class="psk" :class="tone" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label" preserveAspectRatio="none">
    <polyline :points="points" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

// A very small price line with no axes: the daily prices over a stretch of days, coloured by where it ended up against where it started.
const props = defineProps({ values: { type: Array, default: () => [] }, label: { type: String, default: 'Price over the last 30 days' } })
const W = 72
const H = 26
const PAD = 3

const clean = computed(() => (props.values || []).filter((v) => Number.isFinite(v)))
const points = computed(() => {
  const v = clean.value
  if (v.length < 2) return ''
  const min = Math.min(...v)
  const max = Math.max(...v)
  const span = max - min || 1
  return v
    .map((n, i) => `${((i / (v.length - 1)) * W).toFixed(1)},${(max === min ? H / 2 : H - PAD - ((n - min) / span) * (H - PAD * 2)).toFixed(1)}`)
    .join(' ')
})
const tone = computed(() => {
  const v = clean.value
  if (v.length < 2) return 'flat'
  const change = v[v.length - 1] - v[0]
  return change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
})
</script>
