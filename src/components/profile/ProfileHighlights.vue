<template>
  <section v-if="events.length || before.length" class="hl">
    <header class="hl-head">
      <h2>Highlights</h2>
      <div class="hl-kinds" role="group" aria-label="Which moments to show">
        <button v-for="k in kinds" :key="k.key" type="button" :class="{ on: on.has(k.key) }" :aria-pressed="on.has(k.key)" @click="toggle(k.key)">{{ k.label }} <small>{{ counts[k.key] || 0 }}</small></button>
      </div>
    </header>

    <HistoryJourney v-if="points.length > 1" ref="chart" :points="points" :events="shown" :selected="selected" @select="(id) => (selected = selected === id ? '' : id)" />

    <!-- the mark you hover or pick -->
    <p v-if="current" class="hl-now" aria-live="polite">
      <img :src="skillIconSrc(current.skill)" alt="" width="20" height="20" />
      <b>{{ current.title }}</b>
      <span>{{ dateText(current) }}</span>
      <button v-if="current.kind === 'l99'" class="btn-text hl-share" type="button" @click="$emit('share99', current.skill)">Share</button>
    </p>
    <p v-else-if="points.length > 1" class="hl-hint">Hover or tap a mark to see what it was. The larger gold ones are level 99s.</p>

    <!-- every 99, newest first, each one shareable -->
    <div v-if="all99.length" class="hl-99">
      <h3>Level 99s <small>{{ all99.length }}</small></h3>
      <ul>
        <li v-for="n in all99" :key="n.id">
          <button class="hl-medal" type="button" :title="`Share ${n.skill} 99`" :aria-label="`Share ${n.skill} 99`" @click="$emit('share99', n.skill)">
            <img :src="skillIconSrc(n.skill)" alt="" width="16" height="16" />
            <span aria-hidden="true" />
          </button>
          <span class="hl-99-text"><b>{{ n.skill }}</b><small>{{ n.at ? dateText(n) : 'before tracking began' }}</small></span>
          <button class="btn-text hl-share" type="button" @click="$emit('share99', n.skill)">Share</button>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import HistoryJourney from '@/components/profile/HistoryJourney.vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { journeyPoints, HIGHLIGHT_KINDS } from '@/utils/historyHighlights'
import { gameDay, formatGameDay } from '@/utils/gameDay'

// The big moments of a character's whole history: a chart of total XP with each marked, and every level 99 with a way to share it.
const props = defineProps({
  snapshots: { type: Array, default: () => [] },
  events: { type: Array, default: () => [] }, // dated moments (newest first)
  before: { type: Array, default: () => [] }, // already reached when tracking began
})
defineEmits(['share99'])

const kinds = HIGHLIGHT_KINDS.filter((k) => k.key !== 'xp200m' || props.events.some((e) => e.kind === 'xp200m')).sort((a, b) => b.rank - a.rank)
const on = ref(new Set(HIGHLIGHT_KINDS.map((k) => k.key)))
const toggle = (key) => {
  const next = new Set(on.value)
  next.has(key) ? next.delete(key) : next.add(key)
  on.value = next
}
const counts = computed(() => {
  const c = {}
  for (const e of props.events) c[e.kind] = (c[e.kind] || 0) + 1
  return c
})
const points = computed(() => journeyPoints(props.snapshots))
const shown = computed(() => props.events.filter((e) => on.value.has(e.kind)))

const selected = ref('')
const chart = ref(null)
// What the line below the chart describes: the mark under the pointer, else the picked one.
const current = computed(() => chart.value?.active || props.events.find((e) => e.id === selected.value) || null)

const all99 = computed(() => [...props.events.filter((e) => e.kind === 'l99'), ...props.before.filter((b) => b.kind === 'l99')])

function dateText(n) {
  const f = (d) => formatGameDay(gameDay(d), { month: 'short', day: 'numeric', year: 'numeric' })
  return n.gap ? `sometime between ${formatGameDay(gameDay(n.after), { month: 'short', day: 'numeric' })} and ${f(n.at)}` : f(n.at)
}
</script>
