<template>
  <section class="gxt" :class="`is-${kind}`" :aria-labelledby="`gxt-${kind}`">
    <header class="gxt-head">
      <span class="gxt-ico" aria-hidden="true">
        <svg v-if="kind === 'rise'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>
        <svg v-else-if="kind === 'fall'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6 6 4-4 8 9" /><path d="M15 18h6v-6" /></svg>
        <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>
      </span>
      <div>
        <h3 :id="`gxt-${kind}`">{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
    </header>
    <ol v-if="rows.length" class="gxt-list">
      <li v-for="(r, i) in rows" :key="`${period}-${r.id}`" :style="{ '--i': i }">
        <RouterLink :to="{ name: 'item', params: { slug: r.slug } }" :class="{ 'is-top': i === 0 }" @click="$emit('open', r)">
          <span class="gxt-rank">{{ i + 1 }}</span>
          <img :src="itemImage(r.icon, r.name)" alt="" :width="i === 0 ? 36 : 28" :height="i === 0 ? 36 : 28" loading="lazy" @error="hideImage" />
          <span class="gxt-name"><b>{{ r.name }}</b><small>{{ gpText(r.price) }} gp</small></span>
          <span class="gxt-pill" :class="metric(r).tone">{{ metric(r).text }}</span>
        </RouterLink>
      </li>
    </ol>
    <p v-else class="gxt-empty">Nothing stands out here yet. Check back soon.</p>
  </section>
</template>

<script setup>
import { gpText, itemImage } from '@/utils/geFormat'

// kind: rise, fall or traded. metric(row) gives the pill on the right: { text, tone } with tone up, down or flat.
defineProps({
  kind: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  rows: { type: Array, required: true },
  metric: { type: Function, required: true },
  // Changes when the view switches, so the rows animate in again.
  period: { type: String, default: '' },
})
defineEmits(['open'])

const hideImage = (e) => {
  e.target.style.visibility = 'hidden'
}
</script>
