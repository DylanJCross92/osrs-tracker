<template>
  <div class="sc" ref="root">
    <ul v-if="series.length > 1 || legend" class="sc-legend" aria-hidden="true">
      <li v-for="s in series" :key="s.key"><i class="sc-sw" :class="s.type === 'line' ? 'is-line' : ''" :style="{ background: s.color }" />{{ s.label }}</li>
    </ul>
    <div class="sc-plot" :style="{ height: `${height}px` }">
      <svg v-if="width" :width="width" :height="height" role="img" :aria-label="summary" @pointerleave="onLeave">
        <g class="sc-grid">
          <g v-for="t in ticks" :key="t.v">
            <line :x1="M.left" :x2="width - M.right" :y1="y(t.v)" :y2="y(t.v)" />
            <text :x="M.left - 6" :y="y(t.v)" dy="0.32em" text-anchor="end">{{ t.label }}</text>
          </g>
        </g>
        <g v-for="s in barSeries" :key="s.key">
          <rect v-for="(v, i) in s.values" :key="i" class="sc-bar" :class="{ 'is-dim': index >= 0 && index !== i }" :x="cx(i) - barW / 2" :y="y(v)" :width="barW" :height="Math.max(v > 0 ? 2 : 0, y(0) - y(v))" rx="2" :style="{ fill: s.color }" />
        </g>
        <polyline v-for="s in lineSeries" :key="s.key" class="sc-line" :points="s.values.map((v, i) => `${cx(i)},${y(v)}`).join(' ')" :style="{ stroke: s.color }" />
        <g class="sc-x">
          <text v-for="i in xTicks" :key="i" :x="cx(i)" :y="height - 4" :text-anchor="i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'">{{ dayLabel(labels[i]) }}</text>
        </g>
        <template v-if="index >= 0">
          <line class="sc-cross" :x1="cx(index)" :x2="cx(index)" :y1="M.top" :y2="y(0)" />
          <circle v-for="s in lineSeries" :key="s.key" class="sc-dot" :cx="cx(index)" :cy="y(s.values[index])" r="4" :style="{ fill: s.color }" />
        </template>
        <!-- Catches the pointer over the whole plot, so a thin bar is as easy to hit as a wide one. -->
        <rect class="sc-hit" :x="M.left" :y="0" :width="Math.max(0, width - M.left - M.right)" :height="y(0)" tabindex="0" role="group" :aria-label="`${summary} Use the arrow keys to move between days.`" @pointermove="onMove" @pointerdown="onMove" @keydown="onKey" @focus="onFocus" @blur="onLeave" />
      </svg>
      <p v-if="empty" class="sc-empty">{{ emptyText }}</p>
      <div v-if="index >= 0" class="sc-tip" :style="tipStyle" role="status" aria-live="polite">
        <slot name="tooltip" :index="index" :label="labels[index]">
          <b>{{ dayLong(labels[index]) }}</b>
          <p v-for="s in series" :key="s.key"><i class="sc-sw" :class="s.type === 'line' ? 'is-line' : ''" :style="{ background: s.color }" />{{ s.label }}<em>{{ (tipFormat || fmt)(s.values[index]) }}</em></p>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { compact, dayLabel, dayLong, fmt, niceMax } from './statsFormat'

const props = defineProps({
  // Oldest first, 'YYYY-MM-DD'. Every series lines up with these.
  labels: { type: Array, required: true },
  // [{ key, label, color, values: number[], type?: 'bar' | 'line' }]
  series: { type: Array, required: true },
  height: { type: Number, default: 190 },
  format: { type: Function, default: compact },
  tipFormat: { type: Function, default: null },
  legend: { type: Boolean, default: false },
  emptyText: { type: String, default: 'Nothing recorded in this time yet.' },
})
// The day being looked at (an index), or -1 once the pointer leaves.
const emit = defineEmits(['hover'])

const M = { top: 10, right: 8, bottom: 22, left: 40 }
const root = ref(null)
const width = ref(0)
const index = ref(-1)
let ro = null
onMounted(() => {
  width.value = Math.floor(root.value.getBoundingClientRect().width)
  if (typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(([e]) => (width.value = Math.floor(e.contentRect.width)))
  ro.observe(root.value)
  document.addEventListener('pointerdown', outside)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  document.removeEventListener('pointerdown', outside)
})
// Tapping anywhere outside the chart closes the tooltip (a phone has no pointer to move away).
const outside = (e) => {
  if (index.value >= 0 && !root.value?.contains(e.target)) set(-1)
}

const n = computed(() => props.labels.length)
const barSeries = computed(() => props.series.filter((s) => s.type !== 'line'))
const lineSeries = computed(() => props.series.filter((s) => s.type === 'line'))
const top = computed(() => niceMax(Math.max(0, ...props.series.flatMap((s) => s.values))))
const empty = computed(() => !props.series.some((s) => s.values.some((v) => v > 0)))
const innerW = computed(() => Math.max(1, width.value - M.left - M.right))
const band = computed(() => innerW.value / Math.max(1, n.value))
const barW = computed(() => Math.max(2, Math.min(18, band.value * 0.7)))
const cx = (i) => M.left + band.value * (i + 0.5)
const y = (v) => M.top + (props.height - M.top - M.bottom) * (1 - (Number(v) || 0) / top.value)
const ticks = computed(() => [0, 1, 2, 3, 4].map((k) => ({ v: (top.value * k) / 4, label: props.format((top.value * k) / 4) })))
// About five date labels, always including the first and last.
const xTicks = computed(() => {
  const want = width.value < 420 ? 3 : 5
  if (n.value <= want) return props.labels.map((_, i) => i)
  return [...new Set(Array.from({ length: want }, (_, k) => Math.round((k * (n.value - 1)) / (want - 1))))]
})
const summary = computed(() => {
  const parts = props.series.map((s) => `${s.label}: ${fmt(s.values.reduce((a, v) => a + v, 0))} in total, highest ${fmt(Math.max(0, ...s.values))}`)
  return `Chart of ${n.value} days from ${props.labels[0] ? dayLabel(props.labels[0]) : ''} to ${props.labels[n.value - 1] ? dayLabel(props.labels[n.value - 1]) : ''}. ${parts.join('. ')}.`
})

function set(i) {
  if (i === index.value) return
  index.value = i
  emit('hover', i)
}
function onMove(e) {
  const r = e.currentTarget.getBoundingClientRect()
  set(Math.min(n.value - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n.value))))
}
// A mouse leaving closes the tooltip; a finger lifting does not (it stays until another tap).
function onLeave(e) {
  if (!e || e.pointerType === 'mouse' || e.type === 'blur') set(-1)
}
function onFocus() {
  if (index.value < 0) set(n.value - 1)
}
function onKey(e) {
  const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
  if (k) {
    e.preventDefault()
    set(Math.min(n.value - 1, Math.max(0, (index.value < 0 ? n.value - 1 : index.value) + k)))
  } else if (e.key === 'Escape') set(-1)
}
watch(() => props.labels, () => set(-1))

// The tooltip sits beside the day, on whichever side has the room.
const tipStyle = computed(() => {
  const x = index.value >= 0 ? cx(index.value) : 0
  return x > width.value / 2 ? { right: `${Math.max(0, width.value - x + 12)}px` } : { left: `${x + 12}px` }
})
</script>
