<template>
  <div ref="box" class="sj">
    <svg class="sj-svg" :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" role="img" :aria-label="`When each of ${rows.length} skills reached 99${rows.some((r) => r.e200) ? ' and 200M XP' : ''}`">
      <g class="sj-grid">
        <line v-for="t in xTicks" :key="t.x" :x1="t.px" :x2="t.px" :y1="TOP - 6" :y2="H - BOTTOM" />
      </g>

      <g v-for="(r, i) in rows" :key="r.skill" class="sj-row" :class="{ on: active?.skill === r.skill, selected: selected === r.skill }" tabindex="0" role="button" :aria-label="label(r)" @mouseenter="hover = r.skill" @mouseleave="hover = ''" @focus="hover = r.skill" @blur="hover = ''" @click="$emit('select', r.skill)" @keydown.enter.prevent="$emit('select', r.skill)" @keydown.space.prevent="$emit('select', r.skill)">
        <rect class="sj-band" :x="0" :y="rowY(i) - ROW / 2" :width="W" :height="ROW" />
        <image :href="skillIconSrc(r.skill)" :x="8" :y="rowY(i) - 9" width="18" height="18" class="sj-icon" />
        <text v-if="wide" :x="34" :y="rowY(i)" dominant-baseline="central" class="sj-name">{{ r.skill }}</text>
        <!-- getting going, up to 99 -->
        <line class="sj-run" :x1="x1(r)" :x2="x99(r)" :y1="rowY(i)" :y2="rowY(i)" />
        <!-- from 99 to 200M XP -->
        <line v-if="r.e200" class="sj-run is-after" :x1="x99(r)" :x2="x200(r)" :y1="rowY(i)" :y2="rowY(i)" />
        <g class="sj-99" :transform="`translate(${x99(r)} ${rowY(i)})`">
          <circle r="9" />
          <text y="0.5" text-anchor="middle" dominant-baseline="central">99</text>
        </g>
        <path v-if="r.e200" class="sj-200" :d="`M ${x200(r)} ${rowY(i) - 8} l 8 8 l -8 8 l -8 -8 z`" />
      </g>

      <text v-for="t in xTicks" :key="`l${t.x}`" :x="t.px" :y="H - 8" :text-anchor="t.anchor" class="sj-xlabel">{{ t.label }}</text>
    </svg>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { gameDay, formatGameDay } from '@/utils/gameDay'

// A row for each skill that has reached 99: a bar from when it got going to its 99 (the gold mark), and a diamond if it went on to 200M XP.
// The rows are in the order the 99s came, so the whole history reads as a staircase from the first 99 to the latest.
const props = defineProps({
  rows: { type: Array, required: true }, // from skillRows
  minMs: { type: Number, required: true }, // when tracking began
  maxMs: { type: Number, required: true }, // now
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

const ROW = 26
const TOP = 12
const BOTTOM = 28
const hover = ref('')
const wide = computed(() => W.value >= 520)
const padL = computed(() => (wide.value ? 118 : 40))
const padR = 22
const H = computed(() => TOP + props.rows.length * ROW + BOTTOM)
const rowY = (i) => TOP + i * ROW + ROW / 2

const span = computed(() => Math.max(1, props.maxMs - props.minMs))
const xOf = (ms) => padL.value + ((ms - props.minMs) / span.value) * (W.value - padL.value - padR)
// Already reached when tracking began: drawn at the very start of the chart.
const x99 = (r) => xOf(r.t99 ?? props.minMs)
const x1 = (r) => (r.start == null ? padL.value : xOf(r.start))
const x200 = (r) => xOf(r.t200 ?? props.minMs)

const active = computed(() => props.rows.find((r) => r.skill === (hover.value || props.selected)) || null)
defineExpose({ active })

const fmtYear = (ms) => formatGameDay(gameDay(new Date(ms)), { month: 'short', year: 'numeric' })
const xTicks = computed(() => {
  const out = [{ x: 'a', px: padL.value, anchor: 'start', label: fmtYear(props.minMs) }]
  const years = span.value / (365 * 86_400_000)
  if (years > 1.4) {
    for (let y = new Date(props.minMs).getUTCFullYear() + 1; y <= new Date(props.maxMs).getUTCFullYear(); y++) {
      const px = xOf(Date.UTC(y, 0, 1))
      if (px - padL.value > 60 && W.value - padR - px > 60) out.push({ x: y, px, anchor: 'middle', label: String(y) })
    }
  }
  out.push({ x: 'z', px: W.value - padR, anchor: 'end', label: fmtYear(props.maxMs) })
  return out
})
const label = (r) => `${r.skill}: level 99${r.e200 ? ' and 200M XP' : ''}`
</script>
