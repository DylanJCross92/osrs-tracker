<template>
  <div class="spark">
    <div class="spark-head">
      <span>XP gained · last 7 days</span>
      <b :class="{ 'stat-gain': total > 0 }">{{ total > 0 ? `+${total.toLocaleString('en-US')}` : '-' }}</b>
    </div>
    <div class="spark-plot" @mouseleave="active = -1">
    <svg :viewBox="`0 0 ${W} ${H}`" class="spark-svg" role="img" :aria-label="`XP gained per day, last 7 days: ${total.toLocaleString('en-US')} total`">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7cb869" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#7cb869" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line v-for="g in 3" :key="g" :x1="0" :x2="W" :y1="padT + ((H - padT - padB) * (g - 1)) / 2" :y2="padT + ((H - padT - padB) * (g - 1)) / 2" class="spark-grid" />
      <path v-if="points.length > 1" :d="areaPath" fill="url(#sparkFill)" />
      <path v-if="points.length > 1" :d="linePath" class="spark-line" />
      <line v-if="activePoint" :x1="activePoint.x" :x2="activePoint.x" :y1="padT" :y2="H - padB" class="spark-guide" />
      <g v-for="(p, i) in points" :key="p.label">
        <circle :cx="p.x" :cy="p.y" :r="active === i ? 5 : 3.5" class="spark-dot" :class="{ 'is-active': active === i }" />
        <text :x="p.x" :y="H - 4" text-anchor="middle" class="spark-label" :class="{ 'is-active': active === i }">{{ p.label }}</text>
      </g>
      <!-- One wide hit area per day, so hovering anywhere in the column (or tapping it) shows that day. -->
      <rect v-for="(p, i) in points" :key="`hit-${p.label}`" :x="p.x - step / 2" y="0" :width="step" :height="H" class="spark-hit" tabindex="0" :aria-label="`${p.label}: ${p.xp > 0 ? '+' + p.xp.toLocaleString('en-US') + ' XP' : 'no XP'}`" @mouseenter="active = i" @focus="active = i" @blur="active = -1" @pointerdown="active = i" @click="$emit('select', p)" @keydown.enter.prevent="$emit('select', p)" @keydown.space.prevent="$emit('select', p)" />
    </svg>
    <div v-if="activePoint" class="spark-tip" :style="{ left: tipLeft + '%', top: tipTop + '%' }" role="status">
      <small>{{ activePoint.label }}</small>
      <b :class="{ 'stat-gain': activePoint.xp > 0 }">{{ activePoint.xp > 0 ? `+${activePoint.xp.toLocaleString('en-US')} XP` : 'No XP' }}</b>
      <span v-for="s in activePoint.topSkills || []" :key="s.skill" class="spark-tip-skill"><img :src="skillIconSrc(s.skill)" alt="" width="14" height="14" />{{ s.skill }} <b class="stat-gain">+{{ formatXp(s.xp) }}</b></span>
    </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'

// days: [{ label: 'Mon', xp: 12345 }, ...] oldest → newest
const props = defineProps({ days: { type: Array, required: true } })
defineEmits(['select'])
const W = 320
const H = 110
const padX = 0
const padT = 10
const padB = 22

const active = ref(-1)
const step = computed(() => (W - padX * 2) / props.days.length)
const total = computed(() => props.days.reduce((s, d) => s + d.xp, 0))
// Points sit at the centre of 7 equal columns (like a bar chart), so the gap
// from the edge to the first/last point is half the gap between points,
// even spacing all the way across, and the day labels centre under each point.
const points = computed(() => {
  const max = Math.max(...props.days.map((d) => d.xp), 1)
  const step = (W - padX * 2) / props.days.length
  return props.days.map((d, i) => ({
    ...d,
    x: padX + (i + 0.5) * step,
    y: padT + 4 + (1 - d.xp / max) * (H - padT - padB - 8),
  }))
})
const activePoint = computed(() => points.value[active.value] || null)
// The tooltip sits above the dot, kept inside the card at the first and last day.
const tipLeft = computed(() => Math.min(Math.max(((activePoint.value?.x ?? 0) / W) * 100, 20), 80))
const tipTop = computed(() => ((activePoint.value?.y ?? 0) / H) * 100)
const linePath = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '))
const areaPath = computed(() => {
  const base = H - padB
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  return `${linePath.value} L${last.x.toFixed(1)} ${base} L${first.x.toFixed(1)} ${base} Z`
})
</script>
