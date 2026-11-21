<template>
  <div class="xp-chart pc" ref="containerRef">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      class="xp-chart-svg"
      tabindex="0"
      role="img"
      :aria-label="ariaLabel"
      @pointermove="onPointerMove"
      @pointerleave="clearHover"
      @keydown="onKeydown"
      @focus="onFocus"
      @blur="clearHover"
    >
      <g class="xp-chart-grid">
        <line v-for="t in yTicks" :key="`grid-${t}`" :x1="padL" :x2="W - padR" :y1="yScale(t)" :y2="yScale(t)" />
      </g>
      <text v-for="t in yLabelTicks" :key="`ytick-${t}`" :x="padL" :y="yScale(t) - 5" text-anchor="start" class="xp-chart-ylabel">{{ gpAxis(t) }}</text>

      <g v-if="hasVolume" class="pc-vols">
        <rect v-for="(b, i) in volumeBars" :key="i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" class="pc-vol" />
      </g>

      <path v-if="lowPath" :d="lowPath" class="pc-line pc-line-low" />
      <path v-if="highPath" :d="highPath" class="pc-line pc-line-high" />

      <g v-if="hoverPoint">
        <line :x1="xScale(hoverPoint.t)" :x2="xScale(hoverPoint.t)" :y1="padT" :y2="H - padB" class="xp-chart-crosshair" />
        <circle v-if="hoverPoint.high != null" :cx="xScale(hoverPoint.t)" :cy="yScale(hoverPoint.high)" r="4.5" class="pc-dot pc-dot-high" />
        <circle v-if="hoverPoint.low != null" :cx="xScale(hoverPoint.t)" :cy="yScale(hoverPoint.low)" r="4.5" class="pc-dot pc-dot-low" />
      </g>

      <text v-if="points.length" :x="padL" :y="H - 6" text-anchor="start" class="xp-chart-xlabel">{{ axisDate(points[0].t) }}</text>
      <text v-if="points.length > 1" :x="W - padR" :y="H - 6" text-anchor="end" class="xp-chart-xlabel">{{ axisDate(points[points.length - 1].t) }}</text>
    </svg>

    <div v-if="hoverPoint" class="xp-chart-tooltip" :style="tooltipStyle">
      <div class="xp-chart-tooltip-date">{{ fullDate(hoverPoint.t) }}</div>
      <div class="xp-chart-tooltip-value"><i class="pc-key pc-key-high" /> Buy <strong>{{ gpText(hoverPoint.high) }}</strong></div>
      <div class="xp-chart-tooltip-value"><i class="pc-key pc-key-low" /> Sell <strong>{{ gpText(hoverPoint.low) }}</strong></div>
      <div v-if="hoverPoint.vol" class="xp-chart-tooltip-value pc-tip-vol">{{ hoverPoint.vol.toLocaleString('en-US') }} traded</div>
    </div>

    <div class="pc-legend" aria-hidden="true">
      <span><i class="pc-key pc-key-high" /> Buy price</span>
      <span><i class="pc-key pc-key-low" /> Sell price</span>
      <span v-if="hasVolume"><i class="pc-key pc-key-vol" /> Traded</span>
    </div>

    <p v-if="!points.length" class="empty-hint">No trades recorded for this range yet.</p>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { gpAxis, gpText } from '@/utils/geFormat'

// points: [{ t: <ms>, high, low, vol }, ...] oldest first; high or low may be null when nothing traded that way in the step.
const props = defineProps({
  points: { type: Array, required: true },
  ariaLabel: { type: String, default: 'Price over time' },
  // Short ranges show the time of day, long ones only the date.
  showTime: { type: Boolean, default: false },
})

const W = ref(760)
const H = 300
const padL = 2
const padT = 16
const padR = 2
const padB = 24
const VOL_H = 58

const svgRef = ref(null)
const containerRef = ref(null)
const hoverIndex = ref(null)
let resizeObserver = null

onMounted(() => {
  if (!containerRef.value) return
  resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width
    if (width > 0) W.value = width
  })
  resizeObserver.observe(containerRef.value)
})
onUnmounted(() => resizeObserver?.disconnect())

const points = computed(() => props.points)
const values = computed(() => points.value.flatMap((p) => [p.high, p.low]).filter((v) => v != null))
const minX = computed(() => points.value[0]?.t ?? 0)
const maxX = computed(() => points.value[points.value.length - 1]?.t ?? 1)
const rawMin = computed(() => (values.value.length ? Math.min(...values.value) : 0))
const rawMax = computed(() => (values.value.length ? Math.max(...values.value) : 1))
// Zoomed to the prices' own range, with room above for the trade bars drawn along the bottom.
const pad = computed(() => Math.max((rawMax.value - rawMin.value) * 0.1, rawMax.value * 0.005, 1))
const minY = computed(() => Math.max(0, rawMin.value - pad.value - (rawMax.value - rawMin.value) * 0.18))
const maxY = computed(() => rawMax.value + pad.value)

const xScale = (t) => {
  const span = maxX.value - minX.value
  return span <= 0 ? (padL + W.value - padR) / 2 : padL + ((t - minX.value) / span) * (W.value - padL - padR)
}
const yScale = (v) => {
  const span = maxY.value - minY.value
  return span <= 0 ? (padT + H - padB) / 2 : H - padB - ((v - minY.value) / span) * (H - padT - padB)
}

function niceStep(range, count) {
  const rough = range / count || 1
  const mag = 10 ** Math.floor(Math.log10(rough))
  const norm = rough / mag
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
}
const yTicks = computed(() => {
  const step = niceStep(maxY.value - minY.value, 4)
  if (!step) return [Math.round(minY.value)]
  const ticks = []
  for (let v = Math.ceil(minY.value / step) * step; v <= maxY.value; v += step) ticks.push(Math.round(v))
  return ticks.length ? ticks : [Math.round(minY.value), Math.round(maxY.value)]
})

// The labels sit above their grid lines, so the lowest one (down among the trade bars) is left out.
const yLabelTicks = computed(() => yTicks.value.slice(1))

// A line that stops where a price is missing and starts again after it.
function pathFor(field) {
  let d = ''
  let open = false
  for (const p of points.value) {
    if (p[field] == null) {
      open = false
      continue
    }
    d += `${open ? 'L' : 'M'} ${xScale(p.t).toFixed(1)} ${yScale(p[field]).toFixed(1)} `
    open = true
  }
  return d.trim()
}
const highPath = computed(() => pathFor('high'))
const lowPath = computed(() => pathFor('low'))

const hasVolume = computed(() => points.value.some((p) => p.vol > 0))
const volumeBars = computed(() => {
  const top = Math.max(...points.value.map((p) => p.vol || 0), 1)
  const slot = points.value.length > 1 ? (W.value - padL - padR) / (points.value.length - 1) : 8
  const w = Math.max(1, Math.min(slot * 0.7, 14))
  return points.value.map((p) => {
    const h = ((p.vol || 0) / top) * VOL_H
    return { x: xScale(p.t) - w / 2, y: H - padB - h, w, h }
  })
})

const hoverPoint = computed(() => (hoverIndex.value == null ? null : points.value[hoverIndex.value] ?? null))
const tooltipStyle = computed(() => {
  if (!hoverPoint.value) return {}
  const leftPct = (xScale(hoverPoint.value.t) / W.value) * 100
  const y = yScale(hoverPoint.value.high ?? hoverPoint.value.low ?? minY.value)
  return { left: `${leftPct}%`, top: `${(y / H) * 100}%`, transform: leftPct > 60 ? 'translate(-100%, -115%)' : 'translate(8px, -115%)' }
})

function nearestIndexForX(target) {
  let nearest = null
  let best = Infinity
  points.value.forEach((p, i) => {
    const d = Math.abs(p.t - target)
    if (d < best) {
      best = d
      nearest = i
    }
  })
  return nearest
}
function onPointerMove(e) {
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect || !points.value.length) return
  const vbX = ((e.clientX - rect.left) / rect.width) * W.value
  const span = maxX.value - minX.value
  hoverIndex.value = nearestIndexForX(span > 0 ? minX.value + ((vbX - padL) / (W.value - padL - padR)) * span : minX.value)
}
const clearHover = () => {
  hoverIndex.value = null
}
const onFocus = () => {
  if (hoverIndex.value == null && points.value.length) hoverIndex.value = points.value.length - 1
}
function onKeydown(e) {
  if (!points.value.length) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    hoverIndex.value = Math.max((hoverIndex.value ?? points.value.length - 1) - 1, 0)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    hoverIndex.value = Math.min((hoverIndex.value ?? 0) + 1, points.value.length - 1)
  }
}

const axisDate = (ms) =>
  new Date(ms).toLocaleString(undefined, props.showTime ? { month: 'short', day: 'numeric', hour: 'numeric' } : { month: 'short', day: 'numeric', year: '2-digit' })
const fullDate = (ms) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: props.showTime ? 'numeric' : undefined, minute: props.showTime ? '2-digit' : undefined })
</script>
