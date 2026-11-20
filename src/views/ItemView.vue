<template>
  <div class="gx">
    <RouterLink :to="{ name: 'items' }" class="gxi-back">← GE Prices</RouterLink>
    <ItemDetail :slug="slug" variant="page" @loaded="onLoaded" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ItemDetail from '@/components/ItemDetail.vue'
import { gpText } from '@/utils/geFormat'
import { setPageMeta } from '@/utils/pageMeta'

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))

function onLoaded(res) {
  setPageMeta({
    title: `${res.name} Price (OSRS GE)`,
    description: `${res.name} Grand Exchange price: ${gpText(res.price)} gp${res.limit ? `, buy limit ${res.limit.toLocaleString('en-US')}` : ''}. Live OSRS price, history and flipping margin after tax.`,
    path: `/items/${res.slug}`,
  })
}
</script>
