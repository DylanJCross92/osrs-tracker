<template>
  <RouterLink class="gpb" :class="state" :to="{ name: 'items' }" :title="title">
    <i class="gpb-dot" aria-hidden="true" />
    <span v-if="state === 'is-live'"><b>Live Grand Exchange prices</b><small v-if="updatedAt"> · updated {{ ago(updatedAt) }}</small></span>
    <span v-else-if="state === 'is-stale'"><b>Grand Exchange prices</b><small> · a little behind right now</small></span>
    <span v-else><b>Saved price estimates</b><small> · live prices are loading</small></span>
  </RouterLink>
</template>

<script setup>
import { computed } from 'vue'
import { priceStatus } from '@/utils/priceBook'
import { ago } from '@/components/admin/stats/statsFormat'

// A small badge saying whether the gp figures beside it come from live Grand Exchange prices (and how fresh they are) or from the saved ones.
const updatedAt = computed(() => priceStatus.value.updatedAt)
const state = computed(() => (!priceStatus.value.loaded ? 'is-saved' : priceStatus.value.stale ? 'is-stale' : 'is-live'))
const title = computed(() => (state.value === 'is-live' ? 'Prices come from the OSRS Wiki real-time Grand Exchange prices, refreshed every few minutes. Open the GE prices page.' : 'Open the GE prices page'))
</script>
