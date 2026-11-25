<template>
  <i v-if="show" class="new-pill" title="Added this week">New</i>
</template>

<script setup>
import { computed } from 'vue'
import { isNewContent } from '@/data/newContent'

// A small gold "New" next to a quest or training method that was added in the last 7 days (see data/newContent.js).
const props = defineProps({ id: { type: String, default: '' } })
const show = computed(() => isNewContent(props.id))
</script>
