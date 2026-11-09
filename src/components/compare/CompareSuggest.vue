<template>
  <div class="cmp-suggest" role="listbox" :aria-label="heading" @mousedown.prevent>
    <span class="cmp-suggest-head">{{ heading }}</span>
    <button v-for="(o, i) in options" :key="o.username" type="button" class="cmp-suggest-item" :class="{ active: i === active }" role="option" :aria-selected="i === active" @click="$emit('pick', o)" @mouseenter="$emit('hover', i)">
      <PlayerSuggestRow :player="o" />
    </button>
  </div>
</template>

<script setup>
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'

defineProps({
  options: { type: Array, required: true },
  heading: { type: String, default: '' },
  active: { type: Number, default: -1 },
})
defineEmits(['pick', 'hover'])
</script>
