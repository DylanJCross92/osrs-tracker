<template>
  <figure class="dpc" :aria-label="`Players tracked on TickGains each day for the last ${days.length} days`">
    <figcaption class="dxc-read" aria-live="polite">
      <b>{{ shown.label }}</b>
      <span>{{ shown.total.toLocaleString('en-US') }} {{ shown.total === 1 ? 'player' : 'players' }}</span>
      <small>{{ shown.added > 0 ? `+${shown.added.toLocaleString('en-US')} added` : 'none added' }}<template v-if="shown.today"> · so far today</template></small>
    </figcaption>
    <div class="dpc-plot">
      <span class="dxc-max" aria-hidden="true">{{ top.toLocaleString('en-US') }}</span>
      <span class="dpc-min" aria-hidden="true">{{ bottom.toLocaleString('en-US') }}</span>
      <svg class="dpc-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="dpc-area" :d="areaPath" />
        <path class="dpc-line" :d="linePath" />
      </svg>
      <span class="dpc-dot" aria-hidden="true" :style="{ left: `${x(active)}%`, top: `${y(days[active].total)}%` }" />
      <div class="dpc-cols" @mouseleave="hover = -1">
        <button v-for="(d, i) in days" :key="d.day" type="button" class="dpc-col" :aria-label="`${longDay(d.day)}: ${d.total.toLocaleString('en-US')} players, ${d.added} added`" @mouseenter="hover = i" @focus="hover = i" @blur="hover = -1" />
      </div>
    </div>
    <div class="dxc-axis" aria-hidden="true"><span>{{ shortDay(days[0].day) }}</span><span>{{ shortDay(days[days.length - 1].day) }}</span></div>
  </figure>
</template>

<script setup>
import { computed, ref } from 'vue'

// The number of players the site is tracking, day by day, as an area under a line. Hover or tab to a day to read it; it rests on today.
const props = defineProps({ days: { type: Array, required: true } })

const hover = ref(-1)
const active = computed(() => (hover.value >= 0 ? hover.value : props.days.length - 1))

// The line runs from the lowest count to the highest, so growth shows even when the total is large; the two ends are labelled.
const top = computed(() => Math.max(...props.days.map((d) => d.total)))
const bottom = computed(() => Math.min(...props.days.map((d) => d.total)))
const PAD = 8
const x = (i) => (props.days.length > 1 ? (i / (props.days.length - 1)) * 100 : 50)
const y = (total) => {
  const span = top.value - bottom.value
  return span === 0 ? 50 : PAD + (1 - (total - bottom.value) / span) * (100 - PAD * 2)
}
const points = computed(() => props.days.map((d, i) => `${x(i).toFixed(2)},${y(d.total).toFixed(2)}`))
const linePath = computed(() => `M${points.value.join(' L')}`)
const areaPath = computed(() => `M${points.value.join(' L')} L100,100 L0,100 Z`)

const parse = (iso) => new Date(`${iso}T12:00:00Z`)
const shortDay = (iso) => parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const longDay = (iso) => parse(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const shown = computed(() => {
  const d = props.days[active.value]
  return { label: longDay(d.day), total: d.total, added: d.added, today: active.value === props.days.length - 1 }
})
</script>
