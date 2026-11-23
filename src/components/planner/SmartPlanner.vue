<template>
  <section id="ps-smart" class="spl" aria-labelledby="spl-h">
    <header class="spl-head">
      <span class="spl-spark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
      </span>
      <div class="spl-title">
        <span class="spl-eyebrow">Tailored to you</span>
        <h2 id="spl-h">Smart Planner</h2>
        <p>A step-by-step plan from your real levels. <b>Needs your RuneScape name.</b></p>
      </div>
      <button class="btn btn-primary spl-toggle" type="button" aria-haspopup="dialog" @click="openIt">Open Smart Planner</button>
    </header>

    <!-- The planner itself, in a large window over the page -->
    <Teleport to="body">
      <div v-if="open" class="modal-overlay" @click.self="close">
        <div class="modal-card spm" role="dialog" aria-modal="true" aria-labelledby="spm-h">
          <header class="spm-head">
            <span class="spl-spark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
            </span>
            <div class="spl-title">
              <span class="spl-eyebrow">Tailored to you</span>
              <h2 id="spm-h">Smart Planner</h2>
              <p>A few questions and your real levels make a step-by-step plan.</p>
            </div>
            <button ref="closeBtn" type="button" aria-label="Close" @click="close">✕</button>
          </header>
          <SmartPlannerBody :skills="skills" :has-player="hasPlayer" :player-label="playerLabel" @start="onStart" @ready-made="onReadyMade">
            <template #name-box><slot name="name-box" /></template>
          </SmartPlannerBody>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import SmartPlannerBody from '@/components/planner/SmartPlannerBody.vue'
import { track } from '@/utils/analytics'

// The introduction to the Smart Planner on the planner's start page, which opens the planner itself in a large window. The page stays as it
// always was; "Open Smart Planner" is the way in, and closing the window (or choosing a plan) goes back to it.
defineProps({
  skills: { type: Object, default: null },
  hasPlayer: { type: Boolean, default: false },
  playerLabel: { type: String, default: '' },
})
const emit = defineEmits(['start', 'ready-made'])

const open = ref(false)
const closeBtn = ref(null)
const onKey = (e) => e.key === 'Escape' && close()
watch(open, async (on) => {
  if (on) {
    document.addEventListener('keydown', onKey)
    await nextTick()
    closeBtn.value?.focus()
  } else document.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

function openIt() {
  open.value = true
  track('smart_planner_open')
}
function close() {
  open.value = false
}
function onStart(profile) {
  close()
  emit('start', profile)
}
function onReadyMade() {
  close()
  emit('ready-made')
}
</script>
