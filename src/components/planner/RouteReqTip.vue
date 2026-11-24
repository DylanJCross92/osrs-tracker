<template>
  <span ref="root" class="route-req rqt" :class="[`is-${flag.state}`, { 'is-open': open }]" role="img" :aria-label="flag.text" @mouseenter="show" @mouseleave="open = false">
    {{ flag.state === 'blocked' ? '⚠' : '?' }}
    <span ref="bubble" class="rqt-bubble" :style="place" role="tooltip">
      <b>{{ flag.state === 'blocked' ? 'You are missing something' : 'Check before you start' }}</b>
      <span class="rqt-lead">{{ lead }}</span>
      <ul>
        <li v-for="i in listed" :key="i.req.id" :class="`is-${i.status}`">
          <i aria-hidden="true">{{ ICONS[i.status] }}</i>
          <span>{{ i.req.label }}<small v-if="i.req.quests?.length"> from {{ i.req.quests.map((q) => q.label).join(' and ') }}</small></span>
          <small class="rqt-state">{{ STATES[i.status] }}</small>
        </li>
      </ul>
      <small v-if="more">and {{ more }} more</small>
      <small class="rqt-hint">Answer these in the requirements list, or tick the quests in the quest tracker.</small>
    </span>
  </span>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { MET, UNMET, UNKNOWN, PLANNED } from '@/utils/requirements'

// The marker next to a step in a route whose method has something open to check. Hover (or focus) opens a short note naming what, in the site's own
// style instead of the browser's plain tooltip. flag: { state, text, method, items } from routeFlag().
const props = defineProps({ flag: { type: Object, required: true } })
const ICONS = { [MET]: '✓', [UNMET]: '✗', [UNKNOWN]: '?', [PLANNED]: '↗' }
const STATES = { [MET]: 'met', [UNMET]: 'missing', [UNKNOWN]: 'not confirmed', [PLANNED]: 'your plan trains it' }
const MAX = 4

// The note is placed against the window (not inside the row), so a modal or a scrolling list never cuts it off: below the marker, or above it when
// there is no room below, and kept inside the window sideways.
const root = ref(null)
const bubble = ref(null)
const open = ref(false)
const place = ref({})
async function show() {
  open.value = true
  place.value = { visibility: 'hidden' }
  await nextTick()
  const r = root.value?.getBoundingClientRect()
  const b = bubble.value?.getBoundingClientRect()
  if (!r || !b) return
  const room = window.innerHeight - r.bottom
  const up = room < b.height + 16 && r.top > b.height + 16
  const left = Math.min(Math.max(8, r.left - 6), window.innerWidth - b.width - 8)
  place.value = up ? { left: `${left}px`, bottom: `${window.innerHeight - r.top + 8}px`, top: 'auto' } : { left: `${left}px`, top: `${r.bottom + 8}px` }
}
const listed = computed(() => props.flag.items.slice(0, MAX))
const more = computed(() => Math.max(props.flag.items.length - MAX, 0))
const lead = computed(() => (props.flag.state === 'blocked' ? `${props.flag.method} cannot be used yet:` : `${props.flag.method} needs these, and TickGains cannot see them from the hiscores:`))
</script>
