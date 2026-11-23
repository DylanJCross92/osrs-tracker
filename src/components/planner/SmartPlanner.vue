<template>
  <section id="ps-smart" class="spl" :class="{ open }" aria-labelledby="spl-h">
    <header class="spl-head">
      <span class="spl-spark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
      </span>
      <div class="spl-title">
        <span class="spl-eyebrow">Tailored to you</span>
        <h2 id="spl-h">Smart Planner</h2>
        <p>Not sure what to work on? Answer a few questions and get a step-by-step plan.</p>
      </div>
      <button class="btn spl-toggle" :class="open ? 'btn-ghost' : 'btn-primary'" type="button" aria-controls="spl-panel" :aria-expanded="open" @click="toggle">{{ open ? 'Hide' : 'Open Smart Planner' }}</button>
    </header>

    <div v-if="open" id="spl-panel">
      <SmartPlannerBody :skills="skills" :has-player="hasPlayer" :player-label="playerLabel" @start="(profile) => $emit('start', profile)" @ready-made="$emit('ready-made')" />
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import SmartPlannerBody from '@/components/planner/SmartPlannerBody.vue'
import { track } from '@/utils/analytics'

// The introduction to the Smart Planner on the planner's start page. It starts folded away, so the page reads as it always has; "Open Smart
// Planner" unfolds the questions and the steps, and "Hide" folds them away again. The choice is remembered in this browser.
defineProps({
  skills: { type: Object, default: null },
  hasPlayer: { type: Boolean, default: false },
  playerLabel: { type: String, default: '' },
})
defineEmits(['start', 'ready-made'])

const KEY = 'tickgains-smart-planner-open'
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const open = ref(read())
function toggle() {
  open.value = !open.value
  try {
    localStorage.setItem(KEY, open.value ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
  track('smart_planner_toggle', { open: open.value })
}
</script>
