<template>
  <div class="hf-ge">
    <ul v-if="items.length" class="hf-ge-items">
      <li v-for="it in items" :key="it.slug">
        <RouterLink :to="{ name: 'item', params: { slug: it.slug } }" @click="track('home_ge_band', { target: 'item' })">
          <img :src="itemImage(it.icon, it.name)" alt="" width="28" height="28" loading="lazy" @error="hide" />
          <span><b>{{ it.name }}</b><small>{{ gpText(it.price) }} gp</small></span>
        </RouterLink>
      </li>
    </ul>
    <p v-else-if="loaded" class="hf-empty">Live prices are not available right now. The full list is one click away.</p>
    <p v-else class="hf-empty">Loading prices…</p>
    <p class="hf-note">
      Every gp figure in the planners and calculators comes from these prices, after the 2% tax.
      <template v-if="updatedAt">Updated {{ ago(updatedAt) }} from the OSRS Wiki.</template>
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { geApi } from '@/api/ge'
import { gpText, itemImage } from '@/utils/geFormat'
import { ago } from '@/components/admin/stats/statsFormat'
import { track } from '@/utils/analytics'

// A handful of live Grand Exchange prices for the welcome page's preview, as proof that the planners run on real prices. Too few
// prices (or none) shows a short note instead of a half-empty list.
const NAMES = ['Abyssal whip', 'Dragon bones', 'Shark', 'Nature rune', 'Magic logs', 'Ranarr weed']
const items = ref([])
const updatedAt = ref(null)
const loaded = ref(false)

const hide = (e) => {
  e.target.style.visibility = 'hidden'
}

onMounted(async () => {
  try {
    const res = await geApi.prices(NAMES)
    const out = []
    for (const name of NAMES) {
      const p = res.prices?.[name.toLowerCase()]
      if (!p || !p[2]) continue
      const price = p[0] != null && p[1] != null ? Math.round((p[0] + p[1]) / 2) : (p[0] ?? p[1])
      if (price != null) out.push({ name, slug: p[2], icon: p[3] || '', price })
    }
    items.value = out.length >= 3 ? out : []
    updatedAt.value = res.updatedAt || null
  } catch {
    items.value = []
  } finally {
    loaded.value = true
  }
})
</script>
