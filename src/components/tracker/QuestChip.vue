<template>
  <button type="button" class="trk-chip" :class="{ done }" :aria-pressed="done" :title="done ? 'Marked done. Click to undo' : 'Click to mark this quest done'" @click="toggle">
    <span aria-hidden="true">{{ done ? '✓' : '○' }}</span> {{ name }}<small v-if="partial"> (started is enough)</small>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useRequirements } from '@/composables/useRequirements'
import { confirmationFor } from '@/utils/requirements'
import { questId } from '@/utils/questSlug'
import { track } from '@/utils/analytics'

// A quest name that can be ticked off where it is mentioned (a quest's needs, a diary tier's needs). It writes the same answer as the quest list.
const props = defineProps({ name: { type: String, required: true }, partial: { type: Boolean, default: false } })
const { confirmations, setAnswer } = useRequirements()
const id = computed(() => `${questId(props.name)}${props.partial ? ':partial' : ''}`)
const done = computed(() => confirmationFor({ id: id.value, kind: 'quest', partial: props.partial }, confirmations.value) === 'have')
function toggle() {
  setAnswer(id.value, done.value ? null : 'have')
  track('tracker_chip_toggled', { enabled: !done.value })
}
</script>
