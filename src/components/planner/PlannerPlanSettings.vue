<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="done">
      <div class="modal-card ps-settings" role="dialog" aria-modal="true" aria-labelledby="pset-h">
        <div class="share-modal-header">
          <h2 id="pset-h">Plan settings</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="done">✕</button>
        </div>

        <label class="pset-field">
          <span>Plan name</span>
          <input v-model="draftName" type="text" maxlength="60" autocomplete="off" data-1p-ignore data-lpignore="true" @keydown.enter.prevent="done" />
        </label>

        <div v-if="$slots.player" class="pset-field">
          <span>Player</span>
          <slot name="player" />
        </div>

        <div class="pset-field">
          <span>Strategy for every skill</span>
          <div class="pset-strategies" role="radiogroup" aria-label="Training strategy">
            <button v-for="s in strategies" :key="s.value" type="button" role="radio" :aria-checked="strategy === s.value" :class="{ on: strategy === s.value }" @click="$emit('update:strategy', s.value)">
              <b>{{ s.label }}</b>
              <small>{{ s.hint }}</small>
            </button>
          </div>
        </div>

        <div class="pset-field">
          <span>Hours played per day</span>
          <div class="pset-hours">
            <div class="pset-read"><b>{{ hoursPerDay }}</b> hour{{ hoursPerDay === 1 ? '' : 's' }} a day</div>
            <div class="pset-range">
              <button type="button" aria-label="Half an hour less" :disabled="hoursPerDay <= minHours" @click="$emit('update:hours', hoursPerDay - 0.5)">−</button>
              <input type="range" min="0.5" max="12" step="0.5" :value="Math.min(hoursPerDay, 12)" :style="{ '--fill': fill + '%' }" aria-label="Hours played per day" @input="$emit('update:hours', Number($event.target.value))" />
              <button type="button" aria-label="Half an hour more" :disabled="hoursPerDay >= maxHours" @click="$emit('update:hours', hoursPerDay + 0.5)">+</button>
            </div>
          </div>
        </div>

        <div class="pset-actions">
          <button class="btn btn-primary" type="button" @click="done">Done</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// The settings that belong to the whole plan, not one skill: its name, the strategy, how long you play, and who it is for.
const props = defineProps({
  name: { type: String, default: '' },
  strategy: { type: String, required: true },
  strategies: { type: Array, required: true },
  hoursPerDay: { type: Number, required: true },
  minHours: { type: Number, default: 0.5 },
  maxHours: { type: Number, default: 24 },
})
const emit = defineEmits(['update:strategy', 'update:hours', 'close'])
// How far along the slider is (0.5 to 12 hours), to colour the track up to the handle.
const fill = computed(() => ((Math.min(Math.max(props.hoursPerDay, 0.5), 12) - 0.5) / 11.5) * 100)
const draftName = ref(props.name)
function done() {
  emit('close', draftName.value.trim())
}
const onKey = (e) => e.key === 'Escape' && done()
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
