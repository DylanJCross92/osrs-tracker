<template>
  <div v-if="rows.length" class="gxk" aria-label="The busiest items right now">
    <div class="gxk-track">
      <ul v-for="copy in 2" :key="copy" class="gxk-set" :aria-hidden="copy === 2 ? 'true' : undefined">
        <li v-for="r in rows" :key="r.id">
          <RouterLink :to="{ name: 'item', params: { slug: r.slug } }" :tabindex="copy === 2 ? -1 : undefined">
            <img :src="itemImage('', r.name)" alt="" width="20" height="20" loading="lazy" @error="hideImage" />
            <b>{{ r.name }}</b>
            <span>{{ gpText(r.price) }}</span>
            <em :class="changeClass(r.change1)">{{ r.change1 == null ? '' : r.change1 > 0 ? '▲' : r.change1 < 0 ? '▼' : '' }} {{ r.change1 == null ? '' : `${Math.abs(r.change1)}%` }}</em>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { changeClass, gpText, itemImage } from '@/utils/geFormat'

defineProps({ rows: { type: Array, required: true } })

const hideImage = (e) => {
  e.target.style.visibility = 'hidden'
}
</script>
