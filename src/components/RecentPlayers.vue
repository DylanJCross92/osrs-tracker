<template>
  <ul v-if="options.length" class="search-suggest recent-suggest" aria-label="Recent players" @mousedown.prevent>
    <li class="suggest-head">Recent</li>
    <li v-for="o in options" :key="o.username" class="suggest-recent">
      <a href="#" class="suggest-row" @click.prevent="$emit('pick', o)"><PlayerSuggestRow :player="o" /></a>
      <button type="button" class="suggest-del" :aria-label="`Remove ${o.displayName} from recent players`" title="Remove" @click.stop.prevent="remove(o.username)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </li>
  </ul>
</template>

<script setup>
import { onMounted } from 'vue'
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'
import { useRecentPlayers } from '@/composables/useRecentPlayers'

defineEmits(['pick'])
const { options, ensureLoaded, remove } = useRecentPlayers()
onMounted(ensureLoaded)
</script>
