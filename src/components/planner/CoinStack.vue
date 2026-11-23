<template>
  <span class="coin-stack" aria-hidden="true">
    <img v-for="(c, i) in piles" :key="i" src="/icons/methods/coins_10000.png" alt="" width="30" height="29" :style="{ left: c.x + 'px', top: c.y + 'px' }" />
  </span>
</template>

<script setup>
import { computed } from 'vue'

// Gold the way the game draws it: the in-game coin stack picture, piled up. The bigger the level (1 to 4), the more stacks, back row first.
const props = defineProps({ level: { type: Number, default: 1 } })
const LAYOUTS = {
  1: [{ x: 36, y: 46 }],
  2: [{ x: 18, y: 44 }, { x: 54, y: 44 }],
  3: [{ x: 36, y: 12 }, { x: 18, y: 46 }, { x: 54, y: 46 }],
  4: [{ x: 2, y: 2 }, { x: 36, y: 2 }, { x: 70, y: 2 }, { x: 18, y: 40 }, { x: 54, y: 40 }],
}
const piles = computed(() => LAYOUTS[props.level] || LAYOUTS[1])
</script>
