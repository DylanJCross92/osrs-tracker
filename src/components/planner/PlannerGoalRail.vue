<template>
  <div class="gr" :class="[`cat-${entry.category}`, { done: entry.done }]">
    <span class="gr-node" :title="entry.done ? 'Already reached' : `Trained number ${index + 1}`">{{ entry.done ? '✓' : index + 1 }}</span>
  </div>
</template>

<script setup>
defineProps({
  entry: { type: Object, required: true },
  index: { type: Number, required: true },
})
</script>
