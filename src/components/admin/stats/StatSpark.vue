<template>
  <svg class="sspark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
    <rect v-for="(v, i) in values" :key="i" :x="i * step + gap" :y="28 - h(v)" :width="Math.max(0.5, step - gap * 2)" :height="h(v)" :style="{ fill: color }" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ values: { type: Array, required: true }, color: { type: String, default: 'var(--st-a)' } })
const step = computed(() => 100 / Math.max(1, props.values.length))
const gap = computed(() => (props.values.length > 60 ? 0.1 : 0.25))
const max = computed(() => Math.max(1, ...props.values))
const h = (v) => (v > 0 ? Math.max(2, (v / max.value) * 26) : 0.8)
</script>
