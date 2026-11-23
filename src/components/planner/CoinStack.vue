<template>
  <svg class="coin-stack" viewBox="0 0 72 56" width="72" height="56" aria-hidden="true">
    <g v-for="(c, i) in coins" :key="i">
      <ellipse :cx="c.x" :cy="c.y + 2" rx="7.4" ry="3.4" fill="#8a5a12" />
      <ellipse :cx="c.x" :cy="c.y" rx="7.4" ry="3.4" :fill="c.top ? '#f4cf5a' : '#d9a62a'" stroke="#6b430b" stroke-width="0.9" />
      <ellipse v-if="c.top" :cx="c.x" :cy="c.y" rx="4" ry="1.7" fill="none" stroke="#b88416" stroke-width="0.8" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

// A pile of gold coins like the ones in the game: the bigger the level (1 to 4), the more and taller the stacks.
const props = defineProps({ level: { type: Number, default: 1 } })
const SHAPES = {
  1: [3],
  2: [4, 3],
  3: [4, 7, 5],
  4: [5, 8, 11, 8, 6],
}
const coins = computed(() => {
  const heights = SHAPES[props.level] || SHAPES[1]
  const gap = heights.length > 3 ? 12 : 15
  const mid = 36
  const out = []
  // Stacks at the back first so the front ones overlap them
  const cols = heights.map((h, i) => ({ h, x: mid + (i - (heights.length - 1) / 2) * gap, order: Math.abs(i - (heights.length - 1) / 2) }))
  cols.sort((a, b) => b.order - a.order)
  for (const col of cols) {
    const base = 50 - col.order * 1.5
    for (let j = 0; j < col.h; j++) out.push({ x: col.x, y: base - j * 3.4, top: j === col.h - 1 })
  }
  return out
})
</script>
