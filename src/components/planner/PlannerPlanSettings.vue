<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="cancel">
      <div class="modal-card ps-settings" role="dialog" aria-modal="true" aria-labelledby="pset-h">
        <div class="share-modal-header">
          <h2 id="pset-h">Plan settings</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="cancel">✕</button>
        </div>

        <label class="pset-field">
          <span>Plan name</span>
          <input v-model="draftName" type="text" maxlength="60" autocomplete="off" data-1p-ignore data-lpignore="true" @keydown.enter.prevent="save" />
        </label>

        <div v-if="$slots.player" class="pset-field">
          <span>Player</span>
          <slot name="player" />
        </div>

        <div class="pset-field">
          <span>Strategy for every skill</span>
          <div class="pset-strategies" role="radiogroup" aria-label="Training strategy">
            <button v-for="s in strategies" :key="s.value" type="button" role="radio" :aria-checked="draftStrategy === s.value" :class="{ on: draftStrategy === s.value }" @click="draftStrategy = s.value">
              <b>{{ s.label }}</b>
              <small>{{ s.hint }}</small>
            </button>
          </div>
        </div>

        <div class="pset-field">
          <span>Hours played per day</span>
          <div class="pset-hours">
            <div class="pset-read"><b>{{ draftHours }}</b> hour{{ draftHours === 1 ? '' : 's' }} a day</div>
            <div class="pset-range">
              <button type="button" aria-label="Half an hour less" :disabled="draftHours <= minHours" @click="setHours(draftHours - 0.5)">−</button>
              <input type="range" min="0.5" max="12" step="0.5" :value="Math.min(draftHours, 12)" :style="{ '--fill': fill + '%' }" aria-label="Hours played per day" @input="setHours(Number($event.target.value))" />
              <button type="button" aria-label="Half an hour more" :disabled="draftHours >= maxHours" @click="setHours(draftHours + 0.5)">+</button>
            </div>
          </div>
        </div>

        <div class="save-plan-actions">
          <button class="btn btn-ghost" type="button" @click="cancel">Cancel</button>
          <button class="btn btn-primary" type="button" @click="save">Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// The settings that belong to the whole plan, not one skill: its name, the strategy, how long you play, and who it is for.
// Name, strategy and hours are edited as a draft and only reach the plan when Save is pressed; closing the window throws them away.
const props = defineProps({
  name: { type: String, default: '' },
  strategy: { type: String, required: true },
  strategies: { type: Array, required: true },
  hoursPerDay: { type: Number, required: true },
  minHours: { type: Number, default: 0.5 },
  maxHours: { type: Number, default: 24 },
})
const emit = defineEmits(['save', 'close'])
const draftName = ref(props.name)
const draftStrategy = ref(props.strategy)
const draftHours = ref(props.hoursPerDay)
function setHours(v) {
  if (!Number.isFinite(v)) return
  draftHours.value = Math.min(props.maxHours, Math.max(props.minHours, Math.round(v * 2) / 2))
}
// How far along the slider is (0.5 to 12 hours), to colour the track up to the handle.
const fill = computed(() => ((Math.min(Math.max(draftHours.value, 0.5), 12) - 0.5) / 11.5) * 100)
function save() {
  emit('save', { name: draftName.value.trim(), strategy: draftStrategy.value, hours: draftHours.value })
}
function cancel() {
  emit('close')
}
const onKey = (e) => e.key === 'Escape' && cancel()
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
