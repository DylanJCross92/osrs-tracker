<template>
  <div class="start-card start-smart" @click="openIt">
    <span class="start-top" aria-hidden="true">
      <span class="start-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
      </span>
      <span class="start-art"><img v-for="s in ART" :key="s" :src="skillIconSrc(s)" alt="" width="24" height="24" /></span>
    </span>
    <span class="start-eyebrow">Not sure what to do?</span>
    <h3>Smart Planner</h3>
    <p>Answer a few questions and get a step-by-step plan from your real levels.</p>
    <div class="start-foot">
      <button class="btn btn-primary" type="button" aria-haspopup="dialog" @click.stop="openIt">Open Smart Planner</button>
    </div>

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
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import SmartPlannerBody from '@/components/planner/SmartPlannerBody.vue'
import { track } from '@/utils/analytics'
import { skillIconSrc } from '@/utils/osrsSkills'

const ART = ['Runecraft', 'Magic', 'Construction', 'Slayer']

// The Smart Planner's card among the planner's three ways to start. "Open Smart Planner" opens the planner itself in a large window; closing
// the window (or choosing a plan) goes back to the page.
defineProps({
  skills: { type: Object, default: null },
  hasPlayer: { type: Boolean, default: false },
  playerLabel: { type: String, default: '' },
})
const emit = defineEmits(['start', 'ready-made', 'open-change'])

const open = ref(false)
const closeBtn = ref(null)
const onKey = (e) => e.key === 'Escape' && close()
watch(open, async (on) => {
  emit('open-change', on)
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
