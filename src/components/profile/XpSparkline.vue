<template>
  <div class="spark">
    <div class="spark-head">
      <span>XP gained · last 7 days</span>
      <b :class="{ 'stat-gain': total > 0 }">{{ total > 0 ? `+${total.toLocaleString()}` : '—' }}</b>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" class="spark-svg" role="img" :aria-label="`XP gained per day, last 7 days: ${total.toLocaleString()} total`">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7cb869" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#7cb869" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line v-for="g in 3" :key="g" :x1="padX" :x2="W - padX" :y1="padT + ((H - padT - padB) * (g - 1)) / 2" :y2="padT + ((H - padT - padB) * (g - 1)) / 2" class="spark-grid" />
      <path v-if="points.length > 1" :d="areaPath" fill="url(#sparkFill)" />
      <path v-if="points.length > 1" :d="linePath" class="spark-line" />
      <g v-for="p in points" :key="p.label">
        <circle :cx="p.x" :cy="p.y" r="3.5" class="spark-dot"><title>{{ p.label }}: +{{ p.xp.toLocaleString() }} XP</title></circle>
        <text :x="p.x" :y="H - 4" text-anchor="middle" class="spark-label">{{ p.label }}</text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// days: [{ label: 'Mon', xp: 12345 }, ...] oldest → newest
const props = defineProps({ days: { type: Array, required: true } })
const W = 320
const H = 110
const padX = 14
const padT = 10
const padB = 22

const total = computed(() => props.days.reduce((s, d) => s + d.xp, 0))
const points = computed(() => {
  const max = Math.max(...props.days.map((d) => d.xp), 1)
  const step = (W - padX * 2) / Math.max(props.days.length - 1, 1)
  return props.days.map((d, i) => ({
    ...d,
    x: padX + i * step,
    y: padT + (1 - d.xp / max) * (H - padT - padB),
  }))
})
const linePath = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '))
const areaPath = computed(() => {
  const base = H - padB
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  return `${linePath.value} L${last.x.toFixed(1)} ${base} L${first.x.toFixed(1)} ${base} Z`
})
</script>
