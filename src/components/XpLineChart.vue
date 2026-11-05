<template>
  <div class="xp-chart" ref="containerRef">
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
      <text
        v-for="t in yTicks"
        :key="`ytick-${t}`"
        :x="padL - 8"
        :y="yScale(t)"
        text-anchor="end"
        dominant-baseline="middle"
        class="xp-chart-ylabel"
      >
        {{ formatXp(t) }}
      </text>

      <path v-if="points.length > 1" :d="areaPath" class="xp-chart-area" />
      <path v-if="points.length > 1" :d="linePath" class="xp-chart-line" />

      <circle v-if="lastPoint" :cx="xScale(lastPoint.x)" :cy="yScale(lastPoint.y)" r="5" class="xp-chart-enddot" />
      <text
        v-if="lastPoint"
        :x="Math.max(xScale(lastPoint.x) - 10, padL)"
        :y="Math.max(yScale(lastPoint.y) - 12, 12)"
        text-anchor="end"
        class="xp-chart-endlabel"
      >
        {{ formatXp(lastPoint.y) }}
      </text>

      <g v-if="hoverPoint">
        <line :x1="xScale(hoverPoint.x)" :x2="xScale(hoverPoint.x)" :y1="padT" :y2="H - padB" class="xp-chart-crosshair" />
        <circle :cx="xScale(hoverPoint.x)" :cy="yScale(hoverPoint.y)" r="5" class="xp-chart-hoverdot" />
      </g>

      <text v-if="points.length" :x="padL" :y="H - 6" text-anchor="start" class="xp-chart-xlabel">
        {{ shortDate(points[0].x) }}
      </text>
      <text v-if="points.length > 1" :x="W - padR" :y="H - 6" text-anchor="end" class="xp-chart-xlabel">
        {{ shortDate(points[points.length - 1].x) }}
      </text>
    </svg>

    <div v-if="hoverPoint" class="xp-chart-tooltip" :style="tooltipStyle">
      <div class="xp-chart-tooltip-date">{{ fullDate(hoverPoint.x) }}</div>
      <div class="xp-chart-tooltip-value"><strong>{{ Math.round(hoverPoint.y).toLocaleString() }}</strong> xp</div>
    </div>

    <p v-if="!points.length" class="empty-hint">Not enough data yet.</p>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatXp } from '@/utils/osrsSkills'

// points: [{ x: <ms timestamp>, y: <xp> }, ...] sorted ascending by x.
const props = defineProps({
  points: { type: Array, required: true },
  ariaLabel: { type: String, default: 'XP over time' },
})

// W tracks the container's actual rendered width (via ResizeObserver) so the
// viewBox always matches the SVG's real pixel size 1:1. Without this, a
// fixed viewBox width stretched to fit a narrower container (with no
// preserveAspectRatio to stop it) would scale text non-uniformly and
// squish it horizontally.
const W = ref(760)
const H = 300
const padL = 54
const padT = 28
const padR = 16
const padB = 24

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
const lastPoint = computed(() => points.value[points.value.length - 1] ?? null)

const minX = computed(() => points.value[0]?.x ?? 0)
const maxX = computed(() => points.value[points.value.length - 1]?.x ?? 1)

const rawMinY = computed(() => Math.min(...points.value.map((p) => p.y)))
const rawMaxY = computed(() => Math.max(...points.value.map((p) => p.y)))
// Zoomed to the data's own range (not zero-based) — xp totals are huge
// relative to a week's gains, so a zero baseline would flatten the trend
// this chart exists to show.
const yPad = computed(() => Math.max((rawMaxY.value - rawMinY.value) * 0.12, 1))
const minY = computed(() => rawMinY.value - yPad.value)
const maxY = computed(() => rawMaxY.value + yPad.value)

function xScale(x) {
  const span = maxX.value - minX.value
  if (span <= 0) return (padL + (W.value - padR)) / 2
  return padL + ((x - minX.value) / span) * (W.value - padL - padR)
}
function yScale(y) {
  const span = maxY.value - minY.value
  if (span <= 0) return (padT + (H - padB)) / 2
  return H - padB - ((y - minY.value) / span) * (H - padT - padB)
}

function niceStep(range, count) {
  const rough = range / count || 1
  const mag = 10 ** Math.floor(Math.log10(rough))
  const norm = rough / mag
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return step * mag
}
const yTicks = computed(() => {
  const step = niceStep(maxY.value - minY.value, 4)
  if (!step) return [minY.value]
  const start = Math.ceil(minY.value / step) * step
  const ticks = []
  for (let v = start; v <= maxY.value; v += step) ticks.push(Math.round(v))
  return ticks.length ? ticks : [Math.round(minY.value), Math.round(maxY.value)]
})

const linePath = computed(() =>
  points.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.y)}`).join(' '),
)
const areaPath = computed(() => {
  if (points.value.length < 2) return ''
  const top = points.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.y)}`).join(' ')
  const baseY = H - padB
  return `${top} L ${xScale(points.value[points.value.length - 1].x)} ${baseY} L ${xScale(points.value[0].x)} ${baseY} Z`
})

const hoverPoint = computed(() => (hoverIndex.value == null ? null : points.value[hoverIndex.value] ?? null))

const tooltipStyle = computed(() => {
  if (!hoverPoint.value) return {}
  const leftPct = (xScale(hoverPoint.value.x) / W.value) * 100
  const topPct = (yScale(hoverPoint.value.y) / H) * 100
  // Flip the tooltip to the left half of the chart once the point is past
  // the midline, so it never runs off the right edge.
  const flip = leftPct > 60
  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    transform: flip ? 'translate(-100%, -115%)' : 'translate(8px, -115%)',
  }
})

function nearestIndexForX(targetX) {
  if (!points.value.length) return null
  let nearest = 0
  let bestDist = Infinity
  points.value.forEach((p, i) => {
    const d = Math.abs(p.x - targetX)
    if (d < bestDist) {
      bestDist = d
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
  const targetX = span > 0 ? minX.value + ((vbX - padL) / (W.value - padL - padR)) * span : minX.value
  hoverIndex.value = nearestIndexForX(targetX)
}
function clearHover() {
  hoverIndex.value = null
}
function onFocus() {
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

function shortDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fullDate(ms) {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>
