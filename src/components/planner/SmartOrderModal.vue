<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card so" role="dialog" aria-modal="true" aria-labelledby="so-h" aria-describedby="so-d">
        <div class="share-modal-header">
          <h2 id="so-h">Suggested training order</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        </div>
        <p id="so-d" class="so-intro">Worked out from your levels and what each skill does for the others. Every skill takes the same time as before; only the order changes.</p>
        <p v-if="!suggestion.changed" class="so-fits" role="status">Your order already fits. Nothing to change.</p>
        <ol class="so-list">
          <li v-for="(skill, i) in suggestion.order" :key="skill">
            <span class="so-n" aria-hidden="true">{{ i + 1 }}</span>
            <img :src="skillIconSrc(skill)" alt="" width="26" height="26" />
            <div class="so-main">
              <b>{{ skill }}<em v-if="levels[skill]">{{ levels[skill] }}</em><small v-if="moved(skill)" :class="moved(skill) > 0 ? 'up' : 'down'">{{ moved(skill) > 0 ? `up ${moved(skill)}` : `down ${-moved(skill)}` }}</small></b>
              <span v-for="r in suggestion.reasons[skill] || []" :key="r">{{ r }}</span>
            </div>
          </li>
        </ol>
        <div class="save-plan-actions">
          <button class="btn btn-ghost" type="button" @click="$emit('close')">Keep mine</button>
          <button ref="useBtn" class="btn btn-primary" type="button" :disabled="!suggestion.changed" @click="$emit('apply', suggestion.order)">Use this order</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { levelAtXp } from '@/utils/planner'

// The suggestion from utils/smartOrder.js: the order with a reason for each skill, and a button to use it. `goals` is the order now, so
// each skill can show how far it moves.
const props = defineProps({ suggestion: { type: Object, required: true }, goals: { type: Array, required: true } })
const emit = defineEmits(['close', 'apply'])
const useBtn = ref(null)

const levels = computed(() => Object.fromEntries(props.goals.map((g) => [g.skill, `${levelAtXp(g.currentXp, true)} → ${levelAtXp(g.targetXp, true)}`])))
const moved = (skill) => props.goals.findIndex((g) => g.skill === skill) - props.suggestion.order.indexOf(skill)

const onKey = (e) => {
  if (e.key === 'Escape') emit('close')
}
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  await nextTick()
  useBtn.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
