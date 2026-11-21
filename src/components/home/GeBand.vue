<template>
  <section v-if="items.length" class="geb card" aria-labelledby="geb-title">
    <div class="geb-copy">
      <span class="geb-eyebrow"><i class="gpb-dot" aria-hidden="true" />Live Grand Exchange prices</span>
      <h2 id="geb-title">Plans built on today's real prices</h2>
      <p>Every gp figure in the planners and calculators comes from live Grand Exchange prices, after the 2% tax, and refreshes every few minutes. Or just look up any of 4,500 items and its price history.</p>
      <div class="geb-actions">
        <RouterLink :to="{ name: 'items' }" class="btn btn-primary" @click="track('home_ge_band', { target: 'prices' })">Browse GE prices</RouterLink>
        <RouterLink :to="{ name: 'planner' }" class="btn btn-ghost" @click="track('home_ge_band', { target: 'planner' })">See it in the planner</RouterLink>
      </div>
    </div>
    <div class="geb-items">
      <ul>
        <li v-for="it in items" :key="it.slug">
          <RouterLink :to="{ name: 'item', params: { slug: it.slug } }" @click="track('home_ge_band', { target: 'item' })">
            <img :src="itemImage(it.icon, it.name)" alt="" width="28" height="28" loading="lazy" @error="hide" />
            <span><b>{{ it.name }}</b><small>{{ gpText(it.price) }} gp</small></span>
          </RouterLink>
        </li>
      </ul>
      <p v-if="updatedAt" class="geb-note">Updated {{ ago(updatedAt) }} from the OSRS Wiki</p>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { geApi } from '@/api/ge'
import { gpText, itemImage } from '@/utils/geFormat'
import { ago } from '@/components/admin/stats/statsFormat'
import { track } from '@/utils/analytics'

// A short, quiet band on the welcome page: what the Grand Exchange pages are and that the planners and calculators use them, with a few
// live prices as proof. It stays hidden if the prices cannot be loaded.
const NAMES = ['Abyssal whip', 'Dragon bones', 'Shark', 'Nature rune', 'Magic logs', 'Ranarr weed']
const items = ref([])
const updatedAt = ref(null)

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
  }
})
</script>
