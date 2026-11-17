<template>
  <ul v-if="items.length" class="sbars">
    <li v-for="it in items" :key="it.key || it.label">
      <span class="sbars-name" :title="it.label">{{ it.label }}</span>
      <span class="sbars-track"><i :style="{ width: `${Math.max(it.value ? 2 : 0, (it.value / max) * 100)}%`, background: it.color || color }" /></span>
      <b>{{ format(it.value) }}</b>
      <small v-if="it.sub">{{ it.sub }}</small>
    </li>
  </ul>
  <p v-else class="st-empty">{{ emptyText }}</p>
</template>

<script setup>
import { computed } from 'vue'
import { fmt } from './statsFormat'

const props = defineProps({
  // [{ label, value, sub?, color?, key? }], already in the order to show
  items: { type: Array, required: true },
  color: { type: String, default: 'var(--st-b)' },
  format: { type: Function, default: fmt },
  emptyText: { type: String, default: 'Nothing recorded in this time yet.' },
})
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
</script>
