<template>
  <div class="cmp-suggest" role="listbox" :aria-label="heading || 'Players'" @mousedown.prevent>
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
    <!-- A name that is not tracked yet, offered for tracking right here like in the search box -->
    <div v-if="newName" class="cmp-suggest-new">
      <span class="sg-avatar sg-avatar-new" aria-hidden="true">+</span>
      <span class="sg-main"><span class="sg-name">{{ newName }}</span><small class="sg-sub" :class="{ 'suggest-new-error': error }">{{ error || 'Not tracked yet' }}</small></span>
      <button v-if="!error" class="disc-track-btn" type="button" :disabled="adding" @click="$emit('track')">{{ adding ? 'Adding…' : 'Track' }}</button>
    </div>
  </div>
</template>

<script setup>
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'

defineProps({
  options: { type: Array, required: true },
  heading: { type: String, default: '' },
  active: { type: Number, default: -1 },
  // A typed name that is not tracked yet (empty when there is none), with the state of adding it.
  newName: { type: String, default: '' },
  adding: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
defineEmits(['pick', 'hover', 'remove', 'track'])
</script>
