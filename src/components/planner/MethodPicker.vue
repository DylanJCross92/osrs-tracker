<template>
  <div ref="root" class="mpick" :class="{ open }">
    <button class="mpick-trigger" type="button" :aria-expanded="open" aria-haspopup="listbox" @click="open = !open" @keydown.esc="open = false">
      <span class="mpick-trigger-main">
        <b>{{ current.name }}</b>
        <small v-if="current.sub">{{ current.sub }}</small>
      </span>
      <span v-if="current.method" class="mpick-trigger-stats">
        <span>{{ formatNum(current.method.xpPerHour) }} xp/h</span>
        <span :class="gpClass(current.method.gpPerHour)">{{ gpText(current.method.gpPerHour) }}</span>
      </span>
      <span class="mpick-caret" aria-hidden="true">▾</span>
    </button>

    <div v-if="open" class="mpick-panel" role="listbox" @keydown.esc="open = false">
      <ul v-if="routes.length" class="mpick-routes">
        <li v-for="r in routes" :key="r.value">
          <button type="button" role="option" :aria-selected="modelValue === r.value" :class="{ active: modelValue === r.value }" @click="pick(r.value, true)">
            <b>{{ r.label }}</b><small v-if="r.sub">{{ r.sub }}</small>
          </button>
        </li>
      </ul>

      <div class="mpick-sortbar" role="group" aria-label="Sort methods">
        <span class="mpick-col-name">Method</span>
        <button v-for="c in columns" :key="c.key" type="button" :class="{ active: sortKey === c.key }" @click="setSort(c.key)">
          {{ c.label }}<i v-if="sortKey === c.key">{{ sortDir === 'desc' ? '↓' : '↑' }}</i>
        </button>
      </div>

      <ul class="mpick-list">
        <li v-for="m in sorted" :key="m.id">
          <button type="button" role="option" :aria-selected="modelValue === m.id" class="mpick-row" :class="{ active: modelValue === m.id }" @click="pick(m.id)">
            <span class="mpick-name">
              <b>{{ m.name }}</b>
              <span class="mpick-tags">
                <i v-if="m.id === fastestId" class="mpick-tag tag-xp">Fastest XP</i>
                <i v-if="m.id === topProfitId" class="mpick-tag tag-profit">Most profitable</i>
                <i v-else-if="m.gpPerHour > 0" class="mpick-tag tag-profit soft">Profitable</i>
                <i v-if="m.id === cheapestId && !(m.gpPerHour > 0)" class="mpick-tag tag-cheap">Cheapest per XP</i>
                <i v-if="avail(m).state === 'blocked'" class="mpick-tag tag-blocked" :title="`Missing: ${unmetText(avail(m))}`">Missing requirement</i>
              </span>
              <small v-if="avail(m).items.length" class="mpick-req">
                Needs
                <span v-for="(i, k) in avail(m).items" :key="i.req.id" class="mpick-req-item" :class="`is-${i.status}`">{{ i.req.label }}<template v-if="k < avail(m).items.length - 1">, </template></span>
              </small>
            </span>
            <span class="mpick-cell mpick-lvl"><small>Level</small>{{ m.minLevel }}{{ m.maxLevel != null ? `-${m.maxLevel}` : '+' }}</span>
            <span class="mpick-cell mpick-xp">
              <small>XP/hr</small>{{ formatNum(m.xpPerHour) }}
              <span class="mpick-bar"><span :style="{ width: `${(m.xpPerHour / maxXp) * 100}%` }" /></span>
            </span>
            <span class="mpick-cell mpick-gp" :class="gpClass(m.gpPerHour)">
              <small>GP/hr</small>{{ gpText(m.gpPerHour) }}
              <span v-if="m.gpPerHour != null" class="mpick-bar" :class="m.gpPerHour >= 0 ? 'pos' : 'neg'"><span :style="{ width: `${(Math.abs(m.gpPerHour) / maxGp) * 100}%` }" /></span>
            </span>
            <span class="mpick-cell mpick-int"><small>Effort</small>{{ m.intensity }}</span>
          </button>
        </li>
      </ul>

      <button v-if="allowCustom" type="button" role="option" class="mpick-custom" :class="{ active: modelValue === 'custom' }" @click="pick('custom')">Custom XP/hour…</button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatNum, formatGp } from '@/utils/planner'
import { methodAvailability, unmetText } from '@/utils/requirements'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'

// A readable replacement for the long method dropdown: every method in a table with XP/hr and GP/hr bars, sortable
// columns, and tags for the fastest, cheapest and most profitable options.
const props = defineProps({
  modelValue: { type: String, required: true },
  methods: { type: Array, required: true },
  // Route choices shown on top, for example Best route or Follow global: [{ value, label, sub }]
  routes: { type: Array, default: () => [] },
  allowCustom: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])

const reqCtx = inject(plannerRequirementContext, null)
const availCache = computed(() => new Map(props.methods.map((m) => [m.id, methodAvailability(m, reqCtx?.value || {})])))
const avail = (m) => availCache.value.get(m.id) || methodAvailability(m, {})
const open = ref(false)
const root = ref(null)
const sortKey = ref('level')
const sortDir = ref('asc')
const columns = [
  { key: 'level', label: 'Level' },
  { key: 'xp', label: 'XP/hr' },
  { key: 'gp', label: 'GP/hr' },
]

function setSort(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDir.value = key === 'level' ? 'asc' : 'desc'
  }
}

const valueOf = (m) => (sortKey.value === 'level' ? m.minLevel : sortKey.value === 'xp' ? m.xpPerHour : m.gpPerHour ?? -Infinity)
const sorted = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...props.methods].sort((a, b) => (valueOf(a) - valueOf(b)) * dir || a.minLevel - b.minLevel)
})

const maxXp = computed(() => Math.max(...props.methods.map((m) => m.xpPerHour), 1))
const maxGp = computed(() => Math.max(...props.methods.map((m) => Math.abs(m.gpPerHour ?? 0)), 1))
const fastestId = computed(() => props.methods.reduce((a, b) => (b.xpPerHour > (a?.xpPerHour ?? 0) ? b : a), null)?.id)
const topProfitId = computed(() => {
  const p = props.methods.filter((m) => m.gpPerHour != null && m.gpPerHour > 0)
  return p.length ? p.reduce((a, b) => (b.gpPerHour > a.gpPerHour ? b : a)).id : null
})
const cheapestId = computed(() => {
  const priced = props.methods.filter((m) => m.gpPerHour != null)
  return priced.length ? priced.reduce((a, b) => (b.gpPerHour / b.xpPerHour > a.gpPerHour / a.xpPerHour ? b : a)).id : null
})

const current = computed(() => {
  const m = props.methods.find((x) => x.id === props.modelValue)
  if (m) return { name: m.name, sub: '', method: m }
  const r = props.routes.find((x) => x.value === props.modelValue)
  if (r) return { name: r.label, sub: r.sub || '', method: null }
  if (props.modelValue === 'custom') return { name: 'Custom XP/hour', sub: '', method: null }
  return { name: 'Choose a method', sub: '', method: null }
})

const gpText = (gp) => (gp == null ? 'No GP data' : gp === 0 ? 'Break-even' : `${formatGp(gp)}/h`)
const gpClass = (gp) => (gp == null ? 'gp-none' : gp > 0 ? 'planner-gain' : gp < 0 ? 'planner-cost' : '')

// Switching between the route buttons at the top keeps the panel open, so you can flip through them. Picking an
// actual method closes it. Either way the page stays where it was while the results below re-render.
function pick(value, keepOpen = false) {
  const y = window.scrollY
  emit('update:modelValue', value)
  if (!keepOpen) open.value = false
  nextTick(() => {
    window.scrollTo(window.scrollX, y)
    requestAnimationFrame(() => window.scrollTo(window.scrollX, y))
  })
}

function onDoc(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('mousedown', onDoc))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDoc))
</script>
