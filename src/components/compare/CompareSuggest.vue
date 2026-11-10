<template>
  <div class="cmp-suggest" role="listbox" :aria-label="heading" @mousedown.prevent>
    <template v-for="(o, i) in options" :key="o.username">
      <span v-if="i === 0 || !!o.recent !== !!options[i - 1].recent" class="cmp-suggest-head">{{ o.recent ? 'Recent' : heading }}</span>
      <div class="cmp-suggest-row">
        <button type="button" class="cmp-suggest-item" :class="{ active: i === active }" role="option" :aria-selected="i === active" @click="$emit('pick', o)" @mouseenter="$emit('hover', i)">
          <PlayerSuggestRow :player="o" />
        </button>
        <button v-if="o.recent" type="button" class="suggest-del" :aria-label="`Remove ${o.displayName} from recent players`" title="Remove" @click.stop.prevent="$emit('remove', o.username)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'

defineProps({
  options: { type: Array, required: true },
  heading: { type: String, default: '' },
  active: { type: Number, default: -1 },
})
defineEmits(['pick', 'hover', 'remove'])
</script>
