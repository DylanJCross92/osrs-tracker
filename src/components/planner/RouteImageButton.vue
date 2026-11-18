<template>
  <button class="btn btn-ghost route-share-btn" type="button" :disabled="!segments.length" aria-haspopup="dialog" @click="open = true"><ShareIcon name="share" />Share route</button>
  <ShareRouteModal v-if="open" v-bind="$props" @close="open = false" />
</template>

<script setup>
import { ref } from 'vue'
import ShareIcon from '@/components/ShareIcon.vue'
import ShareRouteModal from '@/components/planner/ShareRouteModal.vue'

// The "Share route" button: opens the sharing window for a route. Used by the skill calculators and the Account Planner goal cards.
defineProps({
  skill: { type: String, required: true },
  startLevel: { type: Number, required: true },
  endLevel: { type: Number, required: true },
  segments: { type: Array, required: true },
  hours: { type: Number, default: null },
  netGp: { type: Number, default: null },
  label: { type: String, default: 'Fastest route' },
  url: { type: String, default: '' },
})
const open = ref(false)
</script>
