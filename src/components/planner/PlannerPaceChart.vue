<template>
  <div class="pc" ref="root">
    <ul class="pc-legend" aria-hidden="true">
      <li><i class="pc-sw is-plan" />Plan</li>
      <li><i class="pc-sw is-actual" />Your progress</li>
      <li v-if="series.projected"><i class="pc-sw is-proj" />At your pace</li>
    </ul>
    <svg
      v-if="width"
      class="pc-svg"
      :width="width"
      :height="height"
      role="img"
      :aria-label="summary"
      @pointermove="onMove"
      @pointerleave="hover = null"
    >
      <!-- grid and axes -->
      <g class="pc-grid">
        <g v-for="t in yTicks" :key="`y${t.xp}`">
          <line :x1="M.l" :x2="width - M.r" :y1="t.y" :y2="t.y" />
          <text :x="M.l - 8" :y="t.y + 4" text-anchor="end">{{ t.label }}</text>
        </g>
        <text v-for="t in xTicks" :key="`x${t.day}`" :x="t.x" :y="height - 6" :text-anchor="t.anchor">{{ t.label }}</text>
      </g>

      <!-- today -->
      <g v-if="series.nowDay > 0">
        <line class="pc-today" :x1="X(series.nowDay)" :x2="X(series.nowDay)" :y1="M.t" :y2="M.t + innerH" />
        <text class="pc-today-label" :x="X(series.nowDay)" :y="M.t - 2" :text-anchor="series.nowDay / xMax > 0.85 ? 'end' : 'middle'">Today</text>
      </g>

      <!-- the plan -->
      <path class="pc-plan" :d="line(series.planned)" />
      <circle v-for="m in series.marks.slice(0, -1)" :key="m.skill" class="pc-goal" :cx="X(m.day)" :cy="Y(m.xp)" r="3.5"><title>{{ m.skill }} level {{ m.targetLevel }}: {{ dateText(m.day) }}</title></circle>
      <circle class="pc-end is-plan" :cx="X(series.plannedDays)" :cy="Y(series.totalXp)" r="5"><title>Planned finish: {{ dateText(series.plannedDays) }}</title></circle>

      <!-- what really happened, and where it is heading -->
      <path class="pc-area" :d="`${line(series.actual)} L${X(series.nowDay)},${Y(0)} L${X(0)},${Y(0)} Z`" />
      <path class="pc-actual" :d="line(series.actual)" />
      <path v-if="series.projected" class="pc-proj" :d="line(series.projected)" />
      <circle v-if="series.projected" class="pc-end is-proj" :cx="X(series.projectedDay)" :cy="Y(series.totalXp)" r="5"><title>At your pace: {{ dateText(series.projectedDay) }}</title></circle>
      <circle class="pc-now" :cx="X(series.nowDay)" :cy="Y(nowXp)" r="4.5" />

      <!-- hover -->
      <g v-if="hover">
        <line class="pc-cross" :x1="hover.x" :x2="hover.x" :y1="M.t" :y2="M.t + innerH" />
        <circle v-if="hover.plan != null" class="pc-dot is-plan" :cx="hover.x" :cy="Y(hover.plan)" r="3.5" />
        <circle v-if="hover.mine != null" class="pc-dot is-actual" :cx="hover.x" :cy="Y(hover.mine)" r="3.5" />
      </g>
    </svg>
    <div v-if="hover" class="pc-tip" :class="{ flip: hover.x > width * 0.6 }" :style="{ left: hover.x + 'px' }" role="tooltip">
      <b>{{ hover.date }}</b>
      <span v-if="hover.plan != null"><i class="pc-sw is-plan" />Plan <em>{{ formatXp(hover.plan) }} XP</em></span>
      <span v-if="hover.mine != null"><i class="pc-sw" :class="hover.future ? 'is-proj' : 'is-actual'" />{{ hover.future ? 'At your pace' : 'You' }} <em>{{ formatXp(hover.mine) }} XP</em></span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatXp } from '@/utils/osrsSkills'

const props = defineProps({ series: { type: Object, required: true } })

const root = ref(null)
const width = ref(0)
let ro = null
onMounted(() => {
  const measure = () => (width.value = Math.floor(root.value?.clientWidth || 0))
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    ro.observe(root.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

const M = { l: 48, r: 16, t: 16, b: 26 }
const height = computed(() => (width.value < 480 ? 190 : 230))
const innerW = computed(() => Math.max(10, width.value - M.l - M.r))
const innerH = computed(() => height.value - M.t - M.b)
// A little room past the last date so the finish marker is never cut off.
const xMax = computed(() => Math.max(1, props.series.endDay * 1.04))
const X = (day) => M.l + (day / xMax.value) * innerW.value
const Y = (xp) => M.t + innerH.value - (xp / props.series.totalXp) * innerH.value
const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)},${Y(p.xp).toFixed(1)}`).join(' ')

const nowXp = computed(() => props.series.actual[props.series.actual.length - 1].xp)

const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const fmtYear = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const dateAt = (day) => new Date(props.series.baseline.getTime() + day * 86_400_000)
const dateText = (day) => fmtYear(dateAt(day))

const yTicks = computed(() => [0, 0.5, 1].map((f) => ({ xp: f, y: Y(f * props.series.totalXp), label: f === 0 ? '0' : formatXp(f * props.series.totalXp) })))
const xTicks = computed(() => {
  const count = width.value < 480 ? 3 : 5
  const out = []
  for (let i = 0; i < count; i++) {
    const day = (i / (count - 1)) * xMax.value
    out.push({ day, x: X(day), label: fmt(dateAt(day)), anchor: i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle' })
  }
  return out
})

const summary = computed(() => {
  const s = props.series
  const parts = [`Chart of XP gained against time. Planned finish ${dateText(s.plannedDays)}.`]
  if (s.projected) parts.push(`At your current pace you finish ${dateText(s.projectedDay)}.`)
  return parts.join(' ')
})

function interp(pts, day) {
  if (!pts.length || day < pts[0].day || day > pts[pts.length - 1].day) return null
  for (let i = 1; i < pts.length; i++) {
    if (day <= pts[i].day) {
      const a = pts[i - 1]
      const b = pts[i]
      return b.day === a.day ? b.xp : a.xp + ((b.xp - a.xp) * (day - a.day)) / (b.day - a.day)
    }
  }
  return null
}
const hover = ref(null)
function onMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const px = Math.min(Math.max(e.clientX - rect.left, M.l), width.value - M.r)
  const day = ((px - M.l) / innerW.value) * xMax.value
  const s = props.series
  const future = day > s.nowDay
  hover.value = {
    x: px,
    date: fmtYear(dateAt(day)),
    future,
    plan: interp(s.planned, day),
    mine: future ? (s.projected ? interp(s.projected, day) : null) : interp(s.actual, day),
  }
}
</script>
