<template>
  <div ref="box" class="jr">
    <svg class="jr-svg" :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" role="img" :aria-label="`Total XP over time with ${nodes.length} big moments marked`">
      <g class="jr-grid">
        <line v-for="t in yTicks" :key="t" :x1="padL" :x2="W - padR" :y1="yScale(t)" :y2="yScale(t)" />
      </g>
      <text v-for="t in yTicks" :key="`l${t}`" :x="padL - 8" :y="yScale(t)" text-anchor="end" dominant-baseline="middle" class="jr-ylabel">{{ formatXp(t) }}</text>

      <path v-if="points.length > 1" :d="areaPath" class="jr-area" />
      <path v-if="points.length > 1" :d="linePath" class="jr-line" />

      <!-- each big moment: a stem down to the line and a mark with the skill's own icon -->
      <g v-for="n in nodes" :key="n.id" class="jr-node" :class="[`k-${n.kind}`, { on: active?.id === n.id, selected: selected === n.id }]" tabindex="0" role="button" :aria-label="`${n.title}, ${dateText(n)}`" @mouseenter="hover = n.id" @mouseleave="hover = ''" @focus="hover = n.id" @blur="hover = ''" @click="$emit('select', n.id)" @keydown.enter.prevent="$emit('select', n.id)" @keydown.space.prevent="$emit('select', n.id)">
        <line class="jr-stem" :x1="n.x" :x2="n.x" :y1="n.y + n.r" :y2="n.lineY" />
        <circle class="jr-dot" :cx="n.x" :cy="n.lineY" r="3.5" />
        <circle class="jr-hit" :cx="n.x" :cy="n.y" :r="n.r + 5" />
        <circle class="jr-mark" :cx="n.x" :cy="n.y" :r="n.r" />
        <image :href="skillIconSrc(n.skill)" :x="n.x - n.r * 0.68" :y="n.y - n.r * 0.68" :width="n.r * 1.36" :height="n.r * 1.36" class="jr-icon" />
      </g>

      <text v-for="t in xTicks" :key="t.x" :x="t.px" :y="H - 6" :text-anchor="t.anchor" class="jr-xlabel">{{ t.label }}</text>
    </svg>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { assignLanes } from '@/utils/historyHighlights'
import { gameDay, formatGameDay } from '@/utils/gameDay'

// The whole history of a character as a line of total XP, with a mark for each big moment (see utils/historyHighlights.js) standing in
// rows above it so they never cover each other. Hover or focus a mark to read it; click one to keep it selected.
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
const padR = 18
const LANE = 30
const PLOT_H = 150
const hover = ref('')

const minX = computed(() => props.points[0]?.x ?? 0)
const maxX = computed(() => props.points[props.points.length - 1]?.x ?? 1)
const maxY = computed(() => Math.max(1, ...props.points.map((p) => p.y)) * 1.06)
const xScale = (x) => {
  const span = maxX.value - minX.value
  return span <= 0 ? (padL + W.value - padR) / 2 : padL + ((x - minX.value) / span) * (W.value - padL - padR)
}

// The sizes of the marks, biggest for 99 and 200M.
const RADIUS = { l99: 13, xp200m: 13, half: 11, xp5m: 9.5, xp1m: 8.5 }

// Marks left to right, in the first row with room.
const placed = computed(() => {
  const list = props.events
    .map((e) => ({ ...e, x: xScale(e.atMs), r: RADIUS[e.kind] || 9 }))
    .sort((a, b) => a.x - b.x || b.rank - a.rank)
  const { lanes, count } = assignLanes(
    list.map((n) => n.x),
    28,
  )
  return { list: list.map((n, i) => ({ ...n, lane: lanes[i] })), count }
})
const ribbonH = computed(() => (placed.value.count ? placed.value.count * LANE + 14 : 6))
const plotTop = computed(() => ribbonH.value + 10)
const H = computed(() => plotTop.value + PLOT_H + 26)
const yScale = (y) => plotTop.value + PLOT_H - (y / maxY.value) * PLOT_H

// Where the line is at a moment (between its two nearest points).
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
const nodes = computed(() => placed.value.list.map((n) => ({ ...n, y: 8 + n.lane * LANE + n.r, lineY: yScale(lineAt(n.atMs)) })))
const active = computed(() => nodes.value.find((n) => n.id === (hover.value || props.selected)) || null)
defineExpose({ active })

const linePath = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' '))
const areaPath = computed(() => {
  const pts = props.points
  return `${linePath.value} L ${xScale(pts[pts.length - 1].x).toFixed(1)} ${yScale(0)} L ${xScale(pts[0].x).toFixed(1)} ${yScale(0)} Z`
})

const yTicks = computed(() => {
  const top = maxY.value / 1.06
  const step = 10 ** Math.floor(Math.log10(top / 3 || 1)) * ([1, 2, 5, 10].find((m) => (10 ** Math.floor(Math.log10(top / 3 || 1))) * m >= top / 3) || 1)
  const out = []
  for (let v = 0; v <= top; v += step) out.push(Math.round(v))
  return out.slice(0, 6)
})

const fmtDate = (ms, o) => formatGameDay(gameDay(new Date(ms)), o)
const xTicks = computed(() => {
  if (props.points.length < 2) return []
  const out = [{ x: minX.value, px: padL, anchor: 'start', label: fmtDate(minX.value, { month: 'short', year: 'numeric' }) }]
  const span = maxX.value - minX.value
  const years = span / (365 * 86_400_000)
  if (years > 1.4) {
    for (let y = new Date(minX.value).getUTCFullYear() + 1; y <= new Date(maxX.value).getUTCFullYear(); y++) {
      const ms = Date.UTC(y, 0, 1)
      const px = xScale(ms)
      if (px - padL > 60 && W.value - padR - px > 60) out.push({ x: ms, px, anchor: 'middle', label: String(y) })
    }
  }
  out.push({ x: maxX.value, px: W.value - padR, anchor: 'end', label: fmtDate(maxX.value, { month: 'short', year: 'numeric' }) })
  return out
})

function dateText(n) {
  const f = (d) => formatGameDay(gameDay(d), { month: 'short', day: 'numeric', year: 'numeric' })
  return n.gap ? `sometime between ${formatGameDay(gameDay(n.after), { month: 'short', day: 'numeric' })} and ${f(n.at)}` : f(n.at)
}
</script>
