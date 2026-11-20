<template>
  <section class="st-card jf" aria-labelledby="jf-title">
    <div class="st-card-head"><h2 id="jf-title">User flow</h2><span class="st-hint">The parts of the site people went through, in order</span></div>
    <p v-if="!flow.people" class="st-empty">No page paths are recorded for these people yet.</p>
    <template v-else>
      <div ref="box" class="jf-box">
        <svg class="jf-svg" :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height" role="group" aria-label="Flow of people through the site. Choose a box to see who was there.">
          <g aria-hidden="true">
            <text v-for="c in columns" :key="c.col" class="jf-colhead" :x="c.x" y="12" :text-anchor="c.anchor">{{ c.label }}</text>
          </g>
          <g :transform="`translate(0, ${HEAD})`">
            <path v-for="l in laid.links" :key="l.id" class="jf-link" :class="linkClass(l)" :d="l.d" :stroke-width="l.w" fill="none">
              <title>{{ linkTitle(l) }}</title>
            </path>
            <g
              v-for="n in laid.nodes"
              :key="n.id"
              class="jf-node"
              :class="{ 'is-left': n.left, 'is-on': n.id === selectedId }"
              role="button"
              tabindex="0"
              :aria-pressed="n.id === selectedId"
              :aria-label="nodeTitle(n)"
              @click="select(n)"
              @keydown.enter.prevent="select(n)"
              @keydown.space.prevent="select(n)"
            >
              <title>{{ nodeTitle(n) }}</title>
              <rect :x="n.x" :y="n.y" :width="n.w" :height="n.h" rx="3" />
              <rect class="jf-hit" :x="n.x - 4" :y="n.y" :width="n.w + 8" :height="n.h" />
              <text v-if="n.h >= labelMin" class="jf-label" :x="labelX(n)" :y="n.y + n.h / 2" :text-anchor="n.col === lastCol ? 'end' : 'start'" dominant-baseline="middle">
                <tspan class="jf-label-name" :x="labelX(n)" :dy="n.h >= 34 ? '-0.55em' : '0'">{{ n.left ? 'Left' : n.label }}<tspan v-if="n.h < 34" class="jf-label-num"> {{ fmt(n.count) }}</tspan></tspan>
                <tspan v-if="n.h >= 34" class="jf-label-num" :x="labelX(n)" dy="1.25em">{{ fmt(n.count) }} · {{ pctText(n.pct) }}</tspan>
              </text>
            </g>
          </g>
        </svg>
      </div>

      <div v-if="selected" class="jf-detail" aria-live="polite">
        <div class="jf-detail-head">
          <h3>{{ selected.left ? `Left the site after ${selected.col} ${selected.col === 1 ? 'part' : 'parts'}` : `${selected.label}, ${ordinal(selected.col + 1)} part` }}</h3>
          <button type="button" class="jf-close" aria-label="Close details" @click="selectedId = ''">×</button>
        </div>
        <p class="jf-facts">
          <b>{{ fmt(selected.count) }} {{ selected.count === 1 ? 'person' : 'people' }}</b> ({{ pctText(selected.pct) }} of {{ fmt(flow.people) }}).
          <template v-if="selected.medianLabel">Typically {{ selected.medianLabel }} after the step before.</template>
        </p>
        <div class="jf-cols2">
          <div v-if="comingFrom.length">
            <h4 class="so-sub">Came from</h4>
            <ul class="jf-moves"><li v-for="m in comingFrom" :key="m.id"><span>{{ m.label }}</span><b>{{ fmt(m.count) }}</b><small>{{ pctText(m.share) }}</small></li></ul>
          </div>
          <div v-if="goingTo.length">
            <h4 class="so-sub">Went on to</h4>
            <ul class="jf-moves"><li v-for="m in goingTo" :key="m.id"><span>{{ m.label }}</span><b>{{ fmt(m.count) }}</b><small>{{ pctText(m.share) }}</small><em>{{ m.medianLabel ? `typ. ${m.medianLabel}` : '' }}</em></li></ul>
          </div>
        </div>
        <h4 class="so-sub">Open one of them</h4>
        <ul class="jf-people">
          <li v-for="p in selected.people" :key="p.key"><button type="button" class="jf-person" @click="$emit('open', p.key)">{{ p.label }} <span aria-hidden="true">→</span></button></li>
        </ul>
        <p v-if="selected.count > selected.people.length" class="st-note">Showing the {{ selected.people.length }} most recently active of {{ fmt(selected.count) }}.</p>
      </div>
      <p v-else class="st-note jf-hint">Choose a box to see who was there, where they came from and where they went next.</p>

      <p class="st-note">
        Each person is counted once in each column. Ribbon thickness is the number of people who took that path, so a branch is a path some people took and others did not.
        {{ fmt(flow.people) }} of {{ fmt(totalPeople) }} people have a page recorded<template v-if="flow.noPath">; the other {{ fmt(flow.noPath) }} only did things on the page they arrived on, which older visits did not record, so they are not drawn</template>.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fmt } from './statsFormat'
import { layoutFlow } from './flowLayout'

const props = defineProps({
  flow: { type: Object, required: true },
  totalPeople: { type: Number, default: 0 },
})
defineEmits(['open'])

const HEAD = 22
const box = ref(null)
const boxWidth = ref(640)
let observer = null
onMounted(() => {
  const measure = () => {
    if (box.value) boxWidth.value = Math.max(300, Math.floor(box.value.clientWidth))
  }
  measure()
  if (typeof ResizeObserver !== 'undefined' && box.value) {
    observer = new ResizeObserver(measure)
    observer.observe(box.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())

const width = computed(() => boxWidth.value)
const narrow = computed(() => width.value < 520)
const plotHeight = computed(() => (narrow.value ? 300 : 340))
const laid = computed(() => layoutFlow(props.flow, { width: width.value, height: plotHeight.value, nodeWidth: narrow.value ? 8 : 12, gap: narrow.value ? 8 : 12 }))
const height = computed(() => laid.value.height + HEAD + 8)
// On a phone the columns are close together, so only the tall boxes carry a name.
const labelMin = computed(() => (narrow.value ? 26 : 18))
const lastCol = computed(() => (laid.value.nodes.length ? Math.max(...laid.value.nodes.map((n) => n.col)) : 0))
const columns = computed(() =>
  Array.from({ length: lastCol.value + 1 }, (_, col) => {
    const node = laid.value.nodes.find((n) => n.col === col)
    const last = col === lastCol.value
    return { col, label: col === 0 ? 'Starts on' : `Part ${col + 1}`, x: last ? (node?.x ?? 0) + (node?.w ?? 0) : (node?.x ?? 0), anchor: last ? 'end' : 'start' }
  }),
)
const labelX = (n) => (n.col === lastCol.value ? n.x - 7 : n.x + n.w + 7)

const selectedId = ref('')
const nodeById = computed(() => new Map(props.flow.nodes.map((n) => [n.id, n])))
const selected = computed(() => nodeById.value.get(selectedId.value) || null)
const select = (n) => {
  selectedId.value = selectedId.value === n.id ? '' : n.id
}
const ordinal = (n) => ['', '1st', '2nd', '3rd'][n] || `${n}th`
const pctText = (p) => (p == null ? '-' : `${Number.isInteger(p) ? p : p.toFixed(1)}%`)

const nameOf = (id) => {
  const n = nodeById.value.get(id)
  return n ? (n.left ? 'Left the site' : n.label) : id
}
const nodeTitle = (n) => `${n.left ? 'Left the site' : n.label}: ${fmt(n.count)} people (${pctText(n.pct)})${n.medianLabel ? `, typically ${n.medianLabel} after the step before` : ''}`
const linkTitle = (l) => `${nameOf(l.from)} to ${nameOf(l.to)}: ${fmt(l.count)} people (${pctText(l.pct)})${l.medianLabel ? `, typically ${l.medianLabel}` : ''}`
const linkClass = (l) => ({
  'is-left': nodeById.value.get(l.to)?.left,
  'is-on': selectedId.value && (l.from === selectedId.value || l.to === selectedId.value),
  'is-dim': selectedId.value && l.from !== selectedId.value && l.to !== selectedId.value,
})
const moves = (list, key, other) => list.map((l) => ({ id: l.id, label: nameOf(l[other]), count: l.count, share: selected.value.count ? Math.round((l.count / selected.value.count) * 1000) / 10 : null, medianLabel: l.medianLabel })).sort((a, b) => b.count - a.count)
const goingTo = computed(() => (selected.value ? moves(props.flow.links.filter((l) => l.from === selectedId.value), 'from', 'to') : []))
const comingFrom = computed(() => (selected.value ? moves(props.flow.links.filter((l) => l.to === selectedId.value), 'to', 'from') : []))
</script>
