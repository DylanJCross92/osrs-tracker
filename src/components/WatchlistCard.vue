<template>
  <section class="wl" :aria-labelledby="`wl-${variant}`">
    <header class="wl-head">
      <h2 :id="`wl-${variant}`"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z" /></svg>Your watchlist<small>{{ rows.length }}</small></h2>
      <RouterLink v-if="variant === 'dash'" class="wl-more" :to="{ name: 'items' }">GE prices →</RouterLink>
    </header>
    <ul class="wl-list">
      <li v-for="r in rows" :key="r.id">
        <RouterLink class="wl-item" :to="{ name: 'item', params: { slug: r.slug } }" @click="onItemLinkClick($event, r.slug, 'watchlist')">
          <img :src="itemImage(r.icon, r.name)" alt="" width="28" height="28" loading="lazy" @error="hideImage" />
          <span class="wl-name"><b>{{ r.name }}</b><small>{{ r.price == null ? 'no price yet' : `${gpText(r.price)} gp` }}</small></span>
          <span class="wl-chg">
            <span v-if="r.change1 != null" class="gxt-pill" :class="r.change1 > 0 ? 'up' : r.change1 < 0 ? 'down' : 'flat'">{{ pctText(r.change1) }}</span>
            <small v-if="r.change7 != null" :class="changeClass(r.change7)">7d {{ pctText(r.change7) }}</small>
          </span>
        </RouterLink>
        <button type="button" class="wl-x" :aria-label="`Stop watching ${r.name}`" title="Stop watching" @click="remove(r.slug, variant)">×</button>
      </li>
    </ul>
    <p v-if="!loggedIn" class="wl-note">Saved in this browser. <RouterLink :to="{ name: 'login', query: { next: '/' } }">Log in</RouterLink> to keep it on every device.</p>
  </section>
</template>

<script setup>
import { changeClass, gpText, itemImage, pctText } from '@/utils/geFormat'
import { useAuth } from '@/composables/useAuth'
import { onItemLinkClick } from '@/composables/useItemModal'
import { useWatchlist } from '@/composables/useWatchlist'

// The items someone watches with their price and change. `rows` are item rows (see utils/geFormat.js rowsFromIndex), newest watched first.
defineProps({ rows: { type: Array, required: true }, variant: { type: String, default: 'ge' } })
const { remove } = useWatchlist()
const { loggedIn } = useAuth()
const hideImage = (e) => {
  e.target.style.visibility = 'hidden'
}
</script>
