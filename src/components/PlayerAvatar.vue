<template>
  <svg class="pavatar" viewBox="0 0 7 7" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" :style="{ background: `linear-gradient(145deg, ${art.palette.bg1}, ${art.palette.bg2})` }" aria-hidden="true" focusable="false">
    <rect v-for="c in art.cells" :key="`${c.x}-${c.y}`" :x="c.x" :y="c.y" width="1" height="1" :fill="art.palette.fg" :opacity="c.o" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { avatarFor } from '@/utils/avatar'

// Fills whatever frame it is placed in (the frame supplies the size, border and rounding).
const props = defineProps({ name: { type: String, default: '' } })
const art = computed(() => avatarFor(props.name))
</script>
