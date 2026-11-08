<template>
  <span v-if="method" class="gp-tip" tabindex="0" :aria-label="`${text} ${rateText}`">
    <slot />
    <span class="gp-tip-bubble" role="tooltip">
      <b>{{ method.name }}</b>
      <span>{{ text }}</span>
      <small>{{ rateText }}</small>
    </span>
  </span>
  <span v-else><slot /></span>
</template>

<script setup>
import { computed } from 'vue'
import { gpExplain } from '@/data/gpNotes'
import { formatGp, formatHours } from '@/utils/planner'

const props = defineProps({
  method: { type: Object, default: null },
  hours: { type: Number, default: null },
})

const text = computed(() => gpExplain(props.method))
const rateText = computed(() => {
  const m = props.method
  if (!m || m.gpPerHour == null) return ''
  const rate = `Net rate: ${formatGp(m.gpPerHour)} per hour`
  return props.hours != null ? `${rate} × ${formatHours(props.hours)} = ${formatGp(Math.round(m.gpPerHour * props.hours))}` : rate
})
</script>
