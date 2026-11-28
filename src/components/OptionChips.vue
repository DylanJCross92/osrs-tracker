<template>
  <div class="oc">
    <div class="oc-row" role="radiogroup" :aria-label="label">
      <button v-for="o in options" :key="String(o.value)" type="button" role="radio" class="oc-chip" :class="{ on: o.value === modelValue }" :aria-checked="o.value === modelValue" :title="o.hint" @click="$emit('update:modelValue', o.value)">
        <img v-if="o.icon" :src="o.icon" alt="" width="20" height="20" />
        <svg v-else-if="o.svg === 'afk'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9h11v5a4 4 0 01-4 4H9a4 4 0 01-4-4V9zM16 11h1.5a2 2 0 010 4H16M8 4v2M12 4v2" /></svg>
        <svg v-else-if="o.svg === 'balance'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 005 0L5 8zM19 8l-2.5 6a3 3 0 005 0L19 8z" /></svg>
        <span>{{ o.label }}</span>
      </button>
    </div>
    <!-- What the chosen one means, in a line -->
    <small v-if="chosen?.hint && !hideHint" class="oc-hint">{{ chosen.hint }}</small>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// A small group of choices as compact chips, each with its icon, and a line under them for what the chosen one means.
// options: [{ value, label, icon (an image address), svg ('balance' for the one OSRS has no icon for), hint }]
const props = defineProps({ modelValue: { type: [String, Number, Boolean], default: null }, options: { type: Array, required: true }, label: { type: String, default: '' }, hideHint: { type: Boolean, default: false } })
defineEmits(['update:modelValue'])
const chosen = computed(() => props.options.find((o) => o.value === props.modelValue))
</script>
