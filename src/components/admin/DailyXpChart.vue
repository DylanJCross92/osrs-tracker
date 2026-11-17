<template>
  <figure class="dxc" :aria-label="`XP gained on TickGains each day for the last ${days.length} days`">
    <figcaption class="dxc-read" aria-live="polite">
      <b>{{ shown.label }}</b>
      <span class="stat-gain">+{{ shown.xp.toLocaleString('en-US') }} XP</span>
      <small>{{ shown.players.toLocaleString('en-US') }} {{ shown.players === 1 ? 'player' : 'players' }}<template v-if="shown.today"> · so far today</template></small>
    </figcaption>
    <div class="dxc-plot">
      <span class="dxc-max" aria-hidden="true">{{ formatXp(max) }}</span>
      <span class="dxc-grid" aria-hidden="true" />
      <div class="dxc-cols" @mouseleave="hover = -1">
        <button v-for="(d, i) in days" :key="d.day" type="button" class="dxc-col" :class="{ 'is-on': i === active, 'is-today': i === days.length - 1 }" :aria-label="`${longDay(d.day)}: ${d.xp.toLocaleString('en-US')} XP from ${d.players} players`" @mouseenter="hover = i" @focus="hover = i" @blur="hover = -1">
          <i :style="{ height: barHeight(d.xp) }" />
        </button>
      </div>
    </div>
    <div class="dxc-axis" aria-hidden="true"><span>{{ shortDay(days[0].day) }}</span><span>{{ shortDay(days[days.length - 1].day) }}</span></div>
  </figure>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatXp } from '@/utils/osrsSkills'

// XP gained across the whole site on each day, one bar per day. Hover or tab to a bar to read it; it rests on today.
const props = defineProps({ days: { type: Array, required: true } })

const hover = ref(-1)
const active = computed(() => (hover.value >= 0 ? hover.value : props.days.length - 1))
const max = computed(() => Math.max(1, ...props.days.map((d) => d.xp)))
const barHeight = (xp) => (xp > 0 ? `${Math.max(3, (xp / max.value) * 100)}%` : '2px')

const parse = (iso) => new Date(`${iso}T12:00:00Z`)
const shortDay = (iso) => parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const longDay = (iso) => parse(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const shown = computed(() => {
  const d = props.days[active.value]
  return { label: longDay(d.day), xp: d.xp, players: d.players, today: active.value === props.days.length - 1 }
})
</script>
