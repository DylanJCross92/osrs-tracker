<template>
  <div ref="box" class="jr">
    <svg class="jr-svg" :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" role="img" :aria-label="`Total XP over time with ${events.length} big moments marked`">
      <g class="jr-grid">
        <line v-for="t in yTicks" :key="t" :x1="padL" :x2="W - padR" :y1="yScale(t)" :y2="yScale(t)" />
      </g>
      <text v-for="t in yTicks" :key="`l${t}`" :x="padL - 8" :y="yScale(t)" text-anchor="end" dominant-baseline="middle" class="jr-ylabel">{{ formatXp(t) }}</text>

      <path v-if="points.length > 1" :d="areaPath" class="jr-area" />
      <path v-if="points.length > 1" :d="linePath" class="jr-line" />

      <!-- One row of marks above the line. Moments close together in time share one mark with a count. -->
      <g v-for="c in clusters" :key="c.id" class="jr-node" :class="[c.count > 1 ? 'is-many' : `k-${c.top.kind}`, { big: c.big, on: active?.id === c.id, selected: selected === c.id }]" tabindex="0" role="button" :aria-label="label(c)" @mouseenter="hover = c.id" @mouseleave="hover = ''" @focus="hover = c.id" @blur="hover = ''" @click="$emit('select', c.id)" @keydown.enter.prevent="$emit('select', c.id)" @keydown.space.prevent="$emit('select', c.id)">
        <line class="jr-stem" :x1="c.x" :x2="c.x" :y1="RIBBON_Y + c.r" :y2="c.lineY" />
        <circle class="jr-dot" :cx="c.x" :cy="c.lineY" r="3.5" />
        <circle class="jr-hit" :cx="c.x" :cy="RIBBON_Y" :r="c.r + 6" />
        <circle class="jr-mark" :cx="c.x" :cy="RIBBON_Y" :r="c.r" />
        <image v-if="c.count === 1" :href="skillIconSrc(c.top.skill)" :x="c.x - c.r * 0.68" :y="RIBBON_Y - c.r * 0.68" :width="c.r * 1.36" :height="c.r * 1.36" class="jr-icon" />
        <text v-else :x="c.x" :y="RIBBON_Y" text-anchor="middle" dominant-baseline="central" class="jr-count">{{ c.count }}</text>
      </g>

      <text v-for="t in xTicks" :key="t.x" :x="t.px" :y="H - 6" :text-anchor="t.anchor" class="jr-xlabel">{{ t.label }}</text>
    </svg>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { clusterMarks } from '@/utils/historyHighlights'
import { gameDay, formatGameDay } from '@/utils/gameDay'

// The whole history of a character as a line of total XP, with the big moments (see utils/historyHighlights.js) as one row of marks above
// it. Moments that fall close together share a mark with a count. Hover or focus a mark to read what is in it, click to keep it open.
// The line is drawn on a square-root scale, so the early years stay visible on an account that is now in the billions.
const props = defineProps({
  points: { type: Array, required: true }, // [{ x: ms, y: total xp }]
  events: { type: Array, default: () => [] }, // from skillHighlights
  selected: { type: String, default: '' },
})
defineEmits(['select'])

const box = ref(null)
const W = ref(760)
let ro = null
onMounted(() => {
  if (!box.value) return
  ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width
    if (w > 0) W.value = Math.round(w)
  })
  ro.observe(box.value)
})
onUnmounted(() => ro?.disconnect())

const padL = 52
const padR = 22
const RIBBON_Y = 24
const PLOT_TOP = 62
const PLOT_H = 190
const H = PLOT_TOP + PLOT_H + 26
const BIN = 30
const hover = ref('')

const minX = computed(() => props.points[0]?.x ?? 0)
const maxX = computed(() => props.points[props.points.length - 1]?.x ?? 1)
const topY = computed(() => Math.max(1, ...props.points.map((p) => p.y)))
const xScale = (x) => {
  const span = maxX.value - minX.value
  return span <= 0 ? (padL + W.value - padR) / 2 : padL + ((x - minX.value) / span) * (W.value - padL - padR)
}
const yScale = (y) => PLOT_TOP + PLOT_H - Math.sqrt(Math.max(0, y) / topY.value) * PLOT_H

const RADIUS = { l99: 12, xp200m: 12, half: 10, xp5m: 9, xp1m: 8 }
function lineAt(ms) {
  const pts = props.points
  if (!pts.length) return 0
  if (ms <= pts[0].x) return pts[0].y
  for (let i = 1; i < pts.length; i++) {
    if (ms <= pts[i].x) {
      const a = pts[i - 1]
      const b = pts[i]
      return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (ms - a.x)) / (b.x - a.x)
    }
  }
  return pts[pts.length - 1].y
}

const clusters = computed(() =>
  clusterMarks(
    props.events.map((e) => ({ ...e, x: xScale(e.atMs) })),
    BIN,
  ).map((c) => {
    const top = c.items[0]
    const ms = c.items.reduce((s, i) => s + i.atMs, 0) / c.items.length
    return { id: `c${c.bin}`, x: c.x, items: c.items, top, count: c.items.length, big: c.items.some((i) => i.kind === 'l99' || i.kind === 'xp200m'), r: c.items.length > 1 ? 13 : RADIUS[top.kind] || 9, lineY: yScale(lineAt(ms)) }
  }),
)
const active = computed(() => clusters.value.find((c) => c.id === (hover.value || props.selected)) || null)
defineExpose({ active })

const linePath = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' '))
const areaPath = computed(() => {
  const pts = props.points
  return `${linePath.value} L ${xScale(pts[pts.length - 1].x).toFixed(1)} ${yScale(0)} L ${xScale(pts[0].x).toFixed(1)} ${yScale(0)} Z`
})

// A few round values spread down the height (the scale is not even, so they are picked by where they land).
const yTicks = computed(() => {
  const out = []
  let lastPx = -Infinity
  for (const v of [5e9, 4e9, 3e9, 2e9, 1e9, 5e8, 2.5e8, 1e8, 5e7, 2.5e7, 1e7, 5e6, 1e6, 1e5]) {
    if (v > topY.value) continue
    const px = yScale(v)
    // top to bottom, each at least 34px below the one before, and clear of the 0 at the foot
    if (px - lastPx >= 34 && yScale(0) - px >= 22) {
      out.push(v)
      lastPx = px
    }
  }
  return [0, ...out.reverse()].slice(0, 7)
})

const fmtDate = (ms, o) => formatGameDay(gameDay(new Date(ms)), o)
const xTicks = computed(() => {
  if (props.points.length < 2) return []
  const out = [{ x: minX.value, px: padL, anchor: 'start', label: fmtDate(minX.value, { month: 'short', year: 'numeric' }) }]
  const span = maxX.value - minX.value
  if (span / (365 * 86_400_000) > 1.4) {
    for (let y = new Date(minX.value).getUTCFullYear() + 1; y <= new Date(maxX.value).getUTCFullYear(); y++) {
      const px = xScale(Date.UTC(y, 0, 1))
      if (px - padL > 60 && W.value - padR - px > 60) out.push({ x: y, px, anchor: 'middle', label: String(y) })
    }
  }
  out.push({ x: maxX.value, px: W.value - padR, anchor: 'end', label: fmtDate(maxX.value, { month: 'short', year: 'numeric' }) })
  return out
})

const label = (c) => (c.count === 1 ? c.top.title : `${c.count} moments, including ${c.top.title}`)
</script>
