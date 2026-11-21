<template>
  <button type="button" class="wb" :class="{ on: watching }" :aria-pressed="watching" :title="watching ? 'Stop watching this item' : 'Watch this item: it shows on your dashboard and on the GE Prices page'" @click="onClick">
    <svg viewBox="0 0 24 24" width="16" height="16" :fill="watching ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z" /></svg>
    {{ watching ? 'Watching' : 'Watch' }}
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { MAX_WATCH, useWatchlist } from '@/composables/useWatchlist'

// Starts or stops watching one Grand Exchange item (see composables/useWatchlist.js).
const props = defineProps({ slug: { type: String, required: true }, name: { type: String, default: '' }, source: { type: String, default: 'item' } })
const { isWatching, toggle, slugs } = useWatchlist()
const { loggedIn } = useAuth()
const { showToast } = useToast()
const watching = computed(() => isWatching(props.slug))

function onClick() {
  const was = watching.value
  if (!was && slugs.value.length >= MAX_WATCH) return showToast(`You can watch up to ${MAX_WATCH} items. Stop watching one first.`)
  const now = toggle(props.slug, props.source)
  if (now) showToast(loggedIn.value ? `Watching ${props.name || 'this item'}` : `Watching ${props.name || 'this item'}. Log in to keep your list on every device.`)
  else if (was) showToast(`Stopped watching ${props.name || 'this item'}`)
}
</script>
