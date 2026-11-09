<template>
  <figure class="cmp-days">
    <div class="cmp-legend" aria-hidden="true">
      <span><i class="cmp-key cmp-key-a" />{{ nameA }} <small class="cmp-gain">{{ fmtTotal(daysA) }}</small></span>
      <span><i class="cmp-key cmp-key-b" />{{ nameB }} <small class="cmp-gain">{{ fmtTotal(daysB) }}</small></span>
    </div>

    <div ref="plot" class="cmp-days-plot" @mouseleave="hover = -1">
      <svg :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`" class="cmp-days-svg" role="img" :aria-label="`Daily XP, ${nameA} versus ${nameB}, last ${bars.length} days`">
        <line v-for="t in ticks" :key="t.y" class="cmp-grid" :x1="PAD_L" :x2="W" :y1="t.y" :y2="t.y" />
        <text v-for="t in ticks" :key="'l' + t.y" class="cmp-axis" :x="PAD_L - 8" :y="t.y + 3.5" text-anchor="end">{{ t.label }}</text>
        <g v-for="(d, i) in bars" :key="d.key">
          <rect class="cmp-col" :class="{ on: hover === i }" :x="d.cx - slot / 2 + 2" :y="PAD_T - 8" :width="slot - 4" :height="plotBottom - PAD_T + 8" rx="8" />
          <rect class="cmp-bar cmp-bar-a" :x="d.x" :y="d.ya" :width="barW" :height="d.ha" rx="3.5" />
          <rect class="cmp-bar cmp-bar-b" :x="d.x + barW + 2" :y="d.yb" :width="barW" :height="d.hb" rx="3.5" />
          <text v-for="l in d.labels" :key="l.side" class="cmp-val" :class="{ best: l.best }" :x="l.x" :y="l.y" :text-anchor="l.anchor">{{ l.text }}</text>
          <text v-if="d.showDay" class="cmp-axis cmp-day" :class="{ today: d.today }" :x="d.cx" :y="H - 18" text-anchor="middle">{{ d.today ? 'Today' : d.weekday }}</text>
          <text v-if="d.showDay" class="cmp-axis cmp-date" :x="d.cx" :y="H - 5" text-anchor="middle">{{ d.date }}</text>
          <rect class="cmp-hit" :x="d.cx - slot / 2" y="0" :width="slot" :height="H" tabindex="0" :aria-label="`${d.full}: ${nameA} ${fmt(d.xpA)}, ${nameB} ${fmt(d.xpB)}`" @mouseenter="hover = i" @focus="hover = i" @blur="hover = -1" @click="hover = i" />
        </g>
      </svg>

      <div v-if="hover >= 0" class="cmp-pop" :style="{ left: popLeft }" role="status">
        <b>{{ bars[hover].full }}</b>
        <span class="cmp-pop-row"><i class="cmp-key cmp-key-a" />{{ nameA }}<em :class="{ 'cmp-gain': bars[hover].xpA > 0 }">{{ fmt(bars[hover].xpA) }}</em></span>
        <span class="cmp-pop-row"><i class="cmp-key cmp-key-b" />{{ nameB }}<em :class="{ 'cmp-gain': bars[hover].xpB > 0 }">{{ fmt(bars[hover].xpB) }}</em></span>
        <small v-if="popDiff">{{ popDiff }}</small>
      </div>
    </div>
  </figure>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatXp } from '@/utils/osrsSkills'

const props = defineProps({
  daysA: { type: Array, required: true },
  daysB: { type: Array, required: true },
  nameA: { type: String, required: true },
  nameB: { type: String, required: true },
})

// The SVG is drawn at its real pixel width (measured below) so text stays a readable size on a phone instead of
// shrinking with a scaled viewBox.
const plot = ref(null)
const W = ref(640)
const narrow = computed(() => W.value < 520)
const H = computed(() => (narrow.value ? 230 : 270))
const PAD_L = 42
const PAD_T = 26
const PAD_B = 40
const plotBottom = computed(() => H.value - PAD_B)
const plotH = computed(() => plotBottom.value - PAD_T)
const hover = ref(-1)

let observer
onMounted(() => {
  const measure = () => {
    if (plot.value) W.value = Math.max(Math.floor(plot.value.clientWidth), 280)
  }
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    observer.observe(plot.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())

const fmt = (xp) => (xp > 0 ? `+${formatXp(xp)} XP` : 'No XP')
const short = (xp) => formatXp(xp)
const fmtTotal = (list) => `+${formatXp(list.reduce((n, d) => n + d.xp, 0))} total`
const max = computed(() => Math.max(1, ...props.daysA.map((d) => d.xp), ...props.daysB.map((d) => d.xp)))

// A rounded-up scale so the axis ends on a clean number.
const top = computed(() => {
  const m = max.value
  const pow = 10 ** Math.floor(Math.log10(m))
  const step = pow / 2
  return Math.ceil(m / step) * step
})
const y = (v) => plotBottom.value - (v / top.value) * plotH.value
const ticks = computed(() => [0, 0.5, 1].map((f) => ({ y: y(top.value * f), label: f === 0 ? '0' : formatXp(top.value * f) })))

const n = computed(() => props.daysA.length)
const slot = computed(() => (W.value - PAD_L) / n.value)
const barW = computed(() => Math.min(46, Math.max((slot.value - 12) / 2, 6)))
const bestIndex = (list) => {
  let best = -1
  list.forEach((d, i) => {
    if (d.xp > 0 && (best < 0 || d.xp > list[best].xp)) best = i
  })
  return best
}
const bestA = computed(() => bestIndex(props.daysA))
const bestB = computed(() => bestIndex(props.daysB))

const LABEL_W = 42
const mode = computed(() => (barW.value + 2 >= LABEL_W ? 'center' : slot.value >= 2 * LABEL_W ? 'outward' : 'single'))
const dateOf = (key) => new Date(`${key}T12:00:00Z`)
const bars = computed(() =>
  props.daysA.map((d, i) => {
    const xpA = d.xp
    const xpB = props.daysB[i]?.xp || 0
    const cx = PAD_L + i * slot.value + slot.value / 2
    const h = (v) => (v > 0 ? Math.max(plotBottom.value - y(v), 3) : 0)
    const ha = h(xpA)
    const hb = h(xpB)
    // Which bars get a value label, and where. Two labels side by side only fit when the bars are wide enough to
    // carry them; otherwise they are pushed outward in opposite directions (when each day has room), or only the
    // taller bar of the day is labelled. With many days only each player's best day is labelled.
    const wantA = xpA > 0 && (n.value <= 7 || bestA.value === i)
    const wantB = xpB > 0 && (n.value <= 7 || bestB.value === i)
    const ax = cx - barW.value / 2 - 1
    const bx = cx + barW.value / 2 + 1
    const labels = []
    const add = (side, want, xp, hgt, x, anchor, isBest) => want && labels.push({ side, text: short(xp), x, anchor, y: plotBottom.value - hgt - 7, best: isBest })
    if (mode.value === 'center') {
      add('a', wantA, xpA, ha, ax, 'middle', bestA.value === i)
      add('b', wantB, xpB, hb, bx, 'middle', bestB.value === i)
    } else if (mode.value === 'outward') {
      add('a', wantA, xpA, ha, cx - 1, 'end', bestA.value === i)
      add('b', wantB, xpB, hb, cx + 1, 'start', bestB.value === i)
    } else if (wantA && wantB) {
      if (xpA >= xpB) add('a', true, xpA, ha, ax, 'middle', bestA.value === i)
      else add('b', true, xpB, hb, bx, 'middle', bestB.value === i)
    } else {
      add('a', wantA, xpA, ha, ax, 'middle', bestA.value === i)
      add('b', wantB, xpB, hb, bx, 'middle', bestB.value === i)
    }
    const dt = dateOf(d.key)
    return {
      key: d.key,
      cx,
      x: cx - barW.value - 1,
      xpA,
      xpB,
      ha,
      hb,
      ya: plotBottom.value - ha,
      yb: plotBottom.value - hb,
      labels,
      weekday: dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      full: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }),
      today: i === n.value - 1,
      // Every day when there is room, every other one otherwise (always including today).
      showDay: slot.value >= 46 || (n.value - 1 - i) % 2 === 0,
    }
  }),
)

// Keep the tooltip inside the chart: centred on the day, nudged in near either edge.
const popLeft = computed(() => {
  if (hover.value < 0) return '0'
  const x = bars.value[hover.value].cx
  return `${Math.min(Math.max(x, 96), W.value - 96)}px`
})
const popDiff = computed(() => {
  if (hover.value < 0) return ''
  const { xpA, xpB } = bars.value[hover.value]
  if (xpA === xpB) return xpA ? 'Dead heat' : ''
  const lead = xpA > xpB ? props.nameA : props.nameB
  return `${lead} ahead by ${formatXp(Math.abs(xpA - xpB))}`
})
</script>
