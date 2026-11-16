<template>
  <div ref="root" class="plan-head">
    <div class="ph-top">
      <div class="ph-controls">
        <div class="ph-strategy" role="group" aria-label="Training strategy for all goals">
          <span class="ph-label">Strategy</span>
          <div class="range-tabs">
            <button v-for="s in strategies" :key="s.value" type="button" :class="{ active: strategy === s.value }" :aria-pressed="strategy === s.value" :title="s.hint" @click="$emit('update:strategy', s.value)">{{ s.label }}</button>
          </div>
        </div>

        <!-- Hours played per day: pick a common number or slide to any half hour -->
        <div ref="hoursEl" class="ph-hours">
          <span class="ph-label">Play</span>
          <button class="ph-hours-btn" type="button" aria-haspopup="dialog" :aria-expanded="hoursOpen" :title="'Hours played per day'" @click="hoursOpen = !hoursOpen">
            <b>{{ hoursPerDay }} h/day</b>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div v-if="hoursOpen" class="ph-hours-pop" role="dialog" aria-label="Hours played per day">
            <p class="ph-hours-title">Hours played per day</p>
            <div class="ph-hours-presets">
              <button v-for="h in presets" :key="h" type="button" :class="{ active: hoursPerDay === h }" :aria-pressed="hoursPerDay === h" @click="$emit('update:hours', h)">{{ h }}h</button>
            </div>
            <input class="ph-hours-slider" type="range" min="0.5" max="12" step="0.5" :value="Math.min(hoursPerDay, 12)" aria-label="Daily playtime in hours" @input="$emit('update:hours', Number($event.target.value))" />
            <div class="ph-hours-step">
              <button type="button" aria-label="Half an hour less" :disabled="hoursPerDay <= minHours" @click="$emit('update:hours', hoursPerDay - 0.5)">−</button>
              <input type="number" inputmode="decimal" step="0.5" :min="minHours" :max="maxHours" :value="hoursPerDay" aria-label="Hours played per day" @change="onTyped" />
              <span>h</span>
              <button type="button" aria-label="Half an hour more" :disabled="hoursPerDay >= maxHours" @click="$emit('update:hours', hoursPerDay + 0.5)">+</button>
            </div>
          </div>
        </div>
      </div>
      <div class="ph-plan"><slot /></div>
    </div>

    <nav class="ph-tabs" role="tablist" aria-label="Plan sections">
      <button v-for="t in tabs" :key="t.key" type="button" role="tab" :id="`plan-tab-${t.key}`" :aria-selected="tab === t.key" :aria-controls="`plan-panel-${t.key}`" :class="{ active: tab === t.key }" @click="$emit('update:tab', t.key)">
        {{ t.label }}<i v-if="t.count != null">{{ t.count }}</i>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  tab: { type: String, required: true },
  tabs: { type: Array, required: true },
  strategy: { type: String, required: true },
  strategies: { type: Array, required: true },
  hoursPerDay: { type: Number, required: true },
  minHours: { type: Number, default: 0.5 },
  maxHours: { type: Number, default: 24 },
  presets: { type: Array, default: () => [1, 2, 3, 4, 6, 8] },
})
const emit = defineEmits(['update:tab', 'update:strategy', 'update:hours'])

async function onTyped(e) {
  const raw = e.target.value
  if (raw !== '') emit('update:hours', Number(raw))
  // Snap the box back to the value the page ends up with (blank and out-of-range entries are corrected by the parent).
  await nextTick()
  e.target.value = props.hoursPerDay
}

// The header sticks under the site header; panels scroll into place below both (see --plan-offset).
const root = ref(null)
const hoursEl = ref(null)
const hoursOpen = ref(false)
const onDoc = (e) => {
  if (hoursOpen.value && hoursEl.value && !hoursEl.value.contains(e.target)) hoursOpen.value = false
}
const onKey = (e) => e.key === 'Escape' && hoursOpen.value && (hoursOpen.value = false)
function applyOffsets() {
  const top = document.querySelector('.app-topbar')?.offsetHeight || 0
  const desktop = window.matchMedia('(min-width: 900px)').matches
  const own = desktop ? root.value?.offsetHeight || 0 : root.value?.querySelector('.ph-tabs')?.offsetHeight || 0
  const style = document.documentElement.style
  style.setProperty('--topbar-h', `${top}px`)
  style.setProperty('--plan-offset', `${top + own + 12}px`)
}
let ro = null
onMounted(() => {
  document.addEventListener('mousedown', onDoc)
  document.addEventListener('keydown', onKey)
  applyOffsets()
  window.addEventListener('resize', applyOffsets)
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(applyOffsets)
    ro.observe(root.value)
    const topbar = document.querySelector('.app-topbar')
    if (topbar) ro.observe(topbar)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDoc)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', applyOffsets)
  ro?.disconnect()
  document.documentElement.style.removeProperty('--plan-offset')
})
</script>
