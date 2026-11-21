<template>
  <span class="pbt" role="group" aria-label="Which Grand Exchange price to use">
    <button type="button" class="pbt-btn" :class="{ on: priceBasis === 'mid' }" :aria-pressed="priceBasis === 'mid'" title="The middle of the latest buy and sell price" @click="setPriceBasis('mid')">Middle price</button>
    <button type="button" class="pbt-btn" :class="{ on: priceBasis === 'instant' }" :aria-pressed="priceBasis === 'instant'" title="Pay the instant buy price and get the instant sell price, the cost of doing it right now" @click="setPriceBasis('instant')">Instant buy and sell</button>
  </span>
</template>

<script setup>
import { priceBasis, setPriceBasis } from '@/utils/priceBook'

// Chooses which Grand Exchange price every gp figure on the planners and calculators uses (see utils/priceBook.js).
</script>
