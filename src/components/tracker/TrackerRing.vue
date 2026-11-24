<template>
  <div class="trk-ring">
    <svg viewBox="0 0 44 44" width="52" height="52" role="progressbar" :aria-valuenow="value" aria-valuemin="0" :aria-valuemax="total" :aria-label="label">
      <circle class="trk-ring-bg" cx="22" cy="22" r="18" />
      <circle class="trk-ring-fg" cx="22" cy="22" r="18" :stroke-dasharray="`${arc} ${C}`" transform="rotate(-90 22 22)" />
    </svg>
    <div>
      <span class="trk-ring-label">{{ label }}</span>
      <span class="trk-ring-num"><b>{{ value }}</b> of {{ total }}</span>
      <small v-if="sub">{{ sub }}</small>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ value: { type: Number, default: 0 }, total: { type: Number, default: 1 }, label: { type: String, required: true }, sub: { type: String, default: '' } })
const C = 2 * Math.PI * 18
const arc = computed(() => (props.total ? Math.min(props.value / props.total, 1) * C : 0))
</script>
